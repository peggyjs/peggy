FROM mcr.microsoft.com/devcontainers/javascript-node:4.0.5-trixie

RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
   && apt-get -y upgrade && apt-get install -y tcpdump

RUN npm install -g playwright npm-check-updates

USER node
RUN npx playwright install --with-deps
