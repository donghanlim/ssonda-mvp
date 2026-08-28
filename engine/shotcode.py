"""SSONDA ShotCode reference implementation.
Amounts are intentionally never transformed: only the sender name carries a code.
"""
from datetime import datetime

JITTER = 10

def shot_code_at(issued_at: datetime, jitter: int) -> str:
    if not isinstance(issued_at, datetime):
        raise TypeError("issued_at must be datetime")
    if not isinstance(jitter, int) or not 0 <= jitter < JITTER:
        raise ValueError("jitter must be an integer from 0 to 9")
    return f"{((issued_at.hour * 60 + issued_at.minute) + jitter) % 1000:03d}"
