"""Indian market configuration: NSE/BSE hours (IST), holidays, currency."""

import datetime

# NSE equities / F&O regular session: 09:15 to 15:30 IST (UTC+5:30)
MARKET_OPEN = datetime.time(9, 15)
MARKET_CLOSE = datetime.time(15, 30)
MARKET_CLOSE_EARLY = datetime.time(14, 0)  # rare special closing sessions
IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))

# NSE holidays (sample; keep current for the year you trade).
# Pre-market opens at 09:00; post-market close 16:00 for some segments.
NSE_HOLIDAYS = {
    "2026-01-26": "Republic Day",
    "2026-03-02": "Holi",
    "2026-03-30": "Ugadi / Gudi Padwa",
    "2026-04-02": "Ram Navami",
    "2026-04-10": "Mahavir Jayanti",
    "2026-04-14": "Dr Ambedkar Jayanti",
    "2026-05-01": "Maharashtra Day",
    "2026-08-15": "Independence Day",
    "2026-08-28": "Janmashtami",
    "2026-09-14": "Ganesh Chaturthi",
    "2026-10-02": "Gandhi Jayanti",
    "2026-10-21": "Diwali (Laxmi Pujan - Muhurat trading 18:15-19:15)",
    "2026-10-22": "Diwali Balipratipada",
    "2026-12-25": "Christmas",
}

CURRENCY = "INR"
CURRENCY_SYMBOL = "\u20B9"  # ₹


def now_ist():
    return datetime.datetime.now(IST).replace(microsecond=0)


def today_ist():
    return now_ist().date()


def is_trading_day(d=None):
    """(is_trading_day, reason). Weekends and NSE holidays."""
    d = d or today_ist()
    if d.weekday() >= 5:
        return False, "weekend"
    name = NSE_HOLIDAYS.get(d.isoformat())
    if name:
        return False, "NSE holiday: " + name
    return True, ""


def session_for(d=None):
    """(open, close) in IST for the day, or None if the market is closed all day."""
    ok, _ = is_trading_day(d)
    if not ok:
        return None
    return MARKET_OPEN, MARKET_CLOSE
