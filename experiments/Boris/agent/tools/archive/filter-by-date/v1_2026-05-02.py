tools/filter-by-date.py
```

#!/usr/bin/env python3
"""Filter a JSON array of objects by a date field, keeping only items within a target date range.

Usage:
    echo '[{"created_at":"2025-01-15"},...]' | python tools/filter-by-date.py --date-field created_at --target-date 2025-01-15 --range-days 0
    python tools/filter-by-date.py --input items.json --date-field created_at
    python tools/filter-by-date.py --input items.json --date-field created_at --target-date 2025-07-14 --range-days 1

Arguments:
    --input         Path to a JSON file containing the array (reads from stdin if omitted)
    --date-field    Name of the date field in each object (e.g. 'created_at')
    --target-date   Target date in YYYY-MM-DD format (defaults to today)
    --range-days    Number of days to extend backward from target_date (0 = only that day)

Output:
    Filtered JSON array printed to stdout.
"""

import argparse
import json
import sys
from datetime import datetime, timedelta


def parse_date(value):
    """Try to parse a date string in several common formats.

    Supports:
        - YYYY-MM-DD
        - YYYY-MM-DDTHH:MM:SS (with optional fractional seconds)
        - YYYY-MM-DDTHH:MM:SSZ / +00:00 style offsets
        - Unix timestamp (int or float)
    Returns a datetime.date or raises ValueError.
    """
    if isinstance(value, (int, float)):
        return datetime.utcfromtimestamp(value).date()

    if isinstance(value, str):
        text = value.strip()

        # Try unix timestamp encoded as string
        try:
            ts = float(text)
            return datetime.utcfromtimestamp(ts).date()
        except ValueError:
            pass

        # Strip timezone suffix for simpler parsing
        clean = text.replace("Z", "").replace("z", "")
        # Remove UTC offset like +00:00 or -05:00
        if "+" in clean[10:]:
            clean = clean[: clean.index("+", 10)]
        # Careful with minus: only strip offset portion after the date part
        if len(clean) > 19 and "-" in clean[19:]:
            clean = clean[:19]

        for fmt in (
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y/%m/%d",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
        ):
            try:
                return datetime.strptime(clean, fmt).date()
            except ValueError:
                continue

    raise ValueError(f"Unable to parse date from value: {value!r}")


def filter_by_date(items, date_field, target_date, range_days):
    """Return items whose date_field falls within [target_date - range_days, target_date]."""
    end_date = target_date
    start_date = target_date - timedelta(days=range_days)

    filtered = []
    skipped = 0
    for item in items:
        if date_field not in item:
            skipped += 1
            continue
        try:
            item_date = parse_date(item[date_field])
        except ValueError:
            skipped += 1
            continue
        if start_date <= item_date <= end_date:
            filtered.append(item)

    if skipped > 0:
        print(
            f"[filter-by-date] Warning: {skipped} item(s) skipped (missing or unparseable '{date_field}')",
            file=sys.stderr,
        )

    return filtered


def main():
    parser = argparse.ArgumentParser(
        description="Filter a JSON array of objects by a date field within a date range."
    )
    parser.add_argument(
        "--input",
        default=None,
        help="Path to JSON file with the array. Reads from stdin if omitted.",
    )
    parser.add_argument(
        "--date-field",
        required=True,
        help="Name of the date field in each object (e.g. 'created_at').",
    )
    parser.add_argument(
        "--target-date",
        default=None,
        help="Target date in YYYY-MM-DD format. Defaults to today.",
    )
    parser.add_argument(
        "--range-days",
        type=int,
        default=0,
        help="Days to extend backward from target date. 0 = only target day.",
    )

    args = parser.parse_args()

    # Resolve target date
    if args.target_date:
        try:
            target = datetime.strptime(args.target_date, "%Y-%m-%d").date()
        except ValueError:
            print(
                f"Error: --target-date must be in YYYY-MM-DD format, got '{args.target_date}'",
                file=sys.stderr,
            )
            sys.exit(1)
    else:
        target = datetime.now().date()

    if args.range_days < 0:
        print("Error: --range-days must be >= 0", file=sys.stderr)
        sys.exit(1)

    # Read input
    try:
        if args.input:
            with open(args.input, "r", encoding="utf-8") as f:
                raw = f.read()
        else:
            if sys.stdin.isatty():
                print(
                    "Error: No --input file and no data on stdin. Pipe JSON or use --input.",
                    file=sys.stderr,
                )
                sys.exit(1)
            raw = sys.stdin.read()
    except FileNotFoundError:
        print(f"Error: File not found: {args.input}", file=sys.stderr)
        sys.exit(1)
    except IOError as e:
        print(f"Error reading input: {e}", file=sys.stderr)
        sys.exit(1)

    # Parse JSON
    try:
        items = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(items, list):
        print("Error: JSON input must be an array of objects.", file=sys.stderr)
        sys.exit(1)

    # Filter
    result = filter_by_date(items, args.date_field, target, args.range_days)

    # Output
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
