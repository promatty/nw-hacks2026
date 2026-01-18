/**
 * Plaid API Demo Script
 * 
 * This script demonstrates the Plaid Transactions and Recurring Transactions APIs
 * using Plaid's sandbox environment with test credentials.
 * 
 * Run with: npx tsx src/demo.ts
 */

import 'dotenv/config';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode, SandboxItemFireWebhookRequestWebhookCodeEnum } from 'plaid';

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
      'PLAID-SECRET': process.env.PLAID_SECRET || '',
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Test user ID
const TEST_USER_ID = 'demo-user-123';

async function demo() {
  console.log('\n🏦 PLAID API DEMO - Sandbox Mode\n');
  console.log('='.repeat(60));

  // Check credentials
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    console.error('\n❌ Missing Plaid credentials!');
    console.log('\nPlease add to your .env file:');
    console.log('  PLAID_CLIENT_ID=your-client-id');
    console.log('  PLAID_SECRET=your-sandbox-secret');
    console.log('\nGet credentials at: https://dashboard.plaid.com/developers/keys');
    process.exit(1);
  }

  try {
    // Step 1: Create Link Token
    console.log('\n📝 Step 1: Creating Link Token...');
    const linkTokenResponse = await plaidClient.linkTokenCreate({
      user: { client_user_id: TEST_USER_ID },
      client_name: 'RoastMySubs Demo',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    
    console.log('✅ Link Token created!');
    console.log(`   Token: ${linkTokenResponse.data.link_token.substring(0, 50)}...`);
    console.log(`   Expires: ${linkTokenResponse.data.expiration}`);

    // Step 2: Create sandbox test item (simulates user completing Plaid Link)
    console.log('\n🧪 Step 2: Creating Sandbox Test Item...');
    console.log('   (In production, user would complete Plaid Link UI)');
    
    const sandboxResponse = await plaidClient.sandboxPublicTokenCreate({
      institution_id: 'ins_109508', // First Platypus Bank (sandbox test bank)
      initial_products: [Products.Transactions],
    });
    
    console.log('✅ Sandbox public token created!');

    // Step 3: Exchange for access token
    console.log('\n🔑 Step 3: Exchanging Public Token for Access Token...');
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: sandboxResponse.data.public_token,
    });
    
    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;
    
    console.log('✅ Access token obtained!');
    console.log(`   Item ID: ${itemId}`);

    // Fire sandbox webhook to populate transactions
    console.log('\n⚡ Firing sandbox webhook to populate test data...');
    try {
      await plaidClient.sandboxItemFireWebhook({
        access_token: accessToken,
        webhook_code: SandboxItemFireWebhookRequestWebhookCodeEnum.SyncUpdatesAvailable,
      });
      console.log('✅ Webhook fired! Waiting for data...');
    } catch (e) {
      console.log('   (Webhook optional, continuing...)');
    }
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Get accounts
    console.log('\n💳 Step 4: Fetching Connected Accounts...');
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    
    console.log(`✅ Found ${accountsResponse.data.accounts.length} accounts:`);
    accountsResponse.data.accounts.forEach((account, i) => {
      console.log(`   ${i + 1}. ${account.name} (${account.subtype})`);
      console.log(`      Balance: $${account.balances.current?.toFixed(2) || 'N/A'}`);
      console.log(`      Account ID: ${account.account_id.substring(0, 20)}...`);
    });

    // Step 5: Get transactions (using /get endpoint with date range for sandbox)
    console.log('\n💰 Step 5: Fetching Transactions...');
    
    // Calculate date range (last 30 days)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let allTransactions: any[] = [];
    let totalTransactions = 0;
    
    try {
      // Use transactions/get for sandbox (has pre-populated test data)
      const txnResponse = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: {
          include_personal_finance_category: true,
          count: 100,
          offset: 0,
        },
      });
      
      allTransactions = txnResponse.data.transactions;
      totalTransactions = txnResponse.data.total_transactions;
      
      // Fetch remaining if more exist
      while (allTransactions.length < totalTransactions) {
        const moreResponse = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          options: {
            include_personal_finance_category: true,
            count: 100,
            offset: allTransactions.length,
          },
        });
        allTransactions = [...allTransactions, ...moreResponse.data.transactions];
      }
    } catch (txnError: any) {
      if (txnError.response?.data?.error_code === 'PRODUCT_NOT_READY') {
        console.log('   ⏳ Transactions not ready yet, trying sync API...');
        
        // Fallback to sync API
        let cursor: string | undefined = undefined;
        let hasMore = true;
        
        while (hasMore) {
          const syncResponse = await plaidClient.transactionsSync({
            access_token: accessToken,
            cursor: cursor,
            count: 100,
          });
          
          allTransactions = [...allTransactions, ...syncResponse.data.added];
          hasMore = syncResponse.data.has_more;
          cursor = syncResponse.data.next_cursor;
        }
      } else {
        throw txnError;
      }
    }
    
    console.log(`✅ Found ${allTransactions.length} transactions!`);
    
    // Display sample transactions
    console.log('\n📊 Sample Transactions:');
    console.log('-'.repeat(60));
    
    const sampleTransactions = allTransactions.slice(0, 10);
    sampleTransactions.forEach((txn, i) => {
      const amount = txn.amount > 0 ? `-$${txn.amount.toFixed(2)}` : `+$${Math.abs(txn.amount).toFixed(2)}`;
      const category = txn.personal_finance_category?.primary || txn.category?.[0] || 'Uncategorized';
      console.log(`   ${i + 1}. ${txn.date} | ${amount.padEnd(10)} | ${txn.name?.substring(0, 30)}`);
      console.log(`      Category: ${category} | Merchant: ${txn.merchant_name || 'N/A'}`);
    });
    
    if (allTransactions.length > 10) {
      console.log(`   ... and ${allTransactions.length - 10} more transactions`);
    }

    // Step 6: Get recurring transactions (subscriptions!)
    console.log('\n🔄 Step 6: Detecting Recurring Transactions (Subscriptions)...');
    
    let outflowStreams: any[] = [];
    let inflowStreams: any[] = [];
    
    try {
      // Wait a bit more for recurring detection to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const recurringResponse = await plaidClient.transactionsRecurringGet({
        access_token: accessToken,
      });
      
      outflowStreams = recurringResponse.data.outflow_streams;
      inflowStreams = recurringResponse.data.inflow_streams;
    } catch (recurringError: any) {
      if (recurringError.response?.data?.error_code === 'PRODUCT_NOT_READY') {
        console.log('   ⏳ Recurring transactions not ready yet (normal for new items)');
        console.log('   In production, Plaid takes a few minutes to analyze patterns');
      } else {
        throw recurringError;
      }
    }
    
    console.log(`✅ Found ${outflowStreams.length} recurring outflows (subscriptions/bills)`);
    console.log(`✅ Found ${inflowStreams.length} recurring inflows (income)`);
    
    // Display subscriptions
    if (outflowStreams.length > 0) {
      console.log('\n🎯 DETECTED SUBSCRIPTIONS:');
      console.log('-'.repeat(60));
      
      let totalMonthly = 0;
      
      outflowStreams.forEach((stream, i) => {
        const amount = Math.abs(stream.average_amount?.amount || stream.last_amount?.amount || 0);
        const frequency = stream.frequency || 'UNKNOWN';
        const status = stream.status;
        const isActive = stream.is_active;
        
        // Calculate monthly equivalent
        let monthlyAmount = amount;
        switch (frequency) {
          case 'WEEKLY': monthlyAmount = amount * 4.33; break;
          case 'BIWEEKLY': monthlyAmount = amount * 2.17; break;
          case 'SEMI_MONTHLY': monthlyAmount = amount * 2; break;
          case 'ANNUALLY': monthlyAmount = amount / 12; break;
        }
        totalMonthly += monthlyAmount;
        
        console.log(`\n   ${i + 1}. ${stream.merchant_name || stream.description}`);
        console.log(`      💵 Amount: $${amount.toFixed(2)} (${frequency.toLowerCase()})`);
        console.log(`      📅 Last charged: ${stream.last_date}`);
        console.log(`      📊 Status: ${status} | Active: ${isActive ? '✅' : '❌'}`);
        console.log(`      🏷️  Category: ${stream.personal_finance_category?.primary || stream.category?.[0] || 'N/A'}`);
      });
      
      console.log('\n' + '='.repeat(60));
      console.log(`💰 TOTAL MONTHLY SUBSCRIPTION COST: $${totalMonthly.toFixed(2)}`);
      console.log(`💰 TOTAL ANNUAL SUBSCRIPTION COST: $${(totalMonthly * 12).toFixed(2)}`);
      console.log('='.repeat(60));
    } else {
      console.log('\n   ⚠️  No recurring transactions detected yet.');
      console.log('   (Sandbox may need more transaction history for detection)');
    }

    // Display income streams
    if (inflowStreams.length > 0) {
      console.log('\n💵 RECURRING INCOME:');
      console.log('-'.repeat(60));
      
      inflowStreams.forEach((stream, i) => {
        const amount = Math.abs(stream.average_amount?.amount || stream.last_amount?.amount || 0);
        console.log(`   ${i + 1}. ${stream.merchant_name || stream.description}: $${amount.toFixed(2)} (${stream.frequency?.toLowerCase() || 'unknown'})`);
      });
    }

    // Summary JSON output
    console.log('\n📦 API Response Summary (JSON):');
    console.log('-'.repeat(60));
    
    const summary = {
      demo_user_id: TEST_USER_ID,
      item_id: itemId,
      accounts_connected: accountsResponse.data.accounts.length,
      total_transactions: allTransactions.length,
      recurring_outflows: outflowStreams.length,
      recurring_inflows: inflowStreams.length,
      sample_subscription: outflowStreams[0] ? {
        merchant: outflowStreams[0].merchant_name || outflowStreams[0].description,
        amount: outflowStreams[0].average_amount?.amount,
        frequency: outflowStreams[0].frequency,
        last_date: outflowStreams[0].last_date,
        is_active: outflowStreams[0].is_active,
      } : null,
    };
    
    console.log(JSON.stringify(summary, null, 2));

    console.log('\n✨ Demo complete!');
    console.log('\nNext steps:');
    console.log('  1. Start the server: npm run dev');
    console.log('  2. Call POST /api/plaid/link-token to get a link token');
    console.log('  3. Complete Plaid Link in your extension');
    console.log('  4. Call POST /api/plaid/exchange-token with the public token');
    console.log('  5. Call GET /api/plaid/recurring/:userId to get subscriptions');

  } catch (error: any) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    
    if (error.response?.data?.error_code === 'INVALID_API_KEYS') {
      console.log('\n💡 Your Plaid credentials may be invalid.');
      console.log('   Get sandbox credentials at: https://dashboard.plaid.com/developers/keys');
    }
  }
}

demo();
