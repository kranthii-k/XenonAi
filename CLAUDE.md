# Xenon AI — Full Codebase Documentation

> Last updated: April 2026. Written for any AI assistant working on this repo.
> Read this **entire file** before touching any code.

---

## 1. What This Project Is

**Xenon AI** is a real-time product review intelligence platform. It ingests raw customer reviews (via file upload, paste, or simulated live feed), runs a multi-stage NLP pipeline to extract feature-level sentiment, detects anomalies statistically, forecasts sentiment trajectories using ARIMA, and fires autonomous incident webhooks to n8n when a systemic issue is detected.

**Tech stack at a glance:**
- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5
- **Database**: SQLite via `better-sqlite3`, ORM via `drizzle-orm`
- **ML/NLP**: Python FastAPI server (`ml_server/`) — spaCy + VADER + sklearn
- **Charts**: Recharts
- **Animations**: Framer Motion
- **PDF Export**: jsPDF + jspdf-autotable
- **Styling**: TailwindCSS v4
- **Theme**: Dark/light with `next-themes`, default dark

---

## 2. Running the Project

```bash
# Start Next.js dev server
npm run dev

# Start the Python ML server (separate terminal, from /ml_server)
python app.py
# or: uvicorn app:app --host 0.0.0.0 --port 5000 --reload

# Seed the database with 6 products + 30 reviews each
node scripts/seed-products.js

# Run DB migrations (schema push via Drizzle)
npx tsx push-schema.ts
```

**Important**: The Next.js app works fully without the ML server — it falls back to offline regex heuristics automatically. The ML server enhances quality but is not required.

---

## 3. Project File Map

```
XenonAi/
├── src/
│   ├── app/                        # Next.js App Router pages + API routes
│   │   ├── layout.tsx              # Root layout — Sidebar + theme script
│   │   ├── page.tsx                # Root → redirects to /dashboard
│   │   ├── globals.css             # Global CSS, custom scrollbar, dark variables
│   │   ├── loading.tsx             # Global loading spinner
│   │   ├── upload/page.tsx         # Ingestion Engine UI (file upload / paste)
│   │   ├── dashboard/page.tsx      # Main analytics dashboard
│   │   ├── alerts/page.tsx         # Active anomaly alerts management
│   │   ├── review-queue/page.tsx   # Manual review validation queue
│   │   └── api/
│   │       ├── ingest/
│   │       │   ├── route.ts        # POST /api/ingest — main ingestion entry point
│   │       │   └── status/route.ts # GET /api/ingest/status?job_id= — poll job progress
│   │       ├── features/route.ts   # GET /api/features — feature sentiment aggregation
│   │       ├── trends/route.ts     # GET /api/trends — trend snapshots per batch
│   │       ├── alerts/
│   │       │   ├── route.ts        # GET /api/alerts — fetch all active alerts
│   │       │   └── [id]/route.ts   # DELETE /api/alerts/:id — resolve/dismiss alert
│   │       ├── forecasts/route.ts  # GET /api/forecasts — ARIMA forecast data
│   │       ├── reviews/
│   │       │   ├── queue/route.ts  # GET /api/reviews/queue — sarcastic/ambiguous reviews
│   │       │   └── [id]/resolve/route.ts # PATCH — human override of sentiment
│   │       ├── products/route.ts   # GET /api/products — list all products
│   │       ├── flagged/route.ts    # GET /api/flagged — bot/dup flagged reviews
│   │       ├── feed/route.ts       # GET /api/feed — SSE stream for Ingestion Terminal
│   │       ├── stream/route.ts     # GET /api/stream — SSE stream for Dashboard Terminal
│   │       └── health/n8n/route.ts # GET /api/health/n8n — ping n8n connectivity
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.tsx         # Fixed left nav: Ingestion, Dashboard, Alerts, Review Queue
│   │   ├── dashboard/
│   │   │   ├── LiveTerminal.tsx    # Real-time terminal widget (connects to /api/stream SSE)
│   │   │   └── LiveFeedSimulator.tsx # "Simulate Live Feed" button — POSTs from demo data
│   │   ├── ThemeToggle.tsx         # Sun/moon button, writes to localStorage 'xenon-theme'
│   │   ├── ThemeProvider.tsx       # next-themes wrapper
│   │   └── ui/                     # shadcn/ui components (Card, Badge, Button, Progress, etc.)
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts            # Drizzle DB instance (better-sqlite3, singleton)
│   │   │   └── schema.ts           # All 7 table definitions (see Section 5)
│   │   ├── nlp/
│   │   │   ├── analyzer.ts         # Core NLP + batch pipeline (see Section 7)
│   │   │   ├── dedup.ts            # 3-pass deduplication pipeline (see Section 6)
│   │   │   ├── translator.ts       # Language detection (languagedetect library)
│   │   │   ├── trends.ts           # Rolling window trend computation + Z-score
│   │   │   └── forecaster.ts       # ARIMA M24 sentiment projection
│   │   ├── prompts/
│   │   │   └── extract.ts          # Claude prompt builder for review extraction
│   │   ├── math/
│   │   │   └── arima_engine.ts     # ARIMA/fallback math wrapper
│   │   ├── utils/
│   │   │   ├── cohorts.ts          # Maps review date → cohort label (M1..M24)
│   │   │   ├── export.ts           # jsPDF report generator
│   │   │   └── webhook.ts          # n8n crisis swarm fire-and-forget POST
│   │   ├── demo-data.ts            # 30 curated reviews per product (6 products)
│   │   └── utils.ts                # cn() helper (clsx + tailwind-merge)
│   │
│   └── types/
│       └── index.ts                # Shared TS types: RawReview, AnalyzedReview, Alert, etc.
│
├── ml_server/                      # Python FastAPI NLP server (port 5000)
│   ├── app.py                      # Main FastAPI app — /extract endpoint
│   ├── train.py                    # Train sklearn pipeline → xenon_models.pkl
│   ├── generate_dataset.py         # Synthetic training data generator
│   ├── training_data.json          # ~841KB training corpus
│   ├── xenon_models.pkl            # Trained multi-task sklearn pipeline
│   └── requirements.txt            # spacy, vaderSentiment, scikit-learn, fastapi, uvicorn
│
├── scripts/
│   ├── seed-products.js            # Seeds 6 products + reviews into SQLite
│   ├── migrate-db.js               # Raw SQL schema migration runner
│   ├── direct-analyze.js           # CLI: manually analyze a batch of reviews
│   ├── trigger-analysis.js         # CLI: re-trigger NLP on existing DB reviews
│   └── generate-analytics.js       # CLI: generate trend snapshots without ingestion
│
├── public/
│   └── data/
│       └── demo-smartphones.json   # Static demo dataset (NOT used anymore — replaced by demo-data.ts)
│
├── sqlite.db                       # The live SQLite database
├── drizzle.config.ts               # Drizzle ORM config (points to sqlite.db)
├── push-schema.ts                  # Runs drizzle-kit push to sync schema
└── package.json                    # Dependencies (see Section 4)
```

---

## 4. Key Dependencies

| Package | Purpose |
|---|---|
| `next@16.2.4` | App Router, API routes, SSR |
| `drizzle-orm` + `better-sqlite3` | Type-safe SQLite ORM |
| `framer-motion` | Page/component animations |
| `recharts` | All charts (BarChart, LineChart, AreaChart) |
| `papaparse` | CSV parsing in the ingest API |
| `zod` | JSON payload validation in ingest |
| `languagedetect` | Language detection for reviews |
| `arima` | ARIMA forecasting (JS) |
| `jspdf` + `jspdf-autotable` | PDF export from dashboard |
| `fuzzysort` | Fuzzy search (available, not yet wired to UI) |
| `@anthropic-ai/sdk` | Claude API client (available but ML server is preferred) |
| `lucide-react` | All icons |
| `zustand` | State management (available, not yet wired) |

---

## 5. Database Schema (SQLite via Drizzle)

### `products`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | e.g. `"smartphones"`, `"earbuds"` |
| `name` | TEXT | Display name |
| `launch_date` | TEXT | ISO date — anchor for cohort calculation |
| `category` | TEXT | `"Electronics"` or `"Home Appliances"` |

### `reviews`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `product_id` | TEXT | FK → products |
| `raw_text` | TEXT | **Original unmodified review** |
| `text` | TEXT | Normalised (lowercase, emoji stripped) |
| `created_at` | TEXT | ISO datetime |
| `batch_id` | TEXT | UUID grouping reviews from same upload |
| `detected_language` | TEXT | `"en"`, `"hi"`, `"mixed"`, etc. |
| `language` | TEXT | Confirmed after analysis |
| `translated_text` | TEXT | English translation if non-English |
| `dedup_cluster_id` | TEXT | Links near-duplicate clusters |
| `overall_sentiment` | TEXT | `"positive"` \| `"negative"` \| `"neutral"` \| `"ambiguous"` |
| `confidence` | REAL | 0–1 |
| `is_sarcastic` | BOOLEAN | |
| `is_ambiguous` | BOOLEAN | |
| `cohort` | TEXT | `"M1"` \| `"M3"` \| … \| `"M24"` |
| `days_since_launch` | INTEGER | Calculated from product launch_date |

### `feature_sentiments`
One row per feature extracted from a review.
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `review_id` | TEXT | FK → reviews |
| `feature` | TEXT | e.g. `"battery_life"`, `"build_quality"` |
| `sentiment` | TEXT | `"positive"` \| `"negative"` \| `"neutral"` |
| `confidence` | REAL | |
| `quote` | TEXT | Verbatim snippet from review |

### `flagged_reviews`
Reviews blocked by the dedup pipeline. **Never deleted — audit trail.**
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `original_id` | TEXT | The ID from the original submission |
| `product_id` | TEXT | |
| `batch_id` | TEXT | |
| `raw_text` | TEXT | |
| `flag_reason` | TEXT | `"bot_pattern"` \| `"exact_duplicate"` \| `"near_duplicate"` |
| `dedup_cluster_id` | TEXT | Which cluster this belongs to |
| `similar_to` | TEXT | ID of the review it matched |
| `similarity_score` | REAL | Jaccard score (null for exact dups) |
| `flagged_at` | TEXT | ISO datetime |

### `ingestion_jobs`
Tracks async NLP progress so the UI can poll.
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Job UUID returned immediately to client |
| `product_id` | TEXT | |
| `batch_id` | TEXT | |
| `status` | TEXT | `"queued"` → `"processing"` → `"done"` \| `"error"` |
| `total_received` | INTEGER | Raw count before dedup |
| `total_queued` | INTEGER | After dedup |
| `total_flagged` | INTEGER | Blocked count |
| `total_processed` | INTEGER | How many NLP completed (live progress) |
| `error_message` | TEXT | If status = error |
| `created_at` / `updated_at` | TEXT | |

### `trends`
One row per feature per ingestion batch — written after every `analyzeBatch` call.
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `product_id` | TEXT | |
| `feature` | TEXT | |
| `batch_index` | INTEGER | Unix epoch seconds at write time |
| `negative_pct` | REAL | 0–100 |
| `positive_pct` | REAL | 0–100 |
| `z_score` | REAL | Statistical significance |
| `is_anomaly` | BOOLEAN | True if Z > 1.5 or negPct > 20% |

### `alerts`
Systemic and praise-spike notifications.
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `product_id` | TEXT | |
| `feature` | TEXT | |
| `severity` | TEXT | `"low"` \| `"high"` \| `"critical"` |
| `message` | TEXT | Human-readable explanation |
| `current_pct` | REAL | Current window negative % |
| `previous_pct` | REAL | Previous window negative % |
| `delta` | REAL | Difference |
| `created_at` | TEXT | |

### `feature_forecasts`
Stores ARIMA M24 projection JSON per product+feature. Unique on `(product_id, feature)` so it upserts.
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `product_id` | TEXT | FK → products |
| `feature` | TEXT | |
| `data_json` | TEXT | JSON array: `[{cohort, actual, predicted}]` |
| `last_updated` | TEXT | |

---

## 6. Deduplication Pipeline (`src/lib/nlp/dedup.ts`)

Runs **synchronously** before any NLP, inside `POST /api/ingest`, before the job is even created.

### Step 1 — Text Normalisation (`normalizeText`)
- Lowercase
- Emoji → space (via Unicode range regex)
- Collapse repeated punctuation (`!!!` → `!`)
- Strip non-alphanumeric except space/basic punctuation
- Collapse whitespace

The normalised form is used **only** for hashing and similarity; the raw original is preserved separately.

### Step 2 — Exact Deduplication
- MD5 hash of normalised text
- Reviews with identical hash are grouped
- If same hash appears **≥ 3 times** → ALL copies flagged as `bot_pattern` (entire group blocked)
- If 2 copies → keep representative; flag extras as `exact_duplicate`

### Step 3 — Near-Duplicate Detection (O(n²) Jaccard)
- **Threshold**: 80% word-set overlap = near-duplicate
- Uses Union-Find for clustering
- Within each cluster: keep the **longest** review (most informative), flag the rest as `near_duplicate` with their Jaccard score

**Return**: `{ clean: ProcessedReview[], flagged: FlaggedReview[] }`
- `clean` goes to the NLP pipeline
- `flagged` is persisted to `flagged_reviews` table (never dropped)

---

## 7. NLP Analysis Pipeline (`src/lib/nlp/analyzer.ts`)

Called as `analyzeBatch(clean, jobId)` from the ingest route. Runs **non-blocking** (fire-and-forget with `.catch()`).

### Per-review flow

1. **Cohort lookup** — fetches product's `launch_date` from DB, computes `cohort` (M1–M24) + `daysSinceLaunch`

2. **`analyzeReview(rawText, rawText)`** — tries ML server first, falls back to offline heuristics:
   - **If ML server (`http://127.0.0.1:5000/extract`) is up**: POSTs `{ text }`, gets structured JSON back
   - **If ML server is down**: Uses regex heuristics — matches keywords like `battery`, `camera`, `drain` to features; uses positive/negative keyword lists for overall sentiment

3. **Language detection** (`detectLanguage`) — via `languagedetect` npm package:
   - Explicitly maps Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Punjabi, Gujarati
   - Detects "mixed" (Hinglish / code-switching) if both English and another lang score > 0.15
   - Instructs Claude to "internally translate then analyze" for non-English

4. **Persist to `reviews` table** — `.onConflictDoNothing()` so re-runs are safe

5. **Persist to `feature_sentiments` table** — one row per extracted feature

6. **Update `ingestion_jobs.total_processed`** — after every single review (not just at the end), so the UI progress bar updates in near-real-time

7. **After ALL reviews done**:
   - Calls `updateProductTrends(productId)` → computes rolling Z-score trends → writes to `trends` + `alerts` tables
   - If systemic anomaly detected → calls `triggerCrisisSwarm()` (fire-and-forget webhook to n8n)
   - Calls `Forecaster.updateProductForecasts(productId)` → runs ARIMA → writes to `feature_forecasts`

---

## 8. Python ML Server (`ml_server/`)

**Entry point**: `app.py`, port `5000`

### Endpoint: `POST /extract`
**Input**: `{ "text": "review string" }`
**Output**: Full `ClaudeExtractionResult` shaped JSON

### ML pipeline (multi-task):
Loaded from `xenon_models.pkl` (trained by `train.py`):
1. **Sentiment classifier** — sklearn pipeline → `positive` / `negative` / `neutral`
2. **Sarcasm binary classifier** — sklearn → bool
3. **Ambiguity binary classifier** — sklearn → bool
4. **Feature multi-label classifier** — sklearn MultiLabelBinarizer → set of feature tags

### Feature extraction (grammar-based):
- spaCy dependency parse (`en_core_web_sm`)
- Extracts NOUN tokens with deps `nsubj`, `pobj`, `dobj`
- Finds connected adjectives (`amod`, `acomp`)
- Runs VADER sentiment on the extracted `"noun verb adj"` phrase
- Merges with ML-detected features (deduplicating by feature name)

### Fallback (if `xenon_models.pkl` missing):
- Pure VADER on full text for overall sentiment
- Sarcasm heuristic: if sentence-level scores span `[-0.5, +0.5]`
- Ambiguity heuristic: if VADER neutral score > 0.8

---

## 9. Trend Analysis (`src/lib/nlp/trends.ts`)

Called inside `updateProductTrends()` after each `analyzeBatch`. Takes the last 150 reviews for a product.

### Algorithm
- **Current window**: last 50 reviews
- **Previous window**: reviews 51–100
- For each unique feature across both windows:
  - Compute `currentNegPct` and `previousNegPct` (fraction of reviews mentioning feature negatively)
  - Same for positive
  - Z-score: `delta / stderr` where `stderr = sqrt(p*(1-p)/N)`
  - **Anomaly** if: Z > 1.5 OR deltaNeg > 15% OR currentNeg > 20%
  - **Issue types**: `systemic` (uniqueUsers ≥ 1 and Z > 1.5 or negPct > 20%), `emerging` (delta > 5%), `praise_spike` (delta positive > 10%), `isolated`

### Alert generation
- `systemic` → writes `severity: "critical"` or `"high"` alert + triggers crisis webhook
- `praise_spike` → writes `severity: "low"` alert
- Results sorted by `delta_negative` descending

---

## 10. Forecasting (`src/lib/nlp/forecaster.ts`)

Called after every `analyzeBatch`, per product.

1. Fetches all distinct features for the product from `feature_sentiments`
2. For each feature:
   - Aggregates average positive sentiment per cohort (`M1`, `M3`, `M6`, `M9`, `M12`, `M18`, `M24`)
   - Aligns to `COHORT_MAP` — fills nulls with last known value (baseline: 75%)
   - Determines how many future cohort steps to predict
   - Runs `ArimaEngine.forecast(series, steps, labels)`
   - Persists result to `feature_forecasts` with `onConflictDoUpdate` (upsert by product+feature)

### Cohort system (`src/lib/utils/cohorts.ts`)
| Label | Day range from launch |
|---|---|
| M1 | 0 – 45 days |
| M3 | 46 – 135 days |
| M6 | 136 – 225 days |
| M9 | 226 – 315 days |
| M12 | 316 – 405 days |
| M18 | 406 – 585 days |
| M24 | 586+ days |

---

## 11. Crisis Swarm Webhook (`src/lib/utils/webhook.ts`)

**Fire-and-forget** — never blocks the main pipeline.

1. Fetches the 5 most recent negative quotes for the affected feature from DB
2. POSTs to `process.env.N8N_WEBHOOK_URL` (default: `http://localhost:5678/webhook/crisis-swarm`)
3. Payload: `{ product_id, feature, alert_message, recent_negative_quotes }`
4. Timeout: 3 seconds via `AbortSignal.timeout(3000)` — failure is silently warned, not thrown

---

## 12. API Routes Reference

### `POST /api/ingest`
**FormData fields**: `file` (CSV/JSON), OR `text` (newline-separated), plus optional `product_id`

1. Parses input → builds `InputReview[]`
2. Runs `runDeduplicationPipeline()` synchronously
3. Persists flagged reviews
4. Creates `ingestion_job` record (status: `queued`)
5. Fires `analyzeBatch()` non-blocking
6. Returns immediately: `{ job_id, batch_id, total_received, queued_for_analysis, flagged }`

CSV parsing uses `PapaParse` with smart column detection — looks for columns named: `text`, `review`, `review_text`, `content`, `body`, `comment`, `feedback`.

JSON parsing validated via Zod — accepts `ReviewObject[]` or `{ reviews: ReviewObject[] }`.

### `GET /api/ingest/status?job_id=`
Returns live job progress from `ingestion_jobs` table. The client polls this every 2 seconds.
```json
{ "status": "processing", "progress_pct": 45, "total_processed": 9, "queued_for_analysis": 20 }
```

### `GET /api/features?product_id=`
Aggregates from `feature_sentiments` + `reviews`. Groups by feature, counts positive/negative/neutral, computes `global_sentiment_score`.

### `GET /api/trends?product_id=`
Returns all rows from `trends` table, ordered by `batch_index ASC` (after reversing the `DESC` query). **Each row is one feature for one batch** — the dashboard groups these by `batchIndex` and averages across features to get one chart point per batch.

### `GET /api/alerts?product_id=`
Returns all rows from `alerts` table (optionally filtered by product).

### `DELETE /api/alerts/:id`
Deletes the alert (resolved/dismissed).

### `GET /api/forecasts?product_id=&feature=`
Returns from `feature_forecasts`, parses `data_json` back to array. Returns `[{ feature, data: [{cohort, actual, predicted}] }]`.

### `GET /api/reviews/queue`
Returns reviews where `is_sarcastic = true OR is_ambiguous = true` for human review.

### `PATCH /api/reviews/:id/resolve`
Body: `{ newSentiment: "positive"|"negative"|"neutral" }`. Updates `overall_sentiment` in `reviews` table.

### `GET /api/feed` (SSE)
Server-Sent Events stream. Sends recently ingested reviews. Used by the **Ingestion page terminal**.

### `GET /api/stream` (SSE)
Server-Sent Events stream. Used by the **Dashboard LiveTerminal**. Polls DB every 2 seconds and emits new reviews and flagged items.

### `GET /api/health/n8n`
Pings `http://localhost:5678` to check if n8n is running. Returns 200 if reachable, 503 otherwise.

---

## 13. Pages

### `/upload` — Data Ingestion Engine
- **File upload**: drag-and-drop or click, accepts `.csv` and `.json`
- **Paste mode**: textarea, one review per line
- **Product selector**: dropdown (6 products, grouped by category)
- Submits to `POST /api/ingest`, shows immediate dedup stats
- Polls `/api/ingest/status?job_id=` every 2s, shows a live progress bar
- Live Ingestion Terminal: SSE from `/api/feed` — shows each review as it's processed with colour-coded sentiment

### `/dashboard` — Xenon Intelligence
- **Category + Product filter**: pill selectors; "All" shows aggregate across all products
- **4 metric cards**: Analyzed Reviews, Avg Sentiment, Active Alerts, Negative Rate
- **Sentiment by Feature** (bar chart): stacked positive/neutral/negative per feature, from `/api/features`
- **Systemic Alerts feed**: from `/api/alerts`, shows severity badge + message
- **Negative Sentiment Trend** (line chart): one data point per ingestion batch (aggregated across features), from `/api/trends`
  - Anomaly batches rendered with red dot + halo
  - Grid lines, Y-axis `domain=[0, 'auto']`
  - Tooltip shows "⚠ Anomaly" on flagged batches
- **Lifecycle Forecast M24** (area chart): only shown when a product is selected; fetches top feature's ARIMA forecast from `/api/forecasts`
- **Product Overview Grid**: shown when "All Products" — click any product tile to filter
- **LiveTerminal**: SSE from `/api/stream` — real-time ingestion feed
- **Simulate Live Feed button**: see Section 14
- **Export PDF**: calls `generateReport()` from `src/lib/utils/export.ts`
- Polling: full `fetchData()` called every 10 seconds

### `/alerts` — Active Anomalies
- Shows all alerts from `/api/alerts` (no product filter — all products)
- Auto-refreshes every 5 seconds
- "Mark Resolved" calls `DELETE /api/alerts/:id`
- Empty state: "Systems Nominal" with green shield icon

### `/review-queue` — Manual Review Validation
- Shows reviews flagged as sarcastic or ambiguous from `/api/reviews/queue`
- Human can override sentiment: Positive / Negative / Neutral
- `PATCH /api/reviews/:id/resolve` updates the DB
- After override, card slides out (Framer Motion `AnimatePresence`)

---

## 14. Live Feed Simulator (`src/components/dashboard/LiveFeedSimulator.tsx`)

The "Simulate Live Feed" button on the dashboard header.

**Previous behaviour (broken)**: fetched from `/public/data/demo-smartphones.json`, always sent to `product_id = "smartphones"`. Both values were hardcoded.

**Current state**: Still points to the static file. **TODO — fix needed**: The `LiveFeedSimulator` should accept `productId` as a prop from `dashboard/page.tsx` (passing `selectedProductId`) and pull review texts from `src/lib/demo-data.ts` via a `/api/demo-reviews?product_id=` endpoint instead of the static file.

**`src/lib/demo-data.ts`** — already created, contains 30 curated reviews per product for all 6 products: `smartphones`, `earbuds`, `laptops`, `geyser`, `refrigerator`, `microwave-oven`.

---

## 15. Theme System

- Default: **dark mode**
- Toggle: `ThemeToggle` component writes `"xenon-theme"` key to `localStorage` (`"light"` or `"dark"`)
- A `<script>` tag in `layout.tsx` injected via `dangerouslySetInnerHTML` runs **before React hydrates** to set `document.documentElement.classList` from `localStorage` — prevents white flash on reload
- CSS variables defined in `globals.css` under `.dark` and `:root` classes

---

## 16. Product Catalog

Six products seeded by `scripts/seed-products.js`, hardcoded in `PRODUCT_CATALOG` in `dashboard/page.tsx`:

| ID | Name | Category | Icon |
|---|---|---|---|
| `smartphones` | Smartphones | Electronics | `Smartphone` |
| `earbuds` | Earbuds | Electronics | `Headphones` |
| `laptops` | Laptops | Electronics | `Laptop2` |
| `geyser` | Geyser | Home Appliances | `Flame` |
| `refrigerator` | Refrigerator | Home Appliances | `Refrigerator` |
| `microwave-oven` | Microwave Oven | Home Appliances | `Microwave` |

---

## 17. Known Issues & TODOs

| Area | Issue |
|---|---|
| `LiveFeedSimulator` | Still hardcodes `product_id = "smartphones"` and reads from static file. Must be refactored to accept `selectedProductId` prop and call a `/api/demo-reviews` endpoint. `src/lib/demo-data.ts` is ready, the endpoint and prop wiring are not yet done. |
| `review-queue` | `r.originalText` is used but the schema column is `raw_text`. The API may need to return `rawText` explicitly or the UI falls back to `r.text`. |
| `automation/` | A page route directory exists at `src/app/automation/` but was not explored — may be WIP. |
| `fuzzysort`, `zustand` | Both are installed but not wired to the UI yet. |
| `@anthropic-ai/sdk` | Installed. The prompt builder in `src/lib/prompts/extract.ts` exists but the Claude API call path in `analyzer.ts` was replaced by the local ML server. Could be re-enabled as tertiary fallback. |
| Near-duplicate O(n²) | The Jaccard comparison in `dedup.ts` is O(n²) — fine at ≤ 500 reviews but will slow down at scale. |

---

## 18. Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `N8N_WEBHOOK_URL` | `http://localhost:5678/webhook/crisis-swarm` | n8n auto-response webhook target |
| `ANTHROPIC_API_KEY` | *(none set)* | Claude API — not currently used in hot path |

---

## 19. Scripts Directory

| Script | Purpose |
|---|---|
| `seed-products.js` | Inserts 6 products + ~30 reviews each into SQLite. Safe to re-run — uses `INSERT OR IGNORE` and skips products already having reviews. |
| `migrate-db.js` | Raw SQL `CREATE TABLE IF NOT EXISTS` — the manual migration equivalent of Drizzle push. |
| `direct-analyze.js` | CLI tool — reads existing DB reviews and runs `analyzeBatch` on them directly (bypasses ingest). Useful for re-analysis. |
| `trigger-analysis.js` | Simple HTTP POST to `/api/ingest` with a hardcoded payload for quick testing. |
| `generate-analytics.js` | Generates trend/alert snapshots from existing DB state without new ingestion. |
| `generate-seed.ts` | TypeScript version of seed generation logic. |
| `setup-layer3.ts` / `test-layer3.ts` | Appear to be test scaffolding for the crisis swarm layer. |
| `verify-db.ts` | Quick DB health check — prints table row counts. |

---

## 20. Data Flow Diagram

```
User submits reviews (file / paste / simulator)
          │
          ▼
POST /api/ingest
          │
          ├─→ PapaParse / Zod validation
          │
          ├─→ runDeduplicationPipeline() [SYNC]
          │       ├─ normalizeText → MD5 hash
          │       ├─ Exact dedup (bot pattern if ≥3)
          │       └─ Jaccard near-dedup (80% threshold)
          │
          ├─→ INSERT flaggedReviews (audit trail)
          │
          ├─→ INSERT ingestionJob (status: queued)
          │
          └─→ analyzeBatch() [ASYNC / non-blocking]
                    │
                    ├─ For each clean review:
                    │     ├─ getCohortAndDays()
                    │     ├─ analyzeReview() → ML server (port 5000) OR regex fallback
                    │     ├─ INSERT reviews
                    │     ├─ INSERT feature_sentiments
                    │     └─ UPDATE ingestionJobs.total_processed
                    │
                    ├─ updateProductTrends()
                    │     ├─ computeRollingTrends() → Z-score per feature
                    │     ├─ INSERT trends
                    │     ├─ INSERT alerts (if anomaly)
                    │     └─ triggerCrisisSwarm() [fire-and-forget → n8n webhook]
                    │
                    └─ Forecaster.updateProductForecasts()
                          ├─ Aggregate per cohort
                          ├─ ArimaEngine.forecast()
                          └─ UPSERT feature_forecasts

UI polling (every 10s):
  /api/features → BarChart
  /api/trends   → LineChart (grouped by batchIndex, averaged across features)
  /api/alerts   → Alert feed
  /api/forecasts → AreaChart (top feature, product-specific)

SSE streams (continuous):
  /api/stream → LiveTerminal (dashboard)
  /api/feed   → Live Ingestion Terminal (upload page)
```
