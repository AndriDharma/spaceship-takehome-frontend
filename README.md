# Logistics Analytics — Frontend

React single-page app for an AI-powered logistics analytics dashboard. It provides the two
interfaces the assignment asks for, side by side: a traditional KPI dashboard, and a
natural-language chat that streams answers, charts and the reasoning behind them.

This document covers the **frontend only**. The API, the SQL generation, the validator and
the forecasting tool are documented in the backend's own README.

---

## 1. What it does

A two-pane layout, no login, no navigation:

| Pane | Contents |
|---|---|
| **Left — chat** | Streamed answer, a collapsible *Analysis process & data* panel, and a *Visualization* button that opens the result on the right. |
| **Right — report** | Three tabs: **Dashboard** (KPIs + the three required charts), **Chart** (the chart chosen for the current answer), **Table** (the rows behind it). |

The Dashboard tab is the landing view, so the descriptive analytics are on screen before
anything is typed. Asking a question switches to Chart automatically when one arrives.

### Stack

| Choice | Version | Why |
|---|---|---|
| React | 18.3 | Requested. No framework on top — there is one screen and no routing. |
| Vite | 6 | Fast dev server, and its proxy removes CORS from local development entirely. |
| Recharts | 2.15 | Declarative React components that map almost 1:1 onto the backend's chart config. |
| react-markdown + remark-gfm | 9 / 4 | The model answers in prose that sometimes contains lists and emphasis. |
| Plain CSS | — | One `src/app.css`. No Tailwind, no CSS-in-JS, nothing to configure. |
| Plain JavaScript | — | No TypeScript. |

---

## 2. Local setup

**Prerequisites:** Node 20 or newer (developed on 24), and the backend running on
`http://127.0.0.1:8080`.

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

No `.env` is needed for local development. The app calls `/api/...` on its own origin and
`vite.config.js` proxies that to the backend, so **there is no CORS configuration in dev**
and the same relative URLs work unchanged in production.

The proxy also forces `cache-control: no-cache, no-transform` on responses, because a
proxy that buffers will hold the whole Server-Sent Events stream and deliver it in one
block at the end — which looks exactly like a backend that does not stream.

### Verifying the connection

The header shows the dataset's date window, read from `GET /api/health` on mount. If that
line is blank, the frontend cannot reach the backend, and nothing else will work either.

---

## 3. Environment variables

### Build-time (the application)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE` | No | Base URL of the backend. **Leave empty for local development** — empty means same-origin, which the Vite proxy handles. |

> **`VITE_API_BASE` is inlined at build time, not read at runtime.** Vite substitutes it
> into the bundle during `npm run build`. Setting it as an environment variable on the
> Cloud Run *service* does nothing at all — the value has to be present when the image is
> built. This is why deployment goes through `cloudbuild.yaml` rather than
> `gcloud builds submit --tag`, which has no way to pass a `--build-arg`.

### Deploy-time (`.env`, read by `deploy.sh`)

Not part of the application — these configure the deployment only.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PROJECT_ID` | Yes | — | GCP project. |
| `REPOSITORY` | Yes | — | Artifact Registry repository. |
| `IMAGE_NAME` | Yes | — | Image name within that repository. |
| `SERVICE_NAME` | Yes | — | Cloud Run service to deploy. |
| `SERVICE_ACCOUNT` | Yes | — | Service account for the build and the service. |
| `BACKEND_URL` | Yes | — | Deployed backend URL. Becomes `VITE_API_BASE` inside the image. |
| `REGION` | No | `asia-southeast2` | |
| `CPU` / `MEMORY` | No | `0.5` / `256Mi` | nginx serving static files computes nothing. |
| `CONCURRENCY` | No | `200` | nginx handles far more than Cloud Run's default 80. |
| `MIN_INSTANCES` / `MAX_INSTANCES` | No | `0` / `5` | Scaling to zero is fine here — see §7. |
| `BACKEND_SERVICE_NAME` | No | — | If set, `deploy.sh` checks whether this origin is in the backend's `CORS_ORIGINS`. |

`BACKEND_URL` is deliberately **not** named `VITE_API_BASE`. That variable is kept empty in
`.env` for local development; if the deploy script read it, it would build a bundle with no
backend URL and every request from the deployed site would 404 against its own origin — a
failure that looks like a broken backend rather than a broken build.

---

## 4. Architecture

```
src/
├── main.jsx              entry point
├── App.jsx               layout, which message the report panel shows, which tab is open
├── api.js                every backend call, and the SSE parser
├── useChat.js            conversation state — the only place messages are mutated
├── useTheme.js           light/dark, following the OS until the user overrides
├── palette.js            chart colours (Recharts needs colour strings, not CSS variables)
├── app.css               all styling; tokens at the top
└── components/
    ├── ChatPanel.jsx     message list, suggestions, composer
    ├── Message.jsx       one turn
    ├── Markdown.jsx      renders the answer text
    ├── AnalysisPanel.jsx the explainability surface (collapsed by default)
    ├── ReportPanel.jsx   the right pane and its three tabs
    ├── Dashboard.jsx     KPIs + the three dashboard charts
    ├── DynamicChart.jsx  the only file that knows about Recharts
    └── DataTable.jsx     the rows behind an answer
```

### Data flow

```
User types
   │
   ▼
useChat.send()  ── appends a user turn and a blank assistant turn ──▶ renders immediately
   │                                                                  (progress can show
   ▼                                                                   before any text)
api.streamChat()  POST /api/chat   fetch + ReadableStream
   │
   ▼
   for each SSE frame ──▶ useChat.handleEvent() ──▶ patches the last message
   │                                                       │
   │                                                       ▼
   │                                              React re-renders
   ▼
App's effect notices the message gained a chart ──▶ selects it, switches to the Chart tab
```

Two properties fall out of this shape:

- **State lives in `useChat`; components only display it.** Nothing fetches except
  `Dashboard`, which loads once on mount. A rendering bug is therefore either in the event
  handling or in the JSX, never in between.
- **The blank assistant turn is created before any bytes arrive**, so the analysis panel can
  show *"Interpreting the question"* while the router is still thinking, rather than leaving
  the pane empty.

### Streaming contract

`POST` carries the question in a body, so the browser's `EventSource` — which is GET-only —
cannot be used. `api.js` reads the response with `fetch` + `ReadableStream` and splits
frames on a blank line. `TextDecoder` is used with `{ stream: true }` so a multi-byte
character split across two network chunks is held back rather than decoded into a
replacement character.

| Event | Effect |
|---|---|
| `start` | Records the turn id. |
| `progress` | Upserts a step row **keyed by step name** — a step re-emits as it changes from *running* to *done*, and both are the same row. |
| `output` | Appends a chunk of answer text. |
| `chart` | Sets the chart config. |
| `chart_skipped` | Records why no chart was drawn. |
| `complete` | The authoritative payload: final answer, rows, and the explain object. |
| `error` / `done` | Ends the turn. |

`complete` never clears a chart that already arrived on the stream. The two should agree,
but a chart the user can already see disappearing at the end of a turn would be the worse
failure.

### Key design decisions

**1. The backend sends a chart *config*, never chart code or an image.**
It returns `{ chartType, xKey, yKeys, seriesKey, stacked, data, headers, columnKinds }`,
already validated against the real column names server-side. `DynamicChart` is the single
component that turns that into Recharts elements — and the AI path, the forecasting tool
and the dashboard all emit the same shape, so **one renderer serves all three**. Adding a
chart type is one `case`, not a new integration.

**2. `seriesKey` is resolved by pivoting in the browser.**
A result with one row per (month, carrier) cannot be plotted directly; Recharts wants one
row per x position with a column per series. `seriesKey` is the backend saying *"the values
in this column are the series"*, and `pivot()` carries that out. Series are ordered by their
total across the whole dataset, so a carrier keeps the same colour regardless of which rows
happen to be on screen.

**3. Colour follows the entity, and slots are never cycled.**
Eight fixed categorical slots from a colourblind-validated palette. A ninth series is not
given a ninth hue — the tail folds into a single grey *"Other"* band, because reusing slot 1
would make two different carriers look like the same one.

**4. No dual-axis charts.**
Two measures on two y-scales is the most common way a chart misleads: the crossover point is
an artifact of the scales, not of the data. The backend only emits six single-axis types, so
this holds on both sides.

**5. Markdown is rendered without raw HTML.**
`react-markdown` ignores HTML in its source unless `rehype-raw` is added, and it is
deliberately not added. The text comes from a language model; a path that lets it emit
markup into the page is a door with no reason to be open. Rendering happens on every
streamed chunk, so a half-written bold marker briefly shows as literal asterisks — which
reads as normal streaming, and avoids the whole answer reflowing in one jump at the end.

**6. The dashboard is a tab, not a route.**
It reuses the tab strip that already exists, so the required KPI dashboard costs no router,
no sidebar and no second layout.

**7. A chart failure never costs the user their answer.**
If the backend skips the chart, the answer still streams and the reason appears as a quiet
note. The Chart tab is disabled rather than showing a broken frame.

**8. Colours live in JS; everything else is a CSS token.**
Recharts needs real colour strings, so `palette.js` holds the mark colours. All other
theming is CSS custom properties in `app.css`, with dark declared under both a
`prefers-color-scheme` media query and `[data-theme]`, so the in-app toggle wins in both
directions.

---

## 5. How the AI layer is surfaced

The frontend interprets nothing. It selects no tools, generates no SQL, and computes no
metric — every number on screen was computed by the backend from the database. What the
frontend is responsible for is making that visible rather than asking the user to take it on
trust.

**Tool selection is shown as it happens.** The backend streams a `progress` row each time
the pipeline advances, and the analysis panel lists them live: *Interpreting the question →
Query tool selected → Validating the query → Running the query → 9 rows returned → Writing
the answer.* A forecast question shows a different second row, so which tool was chosen is
visible without opening anything.

**The analysis panel is the explainability surface** required by §4.4, and carries, for each
answer:

- the tool selected and the router's stated reason
- the exact SQL that ran, after validation
- the source relation, the columns used, the `WHERE` clause and the grouping
- the row count, and whether it was truncated at the row limit
- **the date the relative periods were resolved against** — see Assumptions
- the number of query repair attempts, when there were any
- the forecasting method, on a forecast turn

**The Table tab is the underlying data**, also required by §4.4, and doubles as the
accessibility fallback for the chart: anything colour encodes, the table states in text.

---

## 6. Assumptions and simplifications

- **No authentication.** The assignment does not require it and adding it would only put a
  login between a reviewer and the app.
- **A session is one browser tab.** `crypto.randomUUID()` on mount, held in memory. It exists
  only so the backend can resolve follow-up questions like *"now break that down by region"*
  against the previous turns. Refreshing starts a new conversation.
- **The frontend trusts the backend's validation.** SQL is validated, and the chart config is
  checked against the real column names, server-side. The frontend re-checks neither — it
  would be duplicating a guarantee it cannot enforce anyway.
- **Charts render whatever rows arrive, unfiltered.** Filtering happens in SQL, not in the
  browser.
- **All rows are rendered.** The backend caps a result at its row limit, so the table is
  bounded without needing pagination.
- **English only**, and desktop-first — the layout stacks below 900px but is designed for a
  wide screen.
- **The dashboard loads once.** The dataset is read-only and static; there is nothing to
  refresh.

One assumption is worth stating explicitly because it changes what the numbers mean:

> **"Last month" is relative to the dataset, not to today.** The data ends in December 2025.
> The backend anchors every relative period to the latest `order_date` rather than the
> current date — otherwise the assignment's own example questions would correctly return
> zero rows. The frontend surfaces this in two places: the data window in the header, and
> *"Relative dates resolved against"* in the analysis panel.

---

## 7. Deployment

Deployed as its own Cloud Run service — nginx serving the static build, entirely separate
from the backend service.

```bash
./deploy.sh
```

The script builds through `cloudbuild.yaml`, passing `BACKEND_URL` as the `VITE_API_BASE`
build argument, then deploys. **Changing the backend URL requires a rebuild, not a
redeploy**, for the reason in §3.

`min-instances` defaults to `0` here, which is safe in a way it is not for the backend: an
nginx container with a static bundle cold-starts in about a second, where the backend has to
import LangGraph and the Vertex client before it can answer.

### CORS between the two services

The two services deploy independently, so the backend cannot know this origin in advance.
Without it in the backend's `CORS_ORIGINS`, the page loads and then does nothing — every
request is blocked by the browser.

`deploy.sh` **reports** on this; it does not patch it. An earlier version wrote to the
backend's environment directly and that fought the backend's own deploy script, which
replaces the whole environment from its `.env` — whichever ran last won, so CORS broke on
alternate deploys. The backend's `.env` is the single source of truth; set
`BACKEND_SERVICE_NAME` here only to have the script check whether the value is currently
correct and print the line to paste if not.

---

## 8. Limitations

**Not implemented**

- **The filter controls** shown in the original design (date range, value range, series
  selector). The backend already sends `columnKinds` per column, so the data needed to build
  them is arriving — it was cut for scope, not blocked.
- **Chart revision** — *"make that a bar chart"*, *"split it by region"*. The Regenerate
  button re-runs the same first-chart selection on the same rows; it does not take an
  instruction. This was a deliberate scope decision, and it is why the report panel has no
  input of its own.
- **Query history.** The backend persists every turn and exposes
  `GET /api/chat/session/{id}/history`, but no UI reads it. Reloading loses the conversation.
- **CSV or image export.**
- **Table sorting, pagination or column selection.**
- **Retrying a failed turn.** The error is shown; re-asking means retyping.
- **Tests.** None. Given the time budget this went into making failure paths visible instead
  — every one of them renders a message rather than a blank pane.

**Known rough edges**

- **Stop is client-side only.** It aborts the `fetch`, so tokens stop arriving, but the
  backend finishes the turn and still persists it.
- **A forecast turn's table shows the raw history columns.** The chart is built from
  `month / actual / forecast` while the rows are `month / demand / orders`; `DataTable`
  detects the mismatch and falls back to the row keys, so the table is correct but its
  columns do not match the chart's series names.
- **Very wide results overflow.** The table scrolls horizontally, but a result with many
  columns is not charted at all — the backend's own chartability check rejects it.
- **No virtualisation.** At the backend's row limit this is fine; a much larger limit would
  need it.

---

## 9. Future improvements

Roughly in order of value per hour spent.

1. **Persist the session.** `sessionId` in `localStorage` and a history list rebuilt from the
   existing endpoint — the backend side is already done, so this is frontend-only work and
   removes the most jarring current behaviour.
2. **The filter controls.** `columnKinds` already says which control each column needs: date
   range for `date`, min/max for `number`, multi-select for `category`.
3. **Chart revision.** A small input on the report panel posting an instruction alongside the
   turn id, so *"make it a bar chart"* re-selects rather than re-runs.
4. **Export.** CSV from the table, PNG from the chart.
5. **A real empty and error state per pane**, including a retry button that re-sends the last
   question.
6. **Component tests** for the SSE parser and the `pivot()` function — the two pieces with
   real logic and the two most likely to break silently.
7. **Accessibility pass.** Live-region announcements for streamed answers, focus management
   when the report panel opens, and a full keyboard path through the tabs.
8. **Skeleton loaders** instead of *"Loading dashboard…"*.

---

## 10. AI assistance

This project was built with the help of an AI coding assistant (Claude). It was used for
scaffolding, for the SSE parsing and chart-mapping logic, and for reviewing design decisions.
All architectural choices — the chart-config contract, the two-pane layout, the decision to
keep the dashboard deterministic and model-free — were made and reviewed by me, and every
file has been read and understood.
