/**
 * Plaid API Demo with Mock Streaming Services
 * 
 * Demonstrates real Plaid data + mock streaming subscriptions
 * 
 * Run with: npx tsx src/demo-with-mocks.ts
 */

import 'dotenv/config';
import { 
  MOCK_STREAMING_SUBSCRIPTIONS, 
  generateMockTransactions,
  calculateMockTotals,
  type MockSubscription 
} from './mocks/streamingSubscriptions.js';

console.log('\n🎬 PLAID DEMO WITH MOCK STREAMING SERVICES\n');
console.log('='.repeat(65));

// Display mock streaming subscriptions
console.log('\n📺 STREAMING & SOFTWARE SUBSCRIPTIONS:');
console.log('-'.repeat(65));

const byCategory: Record<string, MockSubscription[]> = {};

MOCK_STREAMING_SUBSCRIPTIONS.forEach((sub) => {
  const cat = sub.category[0];
  if (!byCategory[cat]) byCategory[cat] = [];
  byCategory[cat].push(sub);
});

Object.entries(byCategory).forEach(([category, subs]) => {
  console.log(`\n  📁 ${category.replace('_', ' ')}`);
  subs.forEach((sub) => {
    const status = sub.is_active ? '✅' : '❌';
    console.log(`     ${status} ${sub.merchant_name.padEnd(20)} $${sub.amount.toFixed(2).padStart(6)}/mo   (next: ${sub.next_projected_date})`);
  });
});

// Show totals
const totals = calculateMockTotals();
console.log('\n' + '='.repeat(65));
console.log(`📊 SUBSCRIPTION SUMMARY`);
console.log('-'.repeat(65));
console.log(`   Active subscriptions:  ${totals.count}`);
console.log(`   Monthly cost:          $${totals.totalMonthly.toFixed(2)}`);
console.log(`   Annual cost:           $${totals.totalAnnual.toFixed(2)}`);
console.log('='.repeat(65));

// Show sample transactions
console.log('\n💳 SAMPLE TRANSACTIONS (from subscriptions):');
console.log('-'.repeat(65));

const transactions = generateMockTransactions().slice(0, 15);
transactions.forEach((txn, i) => {
  console.log(`   ${i + 1}. ${txn.date} | -$${txn.amount.toFixed(2).padStart(6)} | ${txn.merchant_name}`);
});

// Show JSON structure
console.log('\n📦 API RESPONSE FORMAT (for frontend):');
console.log('-'.repeat(65));

const apiResponse = {
  subscriptions: MOCK_STREAMING_SUBSCRIPTIONS.slice(0, 3).map((sub) => ({
    id: sub.stream_id,
    name: sub.merchant_name,
    amount: sub.amount,
    frequency: sub.frequency.toLowerCase(),
    category: sub.category[0],
    lastCharged: sub.last_date,
    nextCharge: sub.next_projected_date,
    isActive: sub.is_active,
    logo: sub.logo_url,
  })),
  summary: {
    totalSubscriptions: totals.count,
    monthlyTotal: totals.totalMonthly,
    annualTotal: totals.totalAnnual,
  },
};

console.log(JSON.stringify(apiResponse, null, 2));

console.log('\n✨ Mock data ready!');
console.log('\nTo use in your API, the server can merge real Plaid data with mock data');
console.log('when PLAID_ENV=sandbox (for demo purposes)\n');
