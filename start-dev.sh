#!/bin/bash
# Development startup script (Conda)

echo "🚀 Starting PWA Development Environment"
echo ""

# Check if Conda environment exists
if ! conda env list | grep -q "pwa-backend"; then
    echo "📦 Creating Conda environment..."
    cd backend
    conda env create -f environment.yml
    cd ..
fi

# Activate Conda environment
echo "🔧 Activating Conda environment..."
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate pwa-backend

# Start backend in background
echo "🐍 Starting Python backend..."
cd backend
conda run -n pwa-backend python main.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start frontend server
echo "🌐 Starting frontend server..."
cd frontend
python -m http.server 3000 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Development servers started!"
echo ""
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait

