import pkg from 'pg';
const { Pool } = pkg;
const { Pool } = require('pg');
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: {
    sslmode: 'verify-full',
    rejectUnauthorized: false
  }
});

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}