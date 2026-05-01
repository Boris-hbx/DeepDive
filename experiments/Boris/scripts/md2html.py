#!/usr/bin/env python3
"""
md2html.py — Parse structured daily-report .md files and output variant-b-v2 styled HTML.

Usage:
    python3 md2html.py <input.md> <output.html> <report_dir>

    report_dir: directory containing all .md reports (for sidebar generation)
"""

import re
import sys
import os
from pathlib import Path
from html import escape

# ─── CSS (based on variant-b-v2, inlined) ───────────────────────────────────

CSS = """\
:root {
  --bg: #0d1117;
  --bg-soft: #161b22;
  --bg-deeper: #0a0d12;
  --border: #30363d;
  --border-soft: #21262d;
  --fg: #f0f6fc;
  --fg-soft: #c9d1d9;
  --fg-muted: #8b949e;
  --fg-dim: #6e7681;
  --accent: #39d353;
  --accent-soft: rgba(57, 211, 83, 0.12);
  --critique: #d29922;
  --critique-soft: rgba(210, 153, 34, 0.08);
  --link: #58a6ff;
  --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
  --sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --sidebar-w: 196px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--fg-soft);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  background-image: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(57,211,83,0.035), transparent 70%);
  background-attachment: fixed;
}
.topbar {
  position: sticky; top: 0; z-index: 20;
  background: rgba(13,17,23,0.88);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  padding: 12px 0;
  font-family: var(--mono); font-size: 13px;
}
.topbar-inner {
  max-width: 1280px; margin: 0 auto; padding: 0 24px;
  display: flex; align-items: center; justify-content: space-between;
}
.brand { color: var(--fg); font-weight: 600; }
.brand .prompt { color: var(--accent); margin-right: 6px; }
.brand .path { color: var(--fg-muted); }
.brand .cursor { display: inline-block; width: 8px; height: 14px; background: var(--accent); margin-left: 4px; vertical-align: middle; animation: blink 1.1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
.top-meta { display: flex; gap: 18px; color: var(--fg-dim); font-size: 11.5px; }
.top-meta .ok { color: var(--accent); }
.layout {
  max-width: 1280px; margin: 0 auto;
  display: grid; grid-template-columns: var(--sidebar-w) 1fr;
  gap: 0; min-height: calc(100vh - 50px);
}
@media (max-width: 920px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { position: static !important; max-height: 240px; overflow-y: auto; border-right: 0 !important; border-bottom: 1px solid var(--border); }
}
.sidebar {
  position: sticky; top: 50px;
  height: calc(100vh - 50px);
  overflow-y: auto;
  border-right: 1px solid var(--border);
  padding: 20px 10px 18px 14px;
  font-family: var(--mono);
  display: flex; flex-direction: column;
  scrollbar-width: none;
}
.sidebar::-webkit-scrollbar { display: none; }
.sidebar-title { font-size: 10.5px; color: var(--fg-muted); letter-spacing: 0.14em; margin-bottom: 10px; padding-left: 10px; }
.sidebar-list { list-style: none; flex: 1; }
.sb-item {
  display: flex; align-items: baseline; justify-content: space-between;
  text-decoration: none; color: var(--accent);
  padding: 5px 10px; border-left: 2px solid transparent;
  font-size: 12px; transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.sb-item:hover { background: var(--bg-soft); border-left-color: var(--border); }
.sb-item.active { background: var(--bg-soft); border-left-color: var(--accent); color: var(--fg); font-weight: 500; }
.sb-item .stats { font-size: 10px; color: var(--fg-dim); }
.sb-item.active .stats { color: var(--fg-muted); }
.sb-footer {
  margin-top: 12px; padding: 10px; font-size: 10px; color: var(--fg-dim); line-height: 1.6;
  border-top: 1px dashed var(--border-soft);
}
.sb-footer .ok { color: var(--accent); }
.content { padding: 36px 36px 80px; max-width: 920px; width: 100%; }
@media (max-width: 600px) { .content { padding: 28px 22px 60px; } }
.article-head {
  background: var(--bg-soft); border: 1px solid var(--border);
  border-radius: 8px; padding: 22px 26px; margin-bottom: 36px; position: relative;
}
.article-head::before {
  content: ''; position: absolute; top: 0; left: 0; bottom: 0;
  width: 3px; background: var(--accent); border-radius: 2px 0 0 2px;
}
.ah-eyebrow { font-family: var(--mono); font-size: 11px; color: var(--accent); margin-bottom: 8px; letter-spacing: 0.05em; }
.article-head h1 { font-family: var(--mono); font-size: 26px; font-weight: 700; color: var(--fg); letter-spacing: -0.01em; margin-bottom: 12px; line-height: 1.25; }
.ah-summary { color: var(--fg-soft); font-size: 14.5px; }
.ah-stats { font-family: var(--mono); font-size: 12px; color: var(--fg-dim); margin-top: 10px; }
.ah-stats span { color: var(--accent); }
.section { margin: 40px 0; }
.section-h {
  font-family: var(--mono); font-size: 18px; font-weight: 600;
  color: var(--fg); margin-bottom: 16px; line-height: 1.4;
}
.section-h .marker { color: var(--accent); margin-right: 10px; }
.section-body { color: var(--fg-soft); font-size: 14.8px; margin-bottom: 18px; line-height: 1.7; }
.primary-source { font-family: var(--mono); font-size: 12.5px; margin: 10px 0 12px; }
.primary-source::before { content: '\\2514\\2500 \\6765\\6E90:  '; color: var(--fg-dim); }
.primary-source a { color: var(--link); text-decoration: none; border-bottom: 1px dotted var(--link); }
.primary-source a:hover { background: rgba(88,166,255,0.1); }
details.related {
  background: var(--bg-deeper); border: 1px solid var(--border-soft);
  border-radius: 6px; margin-bottom: 12px; font-family: var(--mono); font-size: 12px;
  transition: border-color 0.12s;
}
details.related:hover { border-color: var(--border); }
details.related[open] { padding-bottom: 12px; }
details.related summary {
  cursor: pointer; list-style: none; padding: 10px 16px;
  color: var(--fg-muted); user-select: none;
  display: flex; align-items: center; gap: 10px; transition: color 0.12s;
}
details.related summary::-webkit-details-marker { display: none; }
details.related summary::before {
  content: '\\25B8'; color: var(--accent); font-size: 11px;
  transition: transform 0.18s ease; display: inline-block; width: 12px;
}
details.related[open] summary::before { transform: rotate(90deg); }
details.related summary:hover { color: var(--fg-soft); }
details.related summary .count {
  color: var(--accent); font-weight: 500; background: var(--accent-soft);
  padding: 1px 7px; border-radius: 3px; font-size: 11px;
}
details.related summary .label { color: var(--fg-dim); font-style: italic; margin-left: -2px; }
details.related ul { list-style: none; padding: 4px 16px 0 32px; }
details.related li { padding: 5px 0; color: var(--fg-muted); display: flex; align-items: baseline; gap: 8px; }
details.related li::before { content: '\\00B7'; color: var(--accent); }
details.related li a {
  color: var(--link); text-decoration: none; flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  border-bottom: 1px dotted transparent;
}
details.related li a:hover { border-bottom-color: var(--link); }
.dashed-div { margin: 10px 0 14px; border-top: 1px dashed var(--border-soft); }
.critique-block {
  background: var(--critique-soft); border-left: 3px solid var(--critique);
  border-radius: 0 6px 6px 0; padding: 16px 22px; margin: 0 0 12px;
}
.critique-h {
  font-family: var(--mono); font-size: 14px; color: var(--critique);
  font-weight: 600; margin-bottom: 14px; letter-spacing: 0.02em;
}
.critique-h::before { content: '\\2694  '; }
.quote-box {
  background: var(--bg-deeper); border: 1px solid var(--border-soft);
  border-radius: 4px; padding: 12px 16px; margin-bottom: 14px;
}
.quote-label { font-family: var(--mono); font-size: 10.5px; color: var(--fg-dim); letter-spacing: 0.06em; margin-bottom: 6px; }
.quote-text { font-family: var(--mono); font-size: 13.5px; color: var(--fg-soft); line-height: 1.6; }
.analysis-label { font-family: var(--mono); font-size: 10.5px; color: var(--critique); letter-spacing: 0.06em; margin-bottom: 8px; }
.analysis-body { font-size: 14.5px; color: var(--fg-soft); line-height: 1.7; }
.section-hr {
  margin: 48px 0 36px; height: 32px; position: relative;
  display: flex; align-items: center; justify-content: center;
}
.section-hr::before, .section-hr::after {
  content: ''; position: absolute; top: 50%; height: 0;
  border-top: 2px solid var(--border); width: calc(50% - 60px);
}
.section-hr::before { left: 0; }
.section-hr::after { right: 0; }
.section-hr-tag {
  background: var(--bg); border: 1px solid var(--border); border-radius: 4px;
  padding: 6px 18px; font-family: var(--mono); font-size: 12.5px;
  color: var(--fg); font-weight: 600; letter-spacing: 0.12em; z-index: 1;
  box-shadow: 0 0 0 4px var(--bg);
}
.section-hr-tag .marker { color: var(--accent); margin-right: 6px; }
.secondary-h {
  font-family: var(--mono); font-size: 17px; color: var(--fg); font-weight: 600; margin: 64px 0 12px;
}
.secondary-h::before { content: '## '; color: var(--accent); }
.secondary-lede { font-size: 13px; color: var(--fg-muted); margin-bottom: 18px; }
.secondary { list-style: none; }
.secondary li {
  padding: 10px 0 10px 16px; border-bottom: 1px dashed var(--border-soft);
  font-size: 14px; position: relative;
}
.secondary li::before { content: '\\2022'; color: var(--accent); position: absolute; left: 0; font-family: var(--mono); }
.secondary li:last-child { border-bottom: 0; }
.secondary a { color: var(--link); text-decoration: none; border-bottom: 1px dotted rgba(88,166,255,0.4); }
.secondary a:hover { border-bottom-color: var(--link); background: rgba(88,166,255,0.08); }
.observation { margin: 48px 0 0; padding: 20px 24px; background: var(--bg-soft); border: 1px solid var(--border); border-radius: 8px; }
.observation-h { font-family: var(--mono); font-size: 13px; color: var(--accent); margin-bottom: 10px; letter-spacing: 0.05em; }
.observation-body { font-size: 14.5px; color: var(--fg-soft); line-height: 1.7; }
.footer {
  margin-top: 64px; padding-top: 24px;
  border-top: 1px dashed var(--border);
  font-family: var(--mono); font-size: 11px; color: var(--fg-dim);
  display: flex; justify-content: space-between;
}
.footer a { color: var(--critique); text-decoration: none; }
.footer a:hover { text-decoration: underline; }
"""


# ─── Parser ──────────────────────────────────────────────────────────────────

def parse_report(text):
    """Parse a structured .md report into a dict of components."""
    report = {
        'date': '',
        'summary': '',
        'sources_count': '',
        'scanned_count': '',
        'selected_count': '',
        'top_stories': [],
        'secondary': [],
        'observation': '',
        'critiques': [],
    }

    # Date
    m = re.search(r'^# Daily Brief — (\d{4}-\d{2}-\d{2})', text, re.M)
    if m:
        report['date'] = m.group(1)

    # Summary line
    m = re.search(r'^> 一句话摘要：(.+)$', text, re.M)
    if m:
        report['summary'] = m.group(1).strip()

    # Stats line
    m = re.search(r'数据源：(\d+)\s*个\s*/\s*已扫条目：(\d+)\s*/\s*入选条目：(\d+)', text)
    if m:
        report['sources_count'] = m.group(1)
        report['scanned_count'] = m.group(2)
        report['selected_count'] = m.group(3)

    # Split into major sections
    sections = re.split(r'^## ', text, flags=re.M)

    for section in sections:
        if section.startswith('最关注的事'):
            report['top_stories'] = parse_top_stories(section)
        elif section.startswith('值得一看的事'):
            report['secondary'] = parse_secondary(section)
        elif section.startswith('今日观察小结'):
            lines = section.split('\n', 1)
            if len(lines) > 1:
                report['observation'] = lines[1].strip()
        elif section.startswith('蓝军反驳'):
            report['critiques'] = parse_critiques(section)

    return report


def parse_top_stories(section):
    """Parse the 最关注的事 section into list of stories."""
    stories = []
    parts = re.split(r'^### \d+\.\s*', section, flags=re.M)

    for part in parts[1:]:  # skip the header
        story = {'title': '', 'body': '', 'source_text': '', 'source_url': '', 'source_date': '', 'related': []}

        lines = part.strip().split('\n')
        story['title'] = lines[0].strip()

        body_lines = []
        i = 1
        while i < len(lines):
            line = lines[i]
            if line.startswith('来源：'):
                m = re.search(r'\[([^\]]+)\]\(([^)]+)\)', line)
                if m:
                    story['source_text'] = m.group(1)
                    story['source_url'] = m.group(2)
                # Extract date after " · "
                dm = re.search(r'·\s*(.+)$', line)
                if dm:
                    story['source_date'] = dm.group(1).strip()
                i += 1
                continue
            elif line.startswith('相关来源：'):
                i += 1
                while i < len(lines) and lines[i].startswith('- '):
                    m = re.search(r'\[([^\]]+)\]\(([^)]+)\)', lines[i])
                    if m:
                        story['related'].append({'text': m.group(1), 'url': m.group(2)})
                    i += 1
                continue
            elif line.strip():
                body_lines.append(line)
            i += 1

        story['body'] = ' '.join(body_lines).strip()
        stories.append(story)

    return stories


def parse_secondary(section):
    """Parse 值得一看的事 section."""
    items = []
    for m in re.finditer(r'^- (.+?)(?:\s*—\s*\[([^\]]*)\]\(([^)]+)\)(.*))?$', section, re.M):
        text = m.group(1).strip()
        source = m.group(2) or ''
        url = m.group(3) or ''
        trailing = m.group(4) or ''
        if source:
            text = re.sub(r'\s*—\s*$', '', text)
        # Extract date from trailing " · {date}"
        date = ''
        dm = re.search(r'·\s*(.+)', trailing)
        if dm:
            date = dm.group(1).strip()
        items.append({'text': text, 'source': source, 'url': url, 'date': date})
    return items


def parse_critiques(section):
    """Parse 蓝军反驳 section."""
    critiques = []
    parts = re.split(r'^### 反驳 #\d+（针对\s*(.+?)）', section, flags=re.M)

    i = 1
    while i < len(parts) - 1:
        target = parts[i].strip()
        body = parts[i + 1]

        quote = ''
        analysis = ''

        m = re.search(r'\*\*原文观点\*\*[：:]\s*(.+?)(?=\n\n|\*\*蓝军)', body, re.S)
        if m:
            quote = m.group(1).strip().strip('「」')

        m = re.search(r'\*\*蓝军视角分析\*\*[：:]\s*(.+)', body, re.S)
        if m:
            analysis = m.group(1).strip()

        critiques.append({'target': target, 'quote': quote, 'analysis': analysis})
        i += 2

    return critiques


# ─── HTML Generator ──────────────────────────────────────────────────────────

def get_sidebar_dates(report_dir, current_date):
    """Get list of unique report dates for sidebar."""
    dates = []
    seen = set()
    report_path = Path(report_dir)
    if report_path.exists():
        for f in sorted(report_path.glob('*.md'), reverse=True):
            m = re.match(r'^(\d{4}-\d{2}-\d{2})', f.stem)
            if m:
                d = m.group(1)
                if d not in seen:
                    seen.add(d)
                    dates.append(d)
    return dates


def url_to_display(url):
    """Convert URL to short display form."""
    url = re.sub(r'^https?://(www\.)?', '', url)
    if len(url) > 50:
        url = url[:47] + '...'
    return url


def render_html(report, report_dir):
    """Render parsed report to HTML string."""
    date = report['date']
    sidebar_dates = get_sidebar_dates(report_dir, date)

    # Build sidebar items
    sidebar_items = ''
    for d in sidebar_dates:
        active = ' active' if d == date else ''
        href = f'{d}.html' if d != date else '#'
        sidebar_items += f'      <li><a class="sb-item{active}" href="{href}">{d}</a></li>\n'

    # Build top stories
    stories_html = ''
    for idx, story in enumerate(report['top_stories']):
        num = f'{idx+1:02d}'

        # Section divider (not before first)
        if idx > 0:
            stories_html += f'    <div class="section-hr"><span class="section-hr-tag"><span class="marker">&sect;</span>{num}</span></div>\n\n'

        # Related sources
        related_html = ''
        if story['related']:
            related_items = ''
            for r in story['related']:
                related_items += f'          <li><a target="_blank" rel="noopener" href="{escape(r["url"])}">{escape(r["text"])}</a></li>\n'
            related_html = f'''
      <details class="related">
        <summary><span class="count">+{len(story["related"])}</span> 相关来源 <span class="label">&middot; 仅供参考</span></summary>
        <ul>
{related_items}        </ul>
      </details>'''

        # Find matching critique
        critique_html = ''
        for c in report['critiques']:
            if idx < len(report['critiques']) and c == report['critiques'][idx]:
                critique_html = f'''
      <div class="critique-block">
        <div class="critique-h">蓝军</div>
        <div class="quote-box">
          <div class="quote-label">原文观点</div>
          <div class="quote-text">{escape(c["quote"])}</div>
        </div>
        <div class="analysis-label">蓝军视角分析</div>
        <div class="analysis-body">{escape(c["analysis"])}</div>
      </div>'''
                break

        # Date display for source
        date_html = ''
        if story['source_date']:
            date_html = f' <span style="color:var(--fg-dim); font-size:11px;">&middot; {escape(story["source_date"])}</span>'

        stories_html += f'''    <section class="section">
      <h2 class="section-h"><span class="marker">## [{num}]</span>{escape(story["title"])}</h2>
      <p class="section-body">{escape(story["body"])}</p>
      <div class="primary-source">
        <a target="_blank" rel="noopener" href="{escape(story["source_url"])}">{escape(url_to_display(story["source_url"]))}</a>{date_html}
      </div>
{related_html}
      <div class="dashed-div"></div>
{critique_html}
    </section>

'''

    # Build secondary list
    secondary_html = ''
    for item in report['secondary']:
        date_part = f' <span style="color:var(--fg-dim); font-size:12px;">&middot; {escape(item["date"])}</span>' if item.get('date') else ''
        if item['url']:
            secondary_html += f'      <li>{escape(item["text"])} &mdash; <a target="_blank" rel="noopener" href="{escape(item["url"])}">{escape(item["source"])}</a>{date_part}</li>\n'
        else:
            secondary_html += f'      <li>{escape(item["text"])}{date_part}</li>\n'

    # Observation
    observation_html = ''
    if report['observation']:
        observation_html = f'''
    <div class="observation">
      <div class="observation-h">// 今日观察小结</div>
      <div class="observation-body">{escape(report["observation"])}</div>
    </div>
'''

    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Daily Brief {date} &mdash; DeepDive Boris</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
{CSS}
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-inner">
    <div class="brand"><span class="prompt">~</span><span>boris</span><span class="path">/deepdive/briefs/{date}</span><span class="cursor"></span></div>
    <div class="top-meta">
      <span><span class="ok">&#9679;</span> {report["sources_count"]} sources</span>
      <span>scanned {report["scanned_count"]} items</span>
    </div>
  </div>
</div>

<div class="layout">

  <aside class="sidebar">
    <div class="sidebar-title">DAILY BRIEFS</div>
    <ul class="sidebar-list">
{sidebar_items}    </ul>
    <div class="sb-footer">
      <span class="ok">&#9679;</span> auto-build via gh-actions
    </div>
  </aside>

  <main class="content">

    <header class="article-head">
      <div class="ah-eyebrow">brief/{date}.md &middot; agentic-software-engineering</div>
      <h1>Daily Brief &mdash; {date}</h1>
      <div class="ah-summary">
        {escape(report["summary"])}
        <div class="ah-stats">sources=<span>{report["sources_count"]}</span> &middot; scanned=<span>{report["scanned_count"]}</span> &middot; selected=<span>{report["selected_count"]}</span></div>
      </div>
    </header>

{stories_html}
    <h2 class="secondary-h">值得一看的事</h2>
    <p class="secondary-lede">没进章节但值得一瞥的条目，按重要性排。</p>
    <ul class="secondary">
{secondary_html}    </ul>

{observation_html}
    <div class="footer">
      <span>// DeepDive Boris &middot; agentic-se daily brief</span>
      <span><a href="index.html">&larr; 全部报告</a></span>
    </div>
  </main>
</div>

</body>
</html>'''

    return html


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 4:
        print(f"Usage: {sys.argv[0]} <input.md> <output.html> <report_dir>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    report_dir = sys.argv[3]

    with open(input_path, 'r', encoding='utf-8') as f:
        text = f.read()

    report = parse_report(text)
    html = render_html(report, report_dir)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"  {os.path.basename(input_path)} -> {os.path.basename(output_path)}")


if __name__ == '__main__':
    main()
