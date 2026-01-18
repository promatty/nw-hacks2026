/**
 * Mock streaming service subscriptions for demo purposes
 * These simulate what Plaid would detect from real bank data
 */

export interface MockSubscription {
  stream_id: string;
  merchant_name: string;
  description: string;
  amount: number;
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ANNUALLY';
  category: string[];
  last_date: string;
  next_projected_date: string;
  is_active: boolean;
  status: 'MATURE' | 'EARLY_DETECTION';
  account_id: string;
  logo_url?: string;
}

export interface MockTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name: string;
  category: string[];
  pending: boolean;
  payment_channel: string;
  personal_finance_category: {
    primary: string;
    detailed: string;
  };
}

// Get date string for N days ago
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// Get date string for N days from now
function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// Mock streaming subscriptions
export const MOCK_STREAMING_SUBSCRIPTIONS: MockSubscription[] = [
  {
    stream_id: 'mock_netflix_001',
    merchant_name: 'Netflix',
    description: 'NETFLIX.COM',
    amount: 15.99,
    frequency: 'MONTHLY',
    category: ['ENTERTAINMENT', 'SUBSCRIPTION'],
    last_date: daysAgo(5),
    next_projected_date: daysFromNow(25),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/netflix.com',
  },
  {
    stream_id: 'mock_spotify_001',
    merchant_name: 'Spotify',
    description: 'SPOTIFY USA',
    amount: 10.99,
    frequency: 'MONTHLY',
    category: ['ENTERTAINMENT', 'SUBSCRIPTION'],
    last_date: daysAgo(12),
    next_projected_date: daysFromNow(18),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/spotify.com',
  },
  {
    stream_id: 'mock_disney_001',
    merchant_name: 'Disney Plus',
    description: 'DISNEYPLUS',
    amount: 13.99,
    frequency: 'MONTHLY',
    category: ['ENTERTAINMENT', 'SUBSCRIPTION'],
    last_date: daysAgo(8),
    next_projected_date: daysFromNow(22),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/disneyplus.com',
  },
  {
    stream_id: 'mock_hbo_001',
    merchant_name: 'Max (HBO)',
    description: 'HBO MAX',
    amount: 15.99,
    frequency: 'MONTHLY',
    category: ['ENTERTAINMENT', 'SUBSCRIPTION'],
    last_date: daysAgo(3),
    next_projected_date: daysFromNow(27),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/max.com',
  },
  {
    stream_id: 'mock_youtube_001',
    merchant_name: 'YouTube Premium',
    description: 'GOOGLE *YouTube Premium',
    amount: 13.99,
    frequency: 'MONTHLY',
    category: ['ENTERTAINMENT', 'SUBSCRIPTION'],
    last_date: daysAgo(15),
    next_projected_date: daysFromNow(15),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/youtube.com',
  },
  {
    stream_id: 'mock_amazon_001',
    merchant_name: 'Amazon Prime',
    description: 'AMZN PRIME*',
    amount: 14.99,
    frequency: 'MONTHLY',
    category: ['ENTERTAINMENT', 'SUBSCRIPTION'],
    last_date: daysAgo(20),
    next_projected_date: daysFromNow(10),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/amazon.com',
  },
  {
    stream_id: 'mock_apple_001',
    merchant_name: 'Apple TV+',
    description: 'APPLE.COM/BILL',
    amount: 9.99,
    frequency: 'MONTHLY',
    category: ['ENTERTAINMENT', 'SUBSCRIPTION'],
    last_date: daysAgo(7),
    next_projected_date: daysFromNow(23),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/apple.com',
  },
  {
    stream_id: 'mock_hulu_001',
    merchant_name: 'Hulu',
    description: 'HULU *SUBSCRIPTION',
    amount: 17.99,
    frequency: 'MONTHLY',
    category: ['ENTERTAINMENT', 'SUBSCRIPTION'],
    last_date: daysAgo(10),
    next_projected_date: daysFromNow(20),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/hulu.com',
  },
  {
    stream_id: 'mock_chatgpt_001',
    merchant_name: 'ChatGPT Plus',
    description: 'OPENAI *CHATGPT PLUS',
    amount: 20.00,
    frequency: 'MONTHLY',
    category: ['SOFTWARE', 'SUBSCRIPTION'],
    last_date: daysAgo(2),
    next_projected_date: daysFromNow(28),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/openai.com',
  },
  {
    stream_id: 'mock_gym_001',
    merchant_name: 'Planet Fitness',
    description: 'PLANET FITNESS',
    amount: 24.99,
    frequency: 'MONTHLY',
    category: ['PERSONAL_CARE', 'SUBSCRIPTION'],
    last_date: daysAgo(1),
    next_projected_date: daysFromNow(29),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/planetfitness.com',
  },
  {
    stream_id: 'mock_icloud_001',
    merchant_name: 'iCloud Storage',
    description: 'APPLE.COM/BILL ICLOUD',
    amount: 2.99,
    frequency: 'MONTHLY',
    category: ['SOFTWARE', 'SUBSCRIPTION'],
    last_date: daysAgo(7),
    next_projected_date: daysFromNow(23),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/apple.com',
  },
  {
    stream_id: 'mock_xbox_001',
    merchant_name: 'Xbox Game Pass',
    description: 'MICROSOFT *XBOX',
    amount: 16.99,
    frequency: 'MONTHLY',
    category: ['ENTERTAINMENT', 'SUBSCRIPTION'],
    last_date: daysAgo(18),
    next_projected_date: daysFromNow(12),
    is_active: true,
    status: 'MATURE',
    account_id: 'mock_checking_001',
    logo_url: 'https://logo.clearbit.com/xbox.com',
  },
];

// Generate mock transactions from subscriptions (last 3 months)
export function generateMockTransactions(): MockTransaction[] {
  const transactions: MockTransaction[] = [];
  
  MOCK_STREAMING_SUBSCRIPTIONS.forEach((sub) => {
    // Generate 3 past transactions for each subscription
    for (let i = 0; i < 3; i++) {
      const daysBack = i * 30 + Math.floor(Math.random() * 5);
      transactions.push({
        transaction_id: `${sub.stream_id}_txn_${i}`,
        account_id: sub.account_id,
        amount: sub.amount,
        date: daysAgo(daysBack),
        name: sub.description,
        merchant_name: sub.merchant_name,
        category: sub.category,
        pending: false,
        payment_channel: 'online',
        personal_finance_category: {
          primary: sub.category[0],
          detailed: sub.category[1] || sub.category[0],
        },
      });
    }
  });
  
  // Sort by date descending
  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Calculate totals
export function calculateMockTotals() {
  const activeSubscriptions = MOCK_STREAMING_SUBSCRIPTIONS.filter((s) => s.is_active);
  
  const totalMonthly = activeSubscriptions.reduce((sum, sub) => {
    switch (sub.frequency) {
      case 'WEEKLY': return sum + sub.amount * 4.33;
      case 'BIWEEKLY': return sum + sub.amount * 2.17;
      case 'ANNUALLY': return sum + sub.amount / 12;
      default: return sum + sub.amount;
    }
  }, 0);
  
  return {
    count: activeSubscriptions.length,
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    totalAnnual: Math.round(totalMonthly * 12 * 100) / 100,
  };
}

// Merge mock data with real Plaid data
export function mergeWithMockData<T>(
  plaidData: T[],
  includeMocks: boolean = true
): T[] {
  if (!includeMocks) return plaidData;
  return [...plaidData, ...(MOCK_STREAMING_SUBSCRIPTIONS as unknown as T[])];
}
