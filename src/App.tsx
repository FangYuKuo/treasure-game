import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Button } from './components/ui/button';
import { AuthForm } from './components/AuthForm';
import { GameHistory } from './components/GameHistory';
import * as api from './api';
import closedChest from './assets/treasure_closed.png';
import treasureChest from './assets/treasure_opened.png';
import skeletonChest from './assets/treasure_opened_skeleton.png';
import keyCursor from './assets/key.png';
import chestOpenSound from './audios/chest_open.mp3';
import evilLaughSound from './audios/chest_open_with_evil_laugh.mp3';

interface Box {
  id: number;
  isOpen: boolean;
  hasTreasure: boolean;
}

export default function App() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [score, setScore] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);

  // 登入狀態：authChecked 為 false 時代表還在向伺服器確認既有 token
  const [user, setUser] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [history, setHistory] = useState<api.GameRecord[]>([]);
  const [stats, setStats] = useState<api.GameStats | null>(null);
  const [saveError, setSaveError] = useState('');
  // 避免同一局結束時重複寫入紀錄
  const savedRef = useRef(false);

  const loadHistory = async () => {
    try {
      const data = await api.getGames();
      setHistory(data.games);
      setStats(data.stats);
    } catch {
      // 讀取失敗時保留原本的列表
    }
  };

  // 開啟頁面時以 localStorage 的 token 還原登入狀態
  useEffect(() => {
    api.me().then((name) => {
      setUser(name);
      setAuthChecked(true);
    });
  }, []);

  // 登入後載入紀錄並開新局
  useEffect(() => {
    if (user) {
      loadHistory();
      initializeGame();
    }
  }, [user]);

  // 遊戲結束時把分數寫入資料庫
  useEffect(() => {
    if (!gameEnded || !user || savedRef.current) return;
    savedRef.current = true;
    const foundTreasure = boxes.some(box => box.isOpen && box.hasTreasure);
    setSaveError('');
    api
      .saveGame(score, foundTreasure)
      .then(loadHistory)
      .catch((err) => setSaveError(err instanceof Error ? err.message : '紀錄儲存失敗'));
  }, [gameEnded]);

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    setHistory([]);
    setStats(null);
  };

  const initializeGame = () => {
    // Randomly assign treasure to one box
    const treasureBoxIndex = Math.floor(Math.random() * 3);
    const newBoxes: Box[] = Array.from({ length: 3 }, (_, index) => ({
      id: index,
      isOpen: false,
      hasTreasure: index === treasureBoxIndex,
    }));
    
    setBoxes(newBoxes);
    setScore(0);
    setGameEnded(false);
    setSaveError('');
    savedRef.current = false;
  };

  const openBox = (boxId: number) => {
    if (gameEnded) return;

    // 開啟尚未開啟的箱子時播放音效：寶藏播開箱音效，骷髏播邪惡笑聲
    const targetBox = boxes.find(box => box.id === boxId);
    if (targetBox && !targetBox.isOpen) {
      new Audio(targetBox.hasTreasure ? chestOpenSound : evilLaughSound).play();
    }

    setBoxes(prevBoxes => {
      const updatedBoxes = prevBoxes.map(box => {
        if (box.id === boxId && !box.isOpen) {
          const newScore = box.hasTreasure ? score + 100 : score - 50;
          setScore(newScore);
          return { ...box, isOpen: true };
        }
        return box;
      });
      
      // Check if treasure is found or all boxes are opened
      const treasureFound = updatedBoxes.some(box => box.isOpen && box.hasTreasure);
      const allOpened = updatedBoxes.every(box => box.isOpen);
      if (treasureFound || allOpened) {
        setGameEnded(true);
      }
      
      return updatedBoxes;
    });
  };

  const resetGame = () => {
    initializeGame();
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex items-center justify-center text-amber-700">
        載入中…
      </div>
    );
  }

  if (!user) {
    return <AuthForm onLoggedIn={setUser} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex flex-col items-center justify-center p-8">
      {/* 目前登入的玩家與登出按鈕 */}
      <div className="w-full flex justify-between items-center mb-4 text-amber-900" style={{ maxWidth: '48rem' }}>
        <span>👤 玩家：{user}</span>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          登出
        </Button>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-4xl mb-4 text-amber-900">🏴‍☠️ Treasure Hunt Game 🏴‍☠️</h1>
        <p className="text-amber-800 mb-4">
          Click on the treasure chests to discover what's inside!
        </p>
        <p className="text-amber-700 text-sm">
          💰 Treasure: +$100 | 💀 Skeleton: -$50
        </p>
      </div>

      <div className="mb-8 relative">
        <div className="text-2xl text-center p-4 bg-amber-200/80 backdrop-blur-sm rounded-lg shadow-lg border-2 border-amber-400">
          <span className="text-amber-900">Current Score: </span>
          <span className={`${score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${score}
          </span>
        </div>

        {/* 遊戲結束後依最終分數在分數框右側顯示勝負：正分 Win、負分 Lose、零分 Tie */}
        {gameEnded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-2xl ${
              score > 0 ? 'text-green-600' : score < 0 ? 'text-red-600' : 'text-amber-600'
            }`}
            style={{ left: '100%', marginLeft: '2rem' }}
          >
            {score > 0 ? '🏆 Win!' : score < 0 ? '💀 Lose' : '🤝 Tie'}
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {boxes.map((box) => (
              <motion.div
                key={box.id}
                className="flex flex-col items-center"
                // 滑鼠移到寶箱上時改用鑰匙游標（不論寶箱是否已開啟），圖片無法載入時退回 pointer
                style={{ cursor: `url(${keyCursor}) 24 24, pointer` }}
                whileHover={{ scale: box.isOpen ? 1 : 1.05 }}
                whileTap={{ scale: box.isOpen ? 1 : 0.95 }}
                onClick={() => openBox(box.id)}
              >
                <motion.div
                  initial={{ rotateY: 0 }}
                  animate={{ 
                    rotateY: box.isOpen ? 180 : 0,
                    scale: box.isOpen ? 1.1 : 1
                  }}
                  transition={{ 
                    duration: 0.6,
                    ease: "easeInOut"
                  }}
                  className="relative"
                >
                  <img
                    src={box.isOpen 
                      ? (box.hasTreasure ? treasureChest : skeletonChest)
                      : closedChest
                    }
                    alt={box.isOpen 
                      ? (box.hasTreasure ? "Treasure!" : "Skeleton!")
                      : "Treasure Chest"
                    }
                    className="w-48 h-48 object-contain drop-shadow-lg"
                  />
                  
                  {box.isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="absolute -top-8 left-1/2 transform -translate-x-1/2"
                    >
                      {box.hasTreasure ? (
                        <div className="text-2xl animate-bounce">✨💰✨</div>
                      ) : (
                        <div className="text-2xl animate-pulse">💀👻💀</div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
                
                <div className="mt-4 text-center">
                  {box.isOpen ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                      className={`text-lg p-2 rounded-lg ${
                        box.hasTreasure 
                          ? 'bg-green-100 text-green-800 border border-green-300' 
                          : 'bg-red-100 text-red-800 border border-red-300'
                      }`}
                    >
                      {box.hasTreasure ? '+$100' : '-$50'}
                    </motion.div>
                  ) : (
                    <div className="text-amber-700 p-2">
                      Click to open!
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
      </div>

      {gameEnded && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div className="mb-4 p-6 bg-amber-200/80 backdrop-blur-sm rounded-xl shadow-lg border-2 border-amber-400">
                <h2 className="text-2xl mb-2 text-amber-900">Game Over!</h2>
                <p className="text-lg text-amber-800">
                  Final Score: <span className={`${score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${score}
                  </span>
                </p>
                <p className="text-sm text-amber-600 mt-2">
                  {boxes.some(box => box.isOpen && box.hasTreasure) 
                    ? 'Treasure found! Well done, treasure hunter! 🎉' 
                    : 'No treasure found this time! Better luck next time! 💀'}
                </p>
                {saveError && <p className="text-sm text-red-600 mt-2">⚠️ {saveError}</p>}
              </div>
              
              <Button 
                onClick={resetGame}
                className="text-lg px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white"
              >
                Play Again
              </Button>
            </motion.div>
          )}

      <GameHistory games={history} stats={stats} />
    </div>
  );
}
