#!/usr/bin/env python3
import argparse
import base64
import json
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from io import BytesIO
from pathlib import Path

import pandas as pd

API = "https://www.vietcombank.com.vn/api/exchangerates/exportexcel"
ROOT = Path(__file__).resolve().parents[2]
HISTORY_FILE = ROOT / "data" / "currency-history.json"

def number(value):
    if value is None:
        return None
    text = str(value).replace(",", "").strip()
    if not text or text == "-":
        return None
    try:
        return float(text)
    except ValueError:
        return None

def fetch_day(day):
    url = API + "?" + urllib.parse.urlencode({"date": day.isoformat()})
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "OpenPhuQuoc-Currency-Backfill/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))

    encoded = payload.get("Data")
    if not encoded:
        return []

    frame = pd.read_excel(BytesIO(base64.b64decode(encoded)), sheet_name="ExchangeRate")
    if frame.empty or len(frame.columns) != 5 or len(frame) < 3:
        return []

    frame.columns = ["CurrencyCode", "CurrencyName", "BuyCash", "BuyTransfer", "Sell"]
    frame = frame.iloc[2:].copy()
    frame["CurrencyCode"] = frame["CurrencyCode"].astype(str).str.strip().str.upper()
    frame = frame[frame["CurrencyCode"].str.fullmatch(r"[A-Z]{3}", na=False)]

    rows = []
    for _, item in frame.iterrows():
        rows.append(
            {
                "at": day.isoformat() + "T00:00:00+07:00",
                "source_date": day.isoformat(),
                "granularity": "daily",
                "currency": item["CurrencyCode"],
                "cash_buy": number(item["BuyCash"]),
                "transfer_buy": number(item["BuyTransfer"]),
                "sell": number(item["Sell"]),
            }
        )
    return rows

def daterange(start, end):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("start")
    parser.add_argument("end")
    parser.add_argument("--delay", type=float, default=0.65)
    args = parser.parse_args()

    start = date.fromisoformat(args.start)
    end = date.fromisoformat(args.end)
    if end < start:
        raise SystemExit("end must be >= start")

    if HISTORY_FILE.exists():
        history = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    else:
        history = {"schema_version": "1.0", "source": "vietcombank", "points": []}

    old_points = history.get("points") or []
    keep = [
        p for p in old_points
        if not (
            p.get("granularity") == "daily"
            and args.start <= str(p.get("source_date", "")) <= args.end
        )
    ]

    collected = []
    day_count = 0
    for day in daterange(start, end):
        try:
            rows = fetch_day(day)
        except Exception as exc:
            raise RuntimeError(f"Failed on {day}: {exc}") from exc
        if rows:
            day_count += 1
            collected.extend(rows)
            print(f"{day}: {len(rows)} currencies")
        else:
            print(f"{day}: no published data")
        time.sleep(args.delay)

    if not collected:
        raise RuntimeError("No historical Vietcombank data returned for requested range")

    dedup = {}
    for point in keep + collected:
        key = (str(point.get("at")), str(point.get("currency")))
        dedup[key] = point

    points = sorted(
        dedup.values(),
        key=lambda p: (str(p.get("at", "")), str(p.get("currency", ""))),
    )

    history.update(
        {
            "schema_version": "1.1",
            "source": "vietcombank",
            "source_endpoint": API,
            "backfill": {
                "start_date": args.start,
                "end_date": args.end,
                "calendar_days": (end - start).days + 1,
                "published_days": day_count,
                "method": "official_vietcombank_excel_export",
                "date_anchor": "00:00 Asia/Ho_Chi_Minh for date-only historical records",
            },
            "generated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            "points": points,
        }
    )
    HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Backfill complete: {day_count} published days, {len(collected)} points, {len(points)} total points")

if __name__ == "__main__":
    main()
