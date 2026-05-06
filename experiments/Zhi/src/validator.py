"""Validate generated brief: check format compliance and URL accessibility."""

import re
import requests


def validate_format(brief_content):
    """Check if brief follows the spec contract structure.

    Returns (is_valid, list_of_issues).
    """
    issues = []

    if not brief_content.startswith("# Daily Brief —"):
        issues.append("Missing or malformed title (expected '# Daily Brief — YYYY-MM-DD')")

    if "> " not in brief_content:
        issues.append("Missing blockquote summary line")

    has_top_section = "## 最关注的事" in brief_content
    has_fallback = "今日无重要事件" in brief_content

    if not has_top_section and not has_fallback:
        issues.append("Missing '## 最关注的事' section or fallback text")

    if has_top_section:
        if "## 值得一看的事" not in brief_content:
            issues.append("Missing '## 值得一看的事' section")

        links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', brief_content)
        if not links:
            issues.append("No source links found")

        top_section = brief_content.split("## 最关注的事")[1]
        if "## 值得一看的事" in top_section:
            top_section = top_section.split("## 值得一看的事")[0]
        top_items = re.findall(r'### \d+\.', top_section)
        if len(top_items) > 3:
            issues.append(f"Too many items in '最关注的事': {len(top_items)} (max 3)")

    return len(issues) == 0, issues


def validate_urls(brief_content, timeout=10):
    """Check that all URLs in the brief are accessible.

    Returns (all_valid, list_of_broken_urls).
    """
    urls = re.findall(r'\[([^\]]+)\]\((https?://[^)]+)\)', brief_content)
    broken = []

    for title, url in urls:
        try:
            resp = requests.head(url, timeout=timeout, allow_redirects=True)
            if resp.status_code >= 400:
                resp = requests.get(url, timeout=timeout, allow_redirects=True)
                if resp.status_code >= 400:
                    broken.append({"title": title, "url": url, "status": resp.status_code})
        except requests.RequestException as e:
            broken.append({"title": title, "url": url, "status": str(e)})

    return len(broken) == 0, broken


def validate_brief(brief_content):
    """Run all validations and print results.

    Returns True if all checks pass.
    """
    print("[CHECK] Validating brief format...")
    fmt_ok, fmt_issues = validate_format(brief_content)
    if fmt_ok:
        print("[PASS] Format is valid.")
    else:
        print("[FAIL] Format issues:")
        for issue in fmt_issues:
            print(f"  - {issue}")

    print("[CHECK] Validating URLs...")
    urls_ok, broken = validate_urls(brief_content)
    if urls_ok:
        print("[PASS] All URLs accessible.")
    else:
        print("[WARN] Broken URLs:")
        for b in broken:
            print(f"  - {b['title']}: {b['url']} (status: {b['status']})")

    return fmt_ok and urls_ok
