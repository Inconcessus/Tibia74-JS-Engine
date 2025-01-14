"use strict";

const GenericLock = requireModule("generic-lock");

const PlayerMovementHandler = function (player) {
  /*
   * Class PlayerMovementHandler
   * Handler for movement of the player
   */

  // Reference the parent
  this.__player = player;

  // Create a generic lock for movement
  this.__moveLock = new GenericLock();
  this.__moveLock.on("unlock", this.__unlockMovementAction.bind(this));

  // The buffer if more consecutive inputs are given by the client
  this.__clientMoveBuffer = null;
};

PlayerMovementHandler.prototype.isMoving = function () {
  /*
   * Function PlayerMovementHandler.isMoving
   * Returns true if the creature is moving and does not have the move action available
   */

  return this.__moveLock.isLocked();
};

PlayerMovementHandler.prototype.handleMovement = function (direction) {
  /*
   * Function PlayerMovementHandler.prototype.handleMovement
   * Callback fired when a particular function is unlocked
   */

  // If the player has its move action locked: set the movement buffer
  if (this.isMoving()) {
    return this.__setMoveBuffer(direction);
  }

  let position = this.__player
    .getPosition()
    .getPositionFromDirection(direction);

  // Move the dude
  let tile = gameServer.world.getTileFromWorldPosition(position);

  let stepDuration =
    tile === null || tile.id === 0
      ? 10
      : this.__player.getStepDuration(tile.getFriction());

  // Lock movement action
  this.__moveLock.lock(stepDuration);

  // Move the player by walking!
  let success = gameServer.world.creatureHandler.moveCreature(
    this.__player,
    position
  );

  // Not succesful: teleport to the current position
  if (!success) {
    gameServer.world.creatureHandler.teleportCreature(
      this.__player,
      this.__player.position
    );
  }
};

PlayerMovementHandler.prototype.__unlockMovementAction = function (action) {
  /*
   * Function Player.__unlockMovementAction
   * Callback fired when a particular function is unlocked
   */

  // Movement buffer actions must have special handling
  if (this.__clientMoveBuffer === null) {
    return;
  }

  this.handleMovement(this.__clientMoveBuffer);

  // Clear the buffer
  this.__setMoveBuffer(null);
};

PlayerMovementHandler.prototype.__setMoveBuffer = function (direction) {
  /*
   * Function Player.__setMoveBuffer
   * Updates the server-side movement buffer of the player
   */

  // Sets the server side move buffer
  this.__clientMoveBuffer = direction;
};

module.exports = PlayerMovementHandler;
