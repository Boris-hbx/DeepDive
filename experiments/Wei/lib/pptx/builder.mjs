// Slide builder — renders structured slide deck JSON to PPTX via PptxGenJS
// Uses enhanced template system with more slide types

import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadTemplate } from './template.mjs';
import { getImagesForSections } from '../image-provider.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function c(hex) { return (hex || '').replace('#', ''); }
function stripMd(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*>\s*/gm, '')
    .trim();
}

// === Slide builders per type ===

function buildCover(pptx, t, slide, meta) {
  const sl = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  sl.background = { color: c(t.gradients.cover.from) };

  if (t.decorations.cornerAccent) {
    sl.addShape(pptx.ShapeType.rect, { x: m, y: H * 0.35, w: 1.5, h: 0.06, fill: { color: c(t.colors.accent) } });
  }

  sl.addText(slide.title, {
    x: m, y: H * 0.28, w: W - m * 2, h: 1.8,
    fontSize: t.slides.cover.titleSize, fontFace: t.fonts.title,
    color: c(t.colors.textOnDark), bold: true, align: 'center',
  });

  if (slide.subtitle) {
    sl.addText(slide.subtitle, {
      x: m, y: H * 0.58, w: W - m * 2, h: 0.5,
      fontSize: t.slides.cover.subtitleSize, fontFace: t.fonts.body,
      color: 'BBCCEE', align: 'center',
    });
  }

  sl.addText(meta.date || '', { x: m, y: H * 0.68, w: W - m * 2, h: 0.4, fontSize: 12, fontFace: t.fonts.body, color: '8899BB', align: 'center' });
  sl.addText('DeepDive Insight Agent', { x: m, y: H - 0.6, w: W - m * 2, h: 0.4, fontSize: 9, fontFace: t.fonts.body, color: '667799', align: 'right' });
}

function buildTLDR(pptx, t, slide, idx, img) {
  const sl = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  sl.background = { color: c(t.colors.background) };
  addSectionNumber(sl, pptx, t, idx, m);
  const h = 0.7;
  sl.addText(slide.title || 'TL;DR', { x: m, y: h, w: W - m * 2, h: 0.7, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });

  const items = (slide.items || []).slice(0, 6);
  const textRows = items.map((item, i) => ({
    text: `${i + 1}. ${stripMd(item)}`,
    options: { fontSize: t.slides.content.bodySize, fontFace: t.fonts.body, color: c(t.colors.text), bullet: false, paraSpaceAfter: 8 },
  }));
  sl.addText(textRows, { x: m, y: h + 1.0, w: W - m * 2, h: H - h - 1.5, valign: 'top' });
}

function buildContent(pptx, t, slide, idx, img) {
  const sl = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  sl.background = { color: c(t.colors.background) };
  addSectionNumber(sl, pptx, t, idx, m);

  const titleY = 0.6;
  sl.addText(slide.title || '', { x: m, y: titleY, w: W - m * 2, h: 0.7, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
  if (t.decorations.titleUnderline) {
    sl.addShape(pptx.ShapeType.rect, { x: m, y: titleY + 0.7, w: 1.5, h: 0.04, fill: { color: c(t.colors.accent) } });
  }

  const body = (slide.body || '').slice(0, 500);
  sl.addText(stripMd(body), { x: m, y: titleY + 1.0, w: W - m * 2, h: H - titleY - 1.5, fontSize: t.slides.content.bodySize, fontFace: t.fonts.body, color: c(t.colors.text), valign: 'top', wrap: true, lineSpacing: 22 });

  if (img) {
    sl.addImage({ path: img, x: W - W * 0.25, y: H * 0.5, w: W * 0.2, h: H * 0.35, sizing: { type: 'contain', w: W * 0.2, h: H * 0.35 } });
  }
}

function buildBullets(pptx, t, slide, idx, img) {
  const sl = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  sl.background = { color: c(t.colors.background) };
  addSectionNumber(sl, pptx, t, idx, m);

  const titleY = 0.6;
  sl.addText(slide.title || '', { x: m, y: titleY, w: W - m * 2, h: 0.7, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
  if (t.decorations.titleUnderline) {
    sl.addShape(pptx.ShapeType.rect, { x: m, y: titleY + 0.7, w: 1.5, h: 0.04, fill: { color: c(t.colors.accent) } });
  }

  const items = (slide.items || []).slice(0, 8);
  const textRows = items.map(item => ({
    text: stripMd(item),
    options: { fontSize: t.slides.content.bodySize, fontFace: t.fonts.body, color: c(t.colors.text), bullet: { code: '25CF' }, paraSpaceAfter: 8 },
  }));
  sl.addText(textRows, { x: m, y: titleY + 1.0, w: W - m * 2, h: H - titleY - 1.5, valign: 'top' });
}

function buildTable(pptx, t, slide, idx) {
  const sl = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  sl.background = { color: c(t.colors.background) };

  const titleY = 0.3;
  sl.addText(slide.title || '', { x: m, y: titleY, w: W - m * 2, h: 0.6, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });

  const headers = slide.headers || [];
  const rows = slide.rows || [];

  // If body contains markdown table, parse it
  let tableHeaders = headers;
  let tableRows = rows;
  if (headers.length === 0 && rows.length === 0 && slide.body) {
    const parsed = parseMdTable(slide.body);
    tableHeaders = parsed.headers;
    tableRows = parsed.rows;
  }

  if (tableHeaders.length === 0) {
    buildContent(pptx, t, slide, idx, null);
    return;
  }

  const displayRows = tableRows.slice(0, 5);
  const headerRow = tableHeaders.map(h => ({ text: h, options: { bold: true, fontSize: t.slides.table.headerSize, color: c(t.colors.textOnDark), fill: { color: c(t.colors.tableHeaderBg) } } }));
  const bodyRows = displayRows.map((row, ri) =>
    row.map(cell => ({ text: stripMd(cell), options: { fontSize: t.slides.table.bodySize, color: c(t.colors.text), fill: ri % 2 === 1 ? { color: c(t.colors.tableAltRow) } : undefined } }))
  );

  const colW = (W - m * 2) / tableHeaders.length;
  sl.addTable([headerRow, ...bodyRows], {
    x: m, y: titleY + 0.8, w: W - m * 2,
    colW: Array(tableHeaders.length).fill(colW),
    border: { pt: 0.5, color: 'DDDDDD' },
    rowH: 0.45, autoPage: false,
  });

  if (tableRows.length > 5) {
    sl.addText(`(${Math.min(displayRows.length, 5)}/${tableRows.length} rows)`, {
      x: m, y: H - 0.5, w: W - m * 2, h: 0.3,
      fontSize: 9, color: '999999', align: 'right',
    });
  }
}

function buildTimeline(pptx, t, slide) {
  const sl = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  sl.background = { color: c(t.colors.background) };

  sl.addText(slide.title || '', { x: m, y: 0.3, w: W - m * 2, h: 0.7, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
  if (t.decorations.titleUnderline) {
    sl.addShape(pptx.ShapeType.rect, { x: m, y: 0.95, w: 1.5, h: 0.04, fill: { color: c(t.colors.accent) } });
  }

  const lineX = m + 0.5;
  const items = (slide.items || []).slice(0, 8);
  sl.addShape(pptx.ShapeType.rect, { x: lineX, y: 1.2, w: 0.03, h: Math.min(items.length * 0.65, H - 2), fill: { color: c(t.colors.primary) } });

  for (let i = 0; i < items.length; i++) {
    const y = 1.25 + i * 0.65;
    sl.addShape(pptx.ShapeType.ellipse, { x: lineX - 0.07, y: y + 0.05, w: 0.16, h: 0.16, fill: { color: c(t.colors.primary) } });

    const raw = stripMd(items[i]);
    const dateMatch = raw.match(/^(\d{4}[-/]\d{2}|\d{4})\s*/);
    if (dateMatch) {
      sl.addText(dateMatch[1], { x: lineX + 0.3, y, w: 1.2, h: 0.3, fontSize: 13, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
      sl.addText(raw.slice(dateMatch[0].length), { x: lineX + 1.5, y, w: W - lineX - 2.5, h: 0.5, fontSize: 11, fontFace: t.fonts.body, color: c(t.colors.text), valign: 'top', wrap: true });
    } else {
      sl.addText(raw, { x: lineX + 0.3, y, w: W - lineX - 1.5, h: 0.5, fontSize: 11, fontFace: t.fonts.body, color: c(t.colors.text), valign: 'top', wrap: true });
    }
  }
}

function buildQuote(pptx, t, slide, idx) {
  const sl = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  sl.background = { color: c(t.colors.background) };

  sl.addShape(pptx.ShapeType.rect, { x: m + 0.5, y: H * 0.25, w: 0.06, h: H * 0.3, fill: { color: c(t.colors.accent) } });

  sl.addText(`"${(slide.text || '').slice(0, 300)}"`, {
    x: m + 1.0, y: H * 0.25, w: W - m * 2 - 1, h: H * 0.3,
    fontSize: 18, fontFace: t.fonts.body, color: c(t.colors.text),
    italic: true, valign: 'middle', wrap: true,
  });

  if (slide.attribution) {
    sl.addText(`— ${slide.attribution}`, {
      x: m + 1.0, y: H * 0.6, w: W - m * 2, h: 0.4,
      fontSize: 12, fontFace: t.fonts.body, color: c(t.colors.muted || '999999'),
    });
  }
}

function buildCode(pptx, t, slide, idx) {
  const sl = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  sl.background = { color: c(t.colors.background) };

  sl.addText(slide.title || '代码', { x: m, y: 0.3, w: W - m * 2, h: 0.6, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });

  const langLabel = slide.lang ? ` [${slide.lang}]` : '';
  sl.addShape(pptx.ShapeType.roundRect, {
    x: m, y: 1.2, w: W - m * 2, h: Math.min(H - 2, 4),
    fill: { color: '1E1E1E' }, rectRadius: 0.1,
  });

  sl.addText((slide.code || '').slice(0, 600), {
    x: m + 0.3, y: 1.3, w: W - m * 2 - 0.6, h: Math.min(H - 2.2, 3.8),
    fontSize: 11, fontFace: 'Courier New', color: 'D4D4D4',
    valign: 'top', wrap: true,
  });
}

function buildTwoColumn(pptx, t, slide, idx) {
  const sl = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  sl.background = { color: c(t.colors.background) };

  sl.addText(slide.title || '', { x: m, y: 0.3, w: W - m * 2, h: 0.6, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });

  const colW = (W - m * 2 - 0.5) / 2;
  sl.addShape(pptx.ShapeType.rect, { x: m + colW + 0.15, y: 1.2, w: 0.02, h: H - 2, fill: { color: c(t.colors.border || 'DDDDDD') } });

  sl.addText(stripMd(slide.left || '').slice(0, 300), {
    x: m, y: 1.2, w: colW, h: H - 1.8,
    fontSize: t.slides.content.bodySize - 1, fontFace: t.fonts.body,
    color: c(t.colors.text), valign: 'top', wrap: true,
  });

  sl.addText(stripMd(slide.right || '').slice(0, 300), {
    x: m + colW + 0.5, y: 1.2, w: colW, h: H - 1.8,
    fontSize: t.slides.content.bodySize - 1, fontFace: t.fonts.body,
    color: c(t.colors.text), valign: 'top', wrap: true,
  });
}

function buildStats(pptx, t, slide) {
  const sl = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  sl.background = { color: c(t.colors.background) };

  sl.addText(slide.title || '', { x: m, y: 0.3, w: W - m * 2, h: 0.7, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
  if (t.decorations.titleUnderline) {
    sl.addShape(pptx.ShapeType.rect, { x: m, y: 0.95, w: 1.5, h: 0.04, fill: { color: c(t.colors.accent) } });
  }

  const stats = (slide.stats || []).slice(0, 6);
  const cols = Math.min(stats.length, 3);
  const cellW = (W - m * 2) / cols;
  const startY = 1.5;

  stats.forEach((stat, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = m + col * cellW;
    const y = startY + row * 1.2;

    sl.addShape(pptx.ShapeType.roundRect, {
      x, y, w: cellW - 0.3, h: 1.0,
      fill: { color: c(t.colors.bg2 || 'F5F5F5') },
      rectRadius: 0.1,
    });

    sl.addText(stat.value || '', { x, y: y + 0.1, w: cellW - 0.3, h: 0.5, fontSize: 24, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true, align: 'center' });
    sl.addText(stat.label || '', { x, y: y + 0.6, w: cellW - 0.3, h: 0.3, fontSize: 11, fontFace: t.fonts.body, color: c(t.colors.text), align: 'center' });
  });
}

function buildClosing(pptx, t, meta) {
  const sl = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height;
  sl.background = { color: c(t.gradients.closing.from) };

  if (t.decorations.cornerAccent) {
    sl.addShape(pptx.ShapeType.rect, { x: W / 2 - 1, y: H * 0.32, w: 2, h: 0.05, fill: { color: c(t.colors.accent) } });
  }

  sl.addText('DeepDive', { x: 0, y: H * 0.36, w: W, h: 0.8, fontSize: t.slides.closing.titleSize, fontFace: t.fonts.title, color: c(t.colors.textOnDark), bold: true, align: 'center' });
  sl.addText('Insight Agent', { x: 0, y: H * 0.48, w: W, h: 0.6, fontSize: t.slides.closing.subtitleSize, fontFace: t.fonts.body, color: 'AABBCC', align: 'center' });

  const info = [meta.date, meta.llmProvider ? `模型: ${meta.llmProvider}` : '', `$${(meta.cost || 0).toFixed(4)}`].filter(Boolean).join('  ·  ');
  sl.addText(info, { x: 0, y: H * 0.62, w: W, h: 0.4, fontSize: 10, fontFace: t.fonts.body, color: '778899', align: 'center' });
}

// === Helpers ===

function addSectionNumber(sl, pptx, t, idx, m) {
  if (t.decorations.sectionNumber && idx != null) {
    sl.addText(String(idx).padStart(2, '0'), { x: m, y: 0.3, w: 1, h: 0.6, fontSize: 28, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
  }
}

function parseMdTable(text) {
  const lines = text.split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return { headers: [], rows: [] };
  const parse = line => line.split('|').slice(1, -1).map(c => c.trim());
  const headers = parse(lines[0]);
  const rows = lines.slice(2).map(parse);
  return { headers, rows };
}

// === Image resolution ===

function resolveImageHints(slides) {
  const hints = [];
  for (const s of slides) {
    if (s.imageHint) hints.push(s.imageHint);
    else if (s.title) hints.push(s.title);
    else hints.push('');
  }
  return hints;
}

function matchImagesToSlides(slides, images) {
  // Distribute images to slides that have imageHint or are content-type
  let imgIdx = 0;
  for (const s of slides) {
    if (s.imageHint || s.type === 'content' || s.type === 'bullets') {
      s._img = images[imgIdx] || null;
      imgIdx++;
    } else {
      s._img = null;
    }
  }
}

// === Main build function ===

export async function buildPptx({ slides, title, meta = {}, template = 'tech-blue', outputPath, provider = '' }) {
  const t = loadTemplate(template);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'DeepDive Insight Agent';
  pptx.title = title;

  console.log(`  PPT 模板: ${t.name} | 幻灯片: ${slides.length} 页`);

  // Resolve images (parallel where possible)
  const imageHints = resolveImageHints(slides);
  if (imageHints.some(h => h)) {
    try {
      const images = await getImagesForSections(
        imageHints.map(h => ({ heading: h })),
        provider,
      );
      matchImagesToSlides(slides, images);
    } catch (err) {
      console.log(`  配图失败: ${err.message}，继续无配图生成`);
    }
  }

  let idx = 0;
  for (const slide of slides) {
    idx++;
    switch (slide.type) {
      case 'cover':
        buildCover(pptx, t, slide, meta);
        break;
      case 'tldr':
        buildTLDR(pptx, t, slide, idx, slide._img);
        break;
      case 'content':
        buildContent(pptx, t, slide, idx, slide._img);
        break;
      case 'bullets':
        buildBullets(pptx, t, slide, idx, slide._img);
        break;
      case 'table':
        buildTable(pptx, t, slide, idx);
        break;
      case 'timeline':
        buildTimeline(pptx, t, slide);
        break;
      case 'quote':
        buildQuote(pptx, t, slide, idx);
        break;
      case 'code':
        buildCode(pptx, t, slide, idx);
        break;
      case 'twoColumn':
        buildTwoColumn(pptx, t, slide, idx);
        break;
      case 'stats':
        buildStats(pptx, t, slide);
        break;
      case 'closing':
        buildClosing(pptx, t, meta);
        break;
      default:
        // Unknown type → fallback to content
        buildContent(pptx, t, { ...slide, type: 'content' }, idx, slide._img);
    }
  }

  // Ensure closing slide exists
  if (!slides.some(s => s.type === 'closing')) {
    buildClosing(pptx, t, meta);
  }

  if (outputPath) {
    await pptx.writeFile({ fileName: outputPath });
    return outputPath;
  }
  return await pptx.write({ outputType: 'nodebuffer' });
}
