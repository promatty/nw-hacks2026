import {
  CountryCode,
  Products,
  TransactionsSyncRequest,
} from 'plaid';
import { plaidClient, plaidConfig } from '../config/plaid.js';
import {
  PlaidLinkToken,
  PlaidAccessToken,
  TransactionSyncResult,
  RecurringTransactionsResult,
  SubscriptionInfo,
  SubscriptionsResponse,
  mapPlaidFrequency,
  mapStreamStatus,
} from '../types/plaid.js';

// ============================================================================
// Link Token Service
// ============================================================================

/**
 * Create a Link token for initializing Plaid Link
 * This is the first step in the Plaid Link flow
 */
export async function createLinkToken(
  userId: string,
  products: Products[] = [Products.Transactions]
): Promise<PlaidLinkToken> {
  const response = await plaidClient.linkTokenCreate({
    user: {
      client_user_id: userId,
    },
    client_name: 'Subscription Tracker',
    products: products,
    country_codes: plaidConfig.countryCodes as CountryCode[],
    language: 'en',
  });

  return {
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
    requestId: response.data.request_id,
  };
}

/**
 * Exchange a public token for an access token
 * This is called after the user completes Plaid Link
 */
export async function exchangePublicToken(
  publicToken: string
): Promise<PlaidAccessToken> {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
    requestId: response.data.request_id,
  };
}

// ============================================================================
// Transactions Service
// ============================================================================

/**
 * Sync transactions using the Transactions Sync API
 * This is the recommended way to get transactions as it handles pagination
 * and provides added/modified/removed transactions
 */
export async function syncTransactions(
  accessToken: string,
  cursor?: string
): Promise<TransactionSyncResult> {
  const request: TransactionsSyncRequest = {
    access_token: accessToken,
    cursor: cursor,
    count: 500, // Max allowed per request
    options: {
      include_personal_finance_category: true,
      include_logo_and_counterparty_beta: true,
    },
  };

  const response = await plaidClient.transactionsSync(request);

  return {
    added: response.data.added,
    modified: response.data.modified,
    removed: response.data.removed,
    hasMore: response.data.has_more,
    nextCursor: response.data.next_cursor,
    accounts: response.data.accounts,
    requestId: response.data.request_id,
  };
}

/**
 * Fetch all transactions using sync API with pagination
 * Continues fetching until no more transactions are available
 */
export async function fetchAllTransactions(
  accessToken: string,
  initialCursor?: string
): Promise<TransactionSyncResult> {
  let cursor = initialCursor;
  let allAdded: TransactionSyncResult['added'] = [];
  let allModified: TransactionSyncResult['modified'] = [];
  let allRemoved: TransactionSyncResult['removed'] = [];
  let accounts: TransactionSyncResult['accounts'] = [];
  let requestId = '';

  // Keep fetching until hasMore is false
  let hasMore = true;
  while (hasMore) {
    const result = await syncTransactions(accessToken, cursor);
    
    allAdded = [...allAdded, ...result.added];
    allModified = [...allModified, ...result.modified];
    allRemoved = [...allRemoved, ...result.removed];
    accounts = result.accounts; // Accounts are the same across all pages
    cursor = result.nextCursor;
    hasMore = result.hasMore;
    requestId = result.requestId;
  }

  return {
    added: allAdded,
    modified: allModified,
    removed: allRemoved,
    hasMore: false,
    nextCursor: cursor || '',
    accounts,
    requestId,
  };
}

// ============================================================================
// Recurring Transactions Service
// ============================================================================

/**
 * Get recurring transactions (subscriptions) for all accounts
 * This identifies recurring payments like subscriptions, bills, etc.
 */
export async function getRecurringTransactions(
  accessToken: string,
  accountIds?: string[]
): Promise<RecurringTransactionsResult> {
  const request = {
    access_token: accessToken,
    ...(accountIds && { account_ids: accountIds }),
  };
  const response = await plaidClient.transactionsRecurringGet(request);

  return {
    inflowStreams: response.data.inflow_streams,
    outflowStreams: response.data.outflow_streams,
    updatedDateTime: response.data.updated_datetime,
    requestId: response.data.request_id,
  };
}

/**
 * Transform recurring outflow streams into subscription info
 * Focuses on outgoing recurring payments (subscriptions, bills)
 */
export function transformToSubscriptions(
  result: RecurringTransactionsResult
): SubscriptionsResponse {
  const subscriptions: SubscriptionInfo[] = result.outflowStreams.map((stream) => ({
    streamId: stream.stream_id,
    merchantName: stream.merchant_name || stream.description,
    description: stream.description,
    amount: Math.abs(stream.average_amount?.amount || stream.last_amount?.amount || 0),
    frequency: mapPlaidFrequency(stream.frequency),
    category: stream.personal_finance_category 
      ? [stream.personal_finance_category.primary, stream.personal_finance_category.detailed].filter(Boolean)
      : stream.category || [],
    lastDate: stream.last_date,
    nextProjectedDate: (stream as unknown as { predicted_next_date?: string }).predicted_next_date || undefined,
    isActive: stream.is_active,
    status: mapStreamStatus(stream.status),
    accountId: stream.account_id,
  }));

  // Calculate totals
  const activeSubscriptions = subscriptions.filter((s) => s.isActive);
  
  const totalMonthlyAmount = activeSubscriptions.reduce((total, sub) => {
    switch (sub.frequency) {
      case 'weekly':
        return total + sub.amount * 4.33;
      case 'biweekly':
        return total + sub.amount * 2.17;
      case 'semi_monthly':
        return total + sub.amount * 2;
      case 'monthly':
        return total + sub.amount;
      case 'annually':
        return total + sub.amount / 12;
      default:
        return total + sub.amount; // Assume monthly for unknown
    }
  }, 0);

  return {
    subscriptions,
    totalMonthlyAmount: Math.round(totalMonthlyAmount * 100) / 100,
    totalAnnualAmount: Math.round(totalMonthlyAmount * 12 * 100) / 100,
    updatedDateTime: result.updatedDateTime,
  };
}

// ============================================================================
// Item Management
// ============================================================================

/**
 * Get information about a Plaid Item
 */
export async function getItem(accessToken: string) {
  const response = await plaidClient.itemGet({
    access_token: accessToken,
  });

  return {
    item: response.data.item,
    status: response.data.status,
    requestId: response.data.request_id,
  };
}

/**
 * Get accounts associated with an Item
 */
export async function getAccounts(accessToken: string) {
  const response = await plaidClient.accountsGet({
    access_token: accessToken,
  });

  return {
    accounts: response.data.accounts,
    item: response.data.item,
    requestId: response.data.request_id,
  };
}

/**
 * Remove a Plaid Item (disconnect bank account)
 */
export async function removeItem(accessToken: string) {
  const response = await plaidClient.itemRemove({
    access_token: accessToken,
  });

  return {
    requestId: response.data.request_id,
  };
}
