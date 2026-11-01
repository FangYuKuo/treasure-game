---
description: 檢查並引導所有前置作業（Git、GitHub CLI、登入、建立 Repo），將本專案部署到 GitHub Pages 並回報網址
argument-hint: "[repo 名稱]（省略時會詢問，預設使用目前資料夾名稱）"
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm run build:*), Bash(npm ci), Bash(npm install), Bash(node --version), Bash(winget:*), Bash(curl:*), PowerShell, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# 部署到 GitHub Pages

請依照以下步驟，把本專案的前端部署到 GitHub Pages，最後給使用者一個可以直接點開的網址。
全程使用繁體中文（台灣用語）回報，每完成一個階段就用一行簡短說明目前進度（例如「✅ 1/7 工具檢查完成」）。

參數：`$ARGUMENTS`（GitHub repo 名稱，可省略）

## 部署方式說明（先讀懂再動手）

- 採用 **GitHub Actions 官方流程**（`actions/upload-pages-artifact` + `actions/deploy-pages`）：原始碼推到 `main`，由 Actions 在雲端執行 `npm ci` 與建置，再發布到 Pages。之後每次 push 到 `main` 都會自動重新部署。
- GitHub Pages 的專案網址是 `https://<帳號>.github.io/<repo>/`，網站位於子路徑，因此 Vite 的 `base` 必須是 `/<repo>/`，否則 JS、CSS、圖片、音效都會 404。
  - **不要修改 `vite.config.ts` 的 `base`**（會讓 Vercel 部署壞掉），改在 workflow 的建置指令以 `npm run build -- --base=/<repo>/` 傳入。
  - 例外：repo 名稱為 `<帳號>.github.io` 時是使用者網站，`base` 為 `/`。
- 本專案建置輸出目錄是 `./build`（不是 `./dist`），上傳 artifact 時要指定 `path: build`。
- 本專案沒有前端路由，不需要處理 SPA 的 404 轉址。

## 原則

- 遇到**需要使用者互動**的步驟（安裝軟體、登入、瀏覽器驗證），**停止並清楚告訴使用者要做什麼**，請他在提示列輸入 `! <指令>` 執行，完成後再重新執行 `/deploy-Github`。不要索取、寫入或印出任何 token。
- **對外動作（建立 repo、push、啟用 Pages）執行前，必須先以 AskUserQuestion 向使用者確認**，並列出將要建立的 repo 名稱、公開／私人、帳號。
- 每個步驟都要先「檢查現況」，已經完成的就略過，讓這個指令可以重複執行（中途失敗後重跑不會出錯）。
- 任何步驟失敗都要停下來回報錯誤原文與建議處理方式，不要硬推下一步。

## 1. 檢查必要工具

依序檢查，缺少的就停止並給出安裝指令：

| 工具 | 檢查指令 | 缺少時請使用者執行 |
|---|---|---|
| Git | `git --version` | `! winget install --id Git.Git -e` |
| GitHub CLI | `gh --version` | `! winget install --id GitHub.cli -e` |
| Node.js 22.13+ | `node --version` | `! winget install --id OpenJS.NodeJS.LTS -e` |

- 安裝 `gh` 後，目前的終端機可能還找不到指令（PATH 尚未更新），請使用者**重新開啟終端機／Claude Code** 後再執行 `/deploy-Github`。
- 若 `node_modules` 不存在，先執行 `npm install`。

## 2. 檢查 GitHub 登入狀態

- 執行 `gh auth status`。
- 未登入：停止，請使用者執行 `! gh auth login`（選 GitHub.com → HTTPS → 以瀏覽器登入），完成後重跑本指令。
- 已登入：用 `gh api user --jq .login` 取得帳號名稱，後續稱為 `<owner>`。
- 確認 token 權限包含 `repo` 與 `workflow`（`gh auth status` 輸出的 Token scopes）。缺少 `workflow` 時無法 push `.github/workflows/`，請使用者執行 `! gh auth refresh -s workflow`。
- 設定 git 使用 gh 的認證：`gh auth setup-git`。

## 3. 檢查 Git 身分設定

- 執行 `git config user.name` 與 `git config user.email`。
- 任一為空時，以 AskUserQuestion 詢問使用者要使用的名稱與 email（可建議用 GitHub 帳號名稱與 `<id>+<owner>@users.noreply.github.com` 隱私信箱，`id` 用 `gh api user --jq .id` 取得），再以 `git config --global` 設定。不要自行編造。

## 4. 準備本機 Git 儲存庫

1. 若目前資料夾還不是 git repo（`git rev-parse --is-inside-work-tree` 失敗），執行 `git init -b main`。
2. 檢查 `.gitignore` 至少包含以下項目（缺少就補上，既有內容保留）：
   - `node_modules/`、`build/`、`data/`（SQLite 資料庫，內含帳號與密碼雜湊，**絕對不能推上去**）、`.env`、`.vercel`
3. 執行 `git status --porcelain` 檢視即將加入的檔案，確認沒有 `data/`、`*.db`、`.env`、`node_modules` 等敏感或大型檔案；若有，先停下來回報。
4. 確認 `package-lock.json` 存在（workflow 使用 `npm ci` 需要它）；不存在就先執行 `npm install` 產生。

## 5. 決定 repo 並建立 Pages workflow

### 5-1. 決定 repo 名稱與可見度

- repo 名稱：優先使用 `$ARGUMENTS`；若已有 `origin` remote（`git remote get-url origin`），從網址解析出既有的 `<owner>/<repo>` 並沿用；都沒有時以目前資料夾名稱為預設值，用 AskUserQuestion 詢問。
- 可見度：以 AskUserQuestion 詢問，**建議 Public**。提醒使用者：免費帳號的 GitHub Pages **只支援公開 repo**，私人 repo 需要 GitHub Pro 以上方案。

### 5-2. 建立 workflow 檔

若 `.github/workflows/deploy-pages.yml` 不存在，建立以下內容（已存在則讀取並確認 `path: build` 與 `--base` 設定正確）：

```yaml
# 推送到 main 時自動建置並部署到 GitHub Pages
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      # 專案網站位於 /<repo>/ 子路徑；<帳號>.github.io 使用者網站則為根路徑
      - name: Build
        run: |
          if [ "${{ github.event.repository.name }}" = "${{ github.repository_owner }}.github.io" ]; then
            npm run build -- --base=/
          else
            npm run build -- --base=/${{ github.event.repository.name }}/
          fi
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 5-3. 本機先模擬建置一次

執行 `npm run build -- --base=/<repo>/`。失敗就停止並回報錯誤，不要推上壞掉的版本。成功後可順便檢查 `build/index.html` 內的資源路徑是否以 `/<repo>/` 開頭。

## 6. 建立 GitHub repo、推送並啟用 Pages

**執行前先以 AskUserQuestion 確認**：「將在帳號 `<owner>` 建立 `<public/private>` repo `<repo>`，推送目前程式碼並啟用 GitHub Pages，是否繼續？」使用者同意才往下做。

1. 提交程式碼（有變更才提交）：
   ```bash
   git add -A
   git commit -m "部署到 GitHub Pages"
   ```
2. 建立 repo 並推送：
   - 尚無 `origin`：先用 `gh repo view <owner>/<repo>` 檢查是否已存在。
     - 不存在：`gh repo create <repo> --public|--private --source=. --remote=origin --push`
     - 已存在：告知使用者，確認要沿用後執行 `git remote add origin https://github.com/<owner>/<repo>.git`，再 `git push -u origin main`。若遠端已有不相關的歷史導致 push 被拒，**不要 force push**，停下來請使用者決定。
   - 已有 `origin`：`git push -u origin main`。
3. 啟用 Pages 並指定由 GitHub Actions 發布：
   - 先查詢：`gh api repos/<owner>/<repo>/pages`
   - 回傳 404（尚未啟用）：`gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`
   - 已啟用但 `build_type` 不是 `workflow`：`gh api -X PUT repos/<owner>/<repo>/pages -f build_type=workflow`
   - 若回傳權限或方案相關錯誤（例如私人 repo 不支援 Pages），停止並說明原因，建議改為公開 repo（`gh repo edit <owner>/<repo> --visibility public --accept-visibility-change-consequences`，需再次向使用者確認）。
4. 因為第一次 push 時 Pages 可能還沒啟用，導致那次 workflow 失敗，啟用後手動觸發一次：`gh workflow run deploy-pages.yml`。

## 7. 等待部署完成並驗證

1. 取得最新一次執行：`gh run list --workflow=deploy-pages.yml --limit 1`，再以 `gh run watch <run-id> --exit-status` 等待（逾時設長一些，例如 10 分鐘）。
2. 失敗時用 `gh run view <run-id> --log-failed` 取得錯誤訊息，分析原因並回報；可修正的問題（例如 workflow 設定錯誤）修正後重新 commit、push。
3. 成功後取得網址：`gh api repos/<owner>/<repo>/pages --jq .html_url`。
4. 用 `curl -sI <網址>` 確認回傳 `200`；再從首頁 HTML 取出一個 `assets/*.js` 路徑用 curl 確認也是 `200`（若 404 代表 `base` 設定錯誤）。剛部署完 CDN 可能需要一兩分鐘才生效，可稍候重試幾次。

## 8. 回報結果

用簡短的格式回報：

1. **網址**：放在最前面，讓使用者可以直接點開（例如 `https://<owner>.github.io/<repo>/`）。
2. repo 網址：`https://github.com/<owner>/<repo>`，以及 Actions 執行頁面連結。
3. 之後更新方式：修改程式碼後 `git push` 到 `main` 即會自動重新部署（或再次執行 `/deploy-Github`）。
4. **已知限制（每次都要提醒）**：GitHub Pages 只有前端靜態檔，線上版會直接連本機後端 `http://127.0.0.1:3001`。要登入、註冊或存遊戲紀錄，必須在**同一台電腦**先執行 `npm run server`，其他人的電腦無法登入。此外 `server.mjs` 的 CORS 白名單目前沒有 GitHub Pages 網域，需加入來源 `https://<owner>.github.io`（注意來源不含 `/<repo>/` 路徑）：可在 `server.mjs` 的 `ALLOWED_ORIGINS` 補上，或啟動時設定環境變數 `CORS_ORIGINS=https://<owner>.github.io`。詢問使用者是否要幫他直接加進 `ALLOWED_ORIGINS`。
