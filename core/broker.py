"""Paper broker: records orders and positions, fills stop/target brackets.

Paper trading only. Wire your own broker (Zerodha Kite, Upstox, Angel One,
Dhan, ...) here and keep \"user confirms every order\" as a hard rule.
"""

import datetime
from .config import now_ist, CURRENCY_SYMBOL


class PaperBroker:
    def __init__(self):
        self.orders = []
        self.positions = {}   # symbol -> {shares, avg_price}
        self.trades = []      # fills

    def buy(self, symbol, shares, price, stop=None, target=None):
        order = {
            "id": len(self.orders) + 1,
            "symbol": symbol, "side": "BUY", "shares": int(shares),
            "price": round(float(price), 2),
            "stop": round(float(stop), 2) if stop else None,
            "target": round(float(target), 2) if target else None,
            "status": "OPEN", "placed_at": now_ist().strftime("%Y-%m-%d %H:%M:%S IST"),
        }
        self.orders.append(order)
        return order

    def flatten(self, symbol, price):
        """Sell everything open in a symbol at price (flat by close)."""
        pos = self.positions.get(symbol)
        if not pos or pos["shares"] <= 0:
            return None
        pnl = (float(price) - pos["avg_price"]) * pos["shares"]
        self.trades.append({
            "symbol": symbol, "side": "SELL", "shares": pos["shares"],
            "price": round(float(price), 2), "pnl": round(pnl, 2),
            "at": now_ist().strftime("%Y-%m-%d %H:%M:%S IST"),
        })
        self.positions[symbol] = {"shares": 0, "avg_price": 0.0}
        return {"symbol": symbol, "shares": pos["shares"], "price": round(float(price), 2),
                "pnl": round(pnl, 2)}

    def snapshot(self):
        return {"orders": self.orders, "positions": self.positions, "trades": self.trades}
