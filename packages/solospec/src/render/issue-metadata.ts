/**
 * Issue Metadata Enrichment
 *
 * Walks the AST to find issue-type notes with href,
 * fetches metadata from GitHub API (with file-based caching),
 * and enriches the AST nodes with title/state/repo info.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Document, BlockNote, Block, Section } from '@openuji/speculator';

export interface IssueMetadata {
  title: string;
  state: 'open' | 'closed';
  repoSlug: string;
  issueNumber: string;
  fetchedAt: string;
}

type IssueCache = Record<string, IssueMetadata>;

/**
 * Parse a GitHub issue URL into repo slug and issue number.
 * Returns null if the URL doesn't match the expected pattern.
 */
function parseGitHubIssueUrl(url: string): { repoSlug: string; issueNumber: string } | null {
  const match = url.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
  if (!match) return null;
  return { repoSlug: match[1], issueNumber: match[2] };
}

/**
 * Fetch issue metadata from the GitHub API.
 */
async function fetchGitHubIssue(repoSlug: string, issueNumber: string): Promise<IssueMetadata | null> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'openuji-solospec',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoSlug}/issues/${issueNumber}`,
      { headers }
    );

    if (!response.ok) {
      console.warn(`[solospec] GitHub API ${response.status} for ${repoSlug}#${issueNumber}`);
      return null;
    }

    const data = await response.json() as { title: string; state: string };
    return {
      title: data.title,
      state: data.state as 'open' | 'closed',
      repoSlug,
      issueNumber,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[solospec] Failed to fetch issue ${repoSlug}#${issueNumber}:`, (err as Error).message);
    return null;
  }
}

/**
 * Read the issue cache from a JSON file.
 */
function readCache(cachePath: string): IssueCache {
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as IssueCache;
    }
  } catch {
    // Corrupted cache — start fresh
  }
  return {};
}

/**
 * Write the issue cache to a JSON file.
 */
function writeCache(cachePath: string, cache: IssueCache): void {
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

/**
 * Collect all issue-type BlockNote nodes with href from the AST.
 */
function collectIssueNodes(node: Block | Section | Document): BlockNote[] {
  const results: BlockNote[] = [];

  if ('type' in node && node.type === 'note') {
    const noteNode = node as BlockNote;
    if (noteNode.noteType === 'issue' && noteNode.src) {

      results.push(noteNode);
    }
  }

  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child && typeof child === 'object' && 'type' in child) {
        results.push(...collectIssueNodes(child as Block | Section));
      }
    }
  }

  return results;
}

/**
 * Enrich issue-type notes in the document AST with metadata from GitHub.
 * Uses a file-based cache at `<appDir>/.spec-issues-cache.json`.
 *
 * @param document - The parsed document AST
 * @param appDir - The directory of the consumer app (where the cache file lives)
 */
export async function enrichIssueMetadata(document: Document, appDir: string): Promise<void> {
  const issueNodes = collectIssueNodes(document);
  if (issueNodes.length === 0) return;

  const cachePath = path.join(appDir, '.spec-issues-cache.json');
  const cache = readCache(cachePath);
  

  // Determine which URLs need fetching
  const toFetch: { node: BlockNote; parsed: { repoSlug: string; issueNumber: string }; url: string }[] = [];

  for (const node of issueNodes) {
    const url = node.src as string;
    if (cache[url]) {
      // Use cached data
      node.data = cache[url];
    } else {
      const parsed = parseGitHubIssueUrl(url);
      if (parsed) {
        toFetch.push({ node, parsed, url });
      }
    }
  }

  if (toFetch.length === 0) return;

  // Fetch missing entries (in parallel, but capped)
  console.log(`[solospec] Fetching metadata for ${toFetch.length} issue(s)...`);

  const results = await Promise.allSettled(
    toFetch.map(async ({ node, parsed, url }) => {
      const metadata = await fetchGitHubIssue(parsed.repoSlug, parsed.issueNumber);
      if (metadata) {
        node.data = metadata;
        cache[url] = metadata;
        const stateIcon = metadata.state === 'open' ? '🟢' : '🔴';
        console.log(
          `[solospec] ${stateIcon} Cached issue ${metadata.repoSlug}#${metadata.issueNumber} — "${metadata.title}" (${metadata.state})`
        );
      }
    })
  );

  // Log any failures
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      console.warn(`[solospec] Failed to enrich issue: ${toFetch[i].url}`);
    }
  }

  // Write updated cache
  writeCache(cachePath, cache);
}
