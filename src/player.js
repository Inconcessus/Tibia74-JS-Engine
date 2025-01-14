"use strict";

const Condition = requireModule("condition");
const Creature = requireModule("creature");
const ContainerManager = requireModule("container-manager");
const Friendlist = requireModule("friendlist.js");
const PacketReader = requireModule("packet-reader");
const Spellbook = requireModule("spellbook");

const PlayerIdleHandler = requireModule("player-idle-handler");
const CharacterProperties = requireModule("player-properties");
const SocketHandler = requireModule("player-socket-handler");
const PlayerMovementHandler = requireModule("player-movement-handler");
const ChannelManager = requireModule("player-channel-manager");
const CombatLock = requireModule("player-combat-lock");
const ActionHandler = requireModule("player-action-handler");
const UseHandler = requireModule("player-use-handler");
const Skills = requireModule("skills");
const Position = requireModule("position");

const {
  EmotePacket,
  ContainerClosePacket,
  ContainerOpenPacket,
  CancelMessagePacket,
  CreatureStatePacket,
} = requireModule("protocol");

const Player = function (data) {
  /*
   * Class Player
   * Wrapper for a playable character
   *
   * API:
   *
   * Player.isInCombat - Returns true if the player is or has recently been in combat
   *
   *
   */

  // Inherit from Creature class
  Creature.call(this, data.properties);

  this.templePosition = Position.prototype.fromLiteral(data.templePosition);

  // Add the player properties
  this.addPlayerProperties(data.properties);

  // The player skills and experience
  this.skills = new Skills(this, data.skills);

  // Child classes with data for player handlers
  this.socketHandler = new SocketHandler(this);
  this.friendlist = new Friendlist(data.friends);
  this.containerManager = new ContainerManager(this, data.containers);
  this.spellbook = new Spellbook(this, data.spellbook);

  // Non-data handlers
  this.idleHandler = new PlayerIdleHandler(this);
  this.movementHandler = new PlayerMovementHandler(this);
  this.channelManager = new ChannelManager(this);
  this.actionHandler = new ActionHandler(this);
  this.combatLock = new CombatLock(this);
  this.useHandler = new UseHandler(this);

  // Last visited
  this.lastVisit = data.lastVisit;
};

Player.prototype = Object.create(Creature.prototype);
Player.prototype.constructor = Player;

Player.prototype.addPlayerProperties = function (properties) {
  /*
   * Player.addPlayerProperties
   * Adds the properties of the player to the available properties
   */

  // Add these properties
  this.properties.add(CONST.PROPERTIES.MOUNTS, properties.availableMounts);
  this.properties.add(CONST.PROPERTIES.OUTFITS, properties.availableOutfits);
  this.properties.add(CONST.PROPERTIES.SEX, properties.sex);
  this.properties.add(CONST.PROPERTIES.ROLE, properties.role);
  this.properties.add(CONST.PROPERTIES.VOCATION, properties.vocation);
};

Player.prototype.getTarget = function () {
  return this.actionHandler.targetHandler.getTarget();
};

Player.prototype.getTextColor = function () {
  /*
   * Function Player.getTextColor
   * Returns the text color of the player
   */

  return this.getProperty(CONST.PROPERTIES.ROLE) === CONST.ROLES.ADMIN
    ? CONST.COLOR.RED
    : CONST.COLOR.YELLOW;
};

Player.prototype.getLevel = function () {
  /*
   * Function Player.getLevel
   * Returns the level of the player
   */

  return this.skills.getSkillLevel(CONST.PROPERTIES.EXPERIENCE);
};

Player.prototype.setLevel = function (level) {
  /*
   * Function Player.setLevel
   * Sets the level of a player character
   */

  // Set the level & experience
  this.characterStatistics.skills.setSkillLevel(CONST.SKILL.EXPERIENCE, level);
};

Player.prototype.getExperiencePoints = function () {
  /*
   * Function Player.getExperience
   * Returns the number of experience points a player has
   */

  return this.characterStatistics.skills.getSkillPoints(CONST.SKILL.EXPERIENCE);
};

Player.prototype.think = function () {
  this.actionHandler.actions.handleActions(this.actionHandler);
};

Player.prototype.getVocation = function () {
  /*
   * Function Player.getVocation
   * Returns the vocation of the player
   */

  return this.getProperty(CONST.PROPERTIES.VOCATION);
};

Player.prototype.extendCondition = function (id, ticks, duration) {
  // Does not exist yet?
  if (!this.hasCondition(id)) {
    return this.conditions.add(new Condition(id, ticks, duration), null);
  }

  this.conditions.extendCondition(id, ticks);
};

Player.prototype.isSated = function (ticks) {
  return (
    this.hasCondition(Condition.prototype.SATED) &&
    ticks +
      this.conditions.__conditions.get(Condition.prototype.SATED).numberTicks >
      100
  );
};

Player.prototype.isInvisible = function () {
  return this.hasCondition(Condition.prototype.INVISIBLE);
};

Player.prototype.enterNewChunks = function (newChunks) {
  /*
   * Function Player.enterNewChunk
   * Necessary functions to call when a creature enters a new chunk
   */

  // Get the serialized chunks
  newChunks.forEach((chunk) => chunk.serialize(this));

  newChunks.forEach((chunk) =>
    chunk.internalBroadcast(new CreatureStatePacket(this))
  );
};

Player.prototype.isInNoLogoutZone = function () {
  /*
   * Function Player.isInNoLogoutZone
   * Returns true if the player is in a no-logout zone
   */

  return process.gameServer.world
    .getTileFromWorldPosition(this.position)
    .isNoLogoutZone();
};

Player.prototype.isInProtectionZone = function () {
  /*
   * Function Player.isInProtectionZone
   * Returns true if the player is in a protection zone
   */

  return process.gameServer.world
    .getTileFromWorldPosition(this.position)
    .isProtectionZone();
};

Player.prototype.ownsHouseTile = function (tile) {
  /*
   * Function Player.ownsHouseTile
   * Returns true if the tile is a house tile
   */

  return (
    tile.house.owner === this.name || tile.house.invited.includes(this.name)
  );
};

Player.prototype.isTileOccupied = function (tile) {
  /*
   * Function Player.isTileOccupied
   * Function evaluated for a tile whether it is occupied for the NPC or not
   */

  // If the tile is blocking then definitely
  if (tile.isBlockSolid()) {
    return true;
  }

  // House tile but not owned
  if (tile.isHouseTile() && !this.ownsHouseTile(tile)) {
    this.sendCancelMessage("You do not own this house.");
    return true;
  }

  // The tile items contain a block solid (e.g., a wall)
  if (tile.hasItems() && tile.itemStack.isBlockSolid()) {
    return true;
  }

  // Occupied by other characters
  if (tile.isOccupiedCharacters()) {
    return true;
  }

  return false;
};

Player.prototype.openContainer = function (id, name, baseContainer) {
  /*
   * Function Player.openContainer
   * Opens the base container and writes a packet to the player
   */

  baseContainer.addSpectator(this);

  this.write(new ContainerOpenPacket(id, name, baseContainer));
};

Player.prototype.closeContainer = function (baseContainer) {
  /*
   * Function Player.closeContainer
   * Closes the base container and writes a packet to the player
   */

  baseContainer.removeSpectator(this);

  this.write(new ContainerClosePacket(baseContainer.guid));
};

Player.prototype.isInCombat = function () {
  /*
   * Function Player.isInCombat
   * Return true if the player is currently engaged in combat
   */

  return this.combatLock.isLocked();
};

Player.prototype.isOnline = function () {
  /*
   * Function Player.isOnline
   * Returns true if the player is online and connected to the gameworld
   */

  // Check with the world
  return gameServer.world.creatureHandler.isPlayerOnline(this);
};

Player.prototype.isMoving = function () {
  /*
   * Function Player.isMoving
   * Returns true if the creature is moving and does not have the move action available
   */

  return this.movementHandler.isMoving();
};

Player.prototype.canUseHangable = function (thing) {
  /*
   * Function Player.canNotUseHangable
   * Delegates to the internal function
   */

  return (
    (thing.isHorizontal() && this.position.y >= thing.getPosition().y) ||
    (thing.isVertical() && this.position.x >= thing.getPosition().x)
  );
};

Player.prototype.decreaseHealth = function (source, amount) {
  /*
   * Function Player.decreaseHealth
   * Decreases the health of the player
   */

  // Put the target player in combat
  this.combatLock.activate();

  // Change the property
  this.incrementProperty(CONST.PROPERTIES.HEALTH, -amount);

  // Send damage color to the player
  this.broadcast(new EmotePacket(this, String(amount), CONST.COLOR.RED));

  // Zero health means disconnect the player
  if (this.isZeroHealth()) {
    return this.handleDeath();
  }
};

Player.prototype.getCorpse = function () {
  /*
   * Function Player.getCorpse
   * Returns either the male or female corpse
   */

  const CORPSE_MALE = 3058;
  const CORPSE_FEMALE = 3065;

  return this.getProperty(CONST.PROPERTIES.SEX) === CONST.SEX.MALE
    ? CORPSE_MALE
    : CORPSE_MALE;
};

Player.prototype.handleDeath = function () {
  /*
   * Function Player.handleDeath
   * Called when the player dies because of zero health
   */

  // Restore the player to full health and mana
  this.setFull(CONST.PROPERTIES.HEALTH);
  this.setFull(CONST.PROPERTIES.MANA);

  // Human corpse
  let corpse = gameServer.database.createThing(this.getCorpse());

  gameServer.world.addTopThing(this.getPosition(), corpse);
  gameServer.world.addSplash(2016, this.getPosition(), corpse.getFluidType());

  // Set the position
  gameServer.world.creatureHandler.teleportCreature(this, this.templePosition);

  // Disconnect the socket
  this.socketHandler.disconnect();
};

Player.prototype.consumeAmmunition = function () {
  /*
   * Function Player.consumeAmmunition
   * Consumes a single piece of ammunition
   */

  return this.containerManager.equipment.removeIndex(CONST.EQUIPMENT.QUIVER, 1);
};

Player.prototype.isAmmunitionEquipped = function () {
  /*
   * Function Player.isAmmunitionEquipped
   * Returns true if the player has ammunition available
   */

  return this.containerManager.equipment.isAmmunitionEquipped();
};

Player.prototype.isDistanceWeaponEquipped = function () {
  /*
   * Function Player.isDistanceWeaponEquipped
   * Returns true if the player has a distance weapon equipped
   */

  return this.containerManager.equipment.isDistanceWeaponEquipped();
};

Player.prototype.sendCancelMessage = function (message) {
  /*
   * Function Player.sendCancelMessage
   * Writes a cancel message to the player
   */

  this.write(new CancelMessagePacket(message));
};

Player.prototype.cleanup = function () {
  /*
   * Public Function Player.cleanup
   * Cleans up player references and events after socket close
   */

  // Leave all channels
  this.channelManager.cleanup();

  // Close all containers
  this.containerManager.cleanup();

  // Cancel events scheduled by the condition manager
  this.conditions.cleanup();

  // Cancel events scheduled by the combat lock
  this.combatLock.cleanup();

  // Idle events
  this.idleHandler.cleanup();

  // Disconnect all connected sockets
  this.socketHandler.disconnect();

  // Remaining actions
  this.actionHandler.cleanup();

  // Emit the logout event for the player
  this.emit("logout");
};

Player.prototype.toJSON = function () {
  /*
   * Function Player.toJSON
   * Implements the JSON.Stringify interface
   */

  // Individual classes implement the toJSON interface too
  return new Object({
    position: this.position,
    achievements: this.achievementManager,
    skills: this.skills,
    properties: this.properties,
    lastVisit: Date.now(),
    containers: this.containerManager,
    characterStatistics: this.characterStatistics,
    spellbook: this.spellbook,
    friends: this.friendlist,
    templePosition: this.templePosition,
  });
};

Player.prototype.disconnect = function () {
  this.socketHandler.disconnect();
};

Player.prototype.write = function (packet) {
  /*
   * Function Player.write
   * Delegates write to the websocket connection to write a packet
   */

  this.socketHandler.write(packet);
};

Player.prototype.getEquipmentAttribute = function (attribute) {
  /*
   * Function Player.getEquipmentAttribute
   * Returns an attribute from the the players' equipment
   */

  return this.containerManager.equipment.getAttributeState(attribute);
};

Player.prototype.getSpeed = function () {
  /*
   * Function Player.getSpeed
   * Returns the speed of the player
   */

  // The base speed
  let base = this.getProperty(CONST.PROPERTIES.SPEED);

  if (this.hasCondition(Condition.prototype.HASTE)) {
    base *= 1.3;
  }

  return base;
};

Player.prototype.getBaseDamage = function () {
  /*
   * Function Player.getBaseDamage
   * Returns the base damage based on the level of the player
   * https://tibia.fandom.com/wiki/Formulae#Base_Damage_and_Healing
   */

  let level = this.skills.getSkillLevel(CONST.PROPERTIES.EXPERIENCE);

  // One base point per 5 levels
  return Math.floor(level / 5);
};

Player.prototype.getAttack = function () {
  /*
   * Function Player.getAttack
   * Returns the attack of the player
   * https://tibia.fandom.com/wiki/Formulae#Melee
   */

  // States of player
  const OFFENSIVE = 0;
  const BALANCED = 1;
  const DEFENSIVE = 2;

  let mode = OFFENSIVE;

  let B = this.getBaseDamage();
  let W = 20;
  let weaponType = this.containerManager.equipment.getWeaponType();
  let S = this.skills.getSkillLevel(weaponType);

  switch (mode) {
    case OFFENSIVE:
      return B + Math.floor(Math.floor(W * (6 / 5)) * ((S + 4) / 28));
    case BALANCED:
      return B + Math.floor(W * ((S + 4) / 28));
    case DEFENSIVE:
      return B + Math.floor(Math.ceil(W * (3 / 5)) * ((S + 4) / 28));
  }

  return 0;
};

Player.prototype.getDefense = function () {
  /*
   * Function Player.getDefense
   * Returns the attack of a creature
   */

  return this.getProperty(CONST.PROPERTIES.DEFENSE);
};

Player.prototype.purchase = function (offer, count) {
  /*
   * Function Player.purchase
   * Function to purchase an item from an NPC
   */

  let thing = process.gameServer.database.createThing(offer.id);

  if (thing.isStackable() && count) {
    thing.setCount(count);
  } else if (thing.isFluidContainer() && offer.count) {
    thing.setCount(offer.count);
  }

  if (!this.containerManager.equipment.canPushItem(thing)) {
    return this.sendCancelMessage(
      "You do not have enough available space or capacity."
    );
  }

  // Price is equivalent to the count times price
  if (!this.payWithResource(2148, offer.price * count)) {
    return this.sendCancelMessage("You do not have enough gold.");
  }

  // Add
  this.containerManager.equipment.pushItem(thing);

  return true;
};

Player.prototype.getCapacity = function () {
  /*
   * Function Player.getCapacity
   * Returns the available capacity for the player
   */

  return this.getProperty(CONST.PROPERTIES.CAPACITY);
};

Player.prototype.hasSufficientCapacity = function (thing) {
  /*
   * Function Player.hasSufficientCapacity
   * Returns true if the player has sufficient capacity to carry the thing
   */

  return this.getCapacity() >= thing.getWeight();
};

Player.prototype.payWithResource = function (currencyId, price) {
  /*
   * Function Player.payWithResource
   * Pays a particular price in gold coins
   */

  return this.containerManager.equipment.payWithResource(currencyId, price);
};

Player.prototype.handleBuyOffer = function (packet) {
  /*
   * Function Player.handleBuyOffer
   * Opens trade window with a friendly NPC
   */

  let creature = gameServer.world.creatureHandler.getCreatureFromId(packet.id);

  // The creature does not exist
  if (creature === null) {
    return;
  }

  // Trading only with NPCs
  if (creature.constructor.name !== "NPC") {
    return;
  }

  if (!creature.isWithinHearingRange(this)) {
    return;
  }

  // Get the current offer
  let offer = creature.conversationHandler.tradeHandler.getTradeItem(
    packet.index
  );

  // Try to make the purchase
  if (this.purchase(offer, packet.count)) {
    creature.speechHandler.internalCreatureSay(
      "Here you go!",
      CONST.COLOR.YELLOW
    );
  }
};

Player.prototype.getFluidType = function () {
  /*
   * Function Player.getFluidType
   * Returns the fluid type of a player which is always blood
   */

  return CONST.FLUID.BLOOD;
};

Player.prototype.__handleCreatureKill = function (creature) {
  /*
   * Function Player.__handleCreatureKill
   * Callback fired when the player participates in a creature kill
   */
  //this.questlog.kill(creature);
};

Player.prototype.changeCapacity = function (value) {
  /*
   * Function Player.changeCapacity
   * Changes the available capacity of a player by a value
   */

  this.setProperty(
    CONST.PROPERTIES.CAPACITY,
    this.getProperty(CONST.PROPERTIES.CAPACITY) + value
  );

  if (!this.containerManager) {
    return;
  }
};

Player.prototype.changeSlowness = function (speed) {
  this.speed = this.speed + speed;
  this.write(
    new CreaturePropertyPacket(this.getId(), CONST.PROPERTIES.SPEED, this.speed)
  );
};

module.exports = Player;
