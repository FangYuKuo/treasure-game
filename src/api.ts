// 與 server.mjs 溝通的 API 封裝；登入 token 存在 localStorage
const TOKEN_KEY = 'treasure_token';

// API 位址：開發模式走 Vite proxy（相對路徑）；正式建置（例如部署到 Vercel）直接連本機後端。
// 可用環境變數 VITE_API_BASE_URL 覆寫。
const API_BASE: string =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '' : 'http://127.0.0.1:3001');

export interface GameRecord {
  id: number;
  score: number;
  foundTreasure: boolean;
  playedAt: string; // SQLite datetime('now')，UTC 格式 "YYYY-MM-DD HH:MM:SS"
}

export interface GameStats {
  total: number;
  best: number | null;
  sum: number;
}

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage 無法使用時忽略（例如無痕模式限制）
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(API_BASE + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('無法連線到伺服器，請確認已執行 npm run server');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `伺服器錯誤（${res.status}）`);
  return data as T;
}

export async function register(username: string, password: string): Promise<string> {
  const data = await request<{ token: string; username: string }>('POST', '/api/register', { username, password });
  setToken(data.token);
  return data.username;
}

export async function login(username: string, password: string): Promise<string> {
  const data = await request<{ token: string; username: string }>('POST', '/api/login', { username, password });
  setToken(data.token);
  return data.username;
}

export async function logout(): Promise<void> {
  try {
    await request('POST', '/api/logout');
  } finally {
    setToken(null);
  }
}

/** 以既有 token 還原登入狀態；沒有 token 或已失效時回傳 null */
export async function me(): Promise<string | null> {
  if (!getToken()) return null;
  try {
    const data = await request<{ username: string }>('GET', '/api/me');
    return data.username;
  } catch {
    setToken(null);
    return null;
  }
}

export function getGames() {
  return request<{ games: GameRecord[]; stats: GameStats }>('GET', '/api/games');
}

export function saveGame(score: number, foundTreasure: boolean) {
  return request<{ ok: true }>('POST', '/api/games', { score, foundTreasure });
}
