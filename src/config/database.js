const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Ensure data directory exists
const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../database/epicoin.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('✓ Connected to SQLite database');
  }
});

// Helper to wrap sqlite3 in Promise-based interface matching our previous pg pool
const query = (text, params = []) => {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    // Convert Postgres-style parameter ($1, $2) to SQLite style (?, ?)
    // This is a naive replacement, but should work for our current codebase
    let queryText = text;
    let queryParams = params;

    if (text.includes('$')) {
      let i = 1;
      while (text.includes('$' + i)) {
        queryText = queryText.replace('$' + i, '?');
        i++;
      }
    }

    // Determine query type
    const method = queryText.trim().toLowerCase().startsWith('select') ? 'all' : 'run';

    if (method === 'all') {
      db.all(queryText, queryParams, (err, rows) => {
        const duration = Date.now() - start;
        if (err) {
          console.error('Query error:', { text: queryText, error: err.message });
          reject(err);
        } else {
          console.log('Executed query', { text: queryText, duration, rows: rows.length });
          resolve({ rows, rowCount: rows.length });
        }
      });
    } else {
      db.run(queryText, queryParams, function (err) {
        const duration = Date.now() - start;
        if (err) {
          console.error('Query error:', { text: queryText, error: err.message });
          reject(err);
        } else {
          console.log('Executed query', { text: queryText, duration, changes: this.changes });
          // Simulate pg result for INSERT/UPDATE
          // For INSERT RETURNING, we might need manual fetching if it was supported, 
          // generally SQLite doesn't support RETURNING in older versions, but current ones do.
          // However, node-sqlite3 might not return rows for .run().
          // We will handle specific RETURNING cases if they break.
          resolve({ rows: [], rowCount: this.changes });
        }
      });
    }
  });
};

// Transaction helper for SQLite
const transaction = async (callback) => {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (e) => e ? rej(e) : res()));

        // Mock client object that just uses the main db connection
        // (SQLite is single-threaded mostly anyway)
        const client = { query };

        const result = await callback(client);

        await new Promise((res, rej) => db.run('COMMIT', (e) => e ? rej(e) : res()));
        resolve(result);
      } catch (error) {
        await new Promise((res) => db.run('ROLLBACK', () => res())); // Ignore rollback error
        reject(error);
      }
    });
  });
};

module.exports = {
  query,
  transaction,
  pool: db // Expose raw db object if needed
};
