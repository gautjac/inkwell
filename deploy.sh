#!/bin/bash
# Inkwell — Build & Deploy
# Usage: ./deploy.sh
# Reads from ../inkwell/index.html, patches for Netlify, deploys.

cd "$(dirname "$0")"
export NETLIFY_AUTH_TOKEN=SCRUBBED_NETLIFY_AUTH_TOKEN
node build.js --deploy
