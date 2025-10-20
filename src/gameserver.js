"use strict";

const Database = requireModule("database");
const Enum = requireModule("enum");
const GameLoop = requireModule("gameloop");
const HTTPServer = requireModule("http-server");
const IPCSocket = requireModule("ipcsocket");

const GameServer = function() {

  /*
   * Class GameServer
   *
   * Main container for the Tibia HTML5 Gameserver
   *
   * GameServer API:
   *
   * GameServer.initialize() - Returns true if the internal tick counter is a multiple of the passed modulus.
   * GameServer.loop() - Returns true if a player with a particular name is online
   *
   */

  // Signal interrupt received: gracefully shut down server
  process.on("SIGINT", this.scheduleShutdown.bind(this, CONFIG.SERVER.MS_SHUTDOWN_SCHEDULE));
  process.on("SIGTERM", this.scheduleShutdown.bind(this, CONFIG.SERVER.MS_SHUTDOWN_SCHEDULE));

  // Connect to the information database that keeps all the server data
  this.database = new Database();

  // Create the game loop with an interval and callback function
  this.gameLoop = new GameLoop(
    CONFIG.SERVER.MS_TICK_INTERVAL,
    this.__loop.bind(this)
  );

  // Open the server for HTTP connections
  this.HTTPServer = new HTTPServer(
    CONFIG.SERVER.HOST,
    CONFIG.SERVER.PORT
  );

  // The IPC socket for communicating with the server
  this.IPCSocket = new IPCSocket();

  // State variables to keep the current server status
  this.__serverStatus = null;
  this.__initialized = null;

}

// Game server status
GameServer.prototype.STATUS = new Enum(
  "OPEN",
  "OPENING",
  "CLOSING",
  "CLOSED"
);

GameServer.prototype.isShutdown = function() {

  /*
   * Function GameServer.isShutdown
   * Returns true if the status of the gameserver is closing
   */

  return this.__serverStatus === this.STATUS.CLOSING;

}

GameServer.prototype.initialize = function() {

  /*
   * Function GameServer.initialize
   * Initializes the game server and starts the internal game loop
   */

  // State variable to keep the current server status
  this.__serverStatus = this.STATUS.OPEN;

  // When the server was started
  this.__initialized = Date.now();

  // Database
  this.database.initialize();

  // Start the gameloop
  this.gameLoop.initialize();

  // Listen for incoming connections
  this.HTTPServer.listen();

}

GameServer.prototype.setServerStatus = function(serverStatus) {

  /*
   * Function GameServer.setServerStatus
   * Sets the server status to one the available server statuses
   */

  this.__serverStatus = serverStatus;

}

GameServer.prototype.shutdown = function() {

  /*
   * Function GameServer.shutdown
   * Shuts down the game server and disconnects all clients
   */

  // Inform operator
  console.log("The game server is shutting down.");

  this.setServerStatus(this.STATUS.CLOSED);

  // Close the HTTP server
  this.HTTPServer.close();

  // Close IPC socket
  this.IPCSocket.close();

}

GameServer.prototype.isFeatureEnabled = function() {

  /*
   * Function GameServer.isFeatureEnabled
   * Implement different version features here..
   */

  CONFIG.SERVER.CLIENT_VERSION > 1000;

}

GameServer.prototype.scheduleShutdown = function(seconds) {

  /*
   * Function GameServer.scheduleShutdown
   * Schedules the server to shutdown in a configured time
   */

  // The server is already shutting down
  if(this.__serverStatus === this.STATUS.CLOSING) {
    return console.log("Shutdown command refused because the server is already shutting down.");
  }

  // Update the server status
  this.setServerStatus(this.STATUS.CLOSING);

  // Write to all connected sockets
  this.world.broadcastMessage("The gameserver is closing in %s seconds. Please log out in a safe place.".format(Math.floor(1E-3 * seconds)));

  // Use the timeout function not the event queue
  setTimeout(this.shutdown.bind(this), seconds);

}

GameServer.prototype.__loop = function() {

  /*
   * Function GameServer.__loop
   * Callback function fired every time a server tick happens
   */

  // Handle the input / output buffers for all connected clients
  this.HTTPServer.websocketServer.socketHandler.flushSocketBuffers();

  // Complete a tick in the world
  this.world.tick();

}

GameServer.prototype.isClosed = function() {

  /*
   * Function GameServer.isClosed
   * Returns true if the status of the gameserver is closed
   */

  return this.__serverStatus === this.STATUS.CLOSED;

}

GameServer.prototype.__handleUncaughtException = function(error, origin) {

  /*
   * Function GameServer.__handleUncaughtException
   * Handles an uncaught exception in the server
   */

  // Shut the server down
  this.shutdown();

}

module.exports = GameServer;
