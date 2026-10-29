"""Risk manager: size every position to your budget and max loss per trade."""

from .config import CURRENCY_SYMBOL


def size_position(account_cash, max_loss_per_trade, entry, stop):
    """Shares to buy so a stop-out loses no more than max_loss_per_trade."""
    cash = float(account_cash)
    max_loss = float(max_loss_per_trade)
    entry = float(entry)
    stop = float(stop)
    risk = entry - stop
    if risk <= 0:
        return {"blocked": True, "reason": "stop must be below entry"}
    shares = int(max_loss // risk)
    cost = shares * entry
    actual_loss = shares * risk
    return {
        "shares": shares,
        "entry": round(entry, 2),
        "stop": round(stop, 2),
        "cost": round(cost, 2),
        "max_loss": round(actual_loss, 2),
        "cash_remaining": round(cash - cost, 2),
        "currency": CURRENCY_SYMBOL,
        "blocked": cost > cash,
        "reason": "ok" if cost <= cash else "not enough cash for %d shares at %.2f" % (shares, entry),
    }


def risk_check(order, account, daily_loss_used=0.0, trades_today=0, max_trades_per_day=5,
               max_daily_loss=None, max_position_pct=20.0):
    """PASS / BLOCK for one order against your limits."""
    blocks = []
    if trades_today >= max_trades_per_day:
        blocks.append("daily trade limit reached (%d/%d)" % (trades_today, max_trades_per_day))
    if max_daily_loss is not None and daily_loss_used >= max_daily_loss:
        blocks.append("daily loss limit reached")
    if account and order["cost"] > account * (max_position_pct / 100.0):
        blocks.append("position exceeds %.0f%% of account" % max_position_pct)
    return {
        "decision": "BLOCK" if blocks else "PASS",
        "blocks": blocks,
        "order": order,
    }
