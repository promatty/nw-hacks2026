/**
 * Cancellation Service - Hybrid Approach
 * 1. Check curated database for common services
 * 2. Fall back to Gemini AI for unknown services
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { findCancellationEntry, getNormalizedKey } from '../data/curatedCancellations.js';
import { normalizeServiceName, calculateSimilarity } from '../utils/stringMatching.js';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.PLASMO_PUBLIC_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/**
 * Cancellation link result
 */
export interface CancellationLink {
  serviceName: string;
  url: string;
  difficulty?: string;
  notes?: string;
  email?: string;
  matchScore: number;
  source: 'curated' | 'ai-generated';
}

/**
 * Gets cancellation link for a service
 * First checks curated database, then uses AI if not found
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
      source: 'curated',
      difficulty: 'easy' // Curated entries are well-documented
    };
  }

  // Step 2: Fuzzy match against curated entries
  const normalized = normalizeServiceName(serviceName);
  const curatedServices = await import('../data/curatedCancellations.js');
  const entries = Object.values(curatedServices.CURATED_CANCELLATIONS);

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
      source: 'curated',
      difficulty: 'easy'
    };
  }

  // Step 3: Fall back to AI generation
  console.log(`[Cancellation] Using AI to generate cancellation URL for: ${serviceName}`);
  return await generateCancellationLinkWithAI(serviceName);
}

/**
 * Uses Gemini AI to generate a likely cancellation URL
 */
async function generateCancellationLinkWithAI(serviceName: string): Promise<CancellationLink | null> {
  try {
    const prompt = `You are a helpful assistant that helps users find subscription cancellation pages.

For the service "${serviceName}", provide:
1. The most likely direct URL to their subscription cancellation or billing management page (NOT account deletion)
2. Brief instructions on how to cancel

Format your response as JSON:
{
  "serviceName": "Official Service Name",
  "url": "https://...",
  "notes": "Brief cancellation instructions",
  "confidence": "high|medium|low"
}

Important:
- Only provide real, existing URLs for known services
- If unsure, use the company's account/billing/subscription settings page
- DO NOT provide account deletion pages
- If you don't know the service, return null

Respond with ONLY valid JSON, no additional text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse AI response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Cancellation] AI response not in JSON format');
      return null;
    }

    const aiResponse = JSON.parse(jsonMatch[0]);

    if (!aiResponse.url || aiResponse.url === 'null') {
      return null;
    }

    // Map confidence to match score
    const confidenceMap: Record<string, number> = {
      'high': 85,
      'medium': 70,
      'low': 60
    };

    const matchScore = confidenceMap[aiResponse.confidence] || 70;

    console.log(`[Cancellation] AI generated URL with ${aiResponse.confidence} confidence`);

    return {
      serviceName: aiResponse.serviceName || serviceName,
      url: aiResponse.url,
      notes: aiResponse.notes || 'Visit this page to manage your subscription.',
      matchScore,
      source: 'ai-generated',
      difficulty: 'medium' // AI-generated, may need verification
    };
  } catch (error) {
    console.error('[Cancellation] AI generation failed:', error);
    return null;
  }
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
export async function getServiceStatus() {
  const curatedServices = await import('../data/curatedCancellations.js');
  const count = Object.keys(curatedServices.CURATED_CANCELLATIONS).length;

  return {
    curatedServicesCount: count,
    aiEnabled: !!process.env.PLASMO_PUBLIC_GEMINI_API_KEY,
    isInitialized: true
  };
}

/**
 * Initialize service (no longer needed for this approach, but keeping for compatibility)
 */
export async function initializeCancellationService(): Promise<void> {
  console.log('[Cancellation] Service initialized with hybrid approach (curated + AI)');
  const status = await getServiceStatus();
  console.log(`[Cancellation] Curated services: ${status.curatedServicesCount}`);
  console.log(`[Cancellation] AI fallback: ${status.aiEnabled ? 'enabled' : 'disabled (no API key)'}`);
}

// Deprecated: No longer using JustDelete.me
export async function refreshJustDeleteMeData(): Promise<void> {
  console.log('[Cancellation] refreshJustDeleteMeData is deprecated - using curated database instead');
}
