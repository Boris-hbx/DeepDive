import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getImagesForSections } from './image-provider.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadTemplate(name = 'tech-blue') {
  const p = path.join(__dirname, '..', 'templates', `${name}.json`);
  if (!fs.existsSync(p)) {
    const fallback = path.join(__dirname, '..', 'templates', 'tech-blue.json');
    return JSON.parse(fs.readFileSync(fallback, 'utf-8'));
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function c(hex) { return (hex || '').replace('#', ''); }

function parseMarkdownSections(markdown) {
  const sections = [];
  const parts = markdown.split(/\n## /);
  const titleMatch = parts[0].match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : '';
  for (let i = 1; i < parts.length; i++) {
    const lines = parts[i].split('\n');
    sections.push({ heading: lines[0].trim(), body: lines.slice(1).join('\n').trim() });
  }
  return { title, sections };
}

function parseTable(text) {
  const lines = text.split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return null;
  const parse = line => line.split('|').slice(1, -1).map(c => c.trim());
  return { headers: parse(lines[0]), rows: lines.slice(2).map(parse) };
}

function parseListItems(text) {
  return text.split('\n')
    .filter(l => /^\s*[-*]\s/.test(l) || /^\s*\d+\.\s/.test(l))
    .map(l => l.replace(/^\s*[-*\d.]+\s*/, '').trim())
    .filter(Boolean);
}

function parseSubSections(body) {
  const subs = [];
  const parts = body.split(/\n### /);
  if (parts[0].trim()) subs.push({ heading: '', body: parts[0].trim() });
  for (let i = 1; i < parts.length; i++) {
    const lines = parts[i].split('\n');
    subs.push({ heading: lines[0].trim(), body: lines.slice(1).join('\n').trim() });
  }
  return subs;
}

function truncText(text, max = 500) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const br = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  return (br > max * 0.3 ? cut.slice(0, br + 1) : cut) + '...';
}

function stripMd(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*>\s*/gm, '')
    .replace(/\[\^[\d]+\]/g, '')
    .trim();
}

function bulletChar(style) {
  if (style === 'arrow') return '25B6';
  if (style === 'dash') return '2014';
  return '25CF';
}

// === Slide builders ===

function addCoverSlide(pptx, t, title, meta, img) {
  const slide = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  slide.background = { color: c(t.gradients.cover.from) };
  // cover image
  if (img && t.coverImageLayout === 'overlay') {
    slide.addImage({ path: img, x: 0, y: 0, w: W, h: H, sizing: { type: 'cover', w: W, h: H } });
  } else if (img && t.coverImageLayout === 'side') {
    slide.addImage({ path: img, x: W * 0.6, y: 0, w: W * 0.4, h: H, sizing: { type: 'cover', w: W * 0.4, h: H } });
  }
  // accent line
  if (t.decorations.cornerAccent) {
    slide.addShape(pptx.ShapeType.rect, { x: m, y: H * 0.35, w: 1.5, h: 0.06, fill: { color: c(t.colors.accent) } });
  }
  // title
  slide.addText(title, { x: m, y: H * 0.28, w: W - m * 2, h: 1.8, fontSize: t.slides.cover.titleSize, fontFace: t.fonts.title, color: c(t.colors.textOnDark), bold: true, align: t.coverImageLayout === 'side' ? 'left' : 'center' });
  // subtitle
  const domainLabel = meta.domain === 'cybersecurity' ? '网络安全' : meta.domain === 'software-engineering' ? '软件工程' : '';
  const tagLine = [domainLabel, ...(meta.tags?.user || []), ...(meta.tags?.auto || []).slice(0, 4)].filter(Boolean).join('  ·  ');
  slide.addText(tagLine, { x: m, y: H * 0.58, w: W - m * 2, h: 0.5, fontSize: t.slides.cover.subtitleSize, fontFace: t.fonts.body, color: 'BBCCEE', align: t.coverImageLayout === 'side' ? 'left' : 'center' });
  // date
  slide.addText(meta.date || new Date().toISOString().slice(0, 10), { x: m, y: H * 0.68, w: W - m * 2, h: 0.4, fontSize: 12, fontFace: t.fonts.body, color: '8899BB', align: t.coverImageLayout === 'side' ? 'left' : 'center' });
  // brand
  slide.addText('DeepDive Insight Agent', { x: m, y: H - 0.6, w: W - m * 2, h: 0.4, fontSize: 9, fontFace: t.fonts.body, color: '667799', align: 'right' });
}

function addContentSlide(pptx, t, heading, bodyText, img, idx) {
  const slide = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  slide.background = { color: c(t.colors.background) };
  const hasImg = !!img;
  const imgOnLeft = t.imageLayout === 'left';
  const imgW = hasImg ? W * 0.35 : 0;
  const txtX = hasImg && imgOnLeft ? imgW + 0.3 : m;
  const txtW = hasImg ? W - imgW - m - 0.3 : W - m * 2;
  // image
  if (hasImg) {
    const ix = imgOnLeft ? 0 : W - imgW;
    slide.addImage({ path: img, x: ix, y: 0, w: imgW, h: H, sizing: { type: 'cover', w: imgW, h: H } });
  }
  // section number
  if (t.decorations.sectionNumber && idx != null) {
    slide.addText(String(idx).padStart(2, '0'), { x: txtX, y: 0.3, w: 1, h: 0.6, fontSize: 28, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
  }
  // title
  const titleY = t.decorations.sectionNumber ? 0.7 : 0.4;
  slide.addText(heading, { x: txtX, y: titleY, w: txtW, h: 0.7, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
  // underline
  if (t.decorations.titleUnderline) {
    slide.addShape(pptx.ShapeType.rect, { x: txtX, y: titleY + 0.7, w: 1.5, h: 0.04, fill: { color: c(t.colors.accent) } });
  }
  // body
  slide.addText(stripMd(truncText(bodyText, 700)), { x: txtX, y: titleY + 0.9, w: txtW, h: H - titleY - 1.3, fontSize: t.slides.content.bodySize, fontFace: t.fonts.body, color: c(t.colors.text), valign: 'top', wrap: true, lineSpacing: 22 });
}

function addBulletSlide(pptx, t, heading, items, img, idx) {
  const slide = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  slide.background = { color: c(t.colors.background) };
  const hasImg = !!img;
  const imgOnLeft = t.imageLayout === 'left';
  const imgW = hasImg ? W * 0.32 : 0;
  const txtX = hasImg && imgOnLeft ? imgW + 0.3 : m;
  const txtW = hasImg ? W - imgW - m - 0.3 : W - m * 2;
  if (hasImg) {
    const ix = imgOnLeft ? 0 : W - imgW;
    slide.addImage({ path: img, x: ix, y: 0, w: imgW, h: H, sizing: { type: 'cover', w: imgW, h: H } });
  }
  if (t.decorations.sectionNumber && idx != null) {
    slide.addText(String(idx).padStart(2, '0'), { x: txtX, y: 0.3, w: 1, h: 0.6, fontSize: 28, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
  }
  const titleY = t.decorations.sectionNumber ? 0.7 : 0.4;
  slide.addText(heading, { x: txtX, y: titleY, w: txtW, h: 0.7, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
  if (t.decorations.titleUnderline) {
    slide.addShape(pptx.ShapeType.rect, { x: txtX, y: titleY + 0.7, w: 1.5, h: 0.04, fill: { color: c(t.colors.accent) } });
  }
  const bCode = bulletChar(t.decorations.bulletIcon);
  const textRows = items.slice(0, 10).map((item, i) => {
    const useNumber = t.decorations.bulletIcon === 'number';
    return {
      text: (useNumber ? `${i + 1}.  ` : '') + stripMd(item),
      options: { fontSize: t.slides.content.bodySize, fontFace: t.fonts.body, color: c(t.colors.text), bullet: useNumber ? false : { code: bCode }, paraSpaceAfter: 10, lineSpacing: 20 },
    };
  });
  slide.addText(textRows, { x: txtX, y: titleY + 0.9, w: txtW, h: H - titleY - 1.3, valign: 'top' });
}

function addTableSlide(pptx, t, heading, table, pageInfo, img) {
  const slide = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  slide.background = { color: c(t.colors.background) };
  // top image strip
  if (img) {
    slide.addImage({ path: img, x: 0, y: 0, w: W, h: 1.2, sizing: { type: 'cover', w: W, h: 1.2 } });
  }
  const topY = img ? 1.3 : 0.4;
  const label = pageInfo ? `${heading} ${pageInfo}` : heading;
  slide.addText(label, { x: m, y: topY, w: W - m * 2, h: 0.6, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
  const headerRow = table.headers.map(h => ({ text: h, options: { bold: true, fontSize: t.slides.table.headerSize, color: c(t.colors.textOnDark), fill: { color: c(t.colors.tableHeaderBg) } } }));
  const bodyRows = table.rows.map((row, ri) =>
    row.map(cell => ({ text: stripMd(cell), options: { fontSize: t.slides.table.bodySize, color: c(t.colors.text), fill: ri % 2 === 1 ? { color: c(t.colors.tableAltRow) } : undefined } }))
  );
  const colW = (W - m * 2) / table.headers.length;
  slide.addTable([headerRow, ...bodyRows], { x: m, y: topY + 0.7, w: W - m * 2, colW: Array(table.headers.length).fill(colW), border: { pt: 0.5, color: 'DDDDDD' }, rowH: 0.45, autoPage: false });
}

function addTimelineSlide(pptx, t, heading, items, img) {
  const slide = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height, m = t.layout.margin;
  slide.background = { color: c(t.colors.background) };
  if (img) {
    slide.addImage({ path: img, x: W - W * 0.3, y: 0, w: W * 0.3, h: H, sizing: { type: 'cover', w: W * 0.3, h: H } });
  }
  const contentW = img ? W * 0.65 : W - m * 2;
  slide.addText(heading, { x: m, y: 0.4, w: contentW, h: 0.7, fontSize: t.slides.content.titleSize, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
  if (t.decorations.titleUnderline) {
    slide.addShape(pptx.ShapeType.rect, { x: m, y: 1.05, w: 1.5, h: 0.04, fill: { color: c(t.colors.accent) } });
  }
  // vertical line
  const lineX = m + 0.6;
  slide.addShape(pptx.ShapeType.rect, { x: lineX, y: 1.3, w: 0.03, h: Math.min(items.length * 0.7, H - 2), fill: { color: c(t.colors.primary) } });
  const maxItems = Math.min(items.length, 8);
  for (let i = 0; i < maxItems; i++) {
    const y = 1.35 + i * 0.7;
    // dot
    slide.addShape(pptx.ShapeType.ellipse, { x: lineX - 0.08, y: y + 0.05, w: 0.18, h: 0.18, fill: { color: c(t.colors.primary) } });
    // text
    const raw = stripMd(items[i]);
    const yearMatch = raw.match(/^(\d{4}[-/]\d{2}|\d{4})\s*/);
    if (yearMatch) {
      slide.addText(yearMatch[1], { x: lineX + 0.3, y, w: 1.2, h: 0.3, fontSize: t.slides.timeline?.yearSize || 14, fontFace: t.fonts.title, color: c(t.colors.primary), bold: true });
      slide.addText(raw.slice(yearMatch[0].length), { x: lineX + 1.5, y, w: contentW - 2.2, h: 0.55, fontSize: t.slides.timeline?.descSize || 11, fontFace: t.fonts.body, color: c(t.colors.text), valign: 'top', wrap: true });
    } else {
      slide.addText(raw, { x: lineX + 0.3, y, w: contentW - 1.2, h: 0.55, fontSize: t.slides.timeline?.descSize || 11, fontFace: t.fonts.body, color: c(t.colors.text), valign: 'top', wrap: true });
    }
  }
}

function addClosingSlide(pptx, t, meta) {
  const slide = pptx.addSlide();
  const W = t.layout.width, H = t.layout.height;
  slide.background = { color: c(t.gradients.closing.from) };
  if (t.decorations.cornerAccent) {
    slide.addShape(pptx.ShapeType.rect, { x: W / 2 - 1, y: H * 0.32, w: 2, h: 0.05, fill: { color: c(t.colors.accent) } });
  }
  slide.addText('DeepDive', { x: 0, y: H * 0.36, w: W, h: 0.8, fontSize: t.slides.closing.titleSize, fontFace: t.fonts.title, color: c(t.colors.textOnDark), bold: true, align: 'center' });
  slide.addText('Insight Agent', { x: 0, y: H * 0.48, w: W, h: 0.6, fontSize: t.slides.closing.subtitleSize, fontFace: t.fonts.body, color: 'AABBCC', align: 'center' });
  const info = [meta.date, `模型: ${meta.llmProvider || 'claude'}`, `$${(meta.cost || 0).toFixed(4)}`].filter(Boolean).join('  ·  ');
  slide.addText(info, { x: 0, y: H * 0.62, w: W, h: 0.4, fontSize: 10, fontFace: t.fonts.body, color: '778899', align: 'center' });
}

// === Main export ===

export async function generatePptx({ markdown, title, meta = {}, template = 'tech-blue', outputPath, provider = 'claude' }) {
  const t = loadTemplate(template);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'DeepDive Insight Agent';
  pptx.title = title;

  const { sections } = parseMarkdownSections(markdown);

  console.log(`  PPT 模板: ${t.name}`);
  const images = await getImagesForSections(sections, provider);

  let slideIdx = 0;
  addCoverSlide(pptx, t, title, meta, images[0]);

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    const h = sec.heading.toLowerCase();
    const img = images[si] || null;
    slideIdx++;

    if (h.includes('tl;dr') || h.includes('tldr')) {
      const items = parseListItems(sec.body);
      if (items.length > 0) addBulletSlide(pptx, t, 'TL;DR', items, img, slideIdx);
      else addContentSlide(pptx, t, 'TL;DR', sec.body, img, slideIdx);

    } else if (h.includes('关键发现') || h.includes('key finding')) {
      const subs = parseSubSections(sec.body);
      for (let j = 0; j < subs.length; j++) {
        const sub = subs[j];
        if (sub.heading) addContentSlide(pptx, t, sub.heading, sub.body, j === 0 ? img : null, slideIdx + j);
        else if (sub.body) addContentSlide(pptx, t, sec.heading, sub.body, j === 0 ? img : null, slideIdx + j);
      }

    } else if (h.includes('对比') || h.includes('comparison')) {
      const table = parseTable(sec.body);
      if (table && table.rows.length > 0) {
        const PER = 4;
        for (let i = 0; i < table.rows.length; i += PER) {
          const chunk = table.rows.slice(i, i + PER);
          const pg = table.rows.length > PER ? `(${Math.floor(i / PER) + 1}/${Math.ceil(table.rows.length / PER)})` : '';
          addTableSlide(pptx, t, sec.heading, { headers: table.headers, rows: chunk }, pg, i === 0 ? img : null);
        }
      } else {
        addContentSlide(pptx, t, sec.heading, sec.body, img, slideIdx);
      }

    } else if (h.includes('时间线') || h.includes('timeline')) {
      const items = parseListItems(sec.body);
      if (items.length > 0) addTimelineSlide(pptx, t, sec.heading, items, img);
      else addContentSlide(pptx, t, sec.heading, sec.body, img, slideIdx);

    } else if (h.includes('来源') || h.includes('参考') || h.includes('reference')) {
      const items = parseListItems(sec.body);
      if (items.length > 0) addBulletSlide(pptx, t, sec.heading, items.slice(0, 8), null, null);
      else addContentSlide(pptx, t, sec.heading, sec.body, null, null);

    } else {
      const items = parseListItems(sec.body);
      if (items.length >= 3) addBulletSlide(pptx, t, sec.heading, items, img, slideIdx);
      else addContentSlide(pptx, t, sec.heading, sec.body, img, slideIdx);
    }
  }

  addClosingSlide(pptx, t, meta);

  if (outputPath) {
    await pptx.writeFile({ fileName: outputPath });
    return outputPath;
  }
  return await pptx.write({ outputType: 'nodebuffer' });
}
