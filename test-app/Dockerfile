# EZThrottle Node.js SDK Test App
# Uses local SDK (not published to npm yet)

ARG NODE_VERSION=20.18.1
FROM node:${NODE_VERSION}-slim

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Copy SDK source code from parent directory
COPY src /app/src
COPY package.json /app/package.json
COPY README.md /app/README.md

# Install SDK dependencies
RUN npm install --production

# Copy test app into subdirectory
COPY test-app/package*.json /app/test-app/
COPY test-app/app.js /app/test-app/
COPY test-app/tests /app/test-app/tests

# Install test app dependencies (will use file:.. to reference SDK)
WORKDIR /app/test-app
RUN npm install --production

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "app.js"]
