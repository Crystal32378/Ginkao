# 🌿 Ginkgo Ginkgo Pharmacy

> 治療 AI 失憶症。一鍵把當前 ChatGPT / Claude 對話存成記憶藥丸，下次開新對話自動注入。

## 痛點

同一個專案來回討論很多次後，AI 會：
- 重新提問已經討論過的事
- 推翻已經定案的決策
- 提議已經被否決過的方向

ChatGPT 的「記憶」功能會跨對話汙染。這個工具用 **project_id 隔離** + **4 段式結構化記憶** 解決這件事。

## 4 段式記憶結構

| 段 | 解決什麼痛點 |
|---|---|
| ✅ 決策 (Decisions) | 已拍板定案 + 為什麼 |
| ⚠️ 開放問題 (Open Questions) | 還沒定、下次必須回來 |
| 📋 行動項 (Action Items) | 誰要做什麼、狀態 |
| 🎯 背景錨點 (Context Anchors) | 為什麼走到這裡 / **已否決的方向** / 重要假設 — 防止 AI「決策漂移」 |

每次新藥丸會**融合上一顆**：新決策推翻舊決策時，舊決策自動搬到 contextAnchors。

---

## 三個元件

這個 repo 包含三個部分：

```
/                          # Next.js 網頁 app + API server
  src/
    app/
      page.tsx             # 網頁 UI（專案管理、煉丹爐、記憶卡檢視、歷史 timeline）
      api/                 # REST API（給擴充與 agent 用）
    lib/
      memory.ts            # 記憶型別 + 格式化記憶卡
      refine.ts            # LLM 萃取邏輯（zai 或 openai backend）
      auth.ts              # API token 認證
      fetch-conversation.ts # 從 share URL 抓對話
  prisma/schema.prisma     # Project + Pill 兩表

/download/ginkgo-extension/ # Chrome 擴充（獨立專案）
  manifest.json
  src/
    content.js             # 注入到 ChatGPT/Claude 頁面
    content.css
    background.js
    popup.{html,js,css}    # 擴充設定頁
```

---

## Server 端安裝

### 1. 設環境變數

編輯 `.env`：

```bash
DATABASE_URL=file:/home/z/my-project/db/custom.db

# API 認證 token — 分享給朋友時必設！
# 產生隨機 token：
#   openssl rand -hex 32
GINKGO_API_TOKEN=your_random_token_here

# LLM backend：'zai' (免費) 或 'openai' (需自備 key)
GINKGO_LLM_BACKEND=openai

# OpenAI 設定（如選 openai）
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

### 2. 初始化資料庫

```bash
bun install
bun run db:push
```

### 3. 啟動 server

```bash
bun run dev
```

預設跑在 `http://localhost:3000`。

### 4. 在網頁 UI 建立第一個專案

打開 `http://localhost:3000` → 「新增專案」→ 取個名字 → 「打開藥櫃」→ 從瀏覽器網址列複製專案 ID（URL 中 `/projects/` 之後那串 `cm...`）。

---

## Chrome 擴充安裝

### 1. 載入未打包擴充

1. 打開 `chrome://extensions/`
2. 右上開啟「開發人員模式」
3. 點「載入未打包」→ 選 `/download/ginkgo-extension/` 資料夾
4. 擴充圖示（🌿）會出現在工具列

### 2. 設定擴充

1. 點擴充圖示 🌿
2. 填入：
   - **API Base URL**：你的 server 網址（例如 `https://your-app.example`）
   - **API Token**：你在 `.env` 設的 `GINKGO_API_TOKEN`
   - **預設專案 ID**：按「📋 撈專案」自動帶出，或手動貼
3. 點「測試連線」確認能通
4. 「儲存」

### 3. 使用

打開 ChatGPT 或 Claude 網頁 → 右下角會出現 🌿 浮動按鈕 → 跟 AI 聊完後點它 → 等約 10-30 秒 → 煉丹完成！

**自動注入**：開新對話時，頁面右上會跳出「銀杏記憶卡已備好」提示，點「注入」就會把記憶卡填到對話第一則訊息。

---

## 分享給朋友

1. **部署 server** 到你的朋友能訪問的網址（Vercel、Railway、Fly.io 都行）
2. **設 `GINKGO_API_TOKEN`** — 一定要設，否則任何人都能讀寫你的記憶
3. **把這三個東西傳給朋友**：
   - Server URL（例如 `https://ginkgo-yourname.fly.dev`）
   - API Token（你設的那個）
   - Chrome 擴充資料夾（`/download/ginkgo-extension/`）— 打包成 zip 傳
4. 朋友自己：
   - 把擴充資料夾解壓縮
   - `chrome://extensions/` → 開發人員模式 → 載入未打包 → 選解壓縮後的資料夾
   - 點擴充圖示填入你給的 URL + Token
   - 在你的 server 上建立他自己的專案（或你幫他建）
   - 把專案 ID 填到擴充設定

⚠️ **目前沒有多租戶隔離** — 所有知道 token 的人都能看到所有專案。如果你想跟朋友「各管各的」，建議：
- 要嘛各自部署一份
- 要嘛未來加上 user 概念（這是 next iteration 的事）

---

## API 端點

所有 `/api/projects/**` 端點都需帶 `Authorization: Bearer <token>` header（除非 `GINKGO_API_TOKEN` 留空）。

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/projects` | 列出所有專案 |
| POST | `/api/projects` | 建立新專案 |
| GET | `/api/projects/{id}` | 取得專案詳情 |
| DELETE | `/api/projects/{id}` | 刪除專案 |
| GET | `/api/projects/{id}/pills` | 列出所有藥丸 |
| POST | `/api/projects/{id}/pills` | 煉丹（body: `{ conversationText }`） |
| DELETE | `/api/projects/{id}/pills/{pillId}` | 刪除藥丸 |
| GET | `/api/projects/{id}/memory` | 取得當前記憶（JSON）|
| GET | `/api/projects/{id}/memory?format=text` | 取得記憶卡純文本 |
| GET | `/api/projects/{id}/memory?format=markdown` | 取得記憶卡 markdown |
| POST | `/api/projects/{id}/rollback` | 回滾到指定藥丸（body: `{ pillId }`）|
| GET | `/api/import-url?url=...` | 從 ChatGPT/Claude share URL 抓對話 |

### 給你的 agent 程式用的範例

```python
import requests

BASE = "https://your-app.example"
TOKEN = "your_token"
PROJECT_ID = "cm..."

# 開新對話前撈記憶卡
headers = {"Authorization": f"Bearer {TOKEN}"}
mem = requests.get(f"{BASE}/api/projects/{PROJECT_ID}/memory?format=text", headers=headers).text
# 把 mem 貼到下次對話的 system prompt 開頭

# 對話結束後存成藥丸
requests.post(
    f"{BASE}/api/projects/{PROJECT_ID}/pills",
    headers={**headers, "Content-Type": "application/json"},
    json={"conversationText": "..."},
)
```

---

## 成本估算

- **zai backend**：免費
- **OpenAI GPT-4o-mini**：一次對話 ~30k tokens 約 $0.005 USD，一個專案來回 50 次約 $0.25 USD
- **本地 SQLite**：零成本

---

## 已知限制

- **ChatGPT share URL** 會被 Cloudflare 防護擋下（HTTP 403）— server-side fetch 抓不到，建議用 Chrome 擴充或手動貼文本
- **Claude share URL** 在 server 所在地區可能不支援（亞洲 region 拿不到）
- **沒有多租戶**：所有專案共用一個 token，朋友之間能互相看到對方的專案
- **沒有帳號系統**：local-first 設計，不適合做 SaaS

---

## 下一步可能

- [ ] 多租戶 / 帳號系統（如果要做 SaaS）
- [ ] 記憶卡 diff 預覽（新藥丸 vs 上顆）
- [ ] Custom GPT Action schema（給 ChatGPT 用的 OpenAPI）
- [ ] Claude MCP server（給 Claude Desktop 用）
- [ ] 擴充支援更多平台（Cursor、Gemini）
