// Binance Futures PnL — data from the local server (~/Projects/binance-widget/widget.py)
import { css, run } from "uebersicht";

const OPEN = "$HOME/Projects/binance-widget/open_binance.sh";
const openFutures = (sym, e) => {
  if (e) e.stopPropagation();
  run(`${OPEN} ${sym || ""}`);
};
let lastGood = null; // keep showing last data if one poll fails, no flashing

export const command = "curl -s --max-time 2 http://127.0.0.1:8765/api";
export const refreshFrequency = 3000;

export const className = `
  top: 198px;
  left: 17px;
  width: 342px;
  font-family: -apple-system, "SF Pro Display", system-ui, sans-serif;
  color: #f2f4f7;
  user-select: none;
`;

const UP = "#34d399";
const DOWN = "#fb7185";

const card = css`
  /* solid background: backdrop-filter flickers in Übersicht's WebView on every refresh */
  background: linear-gradient(180deg, rgba(44, 44, 48, 0.94), rgba(30, 30, 34, 0.94));
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transform: translateZ(0);
  border-radius: 22px;
  padding: 18px 18px 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  font-variant-numeric: tabular-nums;
`;
const head = css`
  display: flex; justify-content: space-between; align-items: center;
  font-size: 11px; letter-spacing: .06em; text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
`;
const dot = css`
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  margin-right: 6px; vertical-align: middle;
`;
const total = css`
  font-size: 34px; font-weight: 600; letter-spacing: -.02em;
  margin: 4px 0 12px;
`;
const unit = css` font-size: 15px; font-weight: 500; opacity: .55; margin-left: 6px; `;
const row = css`
  display: grid; grid-template-columns: 1fr auto; column-gap: 12px; align-items: center;
  padding: 11px 0; border-top: 1px solid rgba(255, 255, 255, 0.07);
`;
const sym = css` font-size: 15px; font-weight: 600; `;
const tag = css`
  font-size: 9.5px; font-weight: 700; letter-spacing: .05em;
  padding: 2px 6px; border-radius: 6px; margin-left: 7px; vertical-align: 2px;
`;
const sub = css` font-size: 11.5px; color: rgba(255, 255, 255, 0.5); margin-top: 3px; `;
const right = css` text-align: right; `;
const pnl = css` font-size: 15px; font-weight: 600; `;
const bar = css`
  height: 3px; border-radius: 2px; background: rgba(255,255,255,.08);
  margin-top: 7px; overflow: hidden; grid-column: 1 / -1;
`;
const muted = css` color: rgba(255,255,255,.5); font-size: 13px; padding: 10px 0 8px; `;

const price = v => {
  if (!v) return "—";
  const d = v >= 1000 ? 2 : v >= 1 ? 4 : v >= 0.01 ? 5 : 7;
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};
const usd = v => (v >= 0 ? "+" : "−") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = v => v == null ? "" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + "%";
const col = v => (v >= 0 ? UP : DOWN);

// distance from liquidation: 0% = at entry, 100% = at liq price
const liqRisk = p => {
  if (!p.liq || !p.entry) return 0;
  const r = (p.entry - p.mark) / (p.entry - p.liq);
  return Math.max(0, Math.min(1, r));
};

export const render = ({ output, error }) => {
  let s;
  try { s = JSON.parse(output); lastGood = s; } catch (e) { s = lastGood; }

  if (!s) {
    return (
      <div className={card}>
        <div className={head}><span><span className={dot} style={{ background: DOWN }} />Binance Futures</span></div>
        <div className={muted}>Сервер не отвечает (127.0.0.1:8765)</div>
      </div>
    );
  }

  const ps = s.positions || [];
  const sum = ps.reduce((a, p) => a + p.upnl, 0);
  const time = s.updated ? new Date(s.updated).toLocaleTimeString("ru-RU") : "—";
  const stale = !s.updated || Date.now() - s.updated > 15000 || s.error;

  const top = ps[0] ? ps[0].symbol : "";
  return (
    <div className={card} onClick={() => openFutures(top)}>
      <div className={head}>
        <span><span className={dot} style={{ background: stale ? "#fbbf24" : UP }} />Binance Futures</span>
        <span>{time}</span>
      </div>

      <div className={total} style={{ color: ps.length ? col(sum) : "#f2f4f7" }}>
        {ps.length ? usd(sum) : "0.00"}<span className={unit}>USDT</span>
      </div>

      {ps.length === 0 && <div className={muted}>Открытых позиций нет</div>}

      {ps.map(p => {
        const long = p.side === "LONG";
        const risk = liqRisk(p);
        return (
          <div className={row} key={p.symbol + p.side} onClick={e => openFutures(p.symbol, e)}>
            <div>
              <span className={sym}>{p.symbol.replace(/(USDT|USDC)$/, "")}</span>
              <span className={tag} style={{
                color: long ? UP : DOWN,
                background: long ? "rgba(52,211,153,.14)" : "rgba(251,113,133,.14)",
              }}>{p.side}</span>
              <span className={sub} style={{ marginLeft: 7 }}>${Math.round(p.notional).toLocaleString("en-US")}</span>
              <div className={sub}>
                {price(p.mark)} <span style={{ opacity: .6 }}>· вход {price(p.entry)}</span>
              </div>
            </div>
            <div className={right}>
              <div className={pnl} style={{ color: col(p.upnl) }}>{usd(p.upnl)}</div>
              <div className={sub}>
                ROE <span style={{ color: col(p.upnl) }}>{pct(p.roe)}</span>
              </div>
            </div>
            <div className={bar} title={`liq ${price(p.liq)}`}>
              <div style={{
                width: `${Math.max(3, risk * 100)}%`, height: "100%",
                background: risk > 0.6 ? DOWN : risk > 0.3 ? "#fbbf24" : "rgba(255,255,255,.25)",
              }} />
            </div>
          </div>
        );
      })}

      {s.error && <div className={sub} style={{ color: DOWN, padding: "6px 0" }}>{String(s.error).slice(0, 140)}</div>}
    </div>
  );
};
