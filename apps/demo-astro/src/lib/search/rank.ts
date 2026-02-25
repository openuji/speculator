export interface SearchContext {
  sectionTitle?: string;
  headingPath?: string[];
  nodeType?: string;
}

export interface SearchEntry {
  searchId: string;
  text: string;
  plainText: string;
  context: SearchContext;
  anchor?: string;
  filters?: {
    nodeType?: string;
  };
}

export interface SearchIndexDocument {
  documentId: string;
  title: string;
  shortName?: string;
  workspace: string;
  docId: string;
  route: string;
  entries: SearchEntry[];
}

export interface SearchIndexPayload {
  version: string;
  generatedAt?: string;
  documents: SearchIndexDocument[];
}

export interface RankedSearchResult {
  score: number;
  document: SearchIndexDocument;
  entry: SearchEntry;
  url: string;
}

const NODE_TYPE_WEIGHTS: Record<string, number> = {
  heading: 20,
  definition: 18,
  reference: 16,
  sectionReference: 14,
  paragraph: 10,
  tableCell: 8,
  codeBlock: 6
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface MatchScore {
  score: number;
  matched: boolean;
}

const scoreField = (normalizedField: string, query: string): MatchScore => {
  if (!normalizedField || !query) {
    return { score: 0, matched: false };
  }

  if (normalizedField === query) {
    return { score: 120, matched: true };
  }

  if (normalizedField.startsWith(query)) {
    return { score: 90, matched: true };
  }

  const index = normalizedField.indexOf(query);
  if (index >= 0) {
    const proximityBonus = Math.max(0, 35 - Math.min(index, 35));
    return {
      score: 55 + proximityBonus,
      matched: true
    };
  }

  return { score: 0, matched: false };
};

export const rankSearchResults = (
  queryRaw: string,
  index: SearchIndexPayload,
  limit = 20
): RankedSearchResult[] => {
  const query = normalize(queryRaw);
  if (!query) {
    return [];
  }

  const scored: RankedSearchResult[] = [];

  for (const document of index.documents) {
    const titleScore = scoreField(normalize(document.title), query);

    for (const entry of document.entries) {
      const textScore = scoreField(normalize(entry.plainText || entry.text), query);
      const headingPath = normalize((entry.context.headingPath || []).join(" "));
      const headingScore = scoreField(headingPath, query);
      const sectionScore = scoreField(normalize(entry.context.sectionTitle || ""), query);

      const matched =
        titleScore.matched || textScore.matched || headingScore.matched || sectionScore.matched;

      if (!matched) {
        continue;
      }

      const nodeType = entry.filters?.nodeType || entry.context.nodeType || "paragraph";
      const nodeBoost = NODE_TYPE_WEIGHTS[nodeType] || 6;

      const score =
        titleScore.score * 1.15 +
        textScore.score * 1.4 +
        headingScore.score * 1.1 +
        sectionScore.score * 0.9 +
        nodeBoost;

      const anchor = entry.anchor || "";
      scored.push({
        score,
        document,
        entry,
        url: `${document.route}${anchor}`
      });
    }
  }

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const titleCmp = left.document.title.localeCompare(right.document.title);
    if (titleCmp !== 0) {
      return titleCmp;
    }

    const docCmp = left.document.docId.localeCompare(right.document.docId);
    if (docCmp !== 0) {
      return docCmp;
    }

    return left.entry.searchId.localeCompare(right.entry.searchId);
  });

  return scored.slice(0, limit);
};
