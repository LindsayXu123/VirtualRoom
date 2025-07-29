// models/db.js
const path = require('path');

// Load ../.env (i.e. server/.env)
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

console.log('Loading .env from', path.resolve(__dirname, '../.env'),
            '→ PG_PASS=', process.env.PG_PASS);

const { Pool } = require('pg');

const pool = new Pool({
  user:     'postgres',
  password: 'postpost567###tt',        // your real password
  host:     'localhost',
  port:     5432,
  database: 'room_planner'
});


pool.query('SELECT NOW()')
  .then(r => console.log('🟢 DB connected at', r.rows[0].now))
  .catch(e => {
    console.error('🔴 DB connection failed:', e);
    process.exit(1);
  });

module.exports = pool;

