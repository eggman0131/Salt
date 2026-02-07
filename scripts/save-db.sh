#!/bin/bash
# scripts/save-db.sh
# Saves current emulator data to ./emulator-data

echo "Saving emulator data..."
firebase emulators:export ./emulator-data --force
echo "Data saved to ./emulator-data"
