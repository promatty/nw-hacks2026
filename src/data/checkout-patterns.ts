/**
 * Checkout page URL detection patterns
 * Maps domains and URL patterns to services and spending categories
 */

export interface CheckoutPattern {
  service: string;
  category: string;
  categoryDisplay: string;
  domains: string[];
  urlPatterns: RegExp[];
  queryPatterns?: RegExp[];  // Optional patterns to match against query string
  logoUrl?: string;
}

// Categories that match the mock data categories
export const CATEGORIES = {
  ENTERTAINMENT: {
    name: 'Entertainment',
    color: '#E11D48', // rose-600
    icon: '🎬'
  },
  SOFTWARE: {
    name: 'Software',
    color: '#7C3AED', // violet-600
    icon: '💻'
  },
  PERSONAL_CARE: {
    name: 'Personal Care',
    color: '#0891B2', // cyan-600
    icon: '💪'
  }
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

// Checkout page patterns for popular subscription services
export const CHECKOUT_PATTERNS: CheckoutPattern[] = [
  // Entertainment - Streaming
  {
    service: 'Netflix',
    category: 'ENTERTAINMENT',
    categoryDisplay: 'Entertainment',
    domains: ['netflix.com'],
    urlPatterns: [
      /^\/signup/i,  // Main signup path (matches /signup, /signup/*, etc.)
      /\/checkout/i,
      /\/simpleSignup/i,
      /\/planform/i,
      /\/creditoption/i,
      /\/payment/i
    ],
    // Also match query params for Netflix payment flow
    queryPatterns: [/ENTER_CARD/i, /serverState/i],
    logoUrl: 'https://logo.clearbit.com/netflix.com'
  },
  {
    service: 'Spotify',
    category: 'ENTERTAINMENT',
    categoryDisplay: 'Entertainment',
    domains: ['spotify.com'],
    urlPatterns: [
      /\/checkout/i,
      /\/premium/i,
      /\/purchase/i
    ],
    logoUrl: 'https://logo.clearbit.com/spotify.com'
  },
  {
    service: 'Disney Plus',
    category: 'ENTERTAINMENT',
    categoryDisplay: 'Entertainment',
    domains: ['disneyplus.com', 'disney.com'],
    urlPatterns: [
      /\/subscribe/i,
      /\/checkout/i,
      /\/signup/i,
      /\/payment/i
    ],
    logoUrl: 'https://logo.clearbit.com/disneyplus.com'
  },
  {
    service: 'Max (HBO)',
    category: 'ENTERTAINMENT',
    categoryDisplay: 'Entertainment',
    domains: ['max.com', 'hbomax.com'],
    urlPatterns: [
      /\/checkout/i,
      /\/signup/i,
      /\/subscribe/i,
      /\/payment/i
    ],
    logoUrl: 'https://logo.clearbit.com/max.com'
  },
  {
    service: 'YouTube Premium',
    category: 'ENTERTAINMENT',
    categoryDisplay: 'Entertainment',
    domains: ['youtube.com'],
    urlPatterns: [
      /\/premium/i,
      /\/paid_memberships/i
    ],
    logoUrl: 'https://logo.clearbit.com/youtube.com'
  },
  {
    service: 'Amazon Prime',
    category: 'ENTERTAINMENT',
    categoryDisplay: 'Entertainment',
    domains: ['amazon.com', 'amazon.ca', 'amazon.co.uk'],
    urlPatterns: [
      /\/prime.*signup/i,
      /\/primesignup/i,
      /\/gp\/prime/i
    ],
    logoUrl: 'https://logo.clearbit.com/amazon.com'
  },
  {
    service: 'Apple TV+',
    category: 'ENTERTAINMENT',
    categoryDisplay: 'Entertainment',
    domains: ['tv.apple.com', 'apple.com'],
    urlPatterns: [
      /\/subscribe/i,
      /\/checkout/i,
      /\/channel\/tvs/i
    ],
    logoUrl: 'https://logo.clearbit.com/apple.com'
  },
  {
    service: 'Hulu',
    category: 'ENTERTAINMENT',
    categoryDisplay: 'Entertainment',
    domains: ['hulu.com'],
    urlPatterns: [
      /\/signup/i,
      /\/checkout/i,
      /\/subscribe/i,
      /\/start/i
    ],
    logoUrl: 'https://logo.clearbit.com/hulu.com'
  },
  {
    service: 'Xbox Game Pass',
    category: 'ENTERTAINMENT',
    categoryDisplay: 'Entertainment',
    domains: ['xbox.com', 'microsoft.com'],
    urlPatterns: [
      /\/gamepass/i,
      /\/xbox-game-pass/i,
      /\/checkout/i
    ],
    logoUrl: 'https://logo.clearbit.com/xbox.com'
  },

  // Software subscriptions
  {
    service: 'ChatGPT Plus',
    category: 'SOFTWARE',
    categoryDisplay: 'Software',
    domains: ['chat.openai.com', 'openai.com', 'chatgpt.com'],
    urlPatterns: [
      /\/subscribe/i,
      /\/upgrade/i,
      /\/plus/i,
      /\/checkout/i
    ],
    logoUrl: 'https://logo.clearbit.com/openai.com'
  },
  {
    service: 'iCloud Storage',
    category: 'SOFTWARE',
    categoryDisplay: 'Software',
    domains: ['apple.com', 'icloud.com'],
    urlPatterns: [
      /\/icloud.*upgrade/i,
      /\/storage.*upgrade/i,
      /\/checkout/i
    ],
    logoUrl: 'https://logo.clearbit.com/apple.com'
  },

  // Personal Care
  {
    service: 'Planet Fitness',
    category: 'PERSONAL_CARE',
    categoryDisplay: 'Personal Care',
    domains: ['planetfitness.com'],
    urlPatterns: [
      /\/join/i,
      /\/signup/i,
      /\/membership/i,
      /\/checkout/i
    ],
    logoUrl: 'https://logo.clearbit.com/planetfitness.com'
  }
];

/**
 * Check if a URL matches any checkout pattern
 * Returns the matched pattern or null
 */
export function detectCheckoutPage(url: string): CheckoutPattern | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;
    const search = urlObj.search;  // Query string including ?

    for (const pattern of CHECKOUT_PATTERNS) {
      // Check if domain matches
      const domainMatch = pattern.domains.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      );

      if (domainMatch) {
        // Check if URL path matches any checkout patterns
        const pathMatch = pattern.urlPatterns.some(regex => regex.test(pathname));
        
        // Also check query patterns if defined
        const queryMatch = pattern.queryPatterns 
          ? pattern.queryPatterns.some(regex => regex.test(search))
          : false;
        
        if (pathMatch || queryMatch) {
          return pattern;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get all services in a category
 */
export function getServicesByCategory(category: string): string[] {
  return CHECKOUT_PATTERNS
    .filter(p => p.category === category)
    .map(p => p.service);
}
