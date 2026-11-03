#!/bin/zsh
# Opens Binance USDⓈ-M futures in the most recently used browser.
# Usage: open_binance.sh [SYMBOL]   e.g. IDOLUSDT
SYM=${1:-BTCUSDT}
URL="https://www.binance.com/en/futures/$SYM"

BROWSERS=(com.google.Chrome com.apple.Safari company.thebrowser.Browser com.brave.Browser
  org.mozilla.firefox com.microsoft.edgemac com.operasoftware.Opera com.vivaldi.Vivaldi
  app.zen-browser.zen com.google.Chrome.canary ai.perplexity.comet com.openai.atlas)

# visibleProcessList is ordered front-to-back, i.e. by most recent use
for asn in $(lsappinfo visibleProcessList | grep -o 'ASN:[^:]*:'); do
  bid=$(lsappinfo info -only bundleid "${asn%:}" | sed -n 's/.*="\(.*\)"/\1/p')
  if (( ${BROWSERS[(Ie)$bid]} )); then
    exec open -b "$bid" "$URL"
  fi
done
exec open "$URL"  # fallback: default browser
