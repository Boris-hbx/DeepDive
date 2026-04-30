// Pipeline stages — each stage is a pure function: (state, ctx) => state
// Stages are reusable across brief-generator and report-generator

import { fetchAllSources } from '../fetcher.mjs';
import { dedup } from '../dedup.mjs';
import { getBriefPrompt, getSurveyPrompt, getAutoTagPrompt, getDomainClassifyPrompt, getFollowUpPrompt, getSummarizePrompt } from '../prompts.mjs';
import { briefToHTML, markdownToHTML } from '../markdown-to-html.mjs';
import { createProvider } from '../llm-provider.mjs';
import { saveBrief } from '../storage.mjs';

// === Brief pipeline stages ===

export function fetchStage(sources) {
  return {
    name: 'fetch',
    run: async (state, ctx) => {
      ctx.log(`  [fetch] 抓取 ${sources.length} 个源 ...`);
      const items = await fetchAllSources(sources);
      ctx.log(`  抓取到 ${items.length} 条`);
      return { ...state, items };
    },
  };
}

export const dedupStage = {
  name: 'dedup',
  run: async (state, ctx) => {
    ctx.log(`  [dedup] 去重 (in: ${state.items.length}) ...`);
    const unique = dedup(state.items);
    ctx.log(`  去重后 ${unique.length} 条`);
    return { ...state, items: unique };
  },
};

import { rankItems } from '../ranker.mjs';
import { getInterestByKeyword } from '../memory/article-feedback.mjs';

export function rankStage(domainConfig) {
  return {
    name: 'rank',
    run: async (state, ctx) => {
      const items = state.items;

      // Build source authority lookup map
      const authMap = {};
      for (const src of (domainConfig.sources || [])) {
        authMap[src.name] = src.authority ?? 0.5;
      }

      // Extract domain keywords from source keyword lists
      const domainKeywords = new Set();
      for (const src of (domainConfig.sources || [])) {
        if (src.keywords) {
          for (const kw of src.keywords) domainKeywords.add(kw.toLowerCase());
        }
      }

      // Load article feedback for learning-based boost
      const domain = ctx.domain || '';
      let interestKeywordMap = null;
      try {
        interestKeywordMap = getInterestByKeyword(domain);
      } catch (_) {
        // No feedback data yet — skip learning boost
      }

      const rankingConfig = domainConfig.ranking || {};

      const ranked = rankItems(items, {
        authMap,
        domainKeywords: [...domainKeywords],
        now: new Date(),
        ranking: rankingConfig,
        interestKeywordMap,
      });

      ctx.log(`  [rank] 排序完成 (${ranked.length} 条, 最高分: ${ranked[0]?._score?.toFixed(3) || 'N/A'})`);
      return { ...state, items: ranked };
    },
  };
}

export function briefSummarizeStage(domainKey, label) {
  return {
    name: 'summarize',
    run: async (state, ctx) => {
      const items = state.items;
      if (items.length === 0) {
        const date = new Date().toISOString().slice(0, 10);
        const markdown = `# ${label}每日 Brief — ${date}\n\n今日${label}领域无重要事件。`;
        const html = briefToHTML(markdown, domainKey, date, []);
        saveBrief({ date, domain: domainKey, generatedAt: new Date().toISOString(), llmProvider: ctx.provider, markdown, html, noNews: true });
        ctx.log(`  [summarize] 无内容，生成空 brief`);
        return { ...state, markdown, html, noNews: true };
      }

      const llm = createProvider(ctx.provider);
      const topItems = items.slice(0, 30);
      const prompt = getBriefPrompt(domainKey, topItems) + (ctx.hooks ? '\n\n' + ctx.hooks : '');

      ctx.log(`  [summarize] LLM 生成 brief (${topItems.length} 条输入) ...`);
      const result = await llm.generate(prompt);
      let markdown = result.text
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
        .trim();

      const date = new Date().toISOString().slice(0, 10);
      const noNews = markdown.includes('无重要事件');
      const html = briefToHTML(markdown, domainKey, date, state.items);

      saveBrief({ date, domain: domainKey, generatedAt: new Date().toISOString(), llmProvider: ctx.provider, markdown, html, noNews });
      ctx.log(`  [summarize] Brief 完成 (token: ${result.usage.input} in / ${result.usage.output} out)`);

      return { ...state, markdown, html, noNews, usage: result.usage };
    },
  };
}

// === Survey pipeline stages ===

export function classifyDomainStage() {
  return {
    name: 'classifyDomain',
    run: async (state, ctx) => {
      if (state.domain) return state;
      ctx.log(`  [classifyDomain] 自动判断课题领域: ${state.topic}`);
      try {
        const llm = createProvider(ctx.provider);
        const res = await llm.generate(getDomainClassifyPrompt(state.topic), { maxTokens: 128 });
        const match = res.text.match(/\{[\s\S]*?\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          return { ...state, domain: (parsed.domains || ['software-engineering'])[0] };
        }
      } catch (_) {}
      return { ...state, domain: 'software-engineering' };
    },
  };
}

export function surveySummarizeStage() {
  return {
    name: 'summarize',
    run: async (state, ctx) => {
      const { topic, timeRange, domain, userTags, feedbackHint } = state;
      ctx.log(`  [summarize] 生成综述报告: ${topic}`);

      const llm = createProvider(ctx.provider);
      let prompt = getSurveyPrompt(topic, timeRange, domain);
      if (ctx.hooks) prompt += '\n\n' + ctx.hooks;
      if (feedbackHint) prompt += `\n\n用户对上一版报告的反馈，请在本次生成中重点改进：\n${feedbackHint}`;

      const result = await llm.generate(prompt);
      let markdown = result.text
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
        .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
        .trim();

      return { ...state, markdown, usage: result.usage };
    },
  };
}

export const autoTagStage = {
  name: 'autoTag',
  run: async (state, ctx) => {
    ctx.log(`  [autoTag] 提取标签 ...`);
    try {
      const llm = createProvider(ctx.provider);
      const tagResult = await llm.generate(getAutoTagPrompt(state.markdown), { maxTokens: 256 });
      const match = tagResult.text.match(/\[[\s\S]*?\]/);
      if (match) return { ...state, autoTags: JSON.parse(match[0]) };
    } catch (_) { ctx.log('  标签提取失败，跳过'); }
    return { ...state, autoTags: [] };
  },
};

// Memory recall stage (Phase 2 placeholder)
export const recallMemoryStage = {
  name: 'recallMemory',
  run: async (state, ctx) => {
    // Phase 2: recall similar past reports and inject context
    return state;
  },
};

// Evolution tracking stage (Phase 3 placeholder)
export const trackEvolutionStage = {
  name: 'trackEvolution',
  run: async (state, ctx) => {
    // Phase 3: record generation metrics for self-improvement
    return state;
  },
};
