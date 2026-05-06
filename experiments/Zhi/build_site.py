"""Generate a simple static HTML site from brief markdown files."""

import os
import glob


BRIEFS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "briefs")
SITE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "site")


def md_to_html(md_content):
    """Minimal markdown to HTML conversion for the brief format."""
    lines = md_content.split("\n")
    html_lines = []
    for line in lines:
        if line.startswith("# "):
            html_lines.append(f"<h1>{convert_links(line[2:])}</h1>")
        elif line.startswith("## "):
            html_lines.append(f"<h2>{convert_links(line[3:])}</h2>")
        elif line.startswith("### "):
            html_lines.append(f"<h3>{convert_links(line[4:])}</h3>")
        elif line.startswith("> "):
            html_lines.append(f"<blockquote>{convert_links(line[2:])}</blockquote>")
        elif line.startswith("- "):
            html_lines.append(f"<li>{convert_links(line[2:])}</li>")
        elif line.strip() == "":
            html_lines.append("<br>")
        else:
            html_lines.append(f"<p>{convert_links(line)}</p>")
    return "\n".join(html_lines)


def convert_links(text):
    """Convert markdown links [text](url) to HTML <a> tags."""
    import re
    return re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2" target="_blank">\1</a>', text)


def generate_site():
    """Generate index.html and individual brief pages."""
    os.makedirs(SITE_DIR, exist_ok=True)

    brief_files = sorted(glob.glob(os.path.join(BRIEFS_DIR, "*.md")), reverse=True)

    brief_links = []
    for bf in brief_files:
        date_str = os.path.basename(bf).replace(".md", "")
        html_name = f"{date_str}.html"

        with open(bf, "r", encoding="utf-8") as f:
            content = f.read()

        page_html = f"""<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Brief — {date_str}</title>
    <style>
        body {{ font-family: -apple-system, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }}
        a {{ color: #2563eb; }}
        blockquote {{ border-left: 3px solid #ddd; padding-left: 12px; color: #555; }}
    </style>
</head>
<body>
    <a href="index.html">&larr; Back</a>
    {md_to_html(content)}
</body>
</html>"""
        with open(os.path.join(SITE_DIR, html_name), "w", encoding="utf-8") as f:
            f.write(page_html)

        brief_links.append(f'<li><a href="{html_name}">{date_str}</a></li>')

    index_html = f"""<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DeepDive — Daily Briefs</title>
    <style>
        body {{ font-family: -apple-system, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }}
        a {{ color: #2563eb; }}
    </style>
</head>
<body>
    <h1>DeepDive — Daily Briefs</h1>
    <p>Agentic Software Engineering 每日洞察</p>
    <ul>
        {"".join(brief_links) if brief_links else "<li>暂无 brief，请先运行 pipeline。</li>"}
    </ul>
</body>
</html>"""

    with open(os.path.join(SITE_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(index_html)

    print(f"[INFO] Site generated at {SITE_DIR}/")


if __name__ == "__main__":
    generate_site()
