#!/bin/zsh
# Запускает сервер виджета и открывает его отдельным маленьким окном Chrome.
cd "$(dirname "$0")"
PORT=${WIDGET_PORT:-8765}
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/api"; then
  nohup python3 widget.py > widget.log 2>&1 &
  sleep 1
fi
open -na "Google Chrome" --args --app="http://127.0.0.1:$PORT" --window-size=520,360
