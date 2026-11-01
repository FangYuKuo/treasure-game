---
description: 建置本專案並部署到 Vercel，完成後回報可直接瀏覽的網址
argument-hint: "[prod]（不帶參數為預覽部署，帶 prod 為正式部署）"
allowed-tools: Bash(npm run build), Bash(npx vercel:*), Bash(npx --yes vercel:*), Read, Write, Edit
---

# 部署到 Vercel

請依照以下步驟，把本專案的前端部署到 Vercel，最後給使用者一個可以直接點開的網址。
全程使用繁體中文（台灣用語）回報。

參數：`$ARGUMENTS`
- 空白：預覽部署（Preview），網址每次不同，適合先確認畫面。
- `prod`：正式部署（Production），使用固定的正式網址。

## 1. 確認 Vercel CLI 與登入狀態

- 不需要全域安裝，一律透過 `npx --yes vercel ...` 執行。
- 執行 `npx --yes vercel whoami` 確認是否已登入。
- 若尚未登入：**停止後續步驟**，請使用者在提示列輸入 `! npx vercel login` 完成互動式登入（瀏覽器驗證），登入後再重新執行 `/deploy-Vercel`。不要自行嘗試其他登入方式，也不要索取或寫入 token。

## 2. 確認 `vercel.json`

本專案的建置輸出目錄是 `./build`（不是 Vite 預設的 `./dist`），Vercel 需要明確設定，否則會找不到輸出檔。

- 若專案根目錄沒有 `vercel.json`，建立以下內容：

  ```json
  {
    "framework": "vite",
    "buildCommand": "npm run build",
    "outputDirectory": "build"
  }
  ```

- 若已存在，讀取後確認 `outputDirectory` 為 `build`；其他既有設定保留不動。

## 3. 本機先建置一次

執行 `npm run build`。若失敗，停止部署並回報錯誤訊息，不要把壞掉的版本推上去。

## 4. 部署

- 預覽部署：`npx --yes vercel deploy --yes`
- 正式部署（參數為 `prod`）：`npx --yes vercel deploy --prod --yes`

說明：
- `--yes` 會略過互動式問題；第一次部署時會自動建立並連結 Vercel 專案（產生 `.vercel/` 資料夾）。
- 若 `.gitignore` 中沒有 `.vercel`，請補上一行 `.vercel`，避免把專案連結資訊納入版控。
- 部署指令的標準輸出最後一行就是部署網址（`https://….vercel.app`），請擷取出來。
- 部署時間可能超過 2 分鐘，請把指令逾時設長一些（例如 10 分鐘）。

## 5. 回報結果

用簡短的格式回報：

1. **網址**：放在最前面，讓使用者可以直接點開。正式部署時一併列出正式網域（可用 `npx --yes vercel inspect <部署網址>` 查詢 aliases）。
2. 部署類型（預覽／正式）。
3. **已知限制（每次都要提醒）**：Vercel 上只有前端靜態檔，線上版會直接連本機後端 `http://127.0.0.1:3001`。要登入、註冊或存遊戲紀錄，必須在**同一台電腦**先執行 `npm run server`；其他人的電腦沒有這個後端，所以無法登入。若部署到新的網域，需把該網址加入 `server.mjs` 的 CORS 白名單（或用環境變數 `CORS_ORIGINS`）。
