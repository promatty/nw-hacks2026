// ============================================================================
// Database Types
// ============================================================================

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  url?: string;
  visit_count: number;
  total_time_seconds: number;
  last_visit: string;
  wasted_days_this_month: number;
  updated_at: string;
  created_at: string;
}

export interface PlaidItem {
  id: string;
  user_id: string;
  access_token: string;
  item_id: string;
  institution_id?: string;
  institution_name?: string;
  cursor?: string; // For transaction sync cursor
  created_at: string;
  updated_at: string;
}

export interface StoredTransaction {
  id: string;
  user_id: string;
  plaid_transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  category?: string[];
  pending: boolean;
  payment_channel: string;
  created_at: string;
  updated_at: string;
}

export interface StoredRecurringTransaction {
  id: string;
  user_id: string;
  stream_id: string;
  merchant_name: string;
  description: string;
  amount: number;
  frequency: string;
  category: string[];
  last_date: string;
  next_projected_date?: string;
  is_active: boolean;
  status: string;
  account_id: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API Request Types
// ============================================================================

export interface CreateSubscriptionRequest {
  user_id: string;
  name: string;
  url?: string;
}

export interface UpdateSubscriptionRequest {
  name?: string;
  url?: string;
  visit_count?: number;
  total_time_seconds?: number;
  wasted_days_this_month?: number;
}

export interface RecordVisitRequest {
  time_spent_seconds?: number;
}
