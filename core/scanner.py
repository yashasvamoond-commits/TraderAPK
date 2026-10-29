"""Opening-range breakout scanner for Indian stocks (NSE, IST).

Watches the universe, computes the first-15-minute opening range and flags
tickers whose latest 5-minute bar closed above the range high. Longs only,
paper trading by default — the same method as day-trader-skill's
trader-scanner, tuned to NSE hours 09:15-15:30 IST.
"""

from .config import MARKET_OPEN, MARKET_CLOSE, session_for, now_ist
from .quotes import chart

OR_MINUTES = 15
INTERVAL = "5m"
NO_ENTRIES_AFTER = "15:15"


def _hm(t):
    return "%02d:%02d" % (t.hour, t.minute)


def evaluate(chart_doc, now_ist=None):
    """Pure evaluation of one ticker: opening-range breakout status."""
    now_ist = now_ist or now_ist()
    bars = chart_doc["bars"]
    sym = chart_doc["symbol"]
    step = 300  # 5 minutes in seconds
    local = now_ist
    day = local.date()
    res = {
        "symbol": sym, "date": day.isoformat(), "interval": INTERVAL,
        "or_minutes": OR_MINUTES, "status": "waiting", "phase": "",
        "reason": "", "opening_range": None, "trigger": None, "last": None,
    }
    ok, _ = __import__("core.config", fromlist=["is_trading_day"]).is_trading_day(day)
    open_t, close_t = session_for(day)
    open_dt = datetime_combine(day, open_t)
    close_dt = datetime_combine(day, close_t)
    or_end = open_dt + __import__("datetime").timedelta(minutes=OR_MINUTES)
    cutoff = datetime_combine(day, __import__("datetime").time(15, 15))

    by_slot = {}
    for b in bars:
        et = b["t"]
        et_dt = __import__("datetime").datetime.fromtimestamp(et, IST)
        if et_dt.date() != day or not (open_dt <= et_dt < close_dt):
            continue
        slot = int((et_dt - open_dt).total_seconds()) // step
        by_slot[slot] = dict(b, et=et_dt)

    bars_today = [by_slot[s] for s in sorted(by_slot)]
    or_bars = [b for b in bars_today if b["et"] < or_end]
    if or_bars:
        res["opening_range"] = {
            "high": max(b["h"] for b in or_bars),
            "low": min(b["l"] for b in or_bars),
            "minutes": OR_MINUTES,
            "bars": len(or_bars),
        }

    now_naive = local.replace(tzinfo=None)
    if now_naive < open_dt:
        res.update(status="waiting", phase="pre-open",
                   reason="NSE opens at 09:15 IST; range set at %s" % _hm(or_end.time()))
        return res

    if not or_bars:
        res.update(status="no-data", phase="open",
                   reason="no bars yet for the opening range")
        return res

    lvl = max(b["h"] for b in or_bars)
    res["level"] = lvl
    trig = None
    for b in bars_today:
        if b["et"] < or_end:
            continue
        if b["et"] > cutoff:
            continue
        if b["c"] > lvl:
            trig = b
            break

    last = bars_today[-1] if bars_today else None
    if last:
        res["last"] = {"bar_start": _hm(last["et"].time()), "close": last["c"]}

    if trig:
        res.update(status="triggered", phase="open" if local < close_dt else "after-close",
                   reason="%s bar closed above range high %.2f" % (_hm(trig["et"].time()), lvl),
                   trigger={"time": _hm(trig["et"].time()), "price": trig["c"], "pct_over": 100.0 * (trig["c"] / lvl - 1)})
        return res
    if not bars_today:
        res.update(status="no-data", phase="open", reason="no bars yet")
        return res
    if now_naive >= cutoff:
        res.update(status="expired", phase="after-cutoff",
                   reason="no breakout by 15:15 IST today")
        return res
    gap = lvl - last["c"]
    res.update(status="waiting", phase="open",
               reason="last close %.2f, %.2f under range high %.2f (%+.2f%%)" % (
                   last["c"], abs(gap), lvl, 100.0 * (last["c"] / lvl - 1)))
    return res


def datetime_combine(day, t):
    import datetime
    return datetime.datetime.combine(day, t).replace(tzinfo=IST)


def scan_universe(symbols, now_ist=None):
    """Scan many tickers; returns hits sorted by breakout strength."""
    now_ist = now_ist or now_ist()
    hits = []
    for sym in symbols:
        try:
            ch = chart(sym)
            r = evaluate(ch, now_ist)
        except Exception as e:  # network/ticker problems are skipped quietly
            r = {"symbol": sym, "status": "error", "reason": str(e)}
        hits.append(r)
    hits.sort(key=lambda r: -(r.get("trigger", {}) or {}).get("pct_over", 0) if r.get("status") == "triggered" else -1)
    triggered = [r for r in hits if r.get("status") == "triggered"]
    return {"hits": hits, "triggered": triggered, "count": len(hits)}


# Nifty 50 (representative sample; extend with your own watchlist)
NIFTY_50 = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "ITC",
    "SBIN", "BHARTIARTL", "BAJFINANCE", "KOTAKBANK", "LT", "AXISBANK", "ASIANPAINT",
    "MARUTI", "HCLTECH", "SUNPHARMA", "TITAN", "NTPC", "POWERGRID", "ULTRACEMCO",
    "TATAMOTORS", "TECHM", "BAJAJFINSV", "NESTLEIND", "WIPRO", "ONGC", "COALINDIA",
    "TATASTEEL", "HDFCLIFE", "GRASIM", "CIPLA", "EICHERMOT", "HINDALCO", "BRITANNIA",
    "APOLLOHOSP", "DRREDDY", "ADANIENT", "ADANIPORTS", "JSWSTEEL", "BPCL",
    "HEROMOTOCO", "TATACONSUM", "INDUSINDBK",
]
