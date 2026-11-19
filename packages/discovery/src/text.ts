/** Splits text into lower-case search terms: on punctuation, underscores and camelCase. */
export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/** Crude singular form, so "orders" finds "order". */
export function stem(term: string): string {
  if (term.length > 4 && term.endsWith("ies")) return `${term.slice(0, -3)}y`;
  if (term.length > 3 && term.endsWith("s") && !term.endsWith("ss")) return term.slice(0, -1);
  return term;
}

export interface KeywordHit {
  index: number;
  score: number;
  /** Query terms that matched, as typed. */
  matched: string[];
}

/** BM25 over a fixed set of documents, with stemming and prefix matching. */
export class KeywordIndex {
  private readonly postings = new Map<string, Map<number, number>>();
  private readonly lengths: number[] = [];
  private readonly average: number;

  constructor(documents: string[]) {
    documents.forEach((text, index) => {
      const terms = tokenize(text).map(stem);
      this.lengths.push(terms.length);
      for (const term of terms) {
        let posting = this.postings.get(term);
        if (!posting) this.postings.set(term, (posting = new Map()));
        posting.set(index, (posting.get(index) ?? 0) + 1);
      }
    });
    this.average = this.lengths.reduce((a, b) => a + b, 0) / Math.max(1, this.lengths.length);
  }

  search(query: string): KeywordHit[] {
    const scores = new Map<number, { score: number; matched: Set<string> }>();
    const total = this.lengths.length;
    for (const raw of new Set(tokenize(query))) {
      const term = stem(raw);
      // Exact (stemmed) matches count fully; a term that only starts a word counts for less.
      const candidates: [string, number][] = [];
      if (this.postings.has(term)) candidates.push([term, 1]);
      if (term.length >= 3) {
        for (const known of this.postings.keys()) {
          if (known !== term && known.startsWith(term)) candidates.push([known, 0.6]);
        }
      }
      for (const [known, weight] of candidates) {
        const posting = this.postings.get(known)!;
        const idf = Math.log(1 + (total - posting.size + 0.5) / (posting.size + 0.5));
        for (const [index, frequency] of posting) {
          const length = this.lengths[index]! / (this.average || 1);
          const tf = (frequency * 2.2) / (frequency + 1.2 * (0.25 + 0.75 * length));
          const entry = scores.get(index) ?? { score: 0, matched: new Set<string>() };
          entry.score += weight * idf * tf;
          entry.matched.add(raw);
          scores.set(index, entry);
        }
      }
    }
    return [...scores]
      .map(([index, entry]) => ({ index, score: entry.score, matched: [...entry.matched] }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
  }
}

/** Cosine similarity of two vectors. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}
