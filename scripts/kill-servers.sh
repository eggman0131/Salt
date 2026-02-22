#!/bin/bash
# Kill running Firebase emulators, Vite servers, and Vitest processes

echo "🔍 Searching for running Firebase emulators, Vite servers, and Vitest..."

# Gracefully terminate Vitest first (SIGTERM)
echo "🔴 Gracefully stopping Vitest..."
pkill -f "vitest" 2>/dev/null
sleep 1

# Force kill any remaining Vitest processes
echo "🔴 Force killing Vitest if needed..."
pkill -9 -f "vitest" 2>/dev/null

# Kill Vite servers (checks ports 3000 and 5173)
echo "🔴 Killing Vite servers..."
lsof -ti:3000,5173 | xargs -r kill -9 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Vite server killed"
fi

# Kill Firebase emulators (typically run on ports 4000-5000)
echo "🔴 Killing Firebase emulators..."
lsof -ti:4000,4400,4500,5000,5001,8080,9099,9150 | xargs -r kill -9 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Firebase emulators killed"
fi

echo "✅ Done! All processes cleaned up."
