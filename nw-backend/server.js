require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware
app.use(cors());
app.use(express.json());
app.set('json spaces', 2);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${res.statusCode} ${req.method} ${req.originalUrl} ${duration}ms`);
  });
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Subscription Tracker API',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/api/subscriptions/userId', description: 'Get all subscriptions for a user' },
      { method: 'POST', path: '/api/subscriptions', description: 'Add a new subscription' },
      { method: 'PUT', path: '/api/subscriptions/id', description: 'Update a subscription' },
      { method: 'DELETE', path: '/api/subscriptions/id', description: 'Delete a subscription' },
      { method: 'POST', path: '/api/subscriptions/id/visit', description: 'Record a visit' }
    ]
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// GET /api/subscriptions/:userId - Get all subscriptions for a user
app.get('/api/subscriptions/:userId', async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

// POST /api/subscriptions - Add a new subscription
app.post('/api/subscriptions', async (req, res) => {
  try {
    const { user_id, name, url } = req.body;

    if (!user_id || !name) {
      return res.status(400).json({ error: 'user_id and name are required' });
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id,
        name,
        ...(url && { url }),
        visit_count: 1,
        last_visit: new Date().toISOString(),
        total_time_seconds: 0
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/subscriptions/:id - Update subscription
app.put('/api/subscriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/subscriptions/:id - Delete a subscription
app.delete('/api/subscriptions/:id', async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

// POST /api/subscriptions/:id/visit - Record a visit
app.post('/api/subscriptions/:id/visit', async (req, res) => {
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
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Update with incremented values
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        visit_count: current.visit_count + 1,
        total_time_seconds: current.total_time_seconds + time_spent_seconds,
        last_visit: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error recording visit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
