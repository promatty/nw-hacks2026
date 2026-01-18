import type {
  Transaction as PlaidTransaction,
  TransactionStream,
  AccountBase,
  RemovedTransaction,
} from 'plaid';

// ============================================================================
// Plaid Token Types
// ============================================================================

export interface PlaidLinkToken {
  linkToken: string;
  expiration: string;
  requestId: string;
}

export interface PlaidAccessToken {
  accessToken: string;
  itemId: string;
  requestId: string;
}

export interface PlaidTokenRecord {
  id: string;
  user_id: string;
  access_token: string;
  item_id: string;
  institution_id?: string;
  institution_name?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface TransactionSyncResult {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: RemovedTransaction[];
  hasMore: boolean;
  nextCursor: string;
  accounts: AccountBase[];
  requestId: string;
}

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  accountIds?: string[];
  count?: number;
  offset?: number;
}

export interface EnrichedTransaction extends PlaidTransaction {
  // Additional computed fields
  isSubscription?: boolean;
  subscriptionCategory?: string;
  normalizedMerchantName?: string;
}

// ============================================================================
// Recurring Transaction Types
// ============================================================================

export interface RecurringTransactionsResult {
  inflowStreams: TransactionStream[];
  outflowStreams: TransactionStream[];
  updatedDateTime: string;
  requestId: string;
}

export interface SubscriptionInfo {
  streamId: string;
  merchantName: string;
  description: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly' | 'annually' | 'unknown';
  category: string[];
  lastDate: string;
  nextProjectedDate?: string;
  isActive: boolean;
  status: 'mature' | 'early_detection' | 'tombstoned';
  accountId: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateLinkTokenRequest {
  userId: string;
  products?: string[];
}

export interface ExchangeTokenRequest {
  publicToken: string;
  userId: string;
  institutionId?: string;
  institutionName?: string;
}

export interface GetTransactionsRequest {
  userId: string;
  startDate?: string;
  endDate?: string;
  accountIds?: string[];
  count?: number;
  offset?: number;
}

export interface SyncTransactionsRequest {
  userId: string;
  cursor?: string;
}

export interface GetRecurringTransactionsRequest {
  userId: string;
  accountIds?: string[];
}

export interface TransactionsResponse {
  transactions: PlaidTransaction[];
  accounts: AccountBase[];
  totalTransactions: number;
  requestId: string;
}

export interface SubscriptionsResponse {
  subscriptions: SubscriptionInfo[];
  totalMonthlyAmount: number;
  totalAnnualAmount: number;
  updatedDateTime: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface PlaidErrorResponse {
  error_type: string;
  error_code: string;
  error_message: string;
  display_message: string | null;
  request_id: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type TransactionFrequency = 
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'SEMI_MONTHLY'
  | 'MONTHLY'
  | 'ANNUALLY'
  | 'UNKNOWN';

export function mapPlaidFrequency(frequency: string | undefined): SubscriptionInfo['frequency'] {
  switch (frequency?.toUpperCase()) {
    case 'WEEKLY':
      return 'weekly';
    case 'BIWEEKLY':
      return 'biweekly';
    case 'SEMI_MONTHLY':
      return 'semi_monthly';
    case 'MONTHLY':
      return 'monthly';
    case 'ANNUALLY':
      return 'annually';
    default:
      return 'unknown';
  }
}

export function mapStreamStatus(status: string): SubscriptionInfo['status'] {
  switch (status?.toUpperCase()) {
    case 'MATURE':
      return 'mature';
    case 'EARLY_DETECTION':
      return 'early_detection';
    case 'TOMBSTONED':
      return 'tombstoned';
    default:
      return 'mature';
  }
}
