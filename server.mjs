// 寶藏遊戲的簡易後端：只使用 Node 內建模組（需 Node 22.13+ / 24）
// 提供註冊、登入、登出與遊戲紀錄 API，資料存放於 data/game.db（SQLite）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const PORT = 3001;
const DATA_DIR = path.resolve('data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'game.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    score INTEGER NOT NULL,
    found_treasure INTEGER NOT NULL,
    played_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id);
`);

// 預先準備好的 SQL（一律使用參數綁定，避免 SQL injection）
const stmt = {
  findUser: db.prepare('SELECT id, username, password_hash, salt FROM users WHERE username = ?'),
  insertUser: db.prepare('INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)'),
  insertSession: db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  userByToken: db.prepare(
    'SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  ),
  insertGame: db.prepare('INSERT INTO games (user_id, score, found_treasure) VALUES (?, ?, ?)'),
  recentGames: db.prepare(
    'SELECT id, score, found_treasure, played_at FROM games WHERE user_id = ? ORDER BY id DESC LIMIT 20'
  ),
  stats: db.prepare(
    'SELECT COUNT(*) AS total, MAX(score) AS best, COALESCE(SUM(score), 0) AS sum FROM games WHERE user_id = ?'
  ),
};

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  stmt.insertSession.run(token, userId);
  return token;
}

function getToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function currentUser(req) {
  const token = getToken(req);
  return token ? stmt.userByToken.get(token) : undefined;
}

// 允許跨來源呼叫的前端網址：Vercel 正式網址、GitHub Pages，以及同一個 Vercel 帳號下的預覽網址。
// 可用環境變數 CORS_ORIGINS（逗號分隔）額外加入其他來源。
const ALLOWED_ORIGINS = new Set([
  'https://claudecodetreasuregame-initial-cyan-six.vercel.app',
  // GitHub Pages（來源只含網域，不含 /treasure-game/ 路徑）
  'https://fangyukuo.github.io',
  ...(process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
]);
const PREVIEW_ORIGIN = /^https:\/\/claudecodetreasuregame-initial-[a-z0-9]+-mashsrod-9527\.vercel\.app$/;

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || !(ALLOWED_ORIGINS.has(origin) || PREVIEW_ORIGIN.test(origin))) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Chrome 的私有網路存取（公開網站連 127.0.0.1）預檢需要此標頭
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '600');
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Error('payload too large');
  }
  return raw ? JSON.parse(raw) : {};
}

function validateCredentials({ username, password }) {
  if (typeof username !== 'string' || typeof password !== 'string') return '請輸入帳號與密碼';
  const name = username.trim();
  if (name.length < 3 || name.length > 20) return '帳號長度需為 3–20 字';
  if (password.length < 4) return '密碼至少 4 個字';
  return null;
}

const routes = {
  'POST /api/register': async (req, res) => {
    const body = await readJson(req);
    const error = validateCredentials(body);
    if (error) return send(res, 400, { error });
    const username = body.username.trim();
    if (stmt.findUser.get(username)) return send(res, 409, { error: '帳號已存在' });
    const salt = crypto.randomBytes(16).toString('hex');
    const { lastInsertRowid } = stmt.insertUser.run(username, hashPassword(body.password, salt), salt);
    send(res, 201, { token: createSession(Number(lastInsertRowid)), username });
  },

  'POST /api/login': async (req, res) => {
    const body = await readJson(req);
    const error = validateCredentials(body);
    if (error) return send(res, 400, { error });
    const user = stmt.findUser.get(body.username.trim());
    const ok =
      user &&
      crypto.timingSafeEqual(
        Buffer.from(hashPassword(body.password, user.salt), 'hex'),
        Buffer.from(user.password_hash, 'hex')
      );
    if (!ok) return send(res, 401, { error: '帳號或密碼錯誤' });
    send(res, 200, { token: createSession(user.id), username: user.username });
  },

  'POST /api/logout': async (req, res) => {
    const token = getToken(req);
    if (token) stmt.deleteSession.run(token);
    send(res, 200, { ok: true });
  },

  'GET /api/me': async (req, res) => {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: '尚未登入' });
    send(res, 200, { username: user.username });
  },

  'GET /api/games': async (req, res) => {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: '尚未登入' });
    const games = stmt.recentGames.all(user.id).map((g) => ({
      id: g.id,
      score: g.score,
      foundTreasure: g.found_treasure === 1,
      playedAt: g.played_at,
    }));
    const s = stmt.stats.get(user.id);
    send(res, 200, { games, stats: { total: s.total, best: s.best, sum: s.sum } });
  },

  'POST /api/games': async (req, res) => {
    const user = currentUser(req);
    if (!user) return send(res, 401, { error: '尚未登入' });
    const { score, foundTreasure } = await readJson(req);
    if (!Number.isInteger(score)) return send(res, 400, { error: '分數格式錯誤' });
    stmt.insertGame.run(user.id, score, foundTreasure ? 1 : 0);
    send(res, 201, { ok: true });
  },
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return send(res, 404, { error: 'Not found' });
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      send(res, 400, { error: '請求格式錯誤' });
    }
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`API server listening on http://127.0.0.1:${PORT}`);
  });
