import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { Products } from 'plaid';
import * as plaidService from './services/plaidService.js';
import * as cancellationService from './services/cancellationService.js';
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
import { plaidItems, transactions as transactionsDb, plaidUsage } from './db/jsonDb.js';
import { detectRecurringTransactions, calculateTotals } from './services/recurringDetector.js';

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

// Serve static files (for Plaid Link page)
app.use('/static', express.static(path.join(__dirname, 'public')));

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
      // Cancellation link endpoints
      { method: 'GET', path: '/api/cancellation-links/:serviceName', description: 'Get cancellation link for a service' },
      { method: 'POST', path: '/api/cancellation-links/bulk', description: 'Get cancellation links for multiple services' },
      { method: 'POST', path: '/api/cancellation-links/refresh', description: 'Refresh JustDelete.me data' },
      { method: 'GET', path: '/api/cancellation-links/status', description: 'Get cancellation service status' },
      // Demo endpoints (mock data)
      { method: 'GET', path: '/api/demo/subscriptions', description: 'Get mock streaming subscriptions for demo' },
      { method: 'GET', path: '/api/demo/transactions', description: 'Get mock transactions for demo' },
      { method: 'GET', path: '/api/spending/category/:userId/:category', description: 'Get monthly spending for a category (mock data)' },
    ],
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve Plaid Link page
app.get('/plaid-link', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'plaid-link.html'));
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
app.put('/api/subscriptions/:id', async (req: Request<{ id: string; }, object, UpdateSubscriptionRequest>, res: Response) => {
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
app.post('/api/subscriptions/:id/visit', async (req: Request<{ id: string; }, object, RecordVisitRequest>, res: Response) => {
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

    // Store the access token in JSON database
    plaidItems.insert({
      user_id: userId,
      access_token: tokenData.accessToken,
      item_id: tokenData.itemId,
      institution_id: institutionId,
      institution_name: institutionName,
    });

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
app.get('/api/plaid/items/:userId', (req: Request<{ userId: string; }>, res: Response) => {
  try {
    const { userId } = req.params;
    const items = plaidItems.findByUserId(userId);
    res.json(items);
  } catch (error) {
    console.error('Error fetching Plaid items:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/plaid/items/:itemId - Disconnect a Plaid item
app.delete('/api/plaid/items/:itemId', async (req: Request<{ itemId: string; }>, res: Response) => {
  try {
    const { itemId } = req.params;

    // Get the access token for this item
    const item = plaidItems.findByItemId(itemId);

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    // Remove from Plaid
    await plaidService.removeItem(item.access_token);

    // Remove from database
    plaidItems.delete(itemId);

    res.status(204).send();
  } catch (error) {
    console.error('Error disconnecting item:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Helper function to generate demo subscription transactions
function generateDemoSubscriptions(userId: string, accountId: string) {
  const subscriptions = [
    { name: 'NETFLIX.COM', merchant: 'Netflix', amount: 15.99, dayOfMonth: 15 },
    { name: 'SPOTIFY USA', merchant: 'Spotify', amount: 10.99, dayOfMonth: 12 },
    { name: 'OPENAI *CHATGPT PLUS', merchant: 'ChatGPT', amount: 20.00, dayOfMonth: 8 },
    { name: 'AMAZON PRIME MEMBERSHIP', merchant: 'Amazon Prime', amount: 14.99, dayOfMonth: 5 },
    { name: 'DISNEY PLUS', merchant: 'Disney+', amount: 13.99, dayOfMonth: 18 },
    { name: 'GOOGLE *YOUTUBE PREMIUM', merchant: 'YouTube', amount: 13.99, dayOfMonth: 10 },
    { name: 'GITHUB INC', merchant: 'GitHub', amount: 4.00, dayOfMonth: 3 },
    { name: 'NOTION LABS INC', merchant: 'Notion', amount: 10.00, dayOfMonth: 7 },
    { name: 'ADOBE CREATIVE CLOUD', merchant: 'Adobe', amount: 54.99, dayOfMonth: 1 },
    { name: 'PLANET FITNESS', merchant: 'Planet Fitness', amount: 24.99, dayOfMonth: 2 },
    { name: 'NORDVPN.COM', merchant: 'NordVPN', amount: 12.99, dayOfMonth: 14 },
    { name: 'HBO MAX', merchant: 'HBO', amount: 15.99, dayOfMonth: 16 },
  ];

  const transactions: Array<{
    user_id: string;
    plaid_transaction_id: string;
    account_id: string;
    amount: number;
    date: string;
    name: string;
    merchant_name: string;
    pending: boolean;
    payment_channel: string;
  }> = [];

  const now = new Date();

  // Generate 3 months of transactions for each subscription
  for (const sub of subscriptions) {
    for (let monthsAgo = 0; monthsAgo < 3; monthsAgo++) {
      const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, sub.dayOfMonth);
      // Skip if the date is in the future
      if (date > now) {
        date.setMonth(date.getMonth() - 1);
      }
      const dateStr = date.toISOString().split('T')[0];
      const merchantKey = sub.merchant.toLowerCase().replace(/[^a-z]/g, '');

      transactions.push({
        user_id: userId,
        plaid_transaction_id: `txn-${merchantKey}-${monthsAgo + 1}-${Date.now()}`,
        account_id: accountId,
        amount: sub.amount,
        date: dateStr,
        name: sub.name,
        merchant_name: sub.merchant,
        pending: false,
        payment_channel: 'online',
      });
    }
  }

  return transactions;
}

// POST /api/plaid/transactions/sync - Sync transactions for a user
// In demo mode, this generates fake subscription data instead of using actual Plaid transactions
app.post('/api/plaid/transactions/sync', async (req: Request<object, object, SyncTransactionsRequest>, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    // Get all Plaid items for this user from JSON database
    const items = plaidItems.findByUserIdWithToken(userId);

    if (!items || items.length === 0) {
      res.status(404).json({ error: 'No connected bank accounts found' });
      return;
    }

    // Generate demo subscription transactions instead of fetching from Plaid
    const item = items[0]; // Use the first connected account
    const demoAccountId = '7EzkRkMJ91FZGDBqow9qFl6WKQoDreFdovyPW';

    // Clear existing transactions for this user and insert demo data
    const existingTransactions = transactionsDb.findAllByUserId(userId);
    if (existingTransactions.length > 0) {
      transactionsDb.deleteByPlaidIds(existingTransactions.map(t => t.plaid_transaction_id));
    }

    const demoTransactions = generateDemoSubscriptions(userId, demoAccountId);
    transactionsDb.upsert(demoTransactions);

    res.json({
      message: 'Transactions synced successfully (demo mode)',
      results: [{
        itemId: item.item_id,
        institutionName: item.institution_name,
        added: demoTransactions.length,
        modified: 0,
        removed: existingTransactions.length,
      }],
      totalAdded: demoTransactions.length,
      totalModified: 0,
      totalRemoved: existingTransactions.length,
      note: 'Demo subscription data generated for demonstration purposes',
    });
  } catch (error) {
    console.error('Error syncing transactions:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/plaid/transactions/:userId - Get stored transactions for a user
app.get('/api/plaid/transactions/:userId', (req: Request<{ userId: string; }>, res: Response) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, limit = '100', offset = '0' } = req.query;

    const result = transactionsDb.findByUserId(userId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      transactions: result.transactions,
      total: result.total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/plaid/recurring/:userId - Get recurring transactions (subscriptions) for a user
// In demo mode, uses local detection from stored demo transactions
app.get('/api/plaid/recurring/:userId', (req: Request<{ userId: string; }>, res: Response) => {
  try {
    const { userId } = req.params;

    // Use local detection from stored transactions (demo mode)
    const allTransactions = transactionsDb.findAllByUserId(userId);

    if (allTransactions.length === 0) {
      res.json({
        subscriptions: [],
        totalMonthlyAmount: 0,
        totalAnnualAmount: 0,
        source: 'local-detection',
        note: 'No transactions found. Sync transactions first.',
      });
      return;
    }

    // Detect recurring transactions locally
    const subscriptions = detectRecurringTransactions(allTransactions);
    const totals = calculateTotals(subscriptions);

    // Merge in usage data (visit_count, total_time_seconds) from plaid_usage
    const usageData = plaidUsage.findByUserId(userId);
    const subscriptionsWithUsage = subscriptions.map(sub => {
      const usage = usageData.find(u =>
        u.merchant_name.toLowerCase().trim() === (sub.merchant_name || sub.name).toLowerCase().trim()
      );
      if (usage) {
        return {
          ...sub,
          visit_count: usage.visit_count,
          total_time_seconds: usage.total_time_seconds,
          last_visit: usage.last_visit,
        };
      }
      return {
        ...sub,
        visit_count: 0,
        total_time_seconds: 0,
      };
    });

    res.json({
      subscriptions: subscriptionsWithUsage,
      totalMonthlyAmount: totals.totalMonthlyAmount,
      totalAnnualAmount: totals.totalAnnualAmount,
      source: 'local-detection',
      transactionsAnalyzed: allTransactions.length,
    });
  } catch (error) {
    console.error('Error fetching recurring transactions:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/plaid/recurring/:userId/:merchantName - Delete a recurring subscription by merchant
app.delete('/api/plaid/recurring/:userId/:merchantName', (req: Request<{ userId: string; merchantName: string }>, res: Response) => {
  try {
    const { userId, merchantName } = req.params;
    const decodedMerchant = decodeURIComponent(merchantName);

    const deletedCount = transactionsDb.deleteByMerchant(userId, decodedMerchant);

    if (deletedCount === 0) {
      res.status(404).json({ error: 'No transactions found for this merchant' });
      return;
    }

    res.json({
      success: true,
      deletedTransactions: deletedCount,
      merchant: decodedMerchant,
    });
  } catch (error) {
    console.error('Error deleting recurring subscription:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/plaid/recurring/:userId/:merchantName - Update a recurring subscription's merchant name
app.put('/api/plaid/recurring/:userId/:merchantName', (req: Request<{ userId: string; merchantName: string }, object, { newName: string }>, res: Response) => {
  try {
    const { userId, merchantName } = req.params;
    const { newName } = req.body;
    const decodedMerchant = decodeURIComponent(merchantName);

    if (!newName || !newName.trim()) {
      res.status(400).json({ error: 'newName is required' });
      return;
    }

    const updatedCount = transactionsDb.updateMerchant(userId, decodedMerchant, newName.trim());

    if (updatedCount === 0) {
      res.status(404).json({ error: 'No transactions found for this merchant' });
      return;
    }

    res.json({
      success: true,
      updatedTransactions: updatedCount,
      oldName: decodedMerchant,
      newName: newName.trim(),
    });
  } catch (error) {
    console.error('Error updating recurring subscription:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/plaid/usage/:userId/:merchantName - Update usage stats for a Plaid subscription
app.post('/api/plaid/usage/:userId/:merchantName', (req: Request<{ userId: string; merchantName: string }, object, { addSeconds?: number; incrementVisit?: boolean }>, res: Response) => {
  try {
    const { userId, merchantName } = req.params;
    const { addSeconds = 0, incrementVisit = false } = req.body;
    const decodedMerchant = decodeURIComponent(merchantName);

    const usage = plaidUsage.upsert(userId, decodedMerchant, addSeconds, incrementVisit);

    res.json({
      success: true,
      usage,
    });
  } catch (error) {
    console.error('Error updating Plaid usage:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/plaid/usage/:userId - Get all usage stats for a user's Plaid subscriptions
app.get('/api/plaid/usage/:userId', (req: Request<{ userId: string }>, res: Response) => {
  try {
    const { userId } = req.params;
    const usage = plaidUsage.findByUserId(userId);
    res.json({ usage });
  } catch (error) {
    console.error('Error fetching Plaid usage:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/plaid/accounts/:userId - Get all connected accounts for a user
app.get('/api/plaid/accounts/:userId', async (req: Request<{ userId: string; }>, res: Response) => {
  try {
    const { userId } = req.params;

    // Get all Plaid items for this user from JSON database
    const items = plaidItems.findByUserIdWithToken(userId);

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
// Cancellation Link Routes
// ============================================================================

// GET /api/cancellation-links/:serviceName - Get cancellation link for a service
app.get('/api/cancellation-links/:serviceName', async (req: Request<{ serviceName: string; }>, res: Response) => {
  try {
    const { serviceName } = req.params;

    if (!serviceName || serviceName.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'Service name is required'
      });
      return;
    }

    const link = await cancellationService.getCancellationLink(serviceName);

    if (!link) {
      res.status(404).json({
        success: false,
        error: 'No cancellation information found for this service',
        suggestion: `Try searching "${serviceName}" help center for cancellation instructions`
      });
      return;
    }

    res.json({
      success: true,
      data: link
    });
  } catch (error) {
    console.error('Error fetching cancellation link:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// POST /api/cancellation-links/bulk - Get cancellation links for multiple services
app.post('/api/cancellation-links/bulk', async (req: Request, res: Response) => {
  try {
    const { services } = req.body;

    if (!services || !Array.isArray(services)) {
      res.status(400).json({
        success: false,
        error: 'services array is required'
      });
      return;
    }

    const results = await cancellationService.getCancellationLinksBulk(services);

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error fetching bulk cancellation links:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// POST /api/cancellation-links/refresh - Manually refresh cancellation data
app.post('/api/cancellation-links/refresh', async (req: Request, res: Response) => {
  try {
    await cancellationService.refreshJustDeleteMeData();
    const status = cancellationService.getServiceStatus();

    res.json({
      success: true,
      message: 'Cancellation service refreshed successfully',
      curatedServicesCount: status.curatedServicesCount
    });
  } catch (error) {
    console.error('Error refreshing cancellation data:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// GET /api/cancellation-links/status - Get cancellation service status
app.get('/api/cancellation-links/status', (_req: Request, res: Response) => {
  const status = cancellationService.getServiceStatus();
  res.json({
    success: true,
    ...status
  });
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

// GET /api/spending/category/:userId/:category - Get monthly spending for a category
// Uses mock data to show how much user has spent on subscriptions in a category
app.get('/api/spending/category/:userId/:category', (req: Request, res: Response) => {
  try {
    const category = req.params.category as string;
    const categoryUpper = category.toUpperCase();

    // Filter mock subscriptions by category
    const categorySubscriptions = MOCK_STREAMING_SUBSCRIPTIONS.filter((sub) =>
      sub.is_active && sub.category.includes(categoryUpper)
    );

    // Calculate monthly total for this category
    const monthlyTotal = categorySubscriptions.reduce((sum, sub) => {
      switch (sub.frequency) {
        case 'WEEKLY': return sum + sub.amount * 4.33;
        case 'BIWEEKLY': return sum + sub.amount * 2.17;
        case 'ANNUALLY': return sum + sub.amount / 12;
        default: return sum + sub.amount;
      }
    }, 0);

    // Map category to display name
    const categoryDisplayMap: Record<string, string> = {
      'ENTERTAINMENT': 'Entertainment',
      'SOFTWARE': 'Software',
      'PERSONAL_CARE': 'Personal Care',
    };

    const subscriptions = categorySubscriptions.map((sub) => ({
      name: sub.merchant_name,
      amount: sub.amount,
      lastDate: sub.last_date,
      logoUrl: sub.logo_url,
    }));

    res.json({
      category: categoryUpper,
      categoryDisplay: categoryDisplayMap[categoryUpper] || category,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      subscriptions,
      subscriptionCount: categorySubscriptions.length,
      source: 'mock',
    });
  } catch (error) {
    console.error('Error fetching category spending:', error);
    res.status(500).json({ error: (error as Error).message });
  }
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

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Plaid environment: ${process.env.PLAID_ENV || 'sandbox'}`);
  console.log('Using JSON file database for Plaid data (src/db/data.json)');

  // Initialize cancellation service
  console.log('Initializing cancellation service...');
  await cancellationService.initializeCancellationService();
  console.log('Cancellation service initialized');
});

export default app;
