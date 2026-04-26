export function dedup(items) {
  const seen = new Map();
  const result = [];

  for (const item of items) {
    const normalUrl = normalizeUrl(item.url);

    if (seen.has(normalUrl)) {
      const existing = seen.get(normalUrl);
      if (!existing.duplicateUrls) existing.duplicateUrls = [];
      existing.duplicateUrls.push(item.url);
      continue;
    }

    let isDup = false;
    for (const existing of result) {
      if (jaccardSimilarity(item.title, existing.title) >= 0.6) {
        if (!existing.duplicateUrls) existing.duplicateUrls = [];
        existing.duplicateUrls.push(item.url);
        isDup = true;
        break;
      }
    }

    if (!isDup) {
      seen.set(normalUrl, item);
      result.push(item);
    }
  }

  return result;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/+$/, '');
  } catch (_) {
    return url;
  }
}

function tokenize(text) {
  return new Set(
    text.toLowerCase().replace(/[^\w一-鿿]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  );
}

function jaccardSimilarity(a, b) {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const t of setA) { if (setB.has(t)) intersection++; }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
