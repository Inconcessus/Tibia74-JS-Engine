# Use an official Node.js runtime as a parent image
FROM node:24

WORKDIR /ot-server

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install app dependencies
RUN npm install
RUN apt-get update && apt-get install -y jq

# Copy the rest of the application code
COPY . .

COPY config.json ./config.json

RUN jq '(.LOGIN.HOST = "0.0.0.0") | \
        (.SERVER.EXTERNAL_HOST = "ws://127.0.0.1:8000/api/") | \
        (.SERVER.HOST = "0.0.0.0")' \
    config.json > config.tmp && mv config.tmp config.json

# Create a startup script to run both engine.js and login.js
RUN echo '#!/bin/bash\nnode engine.js &\nnode login.js' > /ot-server/start.sh && chmod +x /ot-server/start.sh

CMD ["/ot-server/start.sh"]

