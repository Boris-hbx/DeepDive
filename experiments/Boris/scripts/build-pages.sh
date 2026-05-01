#!/usr/bin/env bash
set -euo pipefail

REPORT_DIR="experiments/Boris/daily-report"
OUT_DIR="experiments/Boris/_site"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

# --- CSS ---
cat > "$OUT_DIR/style.css" << 'CSSEOF'
:root { --bg: #0d1117; --fg: #e6edf3; --muted: #8b949e; --accent: #58a6ff; --border: #30363d; --card: #161b22; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.7; max-width: 800px; margin: 0 auto; padding: 2rem 1.5rem; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
h1 { font-size: 1.6rem; margin-bottom: 0.5rem; font-weight: 700; }
h2 { font-size: 1.25rem; margin-top: 2rem; margin-bottom: 0.75rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--border); }
h3 { font-size: 1.05rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }
p { margin-bottom: 0.8rem; }
blockquote { border-left: 3px solid var(--accent); padding: 0.5rem 1rem; margin: 1rem 0; color: var(--muted); background: var(--card); border-radius: 0 6px 6px 0; }
ul, ol { padding-left: 1.5rem; margin-bottom: 0.8rem; }
li { margin-bottom: 0.3rem; }
hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
code { font-family: 'JetBrains Mono', monospace; font-size: 0.9em; background: var(--card); padding: 0.15em 0.4em; border-radius: 4px; }
strong { color: #f0f6fc; }
.nav { margin-bottom: 2rem; font-size: 0.9rem; color: var(--muted); }
.nav a { margin-right: 1rem; }
.index-item { padding: 1rem; margin-bottom: 0.75rem; background: var(--card); border: 1px solid var(--border); border-radius: 8px; }
.index-item h3 { margin: 0 0 0.3rem 0; }
.index-item .date { color: var(--muted); font-size: 0.85rem; }
.index-item .summary { color: var(--muted); font-size: 0.9rem; margin-top: 0.3rem; }
CSSEOF

# --- Pandoc template ---
TMPL=$(mktemp)
cat > "$TMPL" << 'TMPLEOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$title$ — Boris DeepDive</title>
<link rel="stylesheet" href="style.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body>
<div class="nav"><a href="index.html">← 全部报告</a></div>
$body$
</body>
</html>
TMPLEOF

# --- Convert each .md → .html ---
count=0
for md in "$REPORT_DIR"/*.md; do
  [ -f "$md" ] || continue
  fname=$(basename "$md" .md)
  # skip non-date files like .gitkeep
  [[ "$fname" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]] || continue
  title=$(head -5 "$md" | grep '^# ' | head -1 | sed 's/^# //')
  [ -z "$title" ] && title="$fname"
  pandoc "$md" -o "$OUT_DIR/${fname}.html" \
    --standalone --template="$TMPL" \
    --metadata title="$title" \
    --from=gfm --to=html5
  count=$((count + 1))
done

# --- Generate index.html ---
cat > "$OUT_DIR/index.html" << 'IDXHEAD'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Boris DeepDive — Daily Reports</title>
<link rel="stylesheet" href="style.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body>
<h1>Boris DeepDive — Agentic SE 洞察日报</h1>
<p style="color: var(--muted); margin-bottom: 2rem;">每日扫描 11 个信息源，筛选 agentic software engineering 领域最值得关注的事。</p>
IDXHEAD

# List reports newest first
for md in $(ls -r "$REPORT_DIR"/*.md 2>/dev/null); do
  fname=$(basename "$md" .md)
  [[ "$fname" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]] || continue
  title=$(head -5 "$md" | grep '^# ' | head -1 | sed 's/^# //')
  [ -z "$title" ] && title="$fname"
  summary=$(grep '^> ' "$md" | head -1 | sed 's/^> //')
  date_part=$(echo "$fname" | grep -oP '^\d{4}-\d{2}-\d{2}')
  cat >> "$OUT_DIR/index.html" << ITEM
<div class="index-item">
  <h3><a href="${fname}.html">${title}</a></h3>
  <div class="date">${date_part}</div>
  <div class="summary">${summary}</div>
</div>
ITEM
done

cat >> "$OUT_DIR/index.html" << 'IDXFOOT'
</body>
</html>
IDXFOOT

rm -f "$TMPL"
echo "Built $count reports → $OUT_DIR/"
