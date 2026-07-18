#!/usr/bin/env bash
# Echo dev runner — starts the FastAPI backend and the Vite frontend together.
# Usage: ./run.sh   (Ctrl-C stops both)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Backend (FastAPI) on :8000"
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then python -m venv .venv; fi
source .venv/bin/activate
pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env
uvicorn main:app --reload --port 8000 &
BACK_PID=$!

echo "==> Frontend (Vite) on :5173"
cd "$ROOT/frontend"
[ -d node_modules ] || npm install
npm run dev &
FRONT_PID=$!

trap "echo; echo 'Stopping...'; kill $BACK_PID $FRONT_PID 2>/dev/null" INT TERM
echo "==> Open http://localhost:5173"
wait
