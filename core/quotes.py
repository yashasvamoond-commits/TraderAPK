"""Free quotes for Indian stocks via Yahoo Finance (unofficial, can lag).

NSE tickers: RELIANCE.NS, TCS.NS, INFY.NS   BSE tickers: RELIANCE.BO
No API key, no signup. Bars are 5-minute (about 60 days) or 1-minute (~7 days).
"""

import datetime
import json
import urllib.error
import urllib.request

from .config import IST, now_ist

UA = "Mozilla/5.0 (compatible; TraderAPK/1.0; +https://github.com/yashasvamoond-commits/TraderAPK)"
HOSTS = ("query2", "query1")
PAUSE = 0.5


def yahoo_symbol(sym):
    sym = sym.strip().upper()
    if not (sym.endswith(".NS") or sym.endswith(".BO")):
        sym = sym + ".NS"   # default to NSE
    return sym.replace(".", "-")


def chart_path(sym, rng, interval):
    return "/v8/finance/chart/%s?range=%s&interval=%s" % (yahoo_symbol(sym), rng, interval)


def _open_url(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def yahoo_get(path):
    last = "no answer"
    for host in HOSTS:
        url = "https://%s.finance.yahoo.com%s" % (host, path)
        for attempt in (0, 1):
            try:
                return _open_url(url)
            except urllib.error.HTTPError as e:
                code = e.code
                try:
                    body = e.read().decode("utf-8", "replace")
                except Exception:
                    body = ""
                finally:
                    e.close()
                if code == 404:
                    raise QuoteError("Yahoo has no chart for %s (unknown ticker)" % path)
                last = "HTTP %d" % code
                if code == 429 and attempt == 0:
                    import time
                    time.sleep(5)
                    continue
                if code == 429 or code >= 500:
                    break
                raise QuoteError("Yahoo answered HTTP %d for %s" % (code, url))
            except (urllib.error.URLError, OSError) as e:
                last = "network error: %s" % (e,)
                break
    raise QuoteError("Yahoo did not answer (%s): try again in a minute" % last)


def parse_chart(text, sym):
    try:
        data = json.loads(text)
        res = data["chart"]["result"]
    except (ValueError, KeyError, TypeError):
        raise QuoteError("Yahoo returned something unexpected for %s" % sym)
    if not res:
        err = (data.get("chart") or {}).get("error") or {}
        raise QuoteError("Yahoo has no data for %s: %s" % (sym, err.get("description") or "unknown ticker"))
    r = res[0] or {}
    meta = r.get("meta") or {}
    q = ((r.get("indicators") or {}).get("quote") or [{}])[0] or {}

    def at(key, i):
        arr = q.get(key) or []
        return arr[i] if i < len(arr) else None

    bars = []
    for i, t in enumerate(r.get("timestamp") or []):
        c = at("close", i)
        if t is None or c is None:
            continue
        o, h, lo = at("open", i), at("high", i), at("low", i)
        bars.append({
            "t": int(t), "o": float(c if o is None else o),
            "h": float(c if h is None else h),
            "l": float(c if lo is None else lo), "c": float(c),
            "v": int(at("volume", i) or 0),
        })
    meta_time = meta.get("regularMarketTime")
    return {
        "symbol": str(meta.get("symbol") or sym).upper().replace("-", "."),
        "exchange": meta.get("exchangeName"),
        "bars": bars,
        "prev_close": meta.get("previousClose") or meta.get("chartPreviousClose"),
        "data_time": meta_time,
        "data_time_ist": (datetime.datetime.fromtimestamp(meta_time, IST).strftime("%Y-%m-%d %H:%M:%S IST")
                          if meta_time else None),
    }


class QuoteError(Exception):
    pass


def chart(sym, interval="5m", rng="1d"):
    """Bar list for one Indian ticker from Yahoo Finance."""
    text = yahoo_get(chart_path(sym, rng, interval))
    return parse_chart(text, sym)


def quote(sym):
    """Latest price for one Indian ticker (last close of today's bars)."""
    ch = chart(sym, interval="5m", rng="1d")
    bars = ch["bars"]
    if not bars:
        raise QuoteError("no bars for %s" % sym)
    last = bars[-1]
    return {
        "symbol": ch["symbol"],
        "price": last["c"],
        "open": last["o"], "high": last["h"], "low": last["l"],
        "volume": last["v"],
        "prev_close": ch.get("prev_close"),
        "as_of": ch.get("data_time_ist"),
        "source": "Yahoo Finance (free, delayed, unofficial)",
    }
