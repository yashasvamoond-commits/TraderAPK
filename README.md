# TraderAPK — Indian stock trading app for your tablet

A working, installable day-trading tool for **NSE / BSE (Indian) stocks**:
opening-range breakout scanner, entry/exit planner, risk position sizer,
paper broker and price alerts. Built as a **Progressive Web App** so it installs
with a single link tap on your Lenovo Yoga tablet — no Play Store, no build
step, works offline after the first visit.

## The one-link install (recommended)

1. Publish this repo (GitHub Pages is configured in `.github/workflows/pages.yml`).
   Your link becomes `https://<your-user>.github.io/TraderAPK/`.
2. Open that link in **Chrome on the tablet**.
3. Chrome shows "Add to Home Screen" (or use the menu → "Add to Home screen").
4. Tap it once → app icon on the home screen, full-screen, offline-ready.

That IS the single-click-of-a-link install. A real `.apk` cannot install with one
tap from a raw link on Android — Google blocks "unknown app sources" by default
(see `BUILD_APK.md` if you still want to compile one with Buildozer).

## What it does (Indian markets)

| panel | job |
|---|---|
| Market | IST clock (UTC+5:30), NSE session 09:15–15:30, weekend/holiday aware, data mode |
| Scanner | Opening-range breakout over your watchlist (first 15 minutes, 5-minute bars) |
| Trade | Quote → entry / range high / low → stop at range midpoint, target at 1R, position size from your max loss/trade |
| Positions | Paper positions, orders, end-of-day flatten with P&L |
| Alerts | Stop / target price alerts (each rings once) |
| Settings | Demo/simulated prices (works fully offline), watchlist, daily limits |

**Data source:** Yahoo Finance for `RELIANCE.NS`, `TCS.NS` etc. (`query1/2.finance.yahoo.com`)
— free, no API key, unofficial and can lag. **Always verify prices with your
broker before acting.** If the network is down, the app runs in demo mode with
simulated prices so every button still works.

## Indian market notes

- NSE equity/F&O session: 09:15–15:30 IST. Pre-market 09:00, post-market 16:00
  exist for some segments but this app trades the regular session.
- Ticker suffix: `.NS` for NSE, `.BO` for BSE (app defaults to `.NS`).
- Currency: ₹ (INR). Position sizing uses your max loss per trade:
  `shares = maxLoss / (entry − stop)`.
- Holiday list in `app/app.js` (CFG.holidays) covers 2026 — add dates as needed.
- No margin, no F&O lots, no short selling in this version; longs only.

## Use it directly in Python too

`core/` is a standard-library Python port of the same method (adapted from the
open-source `day-trader-skill` project, which is US-market/Claude oriented — this
repo rewrites it for Indian markets as a standalone app):

```bash
cd /home/user/TraderAPK
python3 -m py_compile core/*.py   # syntax check
python3 - <<'EOF'
from core.quotes import quote
print(quote("RELIANCE.NS"))   # needs network; Yahoo .NS ticker
EOF
```

## What this is NOT

- Not a broker, not an exchange terminal, not SEBI-registered advice.
- Cannot place real orders on its own (paper broker only). Wire Zerodha/Upstox/
  Angel One/Dhan APIs into the broker layer yourself, and keep "user confirms
  every order" as a hard rule.
- Not financial advice. Most day traders lose money — you can lose money. Test
  on paper first.

## Repo layout

```
app/            PWA (index.html, app.js, style.css, manifest.json, sw.js, icons)
core/           Python trading library (quotes, scanner, entry, exit, risk, broker, alerts)
buildozer.spec  Buildozer recipe for a native APK (build on your own PC)
BUILD_APK.md    APK build steps
.github/        GitHub Pages deploy
```

MIT license. Derived in method from `github.com/Jakeschincariol/day-trader-skill`
(MIT), re-targeted to Indian NSE/BSE trading as an installable tablet app.
