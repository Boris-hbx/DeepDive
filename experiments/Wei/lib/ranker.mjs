// 排名评分 — 组合源权威度、关键词相关性、时间衰减、HN热度、学习反馈

// Tokenize text for keyword matching (same strategy as inverted.mjs)
function tokenize(text) {
  if (!text) return [];
  const tokens = [];
  const lower = text.toLowerCase();
  // English words (length >= 2)
  const words = lower.match(/[a-z][a-z0-9]+/g) || [];
  tokens.push(...words);
  // CJK bigrams
  const cjk = lower.match(/[一-鿿]/g) || [];
  for (let i = 0; i < cjk.length - 1; i++) {
    tokens.push(cjk[i] + cjk[i + 1]);
  }
  return [...new Set(tokens)];
}

// Component A: Source authority (0-1). Direct lookup from source config.
export function computeAuthorityScore(item, authMap) {
  const key = item.source || '';
  return authMap[key] ?? 0.5;
}

// Component B: Keyword relevance (0-1). Jaccard-like overlap of tokens.
export function computeRelevanceScore(item, domainKeywords) {
  if (!domainKeywords || domainKeywords.length === 0) return 0.5;
  const itemText = `${item.title || ''} ${item.snippet || ''}`;
  const itemTokens = tokenize(itemText);
  if (itemTokens.length === 0) return 0.5;

  const kwTokens = domainKeywords.flatMap(k => tokenize(k));
  if (kwTokens.length === 0) return 0.5;

  const intersection = kwTokens.filter(t => itemTokens.includes(t)).length;
  // Normalize: what fraction of domain keywords appear in the item
  return intersection / Math.min(kwTokens.length, itemTokens.length + 1);
}

// Component C: Exponentially decaying time score.
// score = exp(-ageHours / halfLifeHours), clamped to [0, 1]
export function computeTimeScore(publishedAt, now, halfLifeHours = 48) {
  if (!publishedAt) return 0.3; // unknown date = moderate score
  try {
    const pub = new Date(publishedAt).getTime();
    const n = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const ageHours = Math.max(0, (n - pub) / (1000 * 60 * 60));
    return Math.exp(-ageHours / halfLifeHours);
  } catch (_) {
    return 0.3;
  }
}

// Component D: HN heat signals normalized to [0, 1].
// Combines points (primary) and comments (bonus).
export function computeHeatScore(item, maxPoints = 100) {
  const points = item.points;
  const comments = item.comments;
  if (points == null && comments == null) return 0; // non-HN source
  const p = typeof points === 'number' ? points : 0;
  const c = typeof comments === 'number' ? comments : 0;
  const pointsScore = Math.min(p / maxPoints, 1.0);
  const commentsWeight = Math.min(c / 50, 1.0) * 0.15;
  return Math.min(pointsScore + commentsWeight, 1.0);
}

// Composite rule-based score (no LLM, no learning)
export function computeRuleScore(item, opts) {
  const {
    authMap = {},
    domainKeywords = [],
    now = new Date(),
    weights = { authority: 0.20, relevance: 0.25, timeDecay: 0.25, heat: 0.30 },
    timeHalfLifeHours = 48,
    heatMaxPoints = 100,
  } = opts;

  const authority = computeAuthorityScore(item, authMap);
  const relevance = computeRelevanceScore(item, domainKeywords);
  const time = computeTimeScore(item.publishedAt, now, timeHalfLifeHours);
  const heat = computeHeatScore(item, heatMaxPoints);

  return {
    _ruleScore: weights.authority * authority + weights.relevance * relevance + weights.timeDecay * time + weights.heat * heat,
    _authorityScore: authority,
    _relevanceScore: relevance,
    _timeScore: time,
    _heatScore: heat,
  };
}

// Global TOP score — pure authority + heat + recency, NO domain relevance filter.
// For "业界 TOP 科技新闻" — items that are globally important regardless of domain.
export function computeGlobalScore(item, opts) {
  const {
    authMap = {},
    now = new Date(),
    timeHalfLifeHours = 48,
    heatMaxPoints = 100,
  } = opts;

  const authority = computeAuthorityScore(item, authMap);
  const time = computeTimeScore(item.publishedAt, now, timeHalfLifeHours);
  const heat = computeHeatScore(item, heatMaxPoints);
  // weights: authority 0.30, heat 0.40, timeDecay 0.30 — no relevance filter
  return 0.30 * authority + 0.40 * heat + 0.30 * time;
}

// Focus topic relevance — lightweight keyword overlap with natural language focus topics
export function computeFocusScore(item, focusTopics) {
  if (!focusTopics || focusTopics.length === 0) return 0;
  const itemText = `${item.title || ''} ${item.snippet || ''}`;
  const itemTokens = tokenize(itemText);
  if (itemTokens.length === 0) return 0;

  let maxScore = 0;
  for (const topic of focusTopics) {
    const topicTokens = tokenize(topic);
    if (topicTokens.length === 0) continue;
    const intersection = topicTokens.filter(t => itemTokens.includes(t)).length;
    const score = intersection / Math.min(topicTokens.length, itemTokens.length + 1);
    if (score > maxScore) maxScore = score;
  }
  return maxScore;
}

// Full composite with optional LLM score and learning boost
export function computeFinalScore(ruleScore, llmScore, learnBoost, wLLM = 0.15, wLearn = 0.10) {
  if (llmScore != null) {
    const wRule = 1 - wLLM - wLearn;
    return ruleScore * wRule + llmScore * wLLM + learnBoost * wLearn;
  }
  return ruleScore * (1 - wLearn) + learnBoost * wLearn;
}

// Learning boost from historical article feedback
function tokenizeForLearning(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z][a-z0-9]+/g) || [];
  return [...new Set(words)];
}

export function computeLearningBoost(item, interestKeywordMap) {
  if (!interestKeywordMap || interestKeywordMap.size === 0) return 0;
  const titleTokens = tokenizeForLearning(item.title);
  let totalInterest = 0;
  let matchCount = 0;

  for (const token of titleTokens) {
    if (interestKeywordMap.has(token)) {
      totalInterest += interestKeywordMap.get(token);
      matchCount++;
    }
  }

  if (matchCount === 0) return 0;
  return totalInterest / matchCount;
}

// Batch rank: scores all items, then sorts descending by final score.
// Also computes _globalScore for unfiltered TOP news selection.
export function rankItems(items, opts) {
  const {
    authMap = {},
    domainKeywords = [],
    now = new Date(),
    ranking: rankingConfig,
    interestKeywordMap = null,
    llmScores = null,
    focusTopics = [],
    wLLM = 0.15,
    wLearn = 0.10,
    wFocus = 0.10,
  } = opts;

  const weights = rankingConfig?.weights || { authority: 0.20, relevance: 0.25, timeDecay: 0.25, heat: 0.30 };
  const timeHalfLifeHours = rankingConfig?.timeHalfLifeHours ?? 48;
  const heatMaxPoints = rankingConfig?.heatMaxPoints ?? 100;

  const scored = items.map((item, i) => {
    // Domain score (existing, with relevance)
    const rule = computeRuleScore(item, { authMap, domainKeywords, now, weights, timeHalfLifeHours, heatMaxPoints });
    // Global TOP score (no relevance filter)
    const globalScore = computeGlobalScore(item, { authMap, now, timeHalfLifeHours, heatMaxPoints });
    // Focus topic match
    const focus = computeFocusScore(item, focusTopics);
    // Learning boost
    const llmScore = llmScores ? (llmScores[i] ?? null) : null;
    const learnBoost = computeLearningBoost(item, interestKeywordMap);
    // Blend domain score + focus score
    const blendedRule = rule._ruleScore * (1 - wFocus) + focus * wFocus;
    const score = computeFinalScore(blendedRule, llmScore, learnBoost, wLLM, wLearn);

    return {
      ...item,
      ...rule,
      _focusScore: focus,
      _globalScore: globalScore,
      _llmScore: llmScore,
      _learnBoost: learnBoost,
      _score: score,
    };
  });

  scored.sort((a, b) => b._score - a._score);
  return scored;
}
