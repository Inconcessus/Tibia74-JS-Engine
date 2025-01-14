const Player = function (data) {
  /*
   * Function Player
   * Container for the gameclient player character
   *
   * API:
   *
   *
   */

  // Inherit from creature
  Creature.call(this, data);

  this.type = 0;
  this.setState(data);

  // Players have equipment
  this.equipment = new Equipment(data.equipment);
  this.spellbook = new Spellbook(data.spellbook);

  // Private state for the player
  this.__movementEvent = null;
  this.__movementBuffer = null;
  this.__openedContainers = new Set();

  // Can only work again if the server has confirmed
  this.__serverWalkConfirmation = true;

  // Container for the players friendlist
  this.friendlist = new Friendlist(data.friendlist);
};

Player.prototype = Object.create(Creature.prototype);
Player.prototype.constructor = Player;

Player.prototype.getSpeed = function () {
  let base = this.state.speed;

  if (this.hasCondition(ConditionManager.prototype.HASTE)) {
    base *= 1.3;
  }

  return base;
};

Player.prototype.getStepDuration = function (tile) {
  /*
   * Function Creature.getStepDuration
   * Math to calcualte the amount of frames to lock when walking (50MS tick)
   * See: https://tibia.fandom.com/wiki/Speed_Breakpoints
   */

  const A = 857.36;
  const B = 261.29;
  const C = -4795.009;

  let calculatedStepSpeed = Math.max(
    1,
    Math.round(A * Math.log(this.getSpeed() + B) + C)
  );

  // Friction of the tile
  let groundSpeed = tile.getFriction();

  return Math.ceil(
    Math.floor((1000 * groundSpeed) / calculatedStepSpeed) /
      gameClient.getTickInterval()
  );
};

Player.prototype.getTile = function () {
  /*
   * Function Player.getTile
   * Returns the tile that the player is currently on
   */

  return gameClient.world.getTileFromWorldPosition(this.__position);
};

Player.prototype.getMaxFloor = function () {
  /*
   * Function Player.getMaxFloor
   * Returns the maximum visible floor for the player: used for rendering
   */

  return gameClient.world
    .getChunkFromWorldPosition(this.getPosition())
    .getFirstFloorFromBottom(this.getPosition());
};

Player.prototype.setCapacity = function (value) {
  /*
   * Function Player.setCapacity
   * Sets the capacity of the respective player
   */

  // Keep the DOM in sync
  document.getElementById("player-capacity").innerHTML = "Cap: <br> %s".format(
    Math.round(value / 100)
  );
};

Player.prototype.setState = function (data) {
  /*
   * Function Player.setState
   * Sets the mana status to the DOM
   */

  // Keep player state
  this.skills = new Skills(data.skills);
  this.mounts = data.mounts;
  this.outfits = data.outfits;

  // Capacity
  this.state.add("capacity", this.setCapacity.bind(this));

  // Other skills
  this.state.add("armor", this.setLevelSkillValue.bind(this, "armor"));
  this.state.add("attack", this.setLevelSkillValue.bind(this, "attack"));
  this.state.add("speed", this.setLevelSkillValue.bind(this, "speed"));

  // Set defaults
  this.state.maxCapacity = data.maxCapacity;
  this.state.capacity = data.capacity;
  this.state.health = data.health;
  this.state.speed = data.speed;
  this.state.armor = 0;
  this.state.attack = 0;
};

Player.prototype.setLevelSkillValue = function (which, value) {
  /*
   * Function Player.setLevelSkillValue
   * Returns the percentage required to level up
   */

  gameClient.interface.windowManager
    .getWindow("skill-window")
    .setSkillValue(which, value);
};

Player.prototype.setBarStatus = function (bar) {
  /*
   * Function Player.setBarStatus
   * Sets the mana status to the DOM
   */

  let percentage = this.getHealthPercentage().clamp(0, 100);

  bar.firstElementChild.style.width = percentage + "%";
  bar.lastElementChild.innerHTML = percentage + "%";
};

Player.prototype.setManaStatus = function () {
  /*
   * Function Player.setManaStatus
   * Sets the mana status to the DOM
   */

  this.setBarStatus(document.getElementById("mana-bar"));
};

Player.prototype.setHealthStatus = function () {
  /*
   * Function Player.setHealthStatus
   * Sets the health status to the DOM where required
   */

  // The health bar on the side
  this.setBarStatus(document.getElementById("health-bar"));

  // Gamescreen
  this.characterElement.setDefault();
};

Player.prototype.setAmbientSound = function () {
  /*
   * Player.setAmbientSound
   * Sets the ambient soundtrack
   */

  if (this.isUnderground()) {
    gameClient.interface.soundManager.setAmbientTrace("cave");
    gameClient.interface.soundManager.setVolume("rain", 0);
  } else {
    gameClient.interface.soundManager.setAmbientTrace("forest");

    if (gameClient.renderer.weatherCanvas.isRaining()) {
      gameClient.interface.soundManager.setVolume("rain", 1);
    }
  }
};

Player.prototype.isUnderground = function () {
  /*
   * Function Player.isUnderground
   * Returns true if  the player is underground
   */

  return this.getPosition().z < 8;
};

Player.prototype.setMovementBuffer = function (key) {
  /*
   * Function Player.setMovementBuffer
   * Functions to overwrite the private movement buffer state variable
   */

  this.__movementBuffer = key;
};

Player.prototype.extendMovementBuffer = function (key) {
  /*
   * Function Player.setMovementBuffer
   * Sets the movement buffer of the player to a key
   */

  // This parameter defines the responsiveness of the buffer
  const LENIENCY = 0.75;

  if (this.getMovingFraction() < LENIENCY) {
    return this.setMovementBuffer(key);
  }
};

Player.prototype.confirmClientWalk = function () {
  /*
   * Function Player.confirmClientWalk
   * Confirms the client-side walk-ahead. The player may only walk again after the server has confirmed its move
   */

  if (this.__serverWalkConfirmation) {
    gameClient.renderer.updateTileCache();
  }

  this.__serverWalkConfirmation = true;
};

Player.prototype.isCreatureTarget = function (creature) {
  /*
   * Function Player.isCreatureTarget
   * Returns true is the creature is the current target
   */

  return this.__target === creature;
};

Player.prototype.addExperience = function (experience) {
  /*
   * Function Player.addExperience
   * Adds experience points to the player
   */

  return;
};

Player.prototype.isInProtectionZone = function () {
  return this.getTile().isProtectionZone();
};

Player.prototype.setTarget = function (creature) {
  /*
   * Function Player.setTarget
   * Sets target
   */

  this.__target = creature;
  gameClient.interface.windowManager
    .getWindow("battle-window")
    .setTarget(creature);
};

Player.prototype.openContainer = function (container) {
  /*
   * Function Player.openContainer
   * Opens a container
   */

  this.__openedContainers.add(container);
};

Player.prototype.getItem = function (containerId, slotId) {
  /*
   * Function Player.getItem
   * Returns the carried item from a container and slot index
   */

  let container = this.getContainer(containerId);

  if (container === null) {
    return null;
  }

  return container.getSlotItem(slotId);
};

Player.prototype.getContainer = function (id) {
  /*
   * Function Player.getContainer
   * Returns the container based on the identifier
   */

  // Container identifier 0 refers to the players own equipment
  if (id === 0x00) {
    return this.equipment;
  }

  // Linear direct search for the correct container
  let containers = Array.from(this.__openedContainers);

  for (let i = 0; i < containers.length; i++) {
    if (containers[i].__containerId === id) {
      return containers[i];
    }
  }

  return null;
};

Player.prototype.closeAllContainers = function () {
  /*
   * Function Player.closeAllContainers
   * Cleanup function to close all containers
   */

  this.__openedContainers.forEach(function (container) {
    this.removeContainer(container);
  }, this);
};

Player.prototype.removeContainer = function (container) {
  /*
   * Function Player.removeContainer
   * Removes a container from the DOM
   */

  // Remove the reference from the player
  this.__openedContainers.delete(container);

  // Clean up the element from the DOM
  container.window.remove();
};

Player.prototype.closeContainer = function (container) {
  /*
   * Function Player.closeContainer
   * Closes the container and removes it from the graphical user interface
   */

  gameClient.send(new ContainerClosePacket(container.____containerId));
};

Player.prototype.setTurnBuffer = function (direction) {
  /*
   * Function Player.setTurnBuffer
   * Sets the direction of the player to a new direction
   */

  // If moving update the buffer to be updated when player stops moving
  if (this.isMoving()) {
    return (this.__lookDirectionBuffer = direction);
  }

  // Update the look direction
  this.__setLookDirection(direction);
};

Player.prototype.__setLookDirection = function (direction) {
  /*
   * Function Player.__setLookDirection
   * Sets the direction of the player to a new direction
   */

  this.__lookDirection = direction;
};
