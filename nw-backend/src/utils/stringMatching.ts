/**
 * String matching utilities for subscription service name matching
 */

// Special cases mapping for common service name variations
export const SPECIAL_CASES: Record<string, string> = {
  'youtube premium': 'YouTube',
  'youtube music': 'YouTube Music',
  'prime video': 'Amazon Prime Video',
  'amazon prime': 'Amazon Prime',
  'disney+': 'Disney Plus',
  'disney plus': 'Disney Plus',
  'hbo max': 'Max',
  'hbo': 'Max',
  'apple tv+': 'Apple TV Plus',
  'apple tv': 'Apple TV Plus',
  'hulu': 'Hulu',
  'paramount+': 'Paramount Plus',
  'paramount plus': 'Paramount Plus',
  'peacock': 'Peacock',
  'espn+': 'ESPN Plus',
  'chatgpt': 'ChatGPT',
  'chatgpt plus': 'ChatGPT',
  'openai': 'ChatGPT',
};

/**
 * Normalizes a service name for matching
 * Removes common suffixes, special characters, and standardizes format
 */
export function normalizeServiceName(name: string): string {
  if (!name) return '';

  let normalized = name
    .toLowerCase()
    .trim()
    // Remove common business suffixes
    .replace(/\s+(inc\.?|llc|corp\.?|ltd\.?|limited|corporation|company)$/gi, '')
    // Remove subscription-related terms
    .replace(/\s+(subscription|premium|plus|pro|basic|standard)$/gi, '')
    // Remove domain extensions
    .replace(/\.(com|net|org|io|co|tv)$/gi, '')
    // Remove special characters except spaces
    .replace(/[^a-z0-9\s]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  // Check special cases
  const lowerNormalized = normalized.toLowerCase();
  if (SPECIAL_CASES[lowerNormalized]) {
    return SPECIAL_CASES[lowerNormalized].toLowerCase();
  }

  return normalized;
}

/**
 * Calculates Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to transform one string into another
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first column and row
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculates similarity percentage between two strings based on Levenshtein distance
 * Returns a score from 0-100 where 100 is an exact match
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100;
  if (!str1 || !str2) return 0;

  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) return 100;

  const similarity = ((maxLength - distance) / maxLength) * 100;
  return Math.round(similarity);
}

/**
 * Finds the best matching service name from a list of candidates
 * Returns the match with the highest similarity score above the threshold
 */
export interface FuzzyMatchResult {
  name: string;
  normalizedName: string;
  score: number;
}

export function fuzzyMatch(
  searchName: string,
  candidates: Array<{ name: string; normalizedName?: string }>,
  threshold: number = 70
): FuzzyMatchResult | null {
  if (!searchName || !candidates || candidates.length === 0) {
    return null;
  }

  const normalizedSearch = normalizeServiceName(searchName);

  // Calculate similarity scores for all candidates
  const matches = candidates.map(candidate => {
    const candidateNormalized = candidate.normalizedName || normalizeServiceName(candidate.name);
    const score = calculateSimilarity(normalizedSearch, candidateNormalized);

    return {
      name: candidate.name,
      normalizedName: candidateNormalized,
      score
    };
  });

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  // Return the best match if it meets the threshold
  const bestMatch = matches[0];

  if (bestMatch && bestMatch.score >= threshold) {
    return bestMatch;
  }

  return null;
}

/**
 * Extracts domain from URL for matching
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./i, '');
  } catch {
    // If URL parsing fails, try simple extraction
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i);
    return match ? match[1].replace(/^www\./i, '') : url;
  }
}
