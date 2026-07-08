# 🌿 Ginkgo

## Consistent, Evolving Memory for AI

> **AI shouldn't restart every conversation.**  
> **Ginkgo lets every conversation build on the last one.**

Projects last for months.

Research takes years.

Plans evolve.

Knowledge grows.

But AI conversations often start from zero.

Ginkgo continuously distills conversations into a **consistent, evolving memory**, allowing humans and AI agents to continue thinking across conversations, models, and time.

---

## 為什麼需要 Ginkgo？

同一個 project、research 或 plan，會經過很多次的來回討論。

AI 的上下文遺忘，是一個巨大的痛點。

使用者討厭重複解釋事物。ChatGPT 的「記憶」功能會在所有對話中通用，容易造成跨專案污染。Ginkgo 的做法不是把所有聊天都塞進一個大記憶，而是用 **project_id 隔離**，讓每個專案、研究或規劃擁有自己的記憶。

真正流失的不是聊天紀錄。

真正流失的是累積數週、數月、甚至數年的**理解**。

```text
每一顆銀杏，讓 Agent 記得你
每一次提煉，讓記憶更一致
每一次重啟，讓理解能延續
```

---

## The Core Idea

> **Memory is not storage.**  
> **Memory is understanding that stays consistent and evolves over time.**
>
> **記憶不是儲存。**  
> **記憶是持續演化、保持一致的理解。**

AI does not need to remember every sentence.

AI needs to remember what matters:

- Decisions
- Constraints
- Principles
- Definitions
- Facts
- Open questions
- Risks
- Hypotheses

Ginkgo keeps these through structured distillation.

Instead of saving one snapshot per conversation, Ginkgo maintains a single evolving Project Brain.

---

## Distillation, not Summarization

Ginkgo is not a summary engine.

Summary asks:

> What did we talk about?

Ginkgo asks:

> What does the AI need to remember next time?

| | Summary Engine | Distillation Engine |
|---|---|---|
| Output | Conversation summary | Delta operations: add / update / retire |
| Storage | One snapshot per chat | One evolving Project Brain |
| Continuity | Easy to lose context | Preserves decisions, rationale, and retired ideas |
| Token efficiency | Repeats the whole context | Uses item IDs such as `[D17]` |

Ginkgo is designed to prevent the most annoying AI failure:

> The AI forgets why we rejected something and proposes it again.

---

## How It Works

```text
Conversation
      │
      ▼
Knowledge Distillation
      │
      ▼
Project Brain
      │
      ▼
Next Conversation / Agent
      │
      ▼
Continuous Understanding
```

Each new conversation updates the existing Project Brain instead of creating an isolated summary.

Memory is no longer a snapshot.

It becomes living memory.

---

## Brain 的 8 種知識類型

| Type | Emoji | 解決什麼痛點 |
|---|:---:|---|
| DECISION | ✅ | 已定案的決策，包含為什麼 |
| CONSTRAINT | 🔗 | 外部或技術限制，必須遵守 |
| PRINCIPLE | 🧠 | 團隊慣例、設計原則 |
| DEFINITION | 📖 | 名詞定義 |
| FACT | 📌 | 關於世界、tech stack、使用者的事實 |
| QUESTION | ❓ | 仍待討論、下次必須回來的問題 |
| RISK | ⚠️ | 有時效性的風險 |
| HYPOTHESIS | 🔮 | 未驗證的假設，含 confidence 0-1 |

每條 item 都有 ID，例如 `[D17]`。

下次對話可以直接引用：「關於 D3，我們已經決定……」

這讓 token 用量比完整摘要更低，也讓 AI 更不容易重複犯錯。

---

## Memory-first, Project-safe

每一個 project、research 或 plan 都可以有自己的 Brain。

```text
NUDE
├── Brain
├── History
└── Knowledge Items

Life Blind Box
├── Brain
├── History
└── Knowledge Items

R18
├── Brain
├── History
└── Knowledge Items
```

不同脈絡互不污染。

AI 不需要重新認識你的世界。

---

## Distillation Diary

每次蒸餾都會留下 diary。

它不是黑盒，而是可以檢視的記憶變更紀錄。

```bash
$ distill --verbose
✓ Reading conversation (216 tokens)
✓ Comparing with Brain (0 active items)
✓ Finding repeated decisions (0)
✓ Retiring obsolete — no items to retire
✓ Extracting new principles (4)
✓ Building delta
```

---

## 三個元件

```text
/                          # Next.js 網頁 app + API server
  src/
    app/
      page.tsx             # 雙面板 UI：左側人類側 / 右側 Agent 側
      api/                 # REST API，給擴充與 agent 用
    lib/
      brain.ts             # 8 type 定義 + Protocol 格式化
      distill.ts           # Delta 運算 + ritual 輸出
      auth.ts              # API token 認證
      fetch-conversation.ts # 從 share URL 抓對話
  prisma/schema.prisma     # Project + KnowledgeItem + Pill + DistillationLog

/download/ginkgo-extension/ # Chrome 擴充，獨立專案
  manifest.json
  src/
    content.js             # 注入 🌿 按鈕到 ChatGPT/Claude
    content.css
    background.js
    popup.{html,js,css}    # 擴充設定頁
```

---

## Quick Start

### 1. Server

```bash
git clone https://github.com/Crystal32378/Ginkgo.git
cd Ginkgo

bun install

cp .env.example .env
# 編輯 .env，至少設 GINKGO_API_TOKEN
# 可用 openssl rand -hex 32 產生 token

bun run db:push
bun run dev
```

打開：

```text
http://localhost:3000
```

新增專案，開始蒸餾。

---

### 2. Chrome Extension

1. 開 `chrome://extensions/`
2. 右上角打開「開發人員模式」
3. 點「載入未打包」
4. 選 `download/ginkgo-extension/` 資料夾
5. 點擴充圖示 🌿，填入：
   - **API Base URL**：你的 server 網址
   - **API Token**：你在 `.env` 設的 `GINKGO_API_TOKEN`
   - **預設專案 ID**：點「📋 撈專案」自動帶出
6. 打開 ChatGPT 或 Claude
7. 右下角會出現 🌿 浮動按鈕
8. 點擊後一鍵蒸餾目前對話

---

### 3. Agent Usage

```python
import requests

BASE = "https://your-app.example"
TOKEN = "your_token"
PROJECT_ID = "cm..."

headers = {"Authorization": f"Bearer {TOKEN}"}

# 開新對話前撈 Brain Protocol
brain = requests.get(
    f"{BASE}/api/projects/{PROJECT_ID}/brain?format=protocol",
    headers=headers,
).text

# 把 brain 放到下一次對話或 agent 的 system prompt 開頭
# Brain 自帶 [D1] [C1] 等 ID，可直接引用："關於 D3, ..."

# 對話結束後蒸餾
requests.post(
    f"{BASE}/api/projects/{PROJECT_ID}/distill",
    headers={**headers, "Content-Type": "application/json"},
    json={"conversationText": "..."},
)
```

---

## API Endpoints

所有 `/api/projects/**` 都需帶：

```http
Authorization: Bearer <token>
```

除非 `GINKGO_API_TOKEN` 留空。

同源瀏覽器請求，也就是網頁 UI，會自動放行。

| Method | Path | Description |
|---|---|---|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/{id}` | Get project details |
| DELETE | `/api/projects/{id}` | Delete a project |
| **POST** | **`/api/projects/{id}/distill`** | **Distill conversation and apply delta to Brain** |
| GET | `/api/projects/{id}/brain` | Get Brain as JSON |
| GET | `/api/projects/{id}/brain?format=protocol` | Get Brain Protocol as plain text |
| GET | `/api/projects/{id}/diary` | Get distillation diary |
| GET | `/api/projects/{id}/pills` | List conversation logs |
| GET | `/api/projects/{id}/memory` | Backward compatibility, redirects to brain |
| GET | `/api/import-url?url=...` | Import ChatGPT / Claude share URL |

---

## LLM Backend

| Backend | Setting | Cost | Notes |
|---|---|---|---|
| `zai` | `GINKGO_LLM_BACKEND=zai` | Free | Uses z-ai-web-dev-sdk |
| `openai` | `GINKGO_LLM_BACKEND=openai` + `OPENAI_API_KEY` | GPT-4o-mini 約 $0.005 / 次 | Requires OpenAI-supported region |

$5 USD 的 OpenAI 額度，單人使用大約可以撐 2-8 個月，視對話密度而定。

---

## 分享給朋友

1. 部署 server 到 Vercel / Railway / Fly.io
2. 設 `GINKGO_API_TOKEN`
3. 把 `download/ginkgo-extension/` 打包成 zip 傳給朋友
4. 朋友自己解壓
5. 到 `chrome://extensions/` 載入未打包
6. 填入 API Base URL、token、project ID
7. 開始使用

⚠️ **目前沒有多租戶隔離。**

所有知道 token 的人都能看到所有專案。

如果要嚴格隔離，建議各自部署。

---

## Design Philosophy

### 給人看的，給 AI 看的，分兩層

**人類側**

- 銀杏暖金配色、圓角、emoji
- 今日銀杏卡：stat block + 可展開詳情
- Brain 知識列表：item ID + emoji + rationale

**Agent 側**

- macOS 終端風格 brain.protocol 面板
- mono font + 語法高亮
- amber ID / emerald type / stone rationale
- 一鍵 Copy，貼到 GPT / Claude / Agent

**中間橋梁**

- 蒸餾儀式動畫
- 逐條顯示 LLM 回報的蒸餾步驟

---

## Local-first

- SQLite，不上雲
- 沒有帳號系統
- 你的對話與 Brain 都在自己的機器上

---

## Known Limitations

- ChatGPT share URL 會被 Cloudflare 擋住，server-side 抓不到。請用 Chrome 擴充或手動貼。
- 尚未支援多租戶隔離。
- Claude DOM 結構可能變動，content script 有 fallback，但仍可能需要隨 UI 更新。

---

## Roadmap

- [ ] Chrome 擴充：把 🌿 按鈕搬到對話輸入框旁
- [ ] 主動提醒「該蒸餾了」
- [ ] User Profile 層：記得你這個人，不只是專案知識
- [ ] 從 ChatGPT / Claude 資料匯出匯入
- [ ] MCP server，給 Claude Desktop / Cursor 用
- [ ] Custom GPT Action schema
- [ ] Token-saved 累計 dashboard
- [ ] Brain item reference 關係圖

---

## Vision

AI 不需要無限大的 Context Window。

AI 需要更好的記憶。

不是更多 Storage。

而是更穩定、持續演化的 Understanding。

> **Conversations end.**  
> **Understanding continues.**
>
> **對話會結束。**  
> **理解應該延續。**

---

## 🌿 給 AI 的一顆銀杏

治療的不是 AI 的健忘。

而是人類每天重複解釋同一件事情的疲憊。

銀杏葉象徵記憶力。

科學上銀杏對記憶的療效仍有爭議。

但在這裡，它是一個隱喻：

> 真正的記憶，不是什麼都留下。  
> 而是知道什麼值得留下，並讓理解隨時間長大。

---

## License

MIT

---

## Acknowledgements

Ginkgo started from the very human frustration of discussing the same long-running project with AI, only to watch the context disappear when the conversation restarts.

靈感來自跟 AI 來回討論同一個專案、研究或規劃時的失憶痛點。

> **Every conversation should leave AI a little wiser.**
