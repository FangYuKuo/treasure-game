# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 語言規範

- 與使用者對話、撰寫文件（含本檔）、程式碼註解一律使用**繁體中文（台灣用語）**。
- 程式碼本身的語法、識別字（變數、函式、型別名稱）維持英文。

## 常用指令

```bash
npm install      # 安裝相依套件（node_modules 未納入版控）
npm run dev      # 啟動 Vite 開發伺服器 http://localhost:3000（會自動開啟瀏覽器）
npm run build    # 正式建置，輸出至 ./build（不是 ./dist）
npm run server   # 啟動 SQLite 後端 http://127.0.0.1:3001（需另開終端機，與 dev 同時執行）
```

專案沒有設定測試框架、linter，也沒有 `tsconfig.json`。TypeScript 由 `@vitejs/plugin-react-swc` 直接轉譯、不做型別檢查，因此型別錯誤不會讓建置失敗。驗證後端可直接用 curl 打 `http://127.0.0.1:3001/api/...`（或經 proxy 打 `http://localhost:3000/api/...`）。

### 啟動伺服器的注意事項（Windows）

- 若 3000 已被占用，Vite 會**自動改用下一個 port（3001）**，與後端撞號；啟動前先確認 3000 是否已有本專案的 Vite 在跑（`Get-NetTCPConnection -LocalPort 3000,3001 -State Listen`），有的話直接沿用即可（它會自動重新載入 `vite.config.ts`）。
- 以背景工作執行 `npm run ...` 時，停止工作只會結束 npm 外層，**底下的 node 程序會殘留並繼續占用 port**。背景啟動後端請直接用 `node server.mjs`，或停止後以 PID 確認並結束殘留程序。
- 查看資料庫內容可用 Node 內建模組以唯讀方式開啟：`new DatabaseSync('data/game.db', { readOnly: true })`。

## 架構

以 React 18 + Vite 製作的單頁尋寶遊戲，原始碼由 Figma Make 匯出。

- **所有遊戲邏輯都在 `src/App.tsx`。** 狀態包含 `boxes`（3 個 `Box`，各有 `isOpen`／`hasTreasure`）、`score`、`gameEnded`。`initializeGame()` 隨機將寶藏放進其中一個箱子；`openBox()` 開到寶藏 +100、開到骷髏 −50，找到寶藏或全部箱子都打開時遊戲結束。動畫使用 `motion/react`（Framer Motion）。
- **登入與遊戲紀錄**：未登入時 `App.tsx` 只渲染 `src/components/AuthForm.tsx`（登入／註冊，無訪客模式）。登入後 `gameEnded` 變成 `true` 時會呼叫 `saveGame()` 寫入紀錄（以 `savedRef` 防止同局重複寫入），並由 `src/components/GameHistory.tsx` 顯示最近 20 筆與統計。前端 API 呼叫集中在 `src/api.ts`，token 存在 localStorage（key `treasure_token`），以 `Authorization: Bearer` 傳送。
- **後端 `server.mjs`**：只用 Node 內建模組（`node:http`、`node:sqlite`，需 Node 22.13+），資料庫在 `data/game.db`（已列入 `.gitignore`），表格 `users`／`sessions`／`games` 於啟動時自動建立。密碼以 `scrypt` + salt 雜湊，SQL 一律使用 prepared statement。API：`POST /api/register`、`POST /api/login`、`POST /api/logout`、`GET /api/me`、`GET /api/games`、`POST /api/games`。後端只監聽 `127.0.0.1:3001`，`vite.config.ts` 的 `server.proxy` 也明確指向 `http://127.0.0.1:3001` —— 不要改回 `localhost`，否則 `localhost` 可能解析成 `::1` 而連到其他占用 3001 的程序（曾因此導致 `/api` 回 500）。proxy 僅開發模式有效；正式建置時 `src/api.ts` 會直接連 `http://127.0.0.1:3001`（可用 `VITE_API_BASE_URL` 覆寫），因此部署在 Vercel 的前端只有在**同一台電腦已執行後端**時才能登入。`server.mjs` 以 CORS 白名單（Vercel 正式網址、`-mashsrod-9527.vercel.app` 預覽網址，及環境變數 `CORS_ORIGINS`）允許跨來源呼叫。資料庫中的時間為 SQLite `datetime('now')` 的 UTC 文字，前端顯示時才轉為本地時間。
- **素材**以 ES module 方式 import：圖片在 `src/assets/`（關閉／開啟／骷髏寶箱、`key.png`），音效在 `src/audios/`（`chest_open.mp3`、`chest_open_with_evil_laugh.mp3`）。`src/results/` 存放的是參考截圖，不是執行時用到的素材。
- **`src/components/ui/`** 是 shadcn/ui 風格的元件庫（Radix UI + `class-variance-authority`，`utils.ts` 提供 `cn()` 輔助函式）。目前只用到 `Button`、`Input`、`Label`，其餘為自動產生的元件。
- **`vite.config.ts`** 內有一系列別名，把帶版本號的套件名稱（例如 `'sonner@2.0.3'`）對應到一般套件名稱 —— Figma 產生的 UI 元件就是用這種帶版本號的名稱 import，請保留這些別名。`@` 對應到 `./src`。

## 樣式注意事項

`src/index.css` 是**預先編譯好的 Tailwind v4 輸出檔** —— 專案並未安裝 Tailwind，也沒有建置時產生 CSS 的步驟。只有 `index.css` 裡已存在的 utility class 才有效；新增的 class（例如 `grid-cols-5`、`bg-purple-500`）不會有任何效果，也不會報錯。使用某個 class 前請先在 `src/index.css` 中搜尋確認，否則改用 inline `style` 或手動補上 CSS 規則。`src/styles/globals.css`（主題色票變數）沒有被任何檔案 import。

## 其他

- `Attributions.md` 記錄音效與圖示素材的來源；新增第三方素材時請一併補上出處。
- `README.md` 是本專案搭配的 Claude Code 教學操作腳本（練習題目包含：加入音效、依最終分數顯示勝／平／負、滑鼠移到關閉的寶箱時改用 `key.png` 游標、以 SQLite 實作註冊登入並支援訪客模式、部署用的自訂指令），並非專案說明文件。
