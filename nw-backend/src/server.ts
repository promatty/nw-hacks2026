import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { Products } from 'plaid';
import * as plaidService from './services/plaidService.js';
import type {
  CreateLinkTokenRequest,
  ExchangeTokenRequest,
  SyncTransactionsRequest,
} from './types/plaid.js';
import { 
  MOCK_STREAMING_SUBSCRIPTIONS, 
  generateMockTransactions,
  calculateMockTotals 
} from './mocks/streamingSubscriptions.js';
import type {
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  RecordVisitRequest,
  PlaidItem,
} from './types/database.js';

// ============================================================================
// App Setup
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// Middleware
app.use(cors());
app.use(express.json());
app.set('json spaces', 2);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${res.statusCode} ${req.method} ${req.originalUrl} ${duration}ms`);
  });
  next();
});

// ============================================================================
// Root & Health Routes
// ============================================================================

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Subscription Tracker API',
    version: '2.0.0',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      // Subscription endpoints
      { method: 'GET', path: '/api/subscriptions/:userId', description: 'Get all subscriptions for a user' },
      { method: 'POST', path: '/api/subscriptions', description: 'Add a new subscription' },
      { method: 'PUT', path: '/api/subscriptions/:id', description: 'Update a subscription' },
      { method: 'DELETE', path: '/api/subscriptions/:id', description: 'Delete a subscription' },
      { method: 'POST', path: '/api/subscriptions/:id/visit', description: 'Record a visit' },
      // Plaid endpoints
      { method: 'POST', path: '/api/plaid/link-token', description: 'Create Plaid Link token' },
      { method: 'POST', path: '/api/plaid/exchange-token', description: 'Exchange public token for access token' },
      { method: 'GET', path: '/api/plaid/items/:userId', description: 'Get connected Plaid items for a user' },
      { method: 'DELETE', path: '/api/plaid/items/:itemId', description: 'Disconnect a Plaid item' },
      { method: 'POST', path: '/api/plaid/transactions/sync', description: 'Sync transactions for a user' },
      { method: 'GET', path: '/api/plaid/transactions/:userId', description: 'Get synced transactions for a user' },
      { method: 'GET', path: '/api/plaid/recurring/:userId', description: 'Get recurring transactions (subscriptions)' },
      { method: 'GET', path: '/api/plaid/accounts/:userId', description: 'Get connected accounts for a user' },
      // Demo endpoints (mock data)
      { method: 'GET', path: '/api/demo/subscriptions', description: 'Get mock streaming subscriptions for demo' },
      { method: 'GET', path: '/api/demo/transactions', description: 'Get mock transactions for demo' },
    ],
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// Subscription Routes (existing functionality)
// ============================================================================

// GET /api/subscriptions/:userId - Get all subscriptions for a user
app.get('/api/subscriptions/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('last_visit', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/subscriptions - Add a new subscription
app.post('/api/subscriptions', async (req: Request<object, object, CreateSubscriptionRequest>, res: Response) => {
  try {
    const { user_id, name, url } = req.body;

    if (!user_id || !name) {
      res.status(400).json({ error: 'user_id and name are required' });
      return;
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id,
        name,
        ...(url && { url }),
        visit_count: 1,
        last_visit: new Date().toISOString(),
        total_time_seconds: 0,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/subscriptions/:id - Update subscription
app.put('/api/subscriptions/:id', async (req: Request<{ id: string }, object, UpdateSubscriptionRequest>, res: Response) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/subscriptions/:id - Delete a subscription
app.delete('/api/subscriptions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/subscriptions/:id/visit - Record a visit
app.post('/api/subscriptions/:id/visit', async (req: Request<{ id: string }, object, RecordVisitRequest>, res: Response) => {
  try {
    const { id } = req.params;
    const { time_spent_seconds = 0 } = req.body;

    // First, get the current subscription
    const { data: current, error: fetchError } = await supabase
      .from('subscriptions')
      .select('visit_count, total_time_seconds')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (!current) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    // Update with incremented values
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        visit_count: current.visit_count + 1,
        total_time_seconds: current.total_time_seconds + time_spent_seconds,
        last_visit: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error recording visit:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// Plaid Routes
// ============================================================================

// POST /api/plaid/link-token - Create a Link token for Plaid Link initialization
app.post('/api/plaid/link-token', async (req: Request<object, object, CreateLinkTokenRequest>, res: Response) => {
  try {
    const { userId, products } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const plaidProducts = products?.map((p) => p as Products) || [Products.Transactions];
    const linkToken = await plaidService.createLinkToken(userId, plaidProducts);

    res.json(linkToken);
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/plaid/exchange-token - Exchange public token for access token
app.post('/api/plaid/exchange-token', async (req: Request<object, object, ExchangeTokenRequest>, res: Response) => {
  try {
    const { publicToken, userId, institutionId, institutionName } = req.body;

    if (!publicToken || !userId) {
      res.status(400).json({ error: 'publicToken and userId are required' });
      return;
    }

    // Exchange the public token
    const tokenData = await plaidService.exchangePublicToken(publicToken);

    // Store the access token in Supabase
    const { error } = await supabase
      .from('plaid_items')
      .insert({
        user_id: userId,
        access_token: tokenData.accessToken,
        item_id: tokenData.itemId,
        institution_id: institutionId,
        institution_name: institutionName,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      itemId: tokenData.itemId,
      institutionName,
      message: 'Bank account connected successfully',
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/plaid/items/:userId - Get all connected Plaid items for a user
app.get('/api/plaid/items/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from('plaid_items')
      .select('id, user_id, item_id, institution_id, institution_name, created_at')
      .eq('user_id', userId);

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching Plaid items:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/plaid/items/:itemId - Disconnect a Plaid item
app.delete('/api/plaid/items/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;

    // Get the access token for this item
    const { data: item, error: fetchError } = await supabase
      .from('plaid_items')
      .select('access_token')
      .eq('item_id', itemId)
      .single();

    if (fetchError) throw fetchError;

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Remove from Plaid
    await plaidService.removeItem(item.access_token);

    // Remove from database
    const { error: deleteError } = await supabase
      .from('plaid_items')
      .delete()
      .eq('item_id', itemId);

    if (deleteError) throw deleteError;

    res.status(204).send();
  } catch (error) {
    console.error('Error disconnecting item:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/plaid/transactions/sync - Sync transactions for a user
app.post('/api/plaid/transactions/sync', async (req: Request<object, object, SyncTransactionsRequest>, res: Response) => {
  try {
    const { userId, cursor } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    // Get all Plaid items for this user
    const { data: items, error: itemsError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', userId);

    if (itemsError) throw itemsError;

    if (!items || items.length === 0) {
      res.status(404).json({ error: 'No connected bank accounts found' });
      return;
    }

    // Sync transactions for each item
    const allResults = await Promise.all(
      items.map(async (item: PlaidItem) => {
        const syncCursor = cursor || item.cursor || undefined;
        const result = await plaidService.fetchAllTransactions(item.access_token, syncCursor);

        // Update the cursor in the database
        await supabase
          .from('plaid_items')
          .update({ cursor: result.nextCursor, updated_at: new Date().toISOString() })
          .eq('id', item.id);

        // Store transactions in database
        if (result.added.length > 0) {
          const transactionsToInsert = result.added.map((t) => ({
            user_id: userId,
            plaid_transaction_id: t.transaction_id,
            account_id: t.account_id,
            amount: t.amount,
            date: t.date,
            name: t.name,
            merchant_name: t.merchant_name,
            category: t.category,
            pending: t.pending,
            payment_channel: t.payment_channel,
          }));

          await supabase
            .from('transactions')
            .upsert(transactionsToInsert, { onConflict: 'plaid_transaction_id' });
        }

        // Handle removed transactions
        if (result.removed.length > 0) {
          const removedIds = result.removed.map((r) => r.transaction_id);
          await supabase
            .from('transactions')
            .delete()
            .in('plaid_transaction_id', removedIds);
        }

        return {
          itemId: item.item_id,
          institutionName: item.institution_name,
          added: result.added.length,
          modified: result.modified.length,
          removed: result.removed.length,
          accounts: result.accounts,
        };
      })
    );

    res.json({
      message: 'Transactions synced successfully',
      results: allResults,
      totalAdded: allResults.reduce((sum, r) => sum + r.added, 0),
      totalModified: allResults.reduce((sum, r) => sum + r.modified, 0),
      totalRemoved: allResults.reduce((sum, r) => sum + r.removed, 0),
    });
  } catch (error) {
    console.error('Error syncing transactions:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/plaid/transactions/:userId - Get stored transactions for a user
app.get('/api/plaid/transactions/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, limit = '100', offset = '0' } = req.query;

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(parseInt(limit as string))
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (startDate) {
      query = query.gte('date', startDate as string);
    }
    if (endDate) {
      query = query.lte('date', endDate as string);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Get total count
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    res.json({
      transactions: data,
      total: count,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/plaid/recurring/:userId - Get recurring transactions (subscriptions) for a user
app.get('/api/plaid/recurring/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { accountIds } = req.query;

    // Get all Plaid items for this user
    const { data: items, error: itemsError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', userId);

    if (itemsError) throw itemsError;

    if (!items || items.length === 0) {
      res.status(404).json({ error: 'No connected bank accounts found' });
      return;
    }

    const accountIdArray = accountIds 
      ? (accountIds as string).split(',')
      : undefined;

    // Get recurring transactions for each item
    const allResults = await Promise.all(
      items.map(async (item: PlaidItem) => {
        const result = await plaidService.getRecurringTransactions(
          item.access_token,
          accountIdArray
        );
        return {
          itemId: item.item_id,
          institutionName: item.institution_name,
          ...plaidService.transformToSubscriptions(result),
        };
      })
    );

    // Combine all subscriptions
    const allSubscriptions = allResults.flatMap((r) => 
      r.subscriptions.map((s) => ({
        ...s,
        institutionName: r.institutionName,
      }))
    );

    // Calculate combined totals
    const totalMonthlyAmount = allResults.reduce((sum, r) => sum + r.totalMonthlyAmount, 0);
    const totalAnnualAmount = allResults.reduce((sum, r) => sum + r.totalAnnualAmount, 0);

    res.json({
      subscriptions: allSubscriptions,
      totalMonthlyAmount: Math.round(totalMonthlyAmount * 100) / 100,
      totalAnnualAmount: Math.round(totalAnnualAmount * 100) / 100,
      byInstitution: allResults,
    });
  } catch (error) {
    console.error('Error fetching recurring transactions:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/plaid/accounts/:userId - Get all connected accounts for a user
app.get('/api/plaid/accounts/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get all Plaid items for this user
    const { data: items, error: itemsError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', userId);

    if (itemsError) throw itemsError;

    if (!items || items.length === 0) {
      res.status(404).json({ error: 'No connected bank accounts found' });
      return;
    }

    // Get accounts for each item
    const allAccounts = await Promise.all(
      items.map(async (item: PlaidItem) => {
        const result = await plaidService.getAccounts(item.access_token);
        return {
          itemId: item.item_id,
          institutionId: item.institution_id,
          institutionName: item.institution_name,
          accounts: result.accounts,
        };
      })
    );

    res.json({
      institutions: allAccounts,
      totalAccounts: allAccounts.reduce((sum, inst) => sum + inst.accounts.length, 0),
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// Demo/Mock Data Endpoints (for sandbox testing)
// ============================================================================

// GET /api/demo/subscriptions - Get mock streaming subscriptions for demo
app.get('/api/demo/subscriptions', (_req: Request, res: Response) => {
  const totals = calculateMockTotals();
  
  const subscriptions = MOCK_STREAMING_SUBSCRIPTIONS.map((sub) => ({
    id: sub.stream_id,
    name: sub.merchant_name,
    description: sub.description,
    amount: sub.amount,
    frequency: sub.frequency.toLowerCase(),
    category: sub.category[0],
    lastCharged: sub.last_date,
    nextCharge: sub.next_projected_date,
    isActive: sub.is_active,
    status: sub.status.toLowerCase(),
    logo: sub.logo_url,
  }));

  res.json({
    subscriptions,
    summary: {
      totalSubscriptions: totals.count,
      monthlyTotal: totals.totalMonthly,
      annualTotal: totals.totalAnnual,
    },
    source: 'mock',
    note: 'This is demo data. Connect a real bank account for actual subscriptions.',
  });
});

// GET /api/demo/transactions - Get mock transactions for demo
app.get('/api/demo/transactions', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const transactions = generateMockTransactions().slice(0, limit);

  res.json({
    transactions: transactions.map((txn) => ({
      id: txn.transaction_id,
      date: txn.date,
      amount: txn.amount,
      name: txn.name,
      merchantName: txn.merchant_name,
      category: txn.personal_finance_category.primary,
      pending: txn.pending,
    })),
    total: transactions.length,
    source: 'mock',
  });
});

// ============================================================================
// Error Handler
// ============================================================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Plaid environment: ${process.env.PLAID_ENV || 'sandbox'}`);
});

export default app;
