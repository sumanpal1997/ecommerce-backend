export interface TrieItem {
  term: string;
  slug?: string;
  score?: number; // Popularity/relevance weighting
}

class TrieNode {
  public children: Map<string, TrieNode> = new Map();
  public isEndOfWord = false;
  public item?: TrieItem;
}

/**
 * Practical DSA Implementation: Trie (Prefix Tree).
 * Used for instant, sub-millisecond search autocomplete typeahead suggestions.
 *
 * Complexities:
 * - Insert: O(L) time, where L is word length.
 * - Prefix Search: O(K + M) time, where K is prefix length and M is number of matching descendants.
 * - Independent of catalog size N! (Scales effortlessly compared to O(N) database regex scans).
 */
export class AutocompleteTrie {
  private root: TrieNode;

  constructor() {
    this.root = new TrieNode();
  }

  /**
   * Inserts a term into the Trie.
   */
  public insert(item: TrieItem): void {
    let current = this.root;
    const normalizedTerm = item.term.toLowerCase().trim();

    for (const char of normalizedTerm) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
    }

    current.isEndOfWord = true;
    current.item = item;
  }

  /**
   * Finds the node representing the prefix.
   */
  private findPrefixNode(prefix: string): TrieNode | null {
    let current = this.root;
    const normalizedPrefix = prefix.toLowerCase().trim();

    for (const char of normalizedPrefix) {
      if (!current.children.has(char)) {
        return null;
      }
      current = current.children.get(char)!;
    }

    return current;
  }

  /**
   * Depth-First Search (DFS) traversal to collect all words starting from a prefix node.
   */
  private collectAllWords(node: TrieNode, results: TrieItem[]): void {
    if (node.isEndOfWord && node.item) {
      results.push(node.item);
    }

    for (const child of node.children.values()) {
      this.collectAllWords(child, results);
    }
  }

  /**
   * Returns top-K autocomplete suggestions for a given prefix.
   */
  public search(prefix: string, maxResults = 10): TrieItem[] {
    if (!prefix || prefix.trim().length === 0) {
      return [];
    }

    const prefixNode = this.findPrefixNode(prefix);
    if (!prefixNode) {
      return [];
    }

    const matches: TrieItem[] = [];
    this.collectAllWords(prefixNode, matches);

    // Sort by score (descending) if provided, otherwise alphabetical
    matches.sort((a, b) => {
      const scoreA = a.score ?? 0;
      const scoreB = b.score ?? 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return a.term.localeCompare(b.term);
    });

    return matches.slice(0, maxResults);
  }

  /**
   * Clears all entries from the Trie.
   */
  public clear(): void {
    this.root = new TrieNode();
  }
}

export const catalogTrie = new AutocompleteTrie();
