import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { query, queryOne, insert } from '../db.js';

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

export async function register(body) {
  const { username, password } = body;
  if (!username || !password) {
    return { status: 400, data: { error: 'username과 password를 입력하세요' } };
  }
  if (username.length > 50) {
    return { status: 400, data: { error: 'username은 50자 이하여야 합니다' } };
  }
  if (password.length < 4) {
    return { status: 400, data: { error: 'password는 4자 이상이어야 합니다' } };
  }

  const existing = await queryOne('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) {
    return { status: 409, data: { error: '이미 존재하는 username입니다' } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const apiKey = generateApiKey();
  await insert(
    'INSERT INTO users (username, password_hash, api_key) VALUES (?, ?, ?)',
    [username, passwordHash, apiKey],
  );

  return { status: 201, data: { username, api_key: apiKey } };
}

export async function login(body) {
  const { username, password } = body;
  if (!username || !password) {
    return { status: 400, data: { error: 'username과 password를 입력하세요' } };
  }

  const user = await queryOne('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) {
    return { status: 401, data: { error: '존재하지 않는 계정입니다' } };
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return { status: 401, data: { error: '비밀번호가 일치하지 않습니다' } };
  }

  return { status: 200, data: { username: user.username, api_key: user.api_key } };
}

export async function authenticate(apiKey) {
  if (!apiKey) return null;
  return queryOne('SELECT id, username FROM users WHERE api_key = ?', [apiKey]);
}
