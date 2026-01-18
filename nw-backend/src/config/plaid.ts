import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Determine Plaid environment from env variable
function getPlaidEnvironment(): string {
  const env = process.env.PLAID_ENV?.toLowerCase() || 'sandbox';
  switch (env) {
    case 'production':
      return PlaidEnvironments.production;
    case 'development':
      return PlaidEnvironments.development;
    case 'sandbox':
    default:
      return PlaidEnvironments.sandbox;
  }
}

// Plaid configuration
const configuration = new Configuration({
  basePath: getPlaidEnvironment(),
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
      'PLAID-SECRET': process.env.PLAID_SECRET || '',
    },
  },
});

// Export the Plaid API client
export const plaidClient = new PlaidApi(configuration);

// Export configuration for debugging
export const plaidConfig = {
  clientId: process.env.PLAID_CLIENT_ID || '',
  environment: process.env.PLAID_ENV || 'sandbox',
  countryCodes: ['US', 'CA'],
  products: ['transactions'],
};
