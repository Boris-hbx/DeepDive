// LLM 评分阶段 — 可选，让 LLM 对文章重要性和新颖度打分 (1-10)
// 需在 config.json 的 llmScoring.enabled 启用

import { createProvider } from './llm-provider.mjs';

function buildLLMScorePrompt(items, domainLabel) {
  const itemList = items.map((it, i) =>
    `${i + 1}. [${it.source || '?'}] ${it.title}\n   摘要: ${(it.snippet || '').slice(0, 150)}`
  ).join('\n\n');

  return `你是一位技术分析师。请评估以下${domainLabel || ''}领域文章的重要性和新颖度。

对每篇文章给出 1-10 的评分：
- 重要性 (importance): 对${domainLabel || '技术'}领域从业者的信息价值
- 新颖度 (novelty): 内容是否独特、新观点、首发报道

严格按以下 JSON 数组格式输出，不要加任何其他文字：

[
  {"index": 1, "importance": 8, "novelty": 7, "reason": "一句话理由"},
  ...
]

${itemList}`;
}

function parseLLMScores(text, itemCount) {
  try {
    const cleaned = text.trim()
      .replace(/```(?:json)?\s*/gi, '')
      .replace(/\s*```$/gi, '');
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const scores = JSON.parse(match[0]);
    if (!Array.isArray(scores)) return [];
    return scores.filter(s => typeof s.index === 'number' && (s.importance != null || s.novelty != null));
  } catch (_) {
    return [];
  }
}

function normalizeLLMScore(importance, novelty) {
  const imp = typeof importance === 'number' ? importance / 10 : 0.5;
  const nov = typeof novelty === 'number' ? novelty / 10 : 0.5;
  return imp * 0.6 + nov * 0.4;
}

export function createLLMScoreStage(llmScoringConfig) {
  return {
    name: 'llmScore',
    run: async (state, ctx) => {
      const { items } = state;
      const maxItems = llmScoringConfig?.maxItems || 15;
      const toScore = items.slice(0, maxItems);

      if (toScore.length === 0) {
        ctx.log('  [llmScore] 无内容，跳过');
        return state;
      }

      try {
        const providerName = llmScoringConfig?.model || ctx.provider || '';
        const llm = createProvider(providerName);
        const prompt = buildLLMScorePrompt(toScore, ctx.domain || '');
        const result = await llm.generate(prompt, { maxTokens: 1024 });
        const scores = parseLLMScores(result.text, toScore.length);

        // Map scores back to items
        const scoreMap = new Map();
        for (const s of scores) {
          scoreMap.set(s.index - 1, normalizeLLMScore(s.importance, s.novelty));
        }

        // Re-score all items, re-sort
        const rescored = items.map((item, i) => {
          const llmScore = scoreMap.get(i) ?? null;
          const ruleScore = item._ruleScore ?? item._score ?? 0;
          const learnBoost = item._learnBoost ?? 0;
          // Recompute final score with LLM component
          const wLLM = 0.15, wLearn = 0.10;
          const finalScore = llmScore != null
            ? ruleScore * (1 - wLLM - wLearn) + llmScore * wLLM + learnBoost * wLearn
            : ruleScore * (1 - wLearn) + learnBoost * wLearn;

          return { ...item, _llmScore: llmScore, _score: finalScore };
        });

        rescored.sort((a, b) => b._score - a._score);
        ctx.log(`  [llmScore] LLM 评分完成 (${scores.length}/${toScore.length} 条, tokens: ${result.usage?.input || 0}+${result.usage?.output || 0})`);
        return { ...state, items: rescored, _llmScoringTokens: result.usage };
      } catch (err) {
        ctx.log(`  [llmScore] LLM 评分失败，跳过: ${err.message}`);
        return state;
      }
    },
  };
}
