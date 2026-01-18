# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript Express.js backend for a Subscription Tracker API with Plaid integration. Provides:
- CRUD operations for tracking user subscriptions with visit counting and time tracking
- Plaid Link integration for connecting bank accounts
- Transaction syncing and storage via Plaid Transactions API
- Recurring transaction detection for subscription discovery via Plaid Recurring Transactions API
- Uses Supabase as the database

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server with hot reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm start            # Start production server (requires build first)
npm run typecheck    # Type check without emitting
```

## Environment Variables

Requires `.env` file with:

**Server:**
- `PORT` (optional) - Server port, defaults to 3000

**Supabase:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key

**Plaid:**
- `PLAID_CLIENT_ID` - Plaid client ID from dashboard
- `PLAID_SECRET` - Plaid secret key
- `PLAID_ENV` - Environment: `sandbox`, `development`, or `production`

## Project Structure

```
src/
├── server.ts              # Main Express app with all routes
├── config/
│   └── plaid.ts           # Plaid client configuration
├── services/
│   └── plaidService.ts    # Plaid API operations
└── types/
    ├── index.ts           # Type exports
    ├── plaid.ts           # Plaid-related types
    └── database.ts        # Database entity types
```

## API Endpoints

### Subscription Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info and endpoint list |
| GET | `/health` | Health check |
| GET | `/api/subscriptions/:userId` | Get user's subscriptions |
| POST | `/api/subscriptions` | Create subscription (requires `user_id`, `name`) |
| PUT | `/api/subscriptions/:id` | Update subscription |
| DELETE | `/api/subscriptions/:id` | Delete subscription |
| POST | `/api/subscriptions/:id/visit` | Record visit with optional `time_spent_seconds` |

### Plaid Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/plaid/link-token` | Create Link token for Plaid Link (`userId` required) |
| POST | `/api/plaid/exchange-token` | Exchange public token (`publicToken`, `userId` required) |
| GET | `/api/plaid/items/:userId` | Get connected bank items |
| DELETE | `/api/plaid/items/:itemId` | Disconnect a bank item |
| POST | `/api/plaid/transactions/sync` | Sync transactions from Plaid (`userId` required) |
| GET | `/api/plaid/transactions/:userId` | Get stored transactions |
| GET | `/api/plaid/recurring/:userId` | Get recurring transactions (subscriptions) |
| GET | `/api/plaid/accounts/:userId` | Get connected accounts |

## Database Schema

### Existing Table: `subscriptions`
- `id`, `user_id`, `name`, `url`, `visit_count`, `total_time_seconds`, `last_visit`, `updated_at`

### New Table: `plaid_items`
```sql
CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  item_id TEXT UNIQUE NOT NULL,
  institution_id TEXT,
  institution_name TEXT,
  cursor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### New Table: `transactions`
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  plaid_transaction_id TEXT UNIQUE NOT NULL,
  account_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  merchant_name TEXT,
  category TEXT[],
  pending BOOLEAN DEFAULT false,
  payment_channel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Plaid Integration Flow

1. **Create Link Token**: Call `/api/plaid/link-token` with `userId` to get a token for Plaid Link
2. **User Connects Bank**: Frontend uses Plaid Link SDK with the token
3. **Exchange Token**: After success, call `/api/plaid/exchange-token` with `publicToken` and `userId`
4. **Sync Transactions**: Call `/api/plaid/transactions/sync` to fetch and store transactions
5. **Get Recurring**: Call `/api/plaid/recurring/:userId` to get detected subscriptions

## Key Types

- `SubscriptionInfo`: Normalized recurring transaction data with frequency, amounts, status
- `TransactionSyncResult`: Result from transaction sync with added/modified/removed arrays
- `RecurringTransactionsResult`: Raw recurring streams from Plaid
