/**
 * Cancellation Service - Curated Database Only
 * Checks curated database for subscription cancellation links
 */

import { findCancellationEntry, CURATED_CANCELLATIONS } from '../data/curatedCancellations.js';
import { normalizeServiceName, calculateSimilarity } from '../utils/stringMatching.js';

/**
 * Cancellation link result
 */
export interface CancellationLink {
  serviceName: string;
  url: string;
  notes?: string;
  matchScore: number;
  source: 'curated';
}

/**
 * Gets cancellation link for a service from curated database
 */
export async function getCancellationLink(serviceName: string): Promise<CancellationLink | null> {
  if (!serviceName || serviceName.trim() === '') {
    return null;
  }

  // Step 1: Check curated database with exact and fuzzy matching
  const curatedEntry = findCancellationEntry(serviceName);

  if (curatedEntry) {
    console.log(`[Cancellation] Found in curated database: ${curatedEntry.name}`);
    return {
      serviceName: curatedEntry.name,
      url: curatedEntry.url,
      notes: curatedEntry.notes,
      matchScore: 100,
      source: 'curated'
    };
  }

  // Step 2: Fuzzy match against curated entries
  const normalized = normalizeServiceName(serviceName);
  const entries = Object.values(CURATED_CANCELLATIONS);

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of entries) {
    const nameScore = calculateSimilarity(normalized, normalizeServiceName(entry.name));

    // Check aliases too
    let aliasScore = 0;
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        const score = calculateSimilarity(normalized, normalizeServiceName(alias));
        aliasScore = Math.max(aliasScore, score);
      }
    }

    const score = Math.max(nameScore, aliasScore);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  // If fuzzy match is good enough (>75%), use it
  if (bestMatch && bestScore > 75) {
    console.log(`[Cancellation] Fuzzy match found: ${bestMatch.name} (${bestScore}% confidence)`);
    return {
      serviceName: bestMatch.name,
      url: bestMatch.url,
      notes: bestMatch.notes,
      matchScore: bestScore,
      source: 'curated'
    };
  }

  // Not found in database
  console.log(`[Cancellation] Service not found in database: ${serviceName}`);
  return null;
}

/**
 * Gets cancellation links for multiple services (batch lookup)
 */
export async function getCancellationLinksBulk(
  serviceNames: string[]
): Promise<Array<{ input: string; found: boolean; data?: CancellationLink }>> {
  const results = await Promise.all(
    serviceNames.map(async (serviceName) => {
      const link = await getCancellationLink(serviceName);
      return {
        input: serviceName,
        found: link !== null,
        data: link || undefined
      };
    })
  );

  return results;
}

/**
 * Gets status of the service
 */
export function getServiceStatus() {
  const count = Object.keys(CURATED_CANCELLATIONS).length;

  return {
    curatedServicesCount: count,
    isInitialized: true
  };
}

/**
 * Initialize service
 */
export async function initializeCancellationService(): Promise<void> {
  console.log('[Cancellation] Service initialized with curated database');
  const status = getServiceStatus();
  console.log(`[Cancellation] Curated services: ${status.curatedServicesCount}`);
}

// Deprecated
export async function refreshJustDeleteMeData(): Promise<void> {
  console.log('[Cancellation] refreshJustDeleteMeData is deprecated - using curated database instead');
}
