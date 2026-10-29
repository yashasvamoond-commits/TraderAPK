"""TraderAPK core: Indian stock trading tools (NSE / BSE).

A Python port of the day-trader-skill method adapted to Indian markets.
Free public data via Yahoo Finance (NSE tickers end in .NS, BSE in .BO),
standard library only, paper trading by default. Nothing here places a real
order unless you wire your own broker and confirm every trade yourself.

Not financial advice. Most day traders lose money.
"""

from .config import MARKET_OPEN, MARKET_CLOSE, IST, is_trading_day, session_for
from .quotes import quote, chart
from .scanner import scan_universe
from .entry import check_entry
from .exit import exit_plan
from .risk import risk_check
from .broker import PaperBroker
from .alerts import AlertBook

__all__ = [
    "MARKET_OPEN", "MARKET_CLOSE", "IST", "is_trading_day", "session_for",
    "quote", "chart", "scan_universe", "check_entry", "exit_plan",
    "risk_check", "PaperBroker", "AlertBook",
]
