"""Exit planner: stop and target before you enter (1:1 risk/reward, flat by 15:15 IST).

Stop  = opening-range midpoint
Target = entry + 1R   (one times the risk)
Flat-by = 15:15 IST (close out whatever is still open)
"""

from .config import CURRENCY_SYMBOL


def exit_plan(entry_price, range_high, range_low):
    """Stop/target brackets from an opening-range breakout entry.

    Returns a dict with stop, target, risk per share and lots-agnostic math.
    """
    entry = float(entry_price)
    high = float(range_high)
    low = float(range_low)
    stop = (high + low) / 2.0
    risk = entry - stop
    target = entry + risk
    return {
        "entry": round(entry, 2),
        "stop": round(stop, 2),
        "target": round(target, 2),
        "risk_per_share": round(risk, 2),
        "reward_to_risk": 1.0,
        "flat_by": "15:15 IST",
        "currency": CURRENCY_SYMBOL,
        "note": "Stop at range midpoint, target 1R above entry, flat by 15:15 IST. A stop is a plan, not a guarantee: gap fills can slip past the stop.",
    }
