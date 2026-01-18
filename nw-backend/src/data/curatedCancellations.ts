/**
 * Curated database of subscription cancellation URLs for popular services
 * These are direct links to billing/subscription management pages, NOT account deletion
 */

export interface CancellationEntry {
  name: string;
  url: string;
  notes?: string;
  aliases?: string[]; // Alternative names for matching
}

export const CURATED_CANCELLATIONS: Record<string, CancellationEntry> = {
  // Streaming Services
  'netflix': {
    name: 'Netflix',
    url: 'https://www.netflix.com/cancelplan',
    notes: 'Log in to your account, then visit this page to cancel your membership.',
    aliases: ['netflix.com', 'netflix inc']
  },
  'spotify': {
    name: 'Spotify',
    url: 'https://www.spotify.com/account/subscription/',
    notes: 'Go to your account page and click "Change plan" or "Cancel Premium".',
    aliases: ['spotify.com', 'spotify premium', 'spotify ab']
  },
  'disney+': {
    name: 'Disney+',
    url: 'https://www.disneyplus.com/account/subscription',
    notes: 'Sign in, go to Account settings, and select "Cancel Subscription".',
    aliases: ['disney plus', 'disneyplus', 'disneyplus.com', 'disney']
  },
  'hulu': {
    name: 'Hulu',
    url: 'https://www.hulu.com/account',
    notes: 'Go to Account page, click your name, select "Cancel" under your subscription.',
    aliases: ['hulu.com', 'hulu llc']
  },
  'max': {
    name: 'Max (HBO Max)',
    url: 'https://max.com/account/subscription',
    notes: 'Previously HBO Max. Go to your account and manage subscription.',
    aliases: ['hbo max', 'hbo', 'hbomax', 'max.com']
  },
  'amazon prime video': {
    name: 'Amazon Prime Video',
    url: 'https://www.amazon.com/gp/video/settings/managemembership',
    notes: 'Manage your Prime Video membership or Prime membership.',
    aliases: ['prime video', 'amazon video', 'primevideo', 'amazon.com']
  },
  'apple tv+': {
    name: 'Apple TV+',
    url: 'https://tv.apple.com/settings',
    notes: 'Go to Settings, then Subscriptions to manage Apple TV+.',
    aliases: ['apple tv', 'apple tv plus', 'appletv', 'tv.apple.com']
  },
  'youtube premium': {
    name: 'YouTube Premium',
    url: 'https://www.youtube.com/paid_memberships',
    notes: 'Manage your YouTube Premium membership and recurring payments.',
    aliases: ['youtube', 'youtube music', 'yt premium', 'youtube.com']
  },
  'peacock': {
    name: 'Peacock',
    url: 'https://www.peacocktv.com/account/subscriptions',
    notes: 'Manage your Peacock subscription in account settings.',
    aliases: ['peacock tv', 'peacocktv', 'peacocktv.com']
  },
  'paramount+': {
    name: 'Paramount+',
    url: 'https://www.paramountplus.com/account/subscription/',
    notes: 'Go to Account and select your subscription to cancel.',
    aliases: ['paramount plus', 'paramount', 'paramountplus']
  },
  'crunchyroll': {
    name: 'Crunchyroll',
    url: 'https://www.crunchyroll.com/acct/?action=premium',
    notes: 'Go to Premium Settings to cancel your membership.',
    aliases: ['crunchyroll.com', 'crunchyroll premium']
  },

  // Software & Productivity
  'chatgpt': {
    name: 'ChatGPT Plus',
    url: 'https://chat.openai.com/settings/billing',
    notes: 'Go to Settings > Billing to cancel ChatGPT Plus subscription.',
    aliases: ['openai', 'chatgpt plus', 'chat gpt', 'gpt']
  },
  'adobe creative cloud': {
    name: 'Adobe Creative Cloud',
    url: 'https://account.adobe.com/plans',
    notes: 'Manage your Adobe plans and subscriptions.',
    aliases: ['adobe', 'creative cloud', 'adobe cc', 'photoshop', 'adobe.com']
  },
  'microsoft 365': {
    name: 'Microsoft 365',
    url: 'https://account.microsoft.com/services/',
    notes: 'Manage your Microsoft subscriptions including Office 365.',
    aliases: ['office 365', 'ms 365', 'microsoft office', 'microsoft.com']
  },
  'dropbox': {
    name: 'Dropbox',
    url: 'https://www.dropbox.com/account/plan',
    notes: 'Go to Settings > Plan to downgrade or cancel.',
    aliases: ['dropbox.com', 'dropbox plus', 'dropbox professional']
  },
  'zoom': {
    name: 'Zoom',
    url: 'https://zoom.us/billing',
    notes: 'Go to Billing to manage or cancel your Zoom subscription.',
    aliases: ['zoom.us', 'zoom meetings', 'zoom pro']
  },
  'slack': {
    name: 'Slack',
    url: 'https://slack.com/help/articles/218915077-Manage-your-billing',
    notes: 'Workspace owners can manage billing and subscriptions.',
    aliases: ['slack.com', 'slack workspace']
  },
  'notion': {
    name: 'Notion',
    url: 'https://www.notion.so/my-account/settings',
    notes: 'Go to Settings & Members > Billing to manage your plan.',
    aliases: ['notion.so', 'notion labs']
  },
  'canva': {
    name: 'Canva Pro',
    url: 'https://www.canva.com/settings/billing-settings',
    notes: 'Go to Account Settings > Billing & Teams to manage subscription.',
    aliases: ['canva', 'canva.com', 'canva pro']
  },

  // Music Services
  'apple music': {
    name: 'Apple Music',
    url: 'https://music.apple.com/settings',
    notes: 'Go to Settings > Subscriptions to cancel Apple Music.',
    aliases: ['applemusic', 'apple music app']
  },
  'tidal': {
    name: 'Tidal',
    url: 'https://listen.tidal.com/account',
    notes: 'Go to Account > Subscription to manage or cancel.',
    aliases: ['tidal.com', 'tidal music']
  },

  // Gaming
  'xbox game pass': {
    name: 'Xbox Game Pass',
    url: 'https://account.microsoft.com/services/',
    notes: 'Manage Xbox Game Pass through Microsoft account services.',
    aliases: ['xbox', 'game pass', 'xbox live', 'xbox.com']
  },
  'playstation plus': {
    name: 'PlayStation Plus',
    url: 'https://www.playstation.com/account/subscriptions/',
    notes: 'Manage PS Plus subscriptions in your PlayStation account.',
    aliases: ['ps plus', 'psn', 'playstation', 'playstation.com']
  },
  'nintendo switch online': {
    name: 'Nintendo Switch Online',
    url: 'https://ec.nintendo.com/my/subscriptions',
    notes: 'Manage your Nintendo Switch Online membership.',
    aliases: ['nintendo', 'switch online', 'nintendo.com']
  },

  // Fitness & Health
  'planet fitness': {
    name: 'Planet Fitness',
    url: 'https://www.planetfitness.com/gyms',
    notes: 'Contact your home club or visit in person to cancel. Some require certified letter.',
    aliases: ['planet fitness gym', 'planetfitness']
  },
  'peloton': {
    name: 'Peloton',
    url: 'https://my.onepeloton.com/subscriptions',
    notes: 'Manage your Peloton membership subscriptions.',
    aliases: ['peloton.com', 'peloton membership']
  },

  // News & Media
  'new york times': {
    name: 'The New York Times',
    url: 'https://myaccount.nytimes.com/seg/settings',
    notes: 'Manage your NYT subscription in account settings.',
    aliases: ['nyt', 'nytimes', 'ny times', 'nytimes.com']
  },
  'wall street journal': {
    name: 'The Wall Street Journal',
    url: 'https://customercenter.wsj.com/',
    notes: 'Contact customer service or manage subscription online.',
    aliases: ['wsj', 'wall street journal', 'wsj.com']
  },

  // Cloud Storage & Hosting
  'google one': {
    name: 'Google One',
    url: 'https://one.google.com/settings',
    notes: 'Manage your Google One storage plan and subscription.',
    aliases: ['google storage', 'google drive', 'google.com']
  },
  'icloud': {
    name: 'iCloud+',
    url: 'https://www.icloud.com/settings/',
    notes: 'Manage iCloud storage plan through Apple ID settings.',
    aliases: ['icloud storage', 'icloud plus', 'apple icloud']
  }
};

// Create normalized lookup map for faster searches
export function getNormalizedKey(serviceName: string): string {
  return serviceName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build reverse lookup from aliases
export function findCancellationEntry(serviceName: string): CancellationEntry | null {
  const normalized = getNormalizedKey(serviceName);

  // Direct match
  if (CURATED_CANCELLATIONS[normalized]) {
    return CURATED_CANCELLATIONS[normalized];
  }

  // Check aliases
  for (const entry of Object.values(CURATED_CANCELLATIONS)) {
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        if (getNormalizedKey(alias) === normalized) {
          return entry;
        }
      }
    }
  }

  return null;
}
