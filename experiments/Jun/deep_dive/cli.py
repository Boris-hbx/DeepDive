"""CLI 主逻辑"""
import click
from pathlib import Path
from datetime import datetime
from .fetch import fetch_all
from .dedup import deduplicate
from .rank import rank_items
from .summarize import generate_brief
from .render import render_brief_to_html, render_index, save_html
from .config import load_config

def run_pipeline(date: str = None) -> Path:
    """运行完整流水线"""
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    print(f"Running pipeline for {date}...")

    # 1. Fetch
    print("Fetching sources...")
    items = fetch_all()
    print(f"  Fetched {len(items)} items")

    # 2. Dedup
    print("Deduplicating...")
    items = deduplicate(items)
    print(f"  After dedup: {len(items)} items")

    # 3. Rank
    print("Ranking...")
    config = load_config()
    whitelist = config.get("sources", {}).get("whitelist", [])
    items = rank_items(items, whitelist)
    print(f"  Ranked {len(items)} items")

    # 4. Summarize
    print("Generating brief...")
    brief_md = generate_brief(items, date)

    # 5. Render
    print("Rendering...")
    brief_html = render_brief_to_html(brief_md, date)

    # 保存 brief
    briefs_dir = Path(__file__).parent.parent / "briefs"
    briefs_dir.mkdir(exist_ok=True)
    brief_path = briefs_dir / f"{date}.md"
    with open(brief_path, "w") as f:
        f.write(brief_md)

    # 生成站点
    site_dir = Path(__file__).parent.parent / "site"
    site_dir.mkdir(exist_ok=True)

    # 保存 HTML
    html_path = site_dir / "briefs" / f"{date}.html"
    save_html(brief_html, html_path)

    # 更新首页
    update_index(site_dir, date)

    print(f"Done! Brief saved to {brief_path}")
    return brief_path

def update_index(site_dir: Path, date: str):
    """更新首页"""
    # 收集所有 briefs
    briefs_dir = Path(__file__).parent.parent / "briefs"
    briefs = []
    if briefs_dir.exists():
        for f in briefs_dir.glob("*.md"):
            briefs.append({"date": f.stem})
    index_html = render_index(briefs)
    save_html(index_html, site_dir / "index.html")

@click.group()
def cli():
    """DeepDive - 洞察探索 CLI"""
    pass

@cli.command()
@click.option("--date", help="Brief date (YYYY-MM-DD)", default=None)
def run(date):
    """运行流水线"""
    from .config import load_config
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")
    run_pipeline(date)

@click.command()
@click.option("--date", help="Brief date (YYYY-MM-DD)", default=None)
@click.option("--serve", is_flag=True, help="Start local server after generation")
@click.option("--port", default=8080, help="Server port")
def serve(date, serve, port):
    """DeepDive - 洞察探索 CLI"""
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    brief_path = run_pipeline(date)

    if serve:
        import http.server
        import socketserver
        site_dir = Path(__file__).parent.parent / "site"

        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(site_dir), **kwargs)

        print(f"Serving at http://localhost:{port}")
        with socketserver.TCPServer(("", port), Handler) as httpd:
            httpd.serve_forever()

if __name__ == "__main__":
    main()
