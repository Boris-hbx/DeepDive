#!/usr/bin/env bash
set -euo pipefail

REPORT_DIR="experiments/Boris/daily-report"
OUT_DIR="experiments/Boris/_site"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# --- Convert each .md → .html via md2html.py ---
count=0
for md in "$REPORT_DIR"/*.md; do
  [ -f "$md" ] || continue
  fname=$(basename "$md" .md)
  [[ "$fname" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]] || continue
  ${PYTHON:-python3} "$SCRIPT_DIR/md2html.py" "$md" "$OUT_DIR/${fname}.html" "$REPORT_DIR"
  count=$((count + 1))
done

# --- Generate index.html (variant-b-v2 style) ---
INDEX="$OUT_DIR/index.html"

cat > "$INDEX" << 'HEADEOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Boris DeepDive — Agentic SE Daily Briefs</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
:root {
  --bg: #0d1117; --bg-soft: #161b22; --bg-deeper: #0a0d12;
  --border: #30363d; --border-soft: #21262d;
  --fg: #f0f6fc; --fg-soft: #c9d1d9; --fg-muted: #8b949e; --fg-dim: #6e7681;
  --accent: #39d353; --accent-soft: rgba(57,211,83,0.12);
  --link: #58a6ff;
  --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', 'Cascadia Code', monospace;
  --sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: var(--sans); background: var(--bg); color: var(--fg-soft);
  line-height: 1.65; -webkit-font-smoothing: antialiased;
  background-image: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(57,211,83,0.035), transparent 70%);
  background-attachment: fixed;
}
.topbar {
  position: sticky; top: 0; z-index: 20;
  background: rgba(13,17,23,0.88); backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border); padding: 12px 0;
  font-family: var(--mono); font-size: 13px;
}
.topbar-inner {
  max-width: 860px; margin: 0 auto; padding: 0 24px;
  display: flex; align-items: center; justify-content: space-between;
}
.brand { color: var(--fg); font-weight: 600; }
.brand .prompt { color: var(--accent); margin-right: 6px; }
.brand .path { color: var(--fg-muted); }
.brand .cursor { display: inline-block; width: 8px; height: 14px; background: var(--accent); margin-left: 4px; vertical-align: middle; animation: blink 1.1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }
.top-meta { color: var(--fg-dim); font-size: 11.5px; }
.top-meta .ok { color: var(--accent); }
.container { max-width: 860px; margin: 0 auto; padding: 36px 24px 80px; }
.page-head {
  background: var(--bg-soft); border: 1px solid var(--border);
  border-radius: 8px; padding: 22px 26px; margin-bottom: 36px; position: relative;
}
.page-head::before {
  content: ''; position: absolute; top: 0; left: 0; bottom: 0;
  width: 3px; background: var(--accent); border-radius: 2px 0 0 2px;
}
.page-head h1 { font-family: var(--mono); font-size: 24px; font-weight: 700; color: var(--fg); margin-bottom: 10px; }
.page-head p { color: var(--fg-muted); font-size: 14px; }
.page-head .stats { font-family: var(--mono); font-size: 12px; color: var(--fg-dim); margin-top: 8px; }
.page-head .stats span { color: var(--accent); }
.report-list { list-style: none; }
.report-item {
  padding: 18px 22px; margin-bottom: 10px;
  background: var(--bg-soft); border: 1px solid var(--border-soft);
  border-radius: 8px; transition: border-color 0.15s, background 0.15s;
  display: block; text-decoration: none; color: inherit;
}
.report-item:hover { border-color: var(--accent); background: var(--bg-deeper); }
.report-item .date {
  font-family: var(--mono); font-size: 13px; color: var(--accent);
  margin-bottom: 6px; letter-spacing: 0.03em;
}
.report-item .title { font-size: 15px; color: var(--fg); font-weight: 500; margin-bottom: 6px; }
.report-item .summary { font-size: 13.5px; color: var(--fg-muted); line-height: 1.5; }
.footer {
  margin-top: 48px; padding-top: 20px;
  border-top: 1px dashed var(--border);
  font-family: var(--mono); font-size: 11px; color: var(--fg-dim);
  display: flex; justify-content: space-between;
}
.footer a { color: var(--accent); text-decoration: none; }
.footer a:hover { text-decoration: underline; }
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-inner">
    <div class="brand"><span class="prompt">~</span><span>boris</span><span class="path">/deepdive/briefs</span><span class="cursor"></span></div>
HEADEOF

# Inject report count into topbar
echo "    <div class=\"top-meta\"><span class=\"ok\">&#9679;</span> ${count} briefs</div>" >> "$INDEX"

cat >> "$INDEX" << 'MIDEOF'
  </div>
</div>

<div class="container">
  <header class="page-head">
    <h1>Agentic SE Daily Briefs</h1>
    <p>每日扫描信息源，筛选 agentic software engineering 领域最值得关注的事。</p>
MIDEOF

echo "    <div class=\"stats\">total briefs: <span>${count}</span></div>" >> "$INDEX"

cat >> "$INDEX" << 'LISTHEAD'
  </header>

  <ul class="report-list">
LISTHEAD

# List reports newest first
for md in $(ls -r "$REPORT_DIR"/*.md 2>/dev/null); do
  fname=$(basename "$md" .md)
  [[ "$fname" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]] || continue
  title=$(head -5 "$md" | grep '^# ' | head -1 | sed 's/^# //' || true)
  [ -z "$title" ] && title="$fname"
  summary=$(grep '^> 一句话摘要：' "$md" | head -1 | sed 's/^> 一句话摘要：//' || true)
  [ -z "$summary" ] && summary=$(grep '^> ' "$md" | head -1 | sed 's/^> //' || true)
  cat >> "$INDEX" << ITEM
    <li><a class="report-item" href="${fname}.html">
      <div class="date">${fname}</div>
      <div class="title">${title}</div>
      <div class="summary">${summary}</div>
    </a></li>
ITEM
done

cat >> "$INDEX" << 'FOOTEOF'
  </ul>

  <div class="footer">
    <span>// DeepDive Boris &middot; agentic-se daily brief</span>
    <span>auto-build via gh-actions</span>
  </div>
</div>

</body>
</html>
FOOTEOF

echo "Built $count reports + index.html → $OUT_DIR/"
