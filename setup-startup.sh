#!/bin/bash

# LinkedIn Auto-Poster - PM2 Startup Configuration
# This script sets up the LinkedIn auto-poster to run on system boot using PM2

echo "Setting up LinkedIn Auto-Poster for startup..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Set up PM2 startup (only needs to be run once)
echo "Configuring PM2 startup daemon..."
sudo env PATH=$PATH:/Users/antoniomartinez/.nvm/versions/node/v20.19.5/bin /Users/antoniomartinez/.nvm/versions/node/v20.19.5/lib/node_modules/pm2/bin/pm2 startup launchd -u antoniomartinez --hp /Users/antoniomartinez

# Start the app with PM2
echo "Starting LinkedIn Auto-Poster with PM2..."
cd "$SCRIPT_DIR"
pm2 start index.js --name "linkedInAuto"

# Save the PM2 process list
echo "Saving PM2 configuration..."
pm2 save

echo ""
echo "✅ Setup complete!"
echo ""
echo "Useful commands:"
echo "  pm2 list              - View running processes"
echo "  pm2 logs linkedInAuto - View logs"
echo "  pm2 restart linkedInAuto - Restart the app"
echo "  pm2 stop linkedInAuto - Stop the app"
echo "  pm2 delete linkedInAuto - Remove from PM2"
echo ""
