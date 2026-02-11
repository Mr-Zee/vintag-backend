import pkg from 'pg';
const { Pool } = pkg;
import dotenv from "dotenv";
dotenv.config();

// Check if we are in production (Vercel sets NODE_ENV to production)
const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  // Only apply SSL if we are NOT on localhost
  ssl: isProduction 
    ? { rejectUnauthorized: false } 
    : false
});

export async function query(text, params) {
  try {
    const res = await pool.query(text, params);
    return res;
  } catch (error) {
    console.error("Database Query Error:", error);
    throw error;
  }
}