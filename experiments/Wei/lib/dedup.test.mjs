import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { dedup } from './dedup.mjs';

describe('dedup', () => {
  it('removes exact URL duplicates', () => {
    const items = [
      { title: 'A', url: 'https://example.com/a', source: 's1' },
      { title: 'B', url: 'https://example.com/a', source: 's2' },
    ];
    const result = dedup(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].source, 's1');
  });

  it('normalizes trailing slashes', () => {
    const items = [
      { title: 'A', url: 'https://example.com/a/', source: 's1' },
      { title: 'B', url: 'https://example.com/a', source: 's2' },
    ];
    const result = dedup(items);
    assert.equal(result.length, 1);
  });

  it('deduplicates by title similarity', () => {
    const items = [
      { title: 'Claude Code launches new feature for developers', url: 'https://a.com/1', source: 's1' },
      { title: 'Claude Code launches new feature for developers today', url: 'https://b.com/2', source: 's2' },
    ];
    const result = dedup(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].source, 's1');
  });

  it('keeps items with different titles', () => {
    const items = [
      { title: 'Claude Code new feature', url: 'https://a.com/1', source: 's1' },
      { title: 'OpenAI releases GPT-5', url: 'https://b.com/2', source: 's2' },
    ];
    const result = dedup(items);
    assert.equal(result.length, 2);
  });

  it('returns empty for empty input', () => {
    assert.equal(dedup([]).length, 0);
  });

  it('tracks duplicate URLs on the kept item', () => {
    const items = [
      { title: 'A', url: 'https://example.com/a', source: 's1' },
      { title: 'B', url: 'https://example.com/a', source: 's2' },
      { title: 'C', url: 'https://example.com/a', source: 's3' },
    ];
    const result = dedup(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].duplicateUrls.length, 2);
  });
});
