# Logistics Analytics — Frontend

React single-page app for an AI-powered logistics analytics dashboard. It provides the two
interfaces the assignment asks for, side by side: a traditional KPI dashboard, and a
natural-language chat that streams answers, charts and the reasoning behind them.

This document covers the **frontend only**. The API, the SQL generation, the validator and
the forecasting tool are documented in the backend's own README.

---

## Table of contents

1. [What it does](#1-what-it-does)
2. [Why this stack](#2-why-this-stack)
3. [Local setup](#3-local-setup)
4. [Environment variables](#4-environment-variables)
5. [Architecture](#5-architecture)
6. [How charts are rendered](#6-how-charts-are-rendered)
7. [How the AI layer is surfaced](#7-how-the-ai-layer-is-surfaced)
8. [Assumptions and simplifications](#8-assumptions-and-simplifications)
9. [Deployment](#9-deployment)
10. [Limitations](#10-limitations)
11. [Future improvements](#11-future-improvements)
12. [AI assistance](#12-ai-assistance)

---

## 1. What it does

A two-pane layout. No login, no sidebar, no navigation — the app opens straight onto the
dashboard with the chat beside it.

| Pane | Contents |
|---|---|
| **Left — chat** | The streamed answer, a collapsible *Analysis process & data* panel, and a *Visualization* button that opens that turn's result on the right. |
| **Right — report** | Three tabs: **Dashboard** (KPIs + the three required charts), **Chart** (the chart chosen for the current answer), **Table** (the rows behind it). |

The Dashboard tab is the landing view, so the descriptive analytics are on screen before
anything is typed. Asking a question switches to the Chart tab automatically when a chart
arrives, and the tab strip is how you get back.

### The three levels of analytics, and where each one lives

The assignment asks for descriptive, diagnostic, and predictive analytics over one dataset.
In this UI they are not three screens:

| Level | Where it appears |
|---|---|
| **Descriptive** — what happened | Dashboard tab. Deterministic SQL, no model involved. |
| **Diagnostic** — why | Chat. Ask a question, get an answer plus a chart plus the query behind it. |
| **Predictive** — what next | Also chat. A forecasting question is routed to a different tool by the backend; the frontend renders its output through the same components. |

---

## 2. Why this stack

**Context worth stating plainly:** my specialisation is AI and backend engineering, not
frontend. The stack below was chosen — on recommendation, and then reviewed and understood
by me — to optimise for a specific thing: *code I can fully explain, in an application that
behaves correctly*, rather than code that looks the most idiomatic to a frontend specialist.

The assignment says it values clarity, correctness and reasoning over completeness and
polish, and asks that tradeoffs be explained rather than hidden. This section is that
explanation.

### The choices

| Layer | Chosen | Why |
|---|---|---|
| Framework | **React 18** | The requirement, and what I would be working in. No meta-framework on top. |
| Build tool | **Vite 6** | One config file, instant dev server, and a dev proxy that removes CORS from local development entirely. |
| Charts | **Recharts 2.15** | Declarative React components that map almost 1:1 onto the backend's chart config. |
| Markdown | **react-markdown + remark-gfm** | The model answers in prose that contains lists and emphasis. |
| Styling | **One plain CSS file** | No build step, no class vocabulary, every rule findable with one search. |
| Language | **Plain JavaScript** | See below. |
| State | **Two custom hooks** | No Redux, no Zustand, no context. |

### Considered and rejected

**Next.js.** It brings server-side rendering, file-based routing, server components and its
own build model. This app has one screen, no routes, no SEO requirement and no server-side
data needs — every meaningful decision is made by the backend. Next would have added
concepts to explain without changing what the app does, and its deployment story fights a
plain static-file container on Cloud Run. Vite produces a `dist/` folder that nginx serves,
which is the simplest correct thing.

**TypeScript.** The genuine argument for it here is the API boundary: typed responses would
catch a misspelled field before runtime, which matters against a streaming API with eight
event types. I chose against it for two reasons. First, under a 6–10 hour budget, adding a
second language to debug — where type errors *block the build* — trades time away from
making the application correct. Second, frontend types would only describe what I *believe*
the backend returns; they can drift from it silently. The real contract is enforced
server-side by Pydantic models, and I would rather have one authoritative definition than
two that can disagree. The cost is real and I am not pretending otherwise: it is listed under
[Future improvements](#11-future-improvements).

**Tailwind, or a component library (MUI / shadcn / Chakra).** A component library would have
produced a better-looking UI faster — that is a real cost I accepted. I chose against it
because a library moves layout decisions behind props I would not be able to justify, and in
a take-home the layout decisions *are* part of what is being assessed. Tailwind was closer
to viable, but it adds a config step and a utility vocabulary to learn, and with a single
stylesheet of this size the benefit is small. Plain CSS with design tokens at the top of the
file means anyone can read exactly what is happening.

**D3, Chart.js, or ECharts.** D3 is the most capable and the wrong shape for this: it is
imperative and DOM-mutating, so inside React it needs refs and lifecycle management, and a
React developer reading it has to context-switch. Chart.js and ECharts are canvas-based —
fast for tens of thousands of points, which is irrelevant at 400 rows, and harder to style
against a CSS-token theme. Recharts renders SVG through React components, so a chart is
ordinary JSX and the theme colours are ordinary props.

**A state library.** There is one screen and one source of truth. `useChat` owns the
conversation, `useTheme` owns light/dark, and props carry the rest. Introducing a store here
would be ceremony around a `useState`.

**A test framework.** Not included, and this is the choice I am least comfortable with. With
the time available I put the effort into making every failure path *visible* instead — every
error state renders a message rather than a blank pane — on the reasoning that for a
reviewer running the app by hand, an app that explains its own failures is worth more than a
test suite they will not run. The two functions that genuinely deserve unit tests are named
in [Future improvements](#11-future-improvements).

### What a frontend specialist would likely do differently

Worth saying directly rather than leaving to be discovered: they would probably reach for
TypeScript, add a component library for consistency, split `app.css` into per-component
modules, and virtualise the table. Each is a reasonable call. None of them changes whether
the application computes and displays the right numbers, which is where I chose to spend the
budget.

---

## 3. Local setup

**Prerequisites**

- Node 20 or newer (developed on 24)
- The backend running on `http://127.0.0.1:8080` — see the backend README

**Run it**

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:5173>.

**No `.env` is needed for local development.** The app calls `/api/...` on its own origin and
`vite.config.js` proxies that to the backend, so there is no CORS configuration in dev, and
the same relative URLs work unchanged once deployed.

The proxy also forces `cache-control: no-cache, no-transform` on responses. A proxy that
buffers will hold the whole Server-Sent Events stream and deliver it in one block at the end
— which looks exactly like a backend that does not stream, and is a confusing thing to debug
from the frontend side.

**Other commands**

```bash
npm run build
```

```bash
npm run preview
```

### Checking the connection

The header shows the dataset's date window, read from `GET /api/health` on mount. If that
line is blank, the frontend cannot reach the backend and nothing else will work either —
check the backend is up before debugging anything in here.

---

## 4. Environment variables

### Build-time (the application)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE` | No | Base URL of the backend. **Leave empty for local development** — empty means same-origin, which the Vite proxy handles. |

> **`VITE_API_BASE` is inlined at build time, not read at runtime.** Vite substitutes it into
> the bundle during `npm run build`. Setting it as an environment variable on the Cloud Run
> *service* does nothing at all — the value has to be present when the image is built.
>
> This is the single most likely way a deployment of this app breaks, and the failure is
> misleading: the site loads, then every request 404s against its own origin, which looks
> like a broken backend rather than a broken build. It is also why deployment goes through
> `cloudbuild.yaml` rather than `gcloud builds submit --tag` — `--tag` has no way to pass a
> `--build-arg`.

### Deploy-time (`.env`, read by `deploy.sh`)

Not part of the application; these configure the deployment only.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PROJECT_ID` | Yes | — | GCP project. |
| `REPOSITORY` | Yes | — | Artifact Registry repository. |
| `IMAGE_NAME` | Yes | — | Image name within that repository. |
| `SERVICE_NAME` | Yes | — | Cloud Run service to deploy. |
| `SERVICE_ACCOUNT` | Yes | — | Service account for the build and the service. |
| `BACKEND_URL` | Yes | — | Deployed backend URL. Becomes `VITE_API_BASE` inside the image. |
| `REGION` | No | `asia-southeast2` | |
| `CPU` | No | `0.5` | nginx serving static files computes nothing per request. |
| `MEMORY` | No | `256Mi` | |
| `CONCURRENCY` | No | `200` | nginx handles far more than Cloud Run's default of 80. |
| `MIN_INSTANCES` | No | `0` | Scaling to zero is safe here — see [Deployment](#9-deployment). |
| `MAX_INSTANCES` | No | `5` | |
| `BACKEND_SERVICE_NAME` | No | — | If set, `deploy.sh` checks whether this origin is in the backend's `CORS_ORIGINS`. |

`BACKEND_URL` is deliberately **not** named `VITE_API_BASE`. That variable is kept empty in
`.env` for local development; if the deploy script read it directly, it would build a bundle
with no backend URL and produce exactly the misleading failure described above.

---

## 5. Architecture

```
src/
├── main.jsx              entry point
├── App.jsx               layout; which message the report shows, which tab is open
├── api.js                every backend call, and the SSE parser
├── useChat.js            conversation state — the only place messages are mutated
├── useTheme.js           light/dark, following the OS until the user overrides
├── palette.js            chart colours (Recharts needs strings, not CSS variables)
├── app.css               all styling; design tokens at the top
└── components/
    ├── ChatPanel.jsx     message list, starter suggestions, composer
    ├── Message.jsx       one turn
    ├── Markdown.jsx      renders the answer text
    ├── AnalysisPanel.jsx the explainability surface (collapsed by default)
    ├── ReportPanel.jsx   the right pane and its three tabs
    ├── Dashboard.jsx     KPIs + the three dashboard charts
    ├── DynamicChart.jsx  the only file that knows about Recharts
    └── DataTable.jsx     the rows behind an answer
```

### Reading order

If you are reviewing this, the four files that carry the actual logic are `api.js` (SSE
parsing), `useChat.js` (state), `DynamicChart.jsx` (chart mapping) and `App.jsx` (wiring).
Everything else is presentation.

### Data flow

```
User submits
   │
   ▼
useChat.send()  ── appends a user turn AND a blank assistant turn ──▶ renders immediately
   │                                                                  so progress can show
   │                                                                  before any text
   ▼
api.streamChat()   POST /api/chat   fetch + ReadableStream
   │
   ▼
for each SSE frame ──▶ useChat.handleEvent() ──▶ patches the last message
   │                                                    │
   │                                                    ▼
   │                                            React re-renders
   ▼
App's effect notices the message gained a chart
   └──▶ selects that message, switches to the Chart tab
```

Two properties fall out of this shape:

- **State lives in `useChat`; components only display it.** Nothing fetches except
  `Dashboard`, which loads once on mount. A rendering bug is therefore either in the event
  handling or in the JSX — never in between. For someone whose depth is not in frontend,
  that narrowing is worth a great deal when something goes wrong.
- **The blank assistant turn is created before any bytes arrive**, so the analysis panel can
  show *"Interpreting the question"* while the router is still thinking, instead of leaving
  the pane empty for a second or two.

### The streaming contract

`POST` carries the question in a body, so the browser's `EventSource` — which is GET-only —
cannot be used. `api.js` reads the response with `fetch` + `ReadableStream` and splits frames
on a blank line.

Two details in that parser are not obvious and both are deliberate:

- `TextDecoder` is used with `{ stream: true }`, so a multi-byte character split across two
  network chunks is held back rather than decoded into a replacement character.
- An aborted request resolves quietly instead of rejecting. A user pressing Stop is not an
  error and should not render one.

| Event | Effect on the current turn |
|---|---|
| `start` | Records the turn id. |
| `progress` | Upserts a step row **keyed by step name** — a step re-emits as it moves from *running* to *done*, and both are the same row, not two. |
| `output` | Appends a chunk of answer text. |
| `chart` | Sets the chart config. |
| `chart_skipped` | Records why no chart was drawn. |
| `complete` | The authoritative payload: final answer, rows, and the explain object. |
| `error` | Renders an error note on the turn. |
| `done` | Marks the turn finished and re-enables the composer. |

`complete` never clears a chart that already arrived on the stream. The two should agree, but
a chart the user can already see disappearing at the end of a turn would be the worse
failure, so the streamed value is kept when `complete` omits one.

The turn is also marked done in a `finally` block, not only on the `done` event — otherwise a
dropped connection would leave the composer disabled with no way to recover.

### Key design decisions

**1. The backend sends a chart *config*, never chart code or an image.**
It returns `{ chartType, xKey, yKeys, seriesKey, stacked, data, headers, columnKinds }`,
already validated against the real column names server-side. `DynamicChart` is the single
component that turns that into Recharts elements — and the AI path, the forecasting tool and
the dashboard all emit the same shape, so **one renderer serves all three**. Adding a chart
type is one branch, not a new integration. This is also what keeps the model away from
anything executable: it chooses a configuration, never markup or code.

**2. The dashboard is a tab, not a route.**
It reuses the tab strip that already exists, so the required KPI dashboard costs no router,
no sidebar and no second layout. It is also the default tab, so a reviewer sees KPIs
immediately.

**3. The chart opens itself, exactly once per chart.**
The effect that switches to the Chart tab is keyed on the message id, not on the message
list. Without that it would fire on every streamed token and drag the user back to the Chart
tab every time they clicked away mid-answer.

**4. A chart failure never costs the user their answer.**
If the backend skips the chart, the answer still streams and the reason appears as a quiet
note. The Chart tab is disabled rather than showing a broken frame. The same holds at the
component level: an unusable config falls back to a plain chart rather than throwing.

**5. Markdown is rendered without raw HTML.**
`react-markdown` ignores HTML in its source unless `rehype-raw` is added, and it is
deliberately not added. This text comes from a language model; a path that lets it emit
markup into the page is a door with no reason to be open. Links are additionally forced to
`target="_blank" rel="noopener noreferrer"`.

Rendering happens on every streamed chunk rather than once at the end. A half-written bold
marker briefly shows as literal asterisks, which reads as normal streaming — and it avoids
the whole answer reflowing in one jump when the turn finishes.

**6. Colours live in JS; everything else is a CSS token.**
Recharts needs real colour strings, so `palette.js` holds the mark colours. All other theming
is CSS custom properties in `app.css`, with dark declared under both a `prefers-color-scheme`
media query and a `[data-theme]` attribute, so the in-app toggle wins in both directions —
including a user choosing light while their OS is dark.

**7. The report header carries no controls.**
The theme toggle floats in that corner. A *Regenerate chart* button previously sat there and
collided with it; rather than reposition one to accommodate the other, the button was removed
— it re-ran the same selection on the same rows, which is not what someone asking to change a
chart actually wants. The endpoint still exists on the backend; see
[Limitations](#10-limitations).

---

## 6. How charts are rendered

`DynamicChart.jsx` is the only file that imports Recharts, and it does three things.

**It maps `chartType` onto a component.** Six types — `line`, `area`, `bar`, `stacked_bar`,
`pie`, `doughnut`. Pie and doughnut take a different shape entirely (one slice per row, no
axes, no grid) and are handled in their own branch.

**It pivots long data into wide data when `seriesKey` is set.** A result with one row per
(month, carrier) cannot be plotted directly — Recharts wants one row per x position with a
column per series. `seriesKey` is the backend saying *"the values in this column are the
series"*, and `pivot()` carries that out. Series are ordered by their total across the whole
dataset, so a carrier keeps the same colour regardless of which rows happen to be on screen.

**It applies the colour and mark rules.** Three of these are worth naming because breaking
them is easy and the result is a chart that misleads rather than one that looks wrong:

- **Colour follows the entity, not its rank.** Slots come from a stable ordering of the full
  series set, so filtering does not repaint the survivors.
- **Slots are never cycled.** Eight fixed categorical colours from a colourblind-validated
  palette. A ninth series is not given a ninth hue — the tail folds into one grey *"Other"*
  band, because reusing slot 1 would make two different carriers look like the same one.
- **No dual-axis charts.** Two measures on two y-scales is the most common way a chart
  misleads: the crossover point is an artifact of the two scales, not of the data. The
  backend only emits six single-axis types, so this holds on both sides.

Smaller things: numbers are abbreviated on axes (`1.5k`, `2.3M`) but shown in full in
tooltips; ISO dates render as `Mar 2025`; a legend appears only when there are two or more
series, since a single series is already named by the chart title; and lines do not connect
across nulls, which is what lets the forecast chart draw history and projection as two
distinct segments of one axis.

---

## 7. How the AI layer is surfaced

The frontend interprets nothing. It selects no tools, generates no SQL, and computes no
metric — every number on screen was computed by the backend from the database. What the
frontend is responsible for is making that visible, rather than asking the user to take it on
trust.

**Tool selection is shown as it happens.** The backend streams a `progress` row each time the
pipeline advances, and the analysis panel lists them live:

> Query tool selected → Query validated → 9 row(s) returned → Answer complete → bar chart ready

A forecasting question shows a different second row, so *which* tool the AI chose is visible
without opening anything.

**The analysis panel is the explainability surface** required by §4.4 of the specification,
and carries, for every answer:

| Field | What it answers |
|---|---|
| Tool selected + reason | Why this computation path |
| Source, columns used | Which metrics and dimensions |
| Filters, grouped by | What was filtered and aggregated |
| Rows returned, truncated | How much data is behind the answer |
| Relative dates resolved against | What "last month" actually meant |
| Query retries | Whether the first attempt failed validation |
| Method | The forecasting method, on a forecast turn |
| Query | The exact validated SQL that ran |

**The Table tab is the underlying data**, also required by §4.4. It doubles as the
accessibility fallback for the chart: anything colour encodes, the table states in text.

---

## 8. Assumptions and simplifications

- **No authentication.** The assignment does not require it, and adding it would only put a
  login between a reviewer and the app.
- **A session is one browser tab.** `crypto.randomUUID()` on mount, held in memory. It exists
  only so the backend can resolve follow-up questions like *"now break that down by region"*
  against previous turns. Refreshing starts a new conversation.
- **The frontend trusts the backend's validation.** SQL is validated and the chart config is
  checked against real column names, server-side. The frontend re-checks neither — it would
  be duplicating a guarantee it cannot enforce anyway.
- **Charts render whatever rows arrive, unfiltered.** Filtering happens in SQL, not in the
  browser, so what is charted always matches what the query returned.
- **All returned rows are rendered.** The backend caps a result at its row limit, so the table
  is bounded without needing pagination.
- **The dashboard loads once.** The dataset is read-only and static; there is nothing to
  refresh.
- **English only**, and desktop-first — the layout stacks below 900px but is designed for a
  wide screen.

One assumption changes what the numbers *mean*, so it is stated explicitly:

> **"Last month" is relative to the dataset, not to today.** The data ends in December 2025.
> The backend anchors every relative period to the latest `order_date` rather than the
> current date — otherwise the assignment's own example questions would correctly return zero
> rows, which would look like a broken app rather than an empty result. The frontend surfaces
> this in two places: the data window in the header, and *"Relative dates resolved against"*
> in the analysis panel.

---

## 9. Deployment

Deployed as its own Cloud Run service — nginx serving the static build, entirely separate
from the backend service.

```bash
./deploy.sh
```

The script reads `.env`, builds through `cloudbuild.yaml` passing `BACKEND_URL` as the
`VITE_API_BASE` build argument, then deploys. **Changing the backend URL requires a rebuild,
not a redeploy**, for the reason in [Environment variables](#4-environment-variables).

`min-instances` defaults to `0` here, which is safe in a way it is not for the backend: an
nginx container with a static bundle cold-starts in about a second, where the backend has to
import LangGraph and the Vertex client before it can answer.

The nginx config caches hashed assets for a year and marks `index.html` as `no-cache` —
without that split, a returning visitor keeps loading the previous build's asset filenames
after a redeploy.

### CORS between the two services

The two services deploy independently, so the backend cannot know this origin in advance.
Without it in the backend's `CORS_ORIGINS`, the page loads and then does nothing — every
request is blocked by the browser.

`deploy.sh` **reports** on this; it does not patch it. An earlier version wrote to the
backend's environment directly, and that fought the backend's own deploy script, which
replaces the whole environment from its `.env` — whichever ran last won, so CORS broke on
alternate deploys. The backend's `.env` is the single source of truth. Set
`BACKEND_SERVICE_NAME` here to have the script check whether the current value is correct and
print the exact line to paste if it is not.

---

## 10. Limitations

### Not implemented

- **Chart filter controls** (date range, value range, series selector). The backend already
  sends `columnKinds` per column, so the data needed to build them is arriving — this was cut
  for scope, not blocked.
- **Chart revision** — *"make that a bar chart"*, *"split it by region"*. A deliberate scope
  decision, and the reason the report panel has no input of its own. The backend does expose
  `POST /api/chart` to re-select a chart for an existing turn, but nothing in the UI calls it:
  re-running the same selection on the same rows is not what someone asking to revise a chart
  wants, and the control competed for the one free corner of the header with the theme toggle.
- **Query history.** The backend persists every turn and exposes
  `GET /api/chat/session/{id}/history`, but no UI reads it. Reloading loses the conversation.
- **CSV or image export.**
- **Table sorting, pagination, or column selection.**
- **Retrying a failed turn.** The error is shown; re-asking means retyping the question.
- **Tests.** None — see [Why this stack](#2-why-this-stack) for the reasoning and the cost.

### Known rough edges

- **Stop is client-side only.** It aborts the `fetch`, so tokens stop arriving, but the
  backend finishes the turn and still persists it.
- **A forecast turn's table shows the raw history columns.** The chart is built from
  `month / actual / forecast` while the rows are `month / demand / orders`; `DataTable`
  detects the mismatch and falls back to the row keys, so the table is correct but its columns
  do not match the chart's series names.
- **Wide results are not charted at all.** The backend's chartability check rejects them
  before spending a model call; the table still shows everything, scrolling horizontally.
- **No virtualisation.** Fine at the backend's row limit; a much larger limit would need it.
- **Long conversations are never trimmed.** Every turn stays mounted. Not a problem at
  demo length, but it grows without bound.

---

## 11. Future improvements

Roughly in order of value per hour spent.

1. **Persist the session.** `sessionId` in `localStorage` plus a history list rebuilt from the
   existing endpoint. The backend side is already done, so this is frontend-only work and it
   removes the most jarring current behaviour — losing a conversation on refresh.
2. **The chart filter controls.** `columnKinds` already says which control each column needs:
   date range for `date`, min/max for `number`, multi-select for `category`.
3. **Chart revision.** A small input on the report panel posting an instruction alongside the
   turn id, so *"make it a bar chart"* re-selects rather than re-runs — and gives the removed
   Regenerate control a reason to exist.
4. **TypeScript on the API boundary.** Types generated from the backend's OpenAPI schema
   rather than hand-written, so there is still one authoritative definition and the frontend
   cannot drift from it. This is the honest answer to the tradeoff taken in
   [Why this stack](#2-why-this-stack).
5. **Export.** CSV from the table, PNG from the chart.
6. **Unit tests for the two functions with real logic** — the SSE frame parser in `api.js` and
   `pivot()` in `DynamicChart.jsx`. Both are pure, both are easy to test, and both would fail
   silently rather than loudly.
7. **A retry button on a failed turn**, re-sending the last question without retyping.
8. **Accessibility pass.** Live-region announcements for streamed answers, focus management
   when the report panel opens, and a full keyboard path through the tabs.
9. **Skeleton loaders** instead of the current *"Loading dashboard…"* text.

---

## 12. AI assistance

This project was built with the help of an AI coding assistant (Claude). It was used for
scaffolding the React application, for the SSE parsing and chart-mapping logic, for the
frontend stack recommendation described in [Why this stack](#2-why-this-stack), and as a
reviewer for design decisions.

All architectural choices — the chart-config contract between the two services, the two-pane
layout, keeping the dashboard deterministic and model-free, and the decision to surface the
backend's reasoning rather than hide it — were made and reviewed by me. Every file in this
repository has been read and is understood; where a decision was made on recommendation
rather than from my own frontend experience, this README says so.
