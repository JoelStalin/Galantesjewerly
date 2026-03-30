#!/bin/bash
# Android Deployment Script
echo '?? Starting Android Deployment...'
npm run build
npm ci --production
echo '? Build complete. Ready for Termux execution.'

