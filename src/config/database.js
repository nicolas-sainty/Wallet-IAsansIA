const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️  Supabase credentials not found, some features may not work');
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  : null;

// Test connection
if (supabase) {
  supabase.from('users').select('count', { count: 'exact', head: true })
    .then(() => {
      console.log('✓ Connected to Supabase');
    })
    .catch((err) => {
      console.warn('⚠️  Supabase connection test failed:', err.message);
    });
}

/**
 * Execute a raw SQL query using Supabase RPC or direct table operations
 * This is a compatibility wrapper to maintain the same interface as pg
 */
const query = async (text, params = []) => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  // For simple SELECT queries, try to parse and use Supabase query builder
  // For complex queries, you'll need to create RPC functions in Supabase

  // This is a basic implementation - you may need to extend this
  // based on your specific SQL queries
  throw new Error('Raw SQL queries not directly supported with Supabase JS client. Use Supabase query builder or create RPC functions.');
};

/**
 * Execute a transaction
 * Note: Supabase doesn't support traditional transactions via the JS client
 * You need to create database functions for transactional operations
 */
const transaction = async (callback) => {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  // Supabase transactions must be handled via database functions (RPC)
  // This is a placeholder - implement your transaction logic via RPC
  throw new Error('Transactions must be implemented as Supabase RPC functions');
};

module.exports = {
  query,
  transaction,
  supabase, // Export the Supabase client for direct use
  // Legacy pool export for compatibility (will be null)
  pool: null
};

