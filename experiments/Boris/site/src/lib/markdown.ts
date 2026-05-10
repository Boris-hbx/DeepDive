import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: false
});

export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  // Force external links to open in new tab. Internal anchors / relative
  // hrefs are left untouched.
  return html.replace(
    /<a\s+href="(https?:\/\/[^"]+)"/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer"'
  );
}
