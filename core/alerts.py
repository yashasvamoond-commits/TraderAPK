"""Price alerts: stop, target, flat-by close. Information only, never an order."""

from .config import now_ist


class AlertBook:
    def __init__(self):
        self.rules = []     # {symbol, type, level, date, rangd, fired}
        self.fired = []

    def add(self, symbol, atype, level, date=None, label=None):
        self.rules.append({
            "symbol": symbol.upper(), "type": atype,   # stop / target / time / pct
            "level": float(level), "date": date,
            "label": label or atype, "fired": False,
        })

    def check(self, prices):
        """prices: {symbol: price}. Returns list of rings; each rule rings once."""
        now = now_ist().date().isoformat()
        rings = []
        for rule in self.rules:
            if rule["fired"]:
                continue
            if rule["date"] and rule["date"] != now:
                continue
            sym = rule["symbol"]
            if sym not in prices:
                continue
            price = prices[sym]
            hit = False
            if rule["type"] == "stop" and price <= rule["level"]:
                hit = True
            elif rule["type"] == "target" and price >= rule["level"]:
                hit = True
            elif rule["type"] == "time":
                hit = True  # caller decides the clock
            if hit:
                rule["fired"] = True
                self.fired.append(dict(rule, price=price, at=now_ist().strftime("%H:%M:%S IST")))
                rings.append(self.fired[-1])
        return rings
