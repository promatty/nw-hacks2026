import type { StoredTransaction } from '../types/database.js';

// Known subscription services to look for
const KNOWN_SUBSCRIPTIONS: Record<string, { name: string; category: string; logo?: string; url?: string }> = {
  'netflix': { name: 'Netflix', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/netflix.com', url: 'https://netflix.com' },
  'spotify': { name: 'Spotify', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/spotify.com', url: 'https://spotify.com' },
  'apple': { name: 'Apple', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/apple.com', url: 'https://apple.com' },
  'amazon prime': { name: 'Amazon Prime', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/amazon.com', url: 'https://amazon.com/prime' },
  'amazon': { name: 'Amazon', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/amazon.com', url: 'https://amazon.com' },
  'hulu': { name: 'Hulu', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/hulu.com', url: 'https://hulu.com' },
  'disney': { name: 'Disney+', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/disneyplus.com', url: 'https://disneyplus.com' },
  'hbo': { name: 'HBO Max', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/hbomax.com', url: 'https://max.com' },
  'youtube': { name: 'YouTube Premium', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/youtube.com', url: 'https://youtube.com/premium' },
  'google': { name: 'Google', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/google.com', url: 'https://google.com' },
  'microsoft': { name: 'Microsoft', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/microsoft.com', url: 'https://microsoft.com' },
  'adobe': { name: 'Adobe Creative Cloud', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/adobe.com', url: 'https://adobe.com' },
  'dropbox': { name: 'Dropbox', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/dropbox.com', url: 'https://dropbox.com' },
  'github': { name: 'GitHub', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/github.com', url: 'https://github.com' },
  'slack': { name: 'Slack', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/slack.com', url: 'https://slack.com' },
  'zoom': { name: 'Zoom', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/zoom.us', url: 'https://zoom.us' },
  'openai': { name: 'OpenAI', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/openai.com', url: 'https://openai.com' },
  'chatgpt': { name: 'ChatGPT Plus', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/openai.com', url: 'https://chat.openai.com' },
  'disney+': { name: 'Disney+', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/disneyplus.com', url: 'https://disneyplus.com' },
  'claude': { name: 'Claude', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/anthropic.com', url: 'https://claude.ai' },
  'anthropic': { name: 'Anthropic', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/anthropic.com', url: 'https://anthropic.com' },
  'gym': { name: 'Gym', category: 'PERSONAL_CARE', logo: undefined, url: undefined },
  'fitness': { name: 'Fitness', category: 'PERSONAL_CARE', logo: undefined, url: undefined },
  'planet fitness': { name: 'Planet Fitness', category: 'PERSONAL_CARE', logo: 'https://logo.clearbit.com/planetfitness.com', url: 'https://planetfitness.com' },
  'peloton': { name: 'Peloton', category: 'PERSONAL_CARE', logo: 'https://logo.clearbit.com/peloton.com', url: 'https://peloton.com' },
  'starbucks': { name: 'Starbucks', category: 'FOOD', logo: 'https://logo.clearbit.com/starbucks.com', url: 'https://starbucks.com' },
  'uber': { name: 'Uber', category: 'TRANSPORTATION', logo: 'https://logo.clearbit.com/uber.com', url: 'https://uber.com' },
  'lyft': { name: 'Lyft', category: 'TRANSPORTATION', logo: 'https://logo.clearbit.com/lyft.com', url: 'https://lyft.com' },
  'doordash': { name: 'DoorDash', category: 'FOOD', logo: 'https://logo.clearbit.com/doordash.com', url: 'https://doordash.com' },
  'grubhub': { name: 'Grubhub', category: 'FOOD', logo: 'https://logo.clearbit.com/grubhub.com', url: 'https://grubhub.com' },
  'uber eats': { name: 'Uber Eats', category: 'FOOD', logo: 'https://logo.clearbit.com/ubereats.com', url: 'https://ubereats.com' },
  'instacart': { name: 'Instacart', category: 'FOOD', logo: 'https://logo.clearbit.com/instacart.com', url: 'https://instacart.com' },
  'paramount': { name: 'Paramount+', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/paramountplus.com', url: 'https://paramountplus.com' },
  'peacock': { name: 'Peacock', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/peacocktv.com', url: 'https://peacocktv.com' },
  'crunchyroll': { name: 'Crunchyroll', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/crunchyroll.com', url: 'https://crunchyroll.com' },
  'audible': { name: 'Audible', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/audible.com', url: 'https://audible.com' },
  'kindle': { name: 'Kindle Unlimited', category: 'ENTERTAINMENT', logo: 'https://logo.clearbit.com/amazon.com', url: 'https://amazon.com/kindle-unlimited' },
  'notion': { name: 'Notion', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/notion.so', url: 'https://notion.so' },
  'figma': { name: 'Figma', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/figma.com', url: 'https://figma.com' },
  'canva': { name: 'Canva', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/canva.com', url: 'https://canva.com' },
  'linkedin': { name: 'LinkedIn Premium', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/linkedin.com', url: 'https://linkedin.com/premium' },
  'nordvpn': { name: 'NordVPN', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/nordvpn.com', url: 'https://nordvpn.com' },
  'expressvpn': { name: 'ExpressVPN', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/expressvpn.com', url: 'https://expressvpn.com' },
  '1password': { name: '1Password', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/1password.com', url: 'https://1password.com' },
  'lastpass': { name: 'LastPass', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/lastpass.com', url: 'https://lastpass.com' },
  'bitwarden': { name: 'Bitwarden', category: 'SOFTWARE', logo: 'https://logo.clearbit.com/bitwarden.com', url: 'https://bitwarden.com' },
  // Sandbox data merchants
  'touchstone climbing': { name: 'Touchstone Climbing', category: 'PERSONAL_CARE', logo: 'https://logo.clearbit.com/touchstoneclimbing.com', url: 'https://touchstoneclimbing.com' },
  'sparkfun': { name: 'SparkFun', category: 'SHOPPING', logo: 'https://logo.clearbit.com/sparkfun.com', url: 'https://sparkfun.com' },
  'mcdonalds': { name: "McDonald's", category: 'FOOD', logo: 'https://logo.clearbit.com/mcdonalds.com', url: 'https://mcdonalds.com' },
  "mcdonald's": { name: "McDonald's", category: 'FOOD', logo: 'https://logo.clearbit.com/mcdonalds.com', url: 'https://mcdonalds.com' },
};

export interface DetectedSubscription {
  id: string;
  name: string;  // Display name for the subscription
  merchant_name: string;
  description: string;
  amount: number;
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ANNUALLY' | 'UNKNOWN';
  category: string;
  last_date: string;
  next_projected_date?: string;
  is_active: boolean;
  status: 'ACTIVE' | 'MATURE';
  account_id: string;
  transaction_count: number;
  logo_url?: string;
  url?: string;  // URL for the subscription service
}

interface MerchantGroup {
  merchant: string;
  transactions: StoredTransaction[];
  avgAmount: number;
  frequency: DetectedSubscription['frequency'];
  lastDate: string;
  accountId: string;
}

function getMerchantKey(transaction: StoredTransaction): string {
  // Use merchant_name if available, otherwise use name
  const name = transaction.merchant_name || transaction.name;
  return name.toLowerCase().trim();
}

function detectFrequency(dates: Date[]): DetectedSubscription['frequency'] {
  if (dates.length < 2) return 'UNKNOWN';

  // Sort dates ascending
  dates.sort((a, b) => a.getTime() - b.getTime());

  // Calculate average gap in days
  let totalGap = 0;
  for (let i = 1; i < dates.length; i++) {
    const gap = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
    totalGap += gap;
  }
  const avgGap = totalGap / (dates.length - 1);

  // Classify frequency based on average gap
  if (avgGap <= 10) return 'WEEKLY';
  if (avgGap <= 20) return 'BIWEEKLY';
  if (avgGap <= 45) return 'MONTHLY';
  if (avgGap <= 400) return 'ANNUALLY';
  return 'UNKNOWN';
}

function projectNextDate(lastDate: string, frequency: DetectedSubscription['frequency']): string | undefined {
  const date = new Date(lastDate);

  switch (frequency) {
    case 'WEEKLY':
      date.setDate(date.getDate() + 7);
      break;
    case 'BIWEEKLY':
      date.setDate(date.getDate() + 14);
      break;
    case 'MONTHLY':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'ANNUALLY':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return undefined;
  }

  return date.toISOString().split('T')[0];
}

function findKnownSubscription(merchantKey: string): { name: string; category: string; logo?: string; url?: string } | undefined {
  // Direct match
  if (KNOWN_SUBSCRIPTIONS[merchantKey]) {
    return KNOWN_SUBSCRIPTIONS[merchantKey];
  }

  // Partial match
  for (const [key, value] of Object.entries(KNOWN_SUBSCRIPTIONS)) {
    if (merchantKey.includes(key) || key.includes(merchantKey)) {
      return value;
    }
  }

  return undefined;
}

export function detectRecurringTransactions(
  transactions: StoredTransaction[],
  minOccurrences: number = 2
): DetectedSubscription[] {
  // Only consider positive amounts (charges, not refunds/credits)
  const charges = transactions.filter(t => t.amount > 0 && !t.pending);

  // Group by merchant
  const merchantGroups = new Map<string, StoredTransaction[]>();

  for (const txn of charges) {
    const key = getMerchantKey(txn);
    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, []);
    }
    merchantGroups.get(key)!.push(txn);
  }

  // Analyze each merchant group for recurring patterns
  const detectedSubscriptions: DetectedSubscription[] = [];

  for (const [merchantKey, txns] of merchantGroups) {
    // Need at least minOccurrences to detect a pattern
    if (txns.length < minOccurrences) continue;

    // Sort by date descending
    txns.sort((a, b) => b.date.localeCompare(a.date));

    // Calculate average amount
    const avgAmount = txns.reduce((sum, t) => sum + t.amount, 0) / txns.length;

    // Check if amounts are consistent (within 20% variance)
    const amountVariance = txns.every(t => Math.abs(t.amount - avgAmount) / avgAmount < 0.2);

    // Detect frequency
    const dates = txns.map(t => new Date(t.date));
    const frequency = detectFrequency(dates);

    // Skip if no clear frequency pattern and amounts vary widely
    if (frequency === 'UNKNOWN' && !amountVariance) continue;

    // Find known subscription info
    const knownInfo = findKnownSubscription(merchantKey);

    const lastTxn = txns[0];
    const merchantName = lastTxn.merchant_name || lastTxn.name;

    // Find the most recent created_at date (when subscription was added to tracking)
    const mostRecentCreatedAt = txns.reduce((latest, txn) => {
      const txnCreatedAt = txn.created_at || txn.date;
      return txnCreatedAt > latest ? txnCreatedAt : latest;
    }, txns[0].created_at || txns[0].date);

    detectedSubscriptions.push({
      id: `recurring-${merchantKey.replace(/\s+/g, '-')}`,
      name: knownInfo?.name || merchantName,
      merchant_name: merchantName,
      description: `${merchantName} - ${frequency.toLowerCase()} charge`,
      amount: Math.round(avgAmount * 100) / 100,
      frequency,
      category: knownInfo?.category || 'OTHER',
      last_date: mostRecentCreatedAt,
      next_projected_date: projectNextDate(lastTxn.date, frequency),
      is_active: true,
      status: txns.length >= 3 ? 'MATURE' : 'ACTIVE',
      account_id: lastTxn.account_id,
      transaction_count: txns.length,
      logo_url: knownInfo?.logo,
      url: knownInfo?.url,
    });
  }

  // Sort by amount descending
  detectedSubscriptions.sort((a, b) => b.amount - a.amount);

  return detectedSubscriptions;
}

export function calculateTotals(subscriptions: DetectedSubscription[]): {
  totalMonthlyAmount: number;
  totalAnnualAmount: number;
} {
  let totalMonthly = 0;

  for (const sub of subscriptions) {
    if (!sub.is_active) continue;

    switch (sub.frequency) {
      case 'WEEKLY':
        totalMonthly += sub.amount * 4.33;
        break;
      case 'BIWEEKLY':
        totalMonthly += sub.amount * 2.17;
        break;
      case 'MONTHLY':
        totalMonthly += sub.amount;
        break;
      case 'ANNUALLY':
        totalMonthly += sub.amount / 12;
        break;
      default:
        totalMonthly += sub.amount; // Assume monthly if unknown
    }
  }

  return {
    totalMonthlyAmount: Math.round(totalMonthly * 100) / 100,
    totalAnnualAmount: Math.round(totalMonthly * 12 * 100) / 100,
  };
}
