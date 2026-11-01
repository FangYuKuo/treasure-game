import { useState, type FormEvent } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { login, register } from '../api';

interface AuthFormProps {
  onLoggedIn: (username: string) => void;
}

/** 登入／註冊表單，兩種模式共用同一組欄位 */
export function AuthForm({ onLoggedIn }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const name = isLogin ? await login(username, password) : await register(username, password);
      onLoggedIn(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl mb-4 text-amber-900">🏴‍☠️ Treasure Hunt Game 🏴‍☠️</h1>
      <form
        onSubmit={handleSubmit}
        className="w-full p-6 bg-amber-200/80 rounded-xl shadow-lg border-2 border-amber-400 flex flex-col gap-4"
        style={{ maxWidth: '24rem' }}
      >
        <h2 className="text-2xl text-amber-900 text-center">{isLogin ? '登入' : '註冊新帳號'}</h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="username" className="text-amber-900">帳號</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="3–20 字"
            style={{ backgroundColor: 'white' }}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password" className="text-amber-900">密碼</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            placeholder="至少 4 字"
            style={{ backgroundColor: 'white' }}
            required
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
          {loading ? '處理中…' : isLogin ? '登入' : '註冊並開始遊戲'}
        </Button>

        <button
          type="button"
          className="text-sm text-amber-700 underline cursor-pointer"
          onClick={() => {
            setMode(isLogin ? 'register' : 'login');
            setError('');
          }}
        >
          {isLogin ? '還沒有帳號？立即註冊' : '已有帳號？返回登入'}
        </button>
      </form>
    </div>
  );
}
