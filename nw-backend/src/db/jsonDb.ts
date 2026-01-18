import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PlaidItem, StoredTransaction } from '../types/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data.json');

export interface PlaidUsage {
  id: string;
  user_id: string;
  merchant_name: string;
  visit_count: number;
  total_time_seconds: number;
  last_visit: string;
  created_at: string;
  updated_at: string;
}

interface Database {
  plaid_items: PlaidItem[];
  transactions: StoredTransaction[];
  plaid_usage?: PlaidUsage[];
}

function loadDb(): Database {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      const db = JSON.parse(data);
      // Ensure plaid_usage array exists
      if (!db.plaid_usage) {
        db.plaid_usage = [];
      }
      return db;
    }
  } catch (error) {
    console.error('Error loading JSON database:', error);
  }
  return { plaid_items: [], transactions: [], plaid_usage: [] };
}

function saveDb(db: Database): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function generateId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// Plaid Items
// ============================================================================

export const plaidItems = {
  findByUserId(userId: string): Omit<PlaidItem, 'access_token'>[] {
    const db = loadDb();
    return db.plaid_items
      .filter(item => item.user_id === userId)
      .map(({ access_token, ...rest }) => rest);
  },

  findByUserIdWithToken(userId: string): PlaidItem[] {
    const db = loadDb();
    return db.plaid_items.filter(item => item.user_id === userId);
  },

  findByItemId(itemId: string): PlaidItem | undefined {
    const db = loadDb();
    return db.plaid_items.find(item => item.item_id === itemId);
  },

  insert(data: Omit<PlaidItem, 'id' | 'created_at' | 'updated_at'>): PlaidItem {
    const db = loadDb();
    const now = new Date().toISOString();
    const newItem: PlaidItem = {
      ...data,
      id: generateId(),
      created_at: now,
      updated_at: now,
    };
    db.plaid_items.push(newItem);
    saveDb(db);
    return newItem;
  },

  update(itemId: string, updates: Partial<PlaidItem>): PlaidItem | undefined {
    const db = loadDb();
    const index = db.plaid_items.findIndex(item => item.item_id === itemId);
    if (index === -1) return undefined;

    db.plaid_items[index] = {
      ...db.plaid_items[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    saveDb(db);
    return db.plaid_items[index];
  },

  updateById(id: string, updates: Partial<PlaidItem>): PlaidItem | undefined {
    const db = loadDb();
    const index = db.plaid_items.findIndex(item => item.id === id);
    if (index === -1) return undefined;

    db.plaid_items[index] = {
      ...db.plaid_items[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    saveDb(db);
    return db.plaid_items[index];
  },

  delete(itemId: string): boolean {
    const db = loadDb();
    const initialLength = db.plaid_items.length;
    db.plaid_items = db.plaid_items.filter(item => item.item_id !== itemId);
    if (db.plaid_items.length !== initialLength) {
      saveDb(db);
      return true;
    }
    return false;
  },
};

// ============================================================================
// Transactions
// ============================================================================

export const transactions = {
  findByUserId(
    userId: string,
    options: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): { transactions: StoredTransaction[]; total: number } {
    const db = loadDb();
    let filtered = db.transactions.filter(t => t.user_id === userId);

    if (options.startDate) {
      filtered = filtered.filter(t => t.date >= options.startDate!);
    }
    if (options.endDate) {
      filtered = filtered.filter(t => t.date <= options.endDate!);
    }

    // Sort by date descending
    filtered.sort((a, b) => b.date.localeCompare(a.date));

    const total = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    const paginated = filtered.slice(offset, offset + limit);

    return { transactions: paginated, total };
  },

  upsert(data: Omit<StoredTransaction, 'id' | 'created_at' | 'updated_at'>[]): void {
    const db = loadDb();
    const now = new Date().toISOString();

    for (const txn of data) {
      const existingIndex = db.transactions.findIndex(
        t => t.plaid_transaction_id === txn.plaid_transaction_id
      );

      if (existingIndex >= 0) {
        db.transactions[existingIndex] = {
          ...db.transactions[existingIndex],
          ...txn,
          updated_at: now,
        };
      } else {
        db.transactions.push({
          ...txn,
          id: generateId(),
          created_at: now,
          updated_at: now,
        });
      }
    }
    saveDb(db);
  },

  deleteByPlaidIds(plaidTransactionIds: string[]): void {
    const db = loadDb();
    db.transactions = db.transactions.filter(
      t => !plaidTransactionIds.includes(t.plaid_transaction_id)
    );
    saveDb(db);
  },

  countByUserId(userId: string): number {
    const db = loadDb();
    return db.transactions.filter(t => t.user_id === userId).length;
  },

  findAllByUserId(userId: string): StoredTransaction[] {
    const db = loadDb();
    return db.transactions.filter(t => t.user_id === userId);
  },

  deleteByMerchant(userId: string, merchantName: string): number {
    const db = loadDb();
    const normalizedMerchant = merchantName.toLowerCase().trim();
    const initialLength = db.transactions.length;
    db.transactions = db.transactions.filter(t => {
      if (t.user_id !== userId) return true;
      const txnMerchant = (t.merchant_name || t.name).toLowerCase().trim();
      return txnMerchant !== normalizedMerchant;
    });
    const deletedCount = initialLength - db.transactions.length;
    if (deletedCount > 0) {
      saveDb(db);
    }
    return deletedCount;
  },

  updateMerchant(userId: string, oldMerchantName: string, newMerchantName: string): number {
    const db = loadDb();
    const normalizedOldMerchant = oldMerchantName.toLowerCase().trim();
    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const txn of db.transactions) {
      if (txn.user_id !== userId) continue;
      const txnMerchant = (txn.merchant_name || txn.name).toLowerCase().trim();
      if (txnMerchant === normalizedOldMerchant) {
        txn.merchant_name = newMerchantName;
        txn.updated_at = now;
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      saveDb(db);
    }
    return updatedCount;
  },
};

// ============================================================================
// Plaid Usage Tracking
// ============================================================================

export const plaidUsage = {
  findByUserAndMerchant(userId: string, merchantName: string): PlaidUsage | undefined {
    const db = loadDb();
    const normalizedMerchant = merchantName.toLowerCase().trim();
    return db.plaid_usage?.find(u =>
      u.user_id === userId &&
      u.merchant_name.toLowerCase().trim() === normalizedMerchant
    );
  },

  findByUserId(userId: string): PlaidUsage[] {
    const db = loadDb();
    return db.plaid_usage?.filter(u => u.user_id === userId) || [];
  },

  upsert(userId: string, merchantName: string, addSeconds: number, incrementVisit: boolean): PlaidUsage {
    const db = loadDb();
    if (!db.plaid_usage) {
      db.plaid_usage = [];
    }

    const normalizedMerchant = merchantName.toLowerCase().trim();
    const now = new Date().toISOString();

    let existing = db.plaid_usage.find(u =>
      u.user_id === userId &&
      u.merchant_name.toLowerCase().trim() === normalizedMerchant
    );

    if (existing) {
      existing.total_time_seconds += addSeconds;
      if (incrementVisit) {
        existing.visit_count += 1;
      }
      existing.last_visit = now;
      existing.updated_at = now;
    } else {
      existing = {
        id: `plaid-usage-${normalizedMerchant.replace(/\s+/g, '-')}-${Date.now()}`,
        user_id: userId,
        merchant_name: merchantName,
        visit_count: incrementVisit ? 1 : 0,
        total_time_seconds: addSeconds,
        last_visit: now,
        created_at: now,
        updated_at: now,
      };
      db.plaid_usage.push(existing);
    }

    saveDb(db);
    return existing;
  },

  delete(userId: string, merchantName: string): boolean {
    const db = loadDb();
    if (!db.plaid_usage) return false;

    const normalizedMerchant = merchantName.toLowerCase().trim();
    const initialLength = db.plaid_usage.length;
    db.plaid_usage = db.plaid_usage.filter(u =>
      !(u.user_id === userId && u.merchant_name.toLowerCase().trim() === normalizedMerchant)
    );

    if (db.plaid_usage.length !== initialLength) {
      saveDb(db);
      return true;
    }
    return false;
  },
};
