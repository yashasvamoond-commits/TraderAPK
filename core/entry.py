"""Entry timer for one Indian ticker: is the setup triggered right now?"""

from .scanner import evaluate


def check_entry(symbol):
    """Return a plain dict describing trigger status (longs only)."""
    from .quotes import chart
    ch = chart(symbol)
    res = evaluate(ch)
    out = {
        "symbol": res["symbol"],
        "date": res["date"],
        "status": res["status"],      # triggered / waiting / expired / no-data
        "phase": res["phase"],
        "reason": res["reason"],
        "level": res.get("level"),
        "trigger": res.get("trigger"),
        "last": res.get("last"),
        "opening_range": res.get("opening_range"),
    }
    return out
