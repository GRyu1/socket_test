import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '192.168.0.16',
  user: process.env.DB_USER || 'z5corp',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'ry',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function insert(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result.insertId;
}

export default pool;
