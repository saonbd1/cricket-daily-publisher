#!/usr/bin/env python3
"""Fetch *current* cricket matches (live now + still upcoming) into CSV / XLSX.

Scope
-----
Returns only matches that have not finished. Anything already completed, or
whose scheduled start is in the past, is dropped before writing. Use
``--include-finished`` if you ever want the full day's results too.

Data source
-----------
TheSportsDB's free, keyless ``eventsday.php`` endpoint, which returns every
cricket event on a given calendar day across all competitions.

Why not cricinfo.com? It was the originally requested source, but it does not
work for scripted access:

* ``https://www.cricinfo.com/...`` is blocked by an Akamai edge and returns
  HTTP 403 for any non-browser client.
* ``https://www.espncricinfo.com/cricket-fixtures`` does load with browser
  headers, but it no longer serves a fixture schedule. It renders a "Current
  Cricket" *series directory* whoses embedded ``__NEXT_DATA__`` holds only series
  listings -- no per-match rows, dates, venues or statuses.
* Cricinfo's backend API (``hs-consumer-api.espncricinfo.com``) returns 403
  without a private client token.

``--source cricinfo`` is still accepted so the attempt stays explicit; it fails
loudly with the reason rather than silently writing an empty sheet.

--source parsebot
-----------------
``--source parsebot`` goes through a Parse.bot proxy of the same Cricinfo page.
Set the key via the ``PARSEBOT_API_KEY`` environment variable (it is deliberately
not hardcoded here, since scripts/ is git-tracked)::

    export PARSEBOT_API_KEY=pmx_...
    python3 fetch_current_cricket_matches.py --source parsebot

Note: despite the endpoint name ``get_series_fixtures``, it returns *series*
rows -- tournament name, season and start/end dates -- with no venue, match
status, toss or per-match start time. Use it for a tournament-level schedule;
use the default source for individual match fixtures.

Only the Python standard library is required. XLSX output additionally needs
``openpyxl``; without it the script still writes the CSV and explains how to
enable the spreadsheet export.

Examples
--------
    python3 fetch_current_cricket_matches.py
    python3 fetch_current_cricket_matches.py --days 7 --format xlsx
    python3 fetch_current_cricket_matches.py --source parsebot
    python3 fetch_current_cricket_matches.py --tz-offset 6 --out matches.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Iterable

THESPORTSDB = "https://www.thesportsdb.com/api/v1/json/123"
CRICINFO_URL = "https://www.espncricinfo.com/cricket-fixtures"

# Parse.bot proxy for the Cricinfo fixtures page. The scraper id and the API key
# are supplied by the operator; the key is read from the PARSEBOT_API_KEY
# environment variable and is never stored in this file, because scripts/ is
# tracked by git.
PARSEBOT_URL = (
    "https://api.parse.bot/scraper/"
    "1d60bec3-9a21-42ea-8ee9-e5ef840ba233/get_series_fixtures"
)
PARSEBOT_API_KEY_ENV = "PARSEBOT_API_KEY"

# A realistic desktop browser fingerprint. Required because these CDNs reject
# obviously scripted clients outright.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Statuses meaning the match is over. Everything else (scheduled, live, an
# innings in progress, a toss) is still current and worth publishing.
FINISHED_PATTERN = re.compile(
    r"(match\s*finished|finished|completed|result|abandoned|no\s*result|"
    r"awarded|postponed|cancel+ed|tied)",
    re.IGNORECASE,
)

COLUMNS = [
    "event_id",
    "event",
    "tournament",
    "category",
    "home_team",
    "away_team",
    "status",
    "status_detail",
    "start_utc",
    "end_utc",
    "start_local",
    "venue",
    "city",
    "country",
    "round",
    "season",
    "source_url",
]


@dataclass
class Match:
    event_id: str = ""
    event: str = ""
    tournament: str = ""
    category: str = ""
    home_team: str = ""
    away_team: str = ""
    status: str = ""
    status_detail: str = ""
    start_utc: str = ""
    end_utc: str = ""
    start_local: str = ""
    venue: str = ""
    city: str = ""
    country: str = ""
    round: str = ""
    season: str = ""
    source_url: str = ""
    # Used for sorting only; never written to the sheet.
    _sort_key: datetime | None = field(default=None, repr=False)


def http_get_json(
    url: str,
    timeout: int = 25,
    retries: int = 3,
    extra_headers: dict[str, str] | None = None,
) -> dict:
    """GET a JSON endpoint with bounded exponential backoff."""
    headers = {**HEADERS, **(extra_headers or {})}
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8", "replace"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            if attempt < retries:
                time.sleep(1.5 * attempt)
    raise RuntimeError(f"request failed after {retries} attempts: {last_error}")


def parse_iso(value: object) -> datetime | None:
    """Parse an ISO-8601 timestamp, returning None when absent or malformed."""
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def parse_start_utc(event: dict) -> datetime | None:
    """Best-effort UTC start time from whichever field the API populated."""
    stamp = (event.get("strTimestamp") or "").strip()
    if stamp:
        try:
            parsed = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    date = (event.get("dateEvent") or "").strip()
    if not date:
        return None
    time_of_day = (event.get("strTime") or "").strip() or "00:00"
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            naive = datetime.strptime(f"{date} {time_of_day}".strip(), fmt)
        except ValueError:
            continue
        # TheSportsDB publishes strTime in UTC.
        return naive.replace(tzinfo=timezone.utc)
    return None


def is_current(
    event: dict, start: datetime | None, now: datetime, include_finished: bool
) -> bool:
    """Keep live and still-to-start matches; drop anything already over."""
    if include_finished:
        return True

    status = " ".join(str(event.get(key) or "") for key in ("strStatus", "strPostponed"))
    if FINISHED_PATTERN.search(status):
        return False

    # A scheduled match that never kicked off is still current, so only drop
    # events whose scheduled start has already passed.
    if start is not None and start < now:
        return False
    return True


# Providers use sentinel strings for "no value" (TheSportsDB sends "0" for
# intRound and "no" for strPostponed). Mirrors the NULL_SENTINELS handling in
# server/publisher/normalization.ts so the sheet has no placeholder junk.
NULL_SENTINELS = {"0", "-", "n/a", "na", "null", "undefined", "unknown", "tba", "tbc", "no"}


def clean(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text.lower() in NULL_SENTINELS else text


def resolve_status(event: dict, start: datetime | None, now: datetime) -> tuple[str, str]:
    """Return (status, status_detail).

    The free eventsday endpoint frequently omits ``strStatus`` entirely, so
    fall back only to what the start time actually proves: a future match has
    not started, a past one has. Never assert "Live" or a result we cannot see.
    """
    status = clean(event.get("strStatus"))
    postponed = str(event.get("strPostponed") or "").strip().lower() == "yes"
    if postponed:
        return "Postponed", "Postponed"
    if status:
        return status, ""
    if start is None:
        return "Unknown", ""
    return ("Scheduled" if start > now else "Started"), ""


def normalise(event: dict, tz_offset: int, now: datetime) -> Match:
    start = parse_start_utc(event)
    local = (
        start.astimezone(timezone(timedelta(hours=tz_offset))).strftime("%Y-%m-%d %H:%M")
        if start
        else ""
    )
    status, status_detail = resolve_status(event, start, now)

    event_id = str(event.get("idEvent") or "").strip()
    return Match(
        event_id=event_id,
        event=clean(event.get("strEvent")),
        tournament=clean(event.get("strLeague")),
        home_team=clean(event.get("strHomeTeam")),
        away_team=clean(event.get("strAwayTeam")),
        status=status,
        status_detail=status_detail,
        start_utc=start.strftime("%Y-%m-%d %H:%M") if start else "",
        start_local=local,
        venue=clean(event.get("strVenue")),
        city=clean(event.get("strCity")),
        country=clean(event.get("strCountry")),
        round=clean(event.get("intRound")),
        season=clean(event.get("strSeason")),
        source_url=f"https://www.thesportsdb.com/event/{event_id}" if event_id else "",
        _sort_key=start,
    )


def fetch_thesportsdb(days: int, tz_offset: int, include_finished: bool) -> list[Match]:
    now = datetime.now(timezone.utc)
    matches: list[Match] = []
    seen: set[str] = set()

    for offset in range(days):
        day = (now + timedelta(days=offset)).date()
        url = f"{THESPORTSDB}/eventsday.php?d={day.isoformat()}&s=Cricket"
        try:
            payload = http_get_json(url)
        except RuntimeError as error:
            # One bad day must not abort the whole window.
            print(f"  ! {day.isoformat()}: {error}", file=sys.stderr)
            continue

        events = payload.get("events") or []
        kept = 0
        for event in events:
            if not isinstance(event, dict):
                continue
            event_id = str(event.get("idEvent") or "").strip()
            if event_id and event_id in seen:
                continue
            start = parse_start_utc(event)
            if not is_current(event, start, now, include_finished):
                continue
            if event_id:
                seen.add(event_id)
            matches.append(normalise(event, tz_offset, now))
            kept += 1
        print(
            f"  {day.isoformat()}: {len(events)} events -> {kept} current",
            file=sys.stderr,
        )

    return matches


def fetch_parsebot(api_key: str, tz_offset: int, include_finished: bool) -> list[Match]:
    """Fetch the Cricinfo series schedule through the Parse.bot scraper proxy.

    Despite the endpoint name, this returns *series* (tournament) rows rather
    than individual fixtures: the payload carries a series name, season and
    start/end dates, and contains no venue, status, toss or per-match start
    time. Series that have already ended are dropped, matching the "current,
    not past" scope of this script.
    """
    now = datetime.now(timezone.utc)
    payload = http_get_json(PARSEBOT_URL, extra_headers={"X-API-Key": api_key})
    if payload.get("status") not in (None, "success"):
        raise RuntimeError(f"parse.bot returned an error: {payload.get('error') or payload}")

    collections = (payload.get("data") or {}).get("collections") or []
    matches: list[Match] = []
    seen: set[str] = set()

    for collection in collections:
        collection_title = clean(collection.get("title"))
        if not include_finished and "concluded" in collection_title.lower():
            continue

        for group in collection.get("seriesGroups") or []:
            category = clean(group.get("title"))
            for item in group.get("items") or []:
                series = item.get("series") or {}
                start = parse_iso(series.get("startDate"))
                end = parse_iso(series.get("endDate"))

                # "Current, not past": drop series that have already finished.
                if not include_finished and end is not None and end < now:
                    continue

                series_id = str(series.get("id") or "").strip()
                dedupe_key = series_id or f"{category}|{clean(item.get('title'))}"
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)

                local = (
                    start.astimezone(timezone(timedelta(hours=tz_offset))).strftime("%Y-%m-%d")
                    if start
                    else ""
                )
                slug = clean(series.get("slug"))
                matches.append(
                    Match(
                        event_id=series_id,
                        event=clean(item.get("title")),
                        tournament=clean(series.get("name")),
                        category=category,
                        status=(
                            "Current"
                            if "current" in collection_title.lower()
                            else "Upcoming"
                        ),
                        start_utc=start.strftime("%Y-%m-%d") if start else "",
                        end_utc=end.strftime("%Y-%m-%d") if end else "",
                        start_local=local,
                        season=clean(series.get("season")),
                        source_url=(
                            f"https://www.espncricinfo.com/series/{slug}" if slug else ""
                        ),
                        _sort_key=start,
                    )
                )

    return matches


def try_cricinfo(timeout: int = 25) -> list[Match]:
    """Attempt the originally requested source; explain clearly if it is blocked."""
    request = urllib.request.Request(CRICINFO_URL, headers=HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            html = response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        raise RuntimeError(
            f"cricinfo returned HTTP {error.code} for a scripted request. The site "
            "sits behind an Akamai edge that blocks non-browser clients."
        ) from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise RuntimeError(f"cricinfo could not be reached: {error}") from error

    if '"page":"/series/' in html.replace(" ", ""):
        raise RuntimeError(
            "cricinfo loaded, but that URL no longer serves a fixture schedule. It "
            "renders a 'Current Cricket' series directory whose embedded "
            "__NEXT_DATA__ holds series listings only, with no per-match dates, "
            "venues or statuses. Use --source thesportsdb (the default)."
        )
    raise RuntimeError(
        "cricinfo returned a page with no extractable fixture data. "
        "Use --source thesportsdb (the default)."
    )


def write_csv(matches: Iterable[Match], path: str) -> None:
    # utf-8-sig so Excel opens non-ASCII team/venue names correctly.
    with open(path, "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        for match in matches:
            writer.writerow({column: getattr(match, column) for column in COLUMNS})


def write_xlsx(matches: Iterable[Match], path: str) -> None:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font
    except ImportError as error:
        raise RuntimeError(
            "XLSX output needs openpyxl. Install it with:  pip install openpyxl"
        ) from error

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Current Matches"
    sheet.append(COLUMNS)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for match in matches:
        sheet.append([getattr(match, column) for column in COLUMNS])

    widths = {"event": 46, "tournament": 30, "venue": 34, "status": 18}
    for index, column in enumerate(COLUMNS, start=1):
        letter = sheet.cell(row=1, column=index).column_letter
        sheet.column_dimensions[letter].width = widths.get(column, 16)
    sheet.freeze_panes = "A2"
    workbook.save(path)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Save current (live + upcoming) cricket matches to CSV or XLSX."
    )
    parser.add_argument(
        "--source",
        choices=("thesportsdb", "parsebot", "cricinfo"),
        default="thesportsdb",
        help="Data source (default: thesportsdb).",
    )
    parser.add_argument("--days", type=int, default=3, help="Days ahead to scan (default: 3).")
    parser.add_argument("--format", choices=("csv", "xlsx", "both"), default="csv")
    parser.add_argument("--out", default=None, help="Output path override.")
    parser.add_argument(
        "--tz-offset", type=int, default=6, help="Local UTC offset in hours (default: 6)."
    )
    parser.add_argument(
        "--include-finished", action="store_true", help="Keep completed matches too."
    )
    args = parser.parse_args()

    if args.days < 1:
        parser.error("--days must be at least 1")

    if args.source == "cricinfo":
        try:
            matches = try_cricinfo()
        except RuntimeError as error:
            print(f"cricinfo source unavailable: {error}", file=sys.stderr)
            return 2
    elif args.source == "parsebot":
        api_key = os.environ.get(PARSEBOT_API_KEY_ENV, "").strip()
        if not api_key:
            print(
                f"Set the {PARSEBOT_API_KEY_ENV} environment variable to use the "
                "parsebot source. Add it to your .env (git-ignored) or export it:\n"
                f"    export {PARSEBOT_API_KEY_ENV}=<your-key>",
                file=sys.stderr,
            )
            return 2
        try:
            matches = fetch_parsebot(api_key, args.tz_offset, args.include_finished)
        except RuntimeError as error:
            print(f"parsebot source failed: {error}", file=sys.stderr)
            return 2
    else:
        print(f"Scanning {args.days} day(s) of cricket events...", file=sys.stderr)
        matches = fetch_thesportsdb(args.days, args.tz_offset, args.include_finished)

    # Soonest first; undated events sort last.
    matches.sort(
        key=lambda m: (
            m._sort_key is None,
            m._sort_key or datetime.max.replace(tzinfo=timezone.utc),
        )
    )

    if not matches:
        print("No current matches found.", file=sys.stderr)

    written: list[str] = []
    if args.format in ("csv", "both"):
        csv_path = args.out if args.out and args.format == "csv" else "current_matches.csv"
        write_csv(matches, csv_path)
        written.append(csv_path)
    if args.format in ("xlsx", "both"):
        xlsx_path = (
            args.out if args.out and args.format == "xlsx" else "current_matches.xlsx"
        )
        try:
            write_xlsx(matches, xlsx_path)
            written.append(xlsx_path)
        except RuntimeError as error:
            print(f"  ! {error}", file=sys.stderr)

    for path in written:
        print(f"Wrote {len(matches)} matches -> {path}")
    return 0 if written else 1


if __name__ == "__main__":
    raise SystemExit(main())
