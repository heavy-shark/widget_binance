#!/bin/zsh
# Ставит виджет: служба launchd для сервера + виджет Übersicht на рабочий стол.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
PY="$(command -v python3)"
PLIST="$HOME/Library/LaunchAgents/pro.hysk.binance-widget.plist"
WIDGETS="$HOME/Library/Application Support/Übersicht/widgets"

[[ -f "$DIR/.env" ]] || { cp "$DIR/.env.example" "$DIR/.env"; chmod 600 "$DIR/.env"; echo "Заполни ключи в $DIR/.env и запусти снова"; exit 1; }

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>pro.hysk.binance-widget</string>
  <key>ProgramArguments</key><array><string>$PY</string><string>$DIR/widget.py</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DIR/widget.log</string>
  <key>StandardErrorPath</key><string>$DIR/widget.log</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/pro.hysk.binance-widget" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

[[ -d "/Applications/Übersicht.app" ]] || brew install --cask ubersicht
mkdir -p "$WIDGETS"
sed "s|\$HOME/Projects/binance-widget|$DIR|" "$DIR/ubersicht/binance-pnl.jsx" > "$WIDGETS/binance-pnl.jsx"
open -a "Übersicht"
echo "Готово: сервер на http://127.0.0.1:8765, виджет на рабочем столе"
