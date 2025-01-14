const Keyboard = function () {
  /*
   * Class Keyboard
   * Container for keyboard interaction with the game and interface
   *
   * API:
   *
   * Keyboard.isShiftDown() - returns true if shift is pressed
   * Keyboard.isControlDown() - returns true if control is pressed
   * Keyboard.handleInput() - Called every frame to handle the keyboard input
   * Keyboard.handleCharacterMovement() - Handles moving of character
   * Keyboard.setInactive() - Sets the keyboard to inactive by clearing the active keys
   *
   */

  // Add two listeners to up & down: the state is saved and checked every frame
  document.addEventListener("keydown", this.__keyDown.bind(this));
  document.addEventListener("keyup", this.__keyUp.bind(this));

  // An object that contains the actively pressed keys
  this.__activeKeys = new Set();
};

// Configured keys with actions
Keyboard.prototype.KEYS = new Object({
  TAB: 9,
  ENTER_KEY: 13,
  SHIFT_KEY: 16,
  CONTROL_KEY: 17,
  ESC: 27,
  SPACE_BAR: 32,
  KEYPAD_9: 33,
  KEYPAD_3: 34,
  KEYPAD_1: 35,
  KEYPAD_7: 36,
  LEFT_ARROW: 37,
  UP_ARROW: 38,
  RIGHT_ARROW: 39,
  DOWN_ARROW: 40,
  KEY_A: 65,
  KEY_D: 68,
  KEY_E: 69,
  KEY_L: 76,
  KEY_M: 77,
  KEY_S: 83,
  KEY_W: 87,
  F1: 112,
  F2: 113,
  F3: 114,
  F4: 115,
  F5: 116,
  F6: 117,
  F7: 118,
  F8: 119,
  F9: 120,
  F10: 121,
  F11: 122,
  F12: 123,
});

Keyboard.prototype.setInactive = function () {
  /*
   * Function Keyboard.setInactive
   * Sets the keyboard to inactive by clearing all the active keys: e.g., when tabbing out holding down a movement key
   */

  return this.__activeKeys.clear();
};

Keyboard.prototype.isShiftDown = function () {
  /*
   * Function Keyboard.isShiftDown
   * Returns true when shift is pressed
   */

  return this.__activeKeys.has(this.KEYS.SHIFT_KEY);
};

Keyboard.prototype.isControlDown = function () {
  /*
   * Function Keyboard.isControlDown
   * Returns true when control is pressed
   */

  return this.__activeKeys.has(this.KEYS.CONTROL_KEY);
};

Keyboard.prototype.handleInput = function () {
  /*
   * Function Keyboard.handleInput
   * Handles keyboard input on a given frame
   */

  // Go over the active keys
  this.__activeKeys.forEach(function (key) {
    // Cancel pathfinding when any input is given
    gameClient.world.pathfinder.setPathfindCache(null);

    // Must have confirmation from the server before moving to the next tile is allowed
    if (!gameClient.player.__serverWalkConfirmation) {
      return;
    }

    key = Number(key);

    // Block keyboard input when the character is moving or when the server has not confirmed movement
    if (gameClient.player.isMoving()) {
      return gameClient.player.extendMovementBuffer(key);
    }

    // Shift is being held down: rotate
    if (this.isShiftDown()) {
      return this.__handleCharacterRotate(key);
    }

    // Ctrl está sendo pressionado: rotacionar
    if (this.isControlDown()) {
      return this.__handleCharacterRotate(key);
    }

    // Otherwise move the character
    this.handleCharacterMovement(key);
  }, this);
};

Keyboard.prototype.handleCharacterMovement = function (key) {
  /*
   * Function Keyboard.__handleCharacterRotate
   * Handles keyboard input to move the character
   */

  // Shorthand
  let position = gameClient.player.getPosition();

  // Write the correct identifier to the server and make the player pre-walk on the client side
  // Also includes the full keypad for diagonal walking
  switch (key) {
    case this.KEYS.KEYPAD_7:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.NORTHWEST,
        position.northwest()
      );
    case this.KEYS.KEYPAD_9:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.NORTHEAST,
        position.northeast()
      );
    case this.KEYS.KEYPAD_1:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.SOUTHWEST,
        position.southwest()
      );
    case this.KEYS.KEYPAD_3:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.SOUTHEAST,
        position.southeast()
      );
    case this.KEYS.LEFT_ARROW:
    case this.KEYS.KEY_A:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.WEST,
        position.west()
      );
    case this.KEYS.UP_ARROW:
    case this.KEYS.KEY_W:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.NORTH,
        position.north()
      );
    case this.KEYS.RIGHT_ARROW:
    case this.KEYS.KEY_D:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.EAST,
        position.east()
      );
    case this.KEYS.DOWN_ARROW:
    case this.KEYS.KEY_S:
      return this.__handleCharacterMovementWrapper(
        CONST.DIRECTION.SOUTH,
        position.south()
      );
  }
};

Keyboard.prototype.__handleCharacterRotate = function (key) {
  /*
   * Function Keyboard.__handleCharacterRotate
   * Handles keyboard input to rotate the character
   */

  switch (key) {
    case this.KEYS.LEFT_ARROW:
    case this.KEYS.KEY_A:
      return this.__setTurn(CONST.DIRECTION.WEST);
    case this.KEYS.UP_ARROW:
    case this.KEYS.KEY_W:
      return this.__setTurn(CONST.DIRECTION.NORTH);
    case this.KEYS.RIGHT_ARROW:
    case this.KEYS.KEY_D:
      return this.__setTurn(CONST.DIRECTION.EAST);
    case this.KEYS.DOWN_ARROW:
    case this.KEYS.KEY_S:
      return this.__setTurn(CONST.DIRECTION.SOUTH);
  }
};

Keyboard.prototype.__handleCharacterMovementWrapper = function (
  direction,
  position
) {
  /*
   * Function Keyboard.__handleCharacterMovementWrapper
   * Wrapper for movement event to delegate
   */

  // Confirm the movement is possible at all: then send a packet to the server
  if (!gameClient.networkManager.packetHandler.handlePlayerMove(position)) {
    return;
  }

  // Update the tile cache on the client side
  gameClient.renderer.updateTileCache();
  gameClient.interface.modalManager.close();

  gameClient.send(new MovementPacket(direction));
};

Keyboard.prototype.__handleReturnKey = function () {
  /*
   * Function Keyboard.__handleReturnKey
   * Callback event fired when the return key is pressed
   */

  // Enter when modal is opened: handle confirmation
  if (gameClient.interface.modalManager.isOpened()) {
    return gameClient.interface.modalManager.handleConfirm();
  }

  // If not focusing on the chat input element
  if (document.activeElement.id !== "chat-input") {
    return gameClient.interface.channelManager.toggleInputLock();
  }

  // If the input is empty: lock it
  if (document.activeElement.value === "") {
    return gameClient.interface.channelManager.toggleInputLock();
  }

  // Write the message to the server
  return gameClient.interface.channelManager.handleMessageSend();
};

Keyboard.prototype.__handleEscapeKey = function () {
  /*
   * Function Keyboard.__handleEscapeKey
   * Callback event fired when the return key is pressed
   */

  // Modal windows are closed by canceling
  if (gameClient.interface.modalManager.isOpened()) {
    return gameClient.interface.modalManager.close();
  }

  // Close opened menu windows
  if (gameClient.interface.menuManager.isOpened()) {
    return gameClient.interface.menuManager.close();
  }

  // If targeting a creature: cancel this too
  if (gameClient.player && gameClient.player.hasTarget()) {
    gameClient.player.setTarget(null);
    gameClient.send(new TargetPacket(0));
  }

  // Delete the local pathfinding cache
  gameClient.world.pathfinder.setPathfindCache(null);
};

Keyboard.prototype.__setTurn = function (direction) {
  /*
   * Function Keyboard.__setTurn
   * Turns the player and informs the server too
   */

  // Already facing this direction: do nothing
  if (gameClient.player.getLookDirection() === direction) {
    return;
  }

  gameClient.player.setTurnBuffer(direction);
  gameClient.send(new PlayerTurnPacket(direction));
};

Keyboard.prototype.__keyDown = function (event) {
  /*
   * Function Keyboard.__keyDown
   * Callback event fired when key is pressed
   */

  // The key is not configured with an action: block the action
  if (!this.__isConfigured(event.keyCode)) {
    return;
  }

  // Immediately resolve
  if (event.keyCode === Keyboard.prototype.KEYS.ENTER_KEY) {
    return this.__handleReturnKey();
  }

  if (event.keyCode === Keyboard.prototype.KEYS.KEY_L) {
    if (this.isControlDown()) {
      return gameClient.interface.sendLogout();
    }
  }

  // Open large world map
  if (event.keyCode === Keyboard.prototype.KEYS.KEY_M) {
    if (this.isControlDown()) {
      event.preventDefault();
      gameClient.renderer.minimap.openLargeMap();
    }
  }

  // Shortcut for
  if (event.keyCode === Keyboard.prototype.KEYS.KEY_E) {
    if (this.isControlDown()) {
      event.preventDefault();
      gameClient.interface.channelManager.closeCurrentChannel();
    }
  }

  // Update cursors
  if (event.keyCode === Keyboard.prototype.KEYS.SHIFT_KEY) {
    this.__activeKeys.add(event.keyCode);
    gameClient.mouse.setCursor("zoom-in");
  }

  if (event.keyCode === Keyboard.prototype.KEYS.CONTROL_KEY) {
    this.__activeKeys.add(event.keyCode);
    gameClient.mouse.setCursor("pointer");
  }

  // Escape key
  if (event.keyCode === Keyboard.prototype.KEYS.ESC) {
    return this.__handleEscapeKey();
  }

  if (event.keyCode >= this.KEYS.F1 && event.keyCode <= this.KEYS.F12) {
    event.preventDefault();

    if (this.isControlDown()) {
      if (event.keyCode === Keyboard.prototype.KEYS.F8) {
        return gameClient.renderer.debugger.toggleStatistics();
      }
      if (event.keyCode === Keyboard.prototype.KEYS.F12) {
        return gameClient.renderer.takeScreenshot(event);
      }
    }

    return gameClient.interface.hotbarManager.handleKeyPress(event.keyCode);
  }

  // Tab key for switching channels
  if (event.keyCode === Keyboard.prototype.KEYS.TAB) {
    if (gameClient.isConnected()) {
      event.preventDefault();
      return gameClient.interface.channelManager.handleChannelIncrement(1);
    }
  }

  // Other key inputs are blocked when the modal manager is opened
  if (gameClient.interface.modalManager.isOpened()) {
    return;
  }

  // Must focus on the main game body (i.e., the game screen)
  if (document.activeElement !== document.body) {
    return this.__handleKeyType(event.keyCode);
  }

  // Otherwise set the key activity to true
  this.__activeKeys.add(event.keyCode);
};

Keyboard.prototype.__handleKeyType = function (key) {
  /*
   * Function Keyboard.__handleKeyType
   * Handles the key type
   */

  // If shift is down repeat the previous message
  if (this.isShiftDown()) {
    if (key === Keyboard.prototype.KEYS.UP_ARROW) {
      gameClient.interface.channelManager.suggestPrevious();
    }
  }
};

Keyboard.prototype.__isConfigured = function (key) {
  /*
   * Function Keyboard.__isConfigured
   * Returns whether a key is supported by the client
   */

  // Check the object
  return Object.values(this.KEYS).includes(key);
};

Keyboard.prototype.__keyUp = function (event) {
  /*
   * Function Keyboard.__keyUp
   * Callback event fired when key is released
   */

  // Not configured: return
  if (!this.__isConfigured(event.keyCode)) {
    return;
  }

  if (
    event.keyCode === Keyboard.prototype.KEYS.SHIFT_KEY ||
    event.keyCode === Keyboard.prototype.KEYS.CONTROL_KEY
  ) {
    if (gameClient.mouse.__multiUseObject === null) {
      gameClient.mouse.setCursor("auto");
    }
  }

  this.__activeKeys.delete(event.keyCode);
};
