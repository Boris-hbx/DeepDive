"""HTML 渲染模块"""
import re
from pathlib import Path
from jinja2 import Template
from typing import List, Dict

def markdown_to_html(md: str) -> str:
    """简单的 Markdown 转 HTML（用于渲染）"""
    # 这里用正则做简单转换，实际可用 markdown 库
    html = md
    # 标题
    html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    # 链接
    html = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', r'<a href="\2">\1</a>', html)
    # 引用
    html = re.sub(r'^> (.+)$', r'<blockquote>\1</blockquote>', html, flags=re.MULTILINE)
    # 列表
    html = re.sub(r'^- (.+)', r'<li>\1</li>', html, flags=re.MULTILINE)
    # 段落
    html = re.sub(r'\n\n', '</p><p>', html)
    return f"<p>{html}</p>"

def render_brief_to_html(brief_md: str, date: str) -> str:
    """将 brief Markdown 渲染为 HTML"""
    template_path = Path(__file__).parent.parent / "templates" / "brief.html"
    with open(template_path) as f:
        template = Template(f.read())

    content = markdown_to_html(brief_md)
    return template.render(date=date, content=content)

def render_index(briefs: List[Dict]) -> str:
    """渲染首页"""
    template_path = Path(__file__).parent.parent / "templates" / "index.html"
    with open(template_path) as f:
        template = Template(f.read())

    # 按日期排序，最新的在前
    sorted_briefs = sorted(briefs, key=lambda x: x.get("date", ""), reverse=True)
    return template.render(briefs=sorted_briefs)

def save_html(html: str, output_path: Path):
    """保存 HTML 到文件"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        f.write(html)