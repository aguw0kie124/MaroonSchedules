from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import Iterable, Optional

from dateutil import parser as dtparse

from .utils import clean_text

WEEKDAY_INDEX = {
    "mon": 0,
    "monday": 0,
    "tue": 1,
    "tues": 1,
    "tuesday": 1,
    "wed": 2,
    "wednesday": 2,
    "thu": 3,
    "thur": 3,
    "thurs": 3,
    "thursday": 3,
    "fri": 4,
    "friday": 4,
    "sat": 5,
    "saturday": 5,
    "sun": 6,
    "sunday": 6,
}

ORDINAL_INDEX = {
    "first": 1,
    "second": 2,
    "third": 3,
    "fourth": 4,
    "last": -1,
}


@dataclass
class RecurrenceRule:
    pattern: str
    weekdays: list[int]
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    ordinal: Optional[int] = None
    all_day: bool = False


def _parse_clock(value: str | None) -> Optional[time]:
    if not value:
        return None
    text = clean_text(value).replace(".", "")
    try:
        parsed = dtparse.parse(text)
    except (ValueError, TypeError, OverflowError):
        return None
    return parsed.time().replace(second=0, microsecond=0)


def parse_time_range(text: str | None) -> tuple[Optional[time], Optional[time]]:
    if not text:
        return None, None
    cleaned = clean_text(text).replace("–", "-").replace("—", "-").replace("to", "-")
    match = re.search(
        r"(?P<start>\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)\s*-\s*(?P<end>\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)",
        cleaned,
        re.IGNORECASE,
    )
    if match:
        return _parse_clock(match.group("start")), _parse_clock(match.group("end"))

    inferred_match = re.search(
        r"(?P<start>\d{1,2}(?::\d{2})?)\s*-\s*(?P<end>\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)",
        cleaned,
        re.IGNORECASE,
    )
    if inferred_match:
        end_token = inferred_match.group("end")
        meridian_match = re.search(r"([ap]\.?m\.?)", end_token, flags=re.IGNORECASE)
        start_token = inferred_match.group("start")
        if meridian_match:
            start_token = f"{start_token} {meridian_match.group(1)}"
        return _parse_clock(start_token), _parse_clock(end_token)

    at_match = re.search(
        r"\bat\s+(?P<start>\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)",
        cleaned,
        re.IGNORECASE,
    )
    if at_match:
        start = _parse_clock(at_match.group("start"))
        if start:
            return start, None
    return None, None


def parse_event_datetime(
    date_text: str | None,
    time_text: str | None = None,
    *,
    default_tz: str = "America/Chicago",
) -> tuple[Optional[datetime], Optional[datetime]]:
    if not date_text:
        return None, None
    start_time, end_time = parse_time_range(time_text)
    cleaned_date = clean_text(date_text)
    try:
        parsed = dtparse.parse(cleaned_date)
    except (ValueError, TypeError, OverflowError):
        return None, None

    if start_time:
        start_dt = parsed.replace(
            hour=start_time.hour,
            minute=start_time.minute,
            second=0,
            microsecond=0,
        )
    else:
        start_dt = parsed.replace(hour=0, minute=0, second=0, microsecond=0)

    if end_time:
        end_dt = parsed.replace(
            hour=end_time.hour,
            minute=end_time.minute,
            second=0,
            microsecond=0,
        )
        if end_dt < start_dt:
            end_dt += timedelta(days=1)
    else:
        end_dt = None

    return start_dt, end_dt


def _weekday_tokens(text: str) -> list[int]:
    return list(
        dict.fromkeys(
            WEEKDAY_INDEX[token]
            for token in re.findall(
                r"\b(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b",
                text,
                flags=re.IGNORECASE,
            )
        )
    )


def infer_recurrence_rule(text: str | None, *, time_hint: str | None = None) -> Optional[RecurrenceRule]:
    if not text:
        return None
    cleaned = clean_text(text).lower().replace("–", "-").replace("—", "-")
    start_time, end_time = parse_time_range(time_hint or cleaned)
    all_day = "all day" in cleaned

    range_match = re.search(
        r"\b(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*-\s*"
        r"(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b",
        cleaned,
    )
    if range_match:
        start_idx = WEEKDAY_INDEX[range_match.group(1)]
        end_idx = WEEKDAY_INDEX[range_match.group(2)]
        weekdays: list[int] = []
        current = start_idx
        while True:
            weekdays.append(current)
            if current == end_idx:
                break
            current = (current + 1) % 7
        label = ",".join(calendar.day_abbr[index].upper()[:2] for index in weekdays)
        return RecurrenceRule(
            pattern=f"weekly:{label}",
            weekdays=weekdays,
            start_time=start_time,
            end_time=end_time,
            all_day=all_day,
        )

    weekdays = _weekday_tokens(cleaned)
    if "every" in cleaned and weekdays:
        label = ",".join(calendar.day_abbr[index].upper()[:2] for index in weekdays)
        return RecurrenceRule(
            pattern=f"weekly:{label}",
            weekdays=weekdays,
            start_time=start_time,
            end_time=end_time,
            all_day=all_day,
        )

    if "every day" in cleaned or "daily" in cleaned:
        return RecurrenceRule(
            pattern="daily",
            weekdays=list(range(7)),
            start_time=start_time,
            end_time=end_time,
            all_day=all_day,
        )

    monthly = re.search(
        r"\b(first|second|third|fourth|last)\s+([a-z]+day)\s+of\s+the\s+month\b",
        cleaned,
    )
    if monthly:
        ordinal = ORDINAL_INDEX.get(monthly.group(1))
        weekday = WEEKDAY_INDEX.get(monthly.group(2))
        if weekday is not None:
            return RecurrenceRule(
                pattern=f"monthly:{monthly.group(1)}_{calendar.day_abbr[weekday].upper()}",
                weekdays=[weekday],
                start_time=start_time,
                end_time=end_time,
                ordinal=ordinal,
                all_day=all_day,
            )

    return None


def _combine(date_value: datetime, clock: Optional[time]) -> datetime:
    if clock is None:
        return date_value.replace(hour=0, minute=0, second=0, microsecond=0)
    return date_value.replace(
        hour=clock.hour,
        minute=clock.minute,
        second=0,
        microsecond=0,
    )


def next_window_from_recurrence(
    rule: RecurrenceRule,
    *,
    reference: Optional[datetime] = None,
    default_duration_minutes: int = 120,
) -> tuple[Optional[datetime], Optional[datetime]]:
    now = reference or datetime.now()
    for offset in range(0, 90):
        candidate = now + timedelta(days=offset)
        if rule.ordinal is not None:
            if candidate.weekday() not in rule.weekdays:
                continue
            occurrence = (candidate.day - 1) // 7 + 1
            if rule.ordinal > 0 and occurrence != rule.ordinal:
                continue
            if rule.ordinal < 0:
                next_week = candidate + timedelta(days=7)
                if next_week.month == candidate.month:
                    continue
        elif candidate.weekday() not in rule.weekdays:
            continue

        start_dt = _combine(candidate, rule.start_time)
        end_dt = (
            _combine(candidate, rule.end_time)
            if rule.end_time
            else start_dt + timedelta(minutes=default_duration_minutes)
        )
        if end_dt < start_dt:
            end_dt += timedelta(days=1)
        if end_dt >= now:
            return start_dt, end_dt
    return None, None
