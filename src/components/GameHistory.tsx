import type { GameRecord, GameStats } from '../api';

interface GameHistoryProps {
  games: GameRecord[];
  stats: GameStats | null;
}

/** 將 SQLite 的 UTC 時間字串轉為本地時間顯示 */
function formatTime(playedAt: string) {
  const date = new Date(playedAt.replace(' ', 'T') + 'Z');
  return isNaN(date.getTime()) ? playedAt : date.toLocaleString('zh-TW', { hour12: false });
}

export function GameHistory({ games, stats }: GameHistoryProps) {
  return (
    <div
      className="w-full p-4 bg-amber-200/80 rounded-xl shadow-lg border-2 border-amber-400 text-amber-900"
      style={{ maxWidth: '32rem', marginTop: '2rem' }}
    >
      <h2 className="text-2xl mb-2 text-center">📜 遊戲紀錄</h2>

      {stats && stats.total > 0 && (
        <div className="flex justify-between text-sm mb-4 px-2">
          <span>總場數：{stats.total}</span>
          <span>最高分：${stats.best ?? 0}</span>
          <span>累計：${stats.sum}</span>
        </div>
      )}

      {games.length === 0 ? (
        <p className="text-sm text-amber-700 text-center">還沒有紀錄，開始你的第一場尋寶吧！</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1 px-2">時間</th>
                <th className="py-1 px-2">結果</th>
                <th className="py-1 px-2" style={{ textAlign: 'right' }}>分數</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id} className="border-b">
                  <td className="py-1 px-2">{formatTime(g.playedAt)}</td>
                  <td className="py-1 px-2">{g.foundTreasure ? '💰 找到寶藏' : '💀 沒找到'}</td>
                  <td
                    className={`py-1 px-2 ${g.score >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    style={{ textAlign: 'right' }}
                  >
                    ${g.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
