/**
 * Google Search grounding model resolution.
 *
 * The search tool used to target a single hardcoded model. That breaks whenever
 * the pinned model is capacity-exhausted (429/503) or removed from the backend
 * (404), and the set of valid grounding model ids drifts over time.
 *
 * This module builds an ordered chain of candidate models instead:
 *
 *   1. An explicit `search.model` override, when set
 *   2. The newest live-discovered Gemini Flash grounding model
 *   3. The configured `search.fallback_models`
 *   4. The built-in `SEARCH_MODEL` last resort
 *
 * The live list comes from the same `fetchAvailableModels` endpoint the plugin
 * already uses for quotas, so no extra credential path is required.
 */

import { SEARCH_DISCOVERY_MAX_CANDIDATES, SEARCH_MODEL } from "../constants";
import { createLogger } from "./logger";
import { fetchAvailableModels } from "./quota";
import type { SearchConfig } from "./config/schema";

const log = createLogger("search-model");

/**
 * Matches a canonical Gemini Flash grounding model id, for example:
 *   gemini-3.6-flash-high
 *   gemini-3-flash
 *
 * Deliberately excludes non-grounding or non-flash ids such as
 * `gemini-3.1-flash-image`, `gemini-3.5-flash-lite`, `gemini-3-flash-agent`,
 * `gemini-3.6-flash-tiered`, and `tab_flash_lite_preview`.
 */
const SEARCH_FLASH_MODEL = /^gemini-(\d+)(?:\.(\d+))?-flash(?:-(minimal|low|medium|high))?$/i;

/** Higher rank = preferred when two candidates share a version. */
const TIER_RANK: Record<string, number> = { high: 0, medium: 1, low: 2, minimal: 3, "": 4 };

interface DiscoveryCacheEntry {
  at: number;
  models: string[];
}

const discoveryCache = new Map<string, DiscoveryCacheEntry>();

/**
 * Request the live Antigravity model list and return the available model ids.
 * Results are cached per project for `cacheSeconds`. On failure the previous
 * cached list (if any) is returned so callers still have candidates.
 */
export async function discoverSearchModels(
  accessToken: string,
  projectId: string,
  cacheSeconds = 300,
): Promise<string[]> {
  const now = Date.now();
  const cached = discoveryCache.get(projectId);
  if (cached && now - cached.at < cacheSeconds * 1000) {
    return cached.models;
  }

  try {
    const response = await fetchAvailableModels(accessToken, projectId);
    const models = Object.keys(response.models ?? {});
    discoveryCache.set(projectId, { at: now, models });
    return models;
  } catch (error) {
    log.debug("Search model discovery failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return cached?.models ?? [];
  }
}

/** Clear the discovery cache. Intended for tests. */
export function clearSearchModelCache(): void {
  discoveryCache.clear();
}

interface ParsedSearchModel {
  id: string;
  major: number;
  minor: number;
  tier: string;
}

/**
 * Filter the discovered list down to grounding-capable Gemini Flash models and
 * sort them newest version first, preferring `preferredTier` within a version.
 */
export function rankSearchCandidates(models: string[], preferredTier = "high"): string[] {
  const parsed: ParsedSearchModel[] = [];

  for (const id of models) {
    const match = SEARCH_FLASH_MODEL.exec(id);
    if (!match) {
      continue;
    }
    parsed.push({
      id,
      major: Number(match[1]),
      minor: Number(match[2] ?? 0),
      tier: (match[3] ?? "").toLowerCase(),
    });
  }

  const tierRank = (tier: string) => (tier === preferredTier ? -1 : TIER_RANK[tier] ?? 9);

  parsed.sort((a, b) => {
    if (b.major !== a.major) return b.major - a.major;
    if (b.minor !== a.minor) return b.minor - a.minor;
    const tierDelta = tierRank(a.tier) - tierRank(b.tier);
    if (tierDelta !== 0) return tierDelta;
    return a.id.localeCompare(b.id);
  });

  return parsed.map((p) => p.id);
}

/**
 * Resolve the ordered, de-duplicated chain of search models to try.
 */
export async function resolveSearchModelChain(
  config: SearchConfig,
  accessToken: string,
  projectId: string,
): Promise<string[]> {
  const chain: string[] = [];
  const seen = new Set<string>();

  const push = (model?: string | null) => {
    const id = model?.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      chain.push(id);
    }
  };

  if (!config.enabled) {
    push(config.model ?? SEARCH_MODEL);
    return chain;
  }

  // 1. Explicit override
  push(config.model);

  // 2. Newest live-discovered grounding models
  if (config.auto_discover) {
    const discovered = await discoverSearchModels(
      accessToken,
      projectId,
      config.discover_cache_seconds,
    );
    const ranked = rankSearchCandidates(discovered, config.preferred_tier);
    for (const id of ranked.slice(0, SEARCH_DISCOVERY_MAX_CANDIDATES)) {
      push(id);
    }
  }

  // 3. Static fallback chain
  for (const id of config.fallback_models) {
    push(id);
  }

  // 4. Built-in last resort
  push(SEARCH_MODEL);

  return chain;
}
