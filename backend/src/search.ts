import type { ApiSearchResponse, ApiSnapshot, SearchResult } from "./contracts.js";

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatchStart(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  let best = Number.POSITIVE_INFINITY;

  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index >= 0 && index < best) {
      best = index;
    }
  }

  return Number.isFinite(best) ? best : -1;
}

function buildSnippet(text: string, start: number, tokenLength: number): string {
  if (start < 0) {
    return text.slice(0, 180);
  }

  const before = Math.max(0, start - 72);
  const after = Math.min(text.length, start + tokenLength + 108);
  return text.slice(before, after).trim();
}

export function searchSnapshot(
  snapshot: ApiSnapshot,
  query: string,
  mode: "search" | "query",
): ApiSearchResponse {
  const tokens = tokenize(query);

  if (tokens.length === 0) {
    return {
      mode,
      query,
      refreshedAt: snapshot.refreshedAt,
      resultCount: 0,
      summary:
        mode === "query"
          ? "Ask a question with a few concrete terms to retrieve grounded passages."
          : "Enter a term to search the current live snapshot.",
      results: [],
    };
  }

  const results: SearchResult[] = [];

  for (const window of snapshot.windows) {
    for (const tab of window.tabs) {
      const titleLower = tab.title.toLowerCase();
      const bodyLower = tab.text.toLowerCase();
      let score = 0;

      for (const token of tokens) {
        const titleHits = titleLower.split(token).length - 1;
        const bodyHits = bodyLower.split(token).length - 1;
        score += titleHits * 24;
        score += bodyHits * 6;
      }

      if (score === 0) {
        continue;
      }

      const titleMatchStart = findMatchStart(tab.title, tokens);
      const bodyMatchStart = findMatchStart(tab.text, tokens);
      const snippet = buildSnippet(
        tab.text,
        bodyMatchStart,
        tokens[0]?.length ?? 0,
      );

      results.push({
        id: `${tab.id}::${bodyMatchStart >= 0 ? bodyMatchStart : titleMatchStart}`,
        stateId: tab.stateId,
        tabId: tab.id,
        windowHandle: tab.windowHandle,
        tabTitle: tab.title,
        duplicateLabel:
          tab.duplicateCount > 1
            ? `Tab ${tab.duplicateIndex} of ${tab.duplicateCount}`
            : null,
        score:
          score +
          (titleMatchStart >= 0 ? 10 : 0) +
          (bodyMatchStart >= 0 ? 5 : 0) -
          tab.order,
        snippet,
        matchStart: bodyMatchStart >= 0 ? bodyMatchStart : 0,
        matchEnd:
          bodyMatchStart >= 0
            ? bodyMatchStart + (tokens[0]?.length ?? 0)
            : Math.min(tab.text.length, tokens[0]?.length ?? 0),
      });
    }
  }

  results.sort((left, right) => right.score - left.score || left.matchStart - right.matchStart);

  return {
    mode,
    query,
    refreshedAt: snapshot.refreshedAt,
    resultCount: results.length,
    summary:
      results.length > 0
        ? mode === "query"
          ? "Local retrieval only. These passages are ranked from the current live snapshot."
          : `Found ${results.length} matching passage${results.length === 1 ? "" : "s"}.`
        : "No grounded matches were found in the current live snapshot.",
    results: results.slice(0, 50),
  };
}
