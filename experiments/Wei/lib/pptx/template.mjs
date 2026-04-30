// PPTX template loader with enhanced schema and built-in fallback

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');

const DEFAULT_TEMPLATE = {
  name: 'tech-blue',
  layout: { width: 13.33, height: 7.5, margin: 0.8 },
  colors: {
    primary: '2563EB', accent: 'F59E0B', background: 'FFFFFF',
    text: '18181B', textOnDark: 'FAFAFA', tableHeaderBg: '2563EB',
    tableAltRow: 'F4F8FF', border: 'E4E4E7', muted: '999999',
    bg2: 'F5F5F5',
  },
  fonts: { title: 'Arial', body: 'Arial' },
  slides: {
    cover: { titleSize: 36, subtitleSize: 16 },
    content: { titleSize: 24, bodySize: 14 },
    table: { headerSize: 12, bodySize: 11 },
    closing: { titleSize: 36, subtitleSize: 18 },
    timeline: { yearSize: 14, descSize: 11 },
  },
  gradients: { cover: { from: '1E3A5F' }, closing: { from: '1E3A5F' } },
  decorations: {
    cornerAccent: true,
    titleUnderline: true,
    sectionNumber: true,
    bulletIcon: 'dot',
  },
  coverImageLayout: 'overlay',
  imageLayout: 'left',
};

export function loadTemplate(name) {
  if (!name || name === 'tech-blue') {
    // Check if tech-blue.json exists
    const p = path.join(TEMPLATES_DIR, 'tech-blue.json');
    if (fs.existsSync(p)) {
      try {
        return { ...DEFAULT_TEMPLATE, ...JSON.parse(fs.readFileSync(p, 'utf-8')) };
      } catch (_) {}
    }
    return DEFAULT_TEMPLATE;
  }

  const p = path.join(TEMPLATES_DIR, `${name}.json`);
  if (fs.existsSync(p)) {
    try {
      return { ...DEFAULT_TEMPLATE, ...JSON.parse(fs.readFileSync(p, 'utf-8')) };
    } catch (_) {}
  }

  // Fallback
  console.log(`  模板 "${name}" 未找到，使用默认模板`);
  return DEFAULT_TEMPLATE;
}
