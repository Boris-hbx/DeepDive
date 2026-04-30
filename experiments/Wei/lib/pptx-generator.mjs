// PPTX generator — thin orchestrator using LLM-based structurer + slide builder
// Backward-compatible with the original API

import { structureSlides } from './pptx/structurer.mjs';
import { buildPptx } from './pptx/builder.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function generatePptx({ markdown, title, meta = {}, template = 'tech-blue', outputPath, provider = '' }) {
  console.log(`[PPT] 生成幻灯片: ${title}`);

  // Step 1: Structure content into slides (LLM-powered, fallback to regex)
  const { slides } = await structureSlides(markdown, title, {
    provider,
    domain: meta.domain || '',
  });

  // Step 2: Build PPTX from structured slides
  const result = await buildPptx({
    slides,
    title,
    meta: {
      domain: meta.domain || '',
      tags: meta.tags || {},
      date: meta.date || meta.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      llmProvider: meta.llmProvider || '',
      cost: meta.cost || 0,
    },
    template,
    outputPath,
    provider,
  });

  console.log(`[PPT] 完成: ${result}`);
  return result;
}
