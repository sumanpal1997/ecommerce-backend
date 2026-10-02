import { describe, it, expect, beforeEach } from 'vitest';
import { AutocompleteTrie } from '../../src/modules/catalog/dsa/trie';

describe('AutocompleteTrie (Prefix Tree DSA)', () => {
  let trie: AutocompleteTrie;

  beforeEach(() => {
    trie = new AutocompleteTrie();
  });

  it('should insert items and find matches by prefix', () => {
    trie.insert({ term: 'wireless headphones', slug: 'wireless-headphones' });
    trie.insert({ term: 'wireless charger', slug: 'wireless-charger' });
    trie.insert({ term: 'wired mouse', slug: 'wired-mouse' });
    trie.insert({ term: 'bluetooth speaker', slug: 'bluetooth-speaker' });

    const results = trie.search('wire');
    expect(results).toHaveLength(3);
    const terms = results.map((r) => r.term);
    expect(terms).toContain('wireless headphones');
    expect(terms).toContain('wireless charger');
    expect(terms).toContain('wired mouse');
  });

  it('should be case-insensitive and trim whitespace', () => {
    trie.insert({ term: 'Apple iPhone 15' });

    const resultsLower = trie.search('apple');
    const resultsUpper = trie.search('APPLE');
    const resultsSpaces = trie.search('  app  ');

    expect(resultsLower).toHaveLength(1);
    expect(resultsUpper).toHaveLength(1);
    expect(resultsSpaces).toHaveLength(1);
  });

  it('should prioritize results with higher relevance score', () => {
    trie.insert({ term: 'gaming laptop basic', score: 1 });
    trie.insert({ term: 'gaming laptop pro', score: 100 });
    trie.insert({ term: 'gaming laptop medium', score: 50 });

    const results = trie.search('gaming');
    expect(results[0].term).toBe('gaming laptop pro');
    expect(results[1].term).toBe('gaming laptop medium');
    expect(results[2].term).toBe('gaming laptop basic');
  });

  it('should respect maxResults limit', () => {
    for (let i = 1; i <= 20; i++) {
      trie.insert({ term: `smart watch model ${i}` });
    }

    const results = trie.search('smart', 5);
    expect(results).toHaveLength(5);
  });

  it('should return empty array for non-matching prefix or empty query', () => {
    trie.insert({ term: 'running shoes' });

    expect(trie.search('phone')).toEqual([]);
    expect(trie.search('')).toEqual([]);
    expect(trie.search('   ')).toEqual([]);
  });
});
