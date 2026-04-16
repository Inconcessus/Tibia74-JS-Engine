# Forby HTML5 Open Tibia Client and Server (V1)

# Installation

The Open Tibia 7.4 server runs on a custom NodeJS server and protocol.

# Running

    git clone https://github.com/Inconcessus/Tibia74-JS-Engine.git
    cd Tibia74-JS-Engine
    npm install

Three processes need to be started independently:

    python client-server.py
    node engine.js
    node login.js

Visit the resources hosted at `http://127.0.0.1:8000/` and login using the default credentials.

# engine.js

This is the main engine for the game server. It communicates over the WebSocket protocol and requires a valid login token from the login server to upgrade HTTP connections to the WebSocket protocol.

# login.js 

The login server is responsible for creating and managing player accounts. If the player succesfully logs in with a valid account number and password an SHA256-HMAC token is returned including a pointer to the data to load. This token is automatically passed to the gameserver by the game client and has its signature verified. The verification is done by a shared secret in the configuration file.

# Client Server

This simple HTTP server is only responsible for serving static files and can be replaced by e.g., Nginx, Apache, or Caddy.

# Exploring

Use the command `/waypoint <waypoint>` to travel to different places. Available waypoints:

    rookgaard
    thais
    carlin
    ab'dendriel
    venore
    poh
    gm-island
    senja
    dracona
    orc-fortress
    edron
    kazordoon
    ankrahmun
    darama
    cormaya
    fibula
    white-flower
    femur-hills
    ghost-ship
    mintwallin
    cyclopolis
    annihilator
