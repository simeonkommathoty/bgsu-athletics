# BGSU Athletics — Architecture Map

A guide for a developer who did not write this code. It describes the repository as it exists in Git on branch `feature/sport-portal`. Facts were taken from the source, the `package.json` scripts, the tests and the existing README / AGENTS / HANDOVER files. Items I could not confirm are marked **UNRESOLVED** with the file to read.

No keys, URLs, athlete records or private configuration appear here. Function names are cited instead of line numbers, because line numbers go stale.

## 0. Contents

1. [Big picture](#1-big-picture)
2. [Quick reference: "I want to change X"](#2-quick-reference)
3. [Sports Home portal](#3-sports-home-portal)
4. [Hockey layout](#4-hockey-layout)
5. [Hockey's 12 sidebar features](#5-hockey-sidebar-features)
6. [Hockey services](#6-hockey-services)
7. [Volleyball layout](#7-volleyball-layout)
8. [Volleyball's 11 sidebar features](#8-volleyball-sidebar-features)
9. [Volleyball services](#9-volleyball-services)
10. [Demo Mode and synthetic fixtures](#10-demo-mode-and-synthetic-fixtures)
11. [Supabase authentication and persistence (Live mode)](#11-supabase-authentication-and-persistence)
12. [Tests and build configuration](#12-tests-and-build-configuration)
13. [Unresolved items](#13-unresolved-items)

---

## 1. Big picture

Three independent Vite + vanilla-JS (ES modules) projects live in one repository. There is no React, no TypeScript and no shared code folder.

| Project | Folder | Role |
|---|---|---|
| Sports Home portal | repo root (`index.html`, `src/`, `tools/`, `tests/`) | A page of cards linking to each sport. No login, no athlete data. |
| Hockey app | `hockey/` | Own `package.json`, tests, build and Supabase project. 12 sidebar features. |
| Volleyball app | `volleyball/` | Same architecture as Hockey. 11 sidebar features (no Progress Tracking). Separate Supabase project. |

The two sport apps are deliberately separate copies. A fix in one is **not** applied to the other automatically.

How a sport app starts (the same in both):

1. `src/main.js` calls `startApplication()` in `src/application.js`.
2. `createLayout` (`src/layout/layout.js`) injects `src/layout/shell.html` into `#hockey-app` (or `#volleyball-app`).
3. `application.js` inserts the login/reset overlays (`services/authentication/authentication.html`) and the import dialog (`services/import/import.html`) into `document.body`.
4. `createServices` (`services/context.js`) builds one `context.api` object. It merges the exports of every service listed in `services/modules.js`.
5. `import.meta.glob` finds every `features/*/registration.js`, and `discoverFeatures` (`layout/feature-loader.js`) validates them and sorts them by `order`. The sidebar is built from that list.
6. After the layout starts, `application.js` boots either Demo Mode (`context.api.demoMode` true → `startDemo()`) or Live mode (`bootSupabase()`).

Data flows through `context.api`. Services read and write shared state such as `ATHLETES`, `SESSIONS` and `CH` (chart registry) through it. Features call services through it, and nothing is a `window` global. Inline HTML handlers use `data-onclick="fn()"` attributes. `layout/events.js` parses them with Acorn and calls the named `context.api` function. It does not use `eval`.

Each feature renders inside a Shadow DOM root (`layout/feature-runtime.js`). Global CSS (`styles/reference.css`) plus the feature's own CSS are copied into that root.

Two origins of code are important:

- Most service and feature code was extracted from the original single-file HTML dashboards. Comments such as `// Reference: originals/hockey.html:NNNN` point back to them. `originals/` is Git-ignored (local only). The tests treat those files as the behavioural oracle.
- `tools/extract-reference.mjs` produced that extraction. **Do not re-run it.** It overwrites later hand edits (`hockey/AGENTS.md`, `hockey/HANDOVER.md`).

Hand-edited behaviour that diverges from the originals (documented in the HANDOVER files):
- Hockey password-reset redirect.
- Profile and Compare missing-data handling.
- Demo Mode.
- Sports Home links.

---

## 2. Quick reference

Run commands from the folder shown. Windows PowerShell users: `npm.cmd`. Parity-based tests need `originals/hockey.html` and `originals/volleyball.html` locally (see §12).

| I want to change… | Edit this | Then run |
|---|---|---|
| A site-wide colour / font (Hockey) | `hockey/src/styles/reference.css` (`:root` CSS variables such as `--orange`, `--bg`) | `cd hockey && npm run build`; look at it in `npm run dev`. `npm run test:browser` may flag text/chart-colour diffs (see note below the table). |
| A site-wide colour (Volleyball) | `volleyball/src/styles/reference.css` | `cd volleyball && npm run build && npm run test:browser` |
| One feature's look only | `<sport>/src/features/<id>/<id>.css` | Same as above |
| A chart's colour for a metric | `color` in the `ALL_METRICS` entry in `<sport>/src/services/scoring/composite.js` (tier colours: `TIER_COLORS` there) | `npm run test:browser` (compares chart colours with the original; intended divergence will fail it, see note) |
| Add / remove / reorder a sidebar entry | Create or delete `<sport>/src/features/<id>/` (needs `registration.js` + `feature.js` + html/js/css/test). Order and group come from `order` and `section` in `registration.js`. **No layout edit.** | `npm test && npm run test:browser` in that sport. `integrity.test.js` expects the original sidebar entries. |
| Rename a sidebar label | `label` / `title` in `<sport>/src/features/<id>/registration.js` | `npm test`, then `npm run test:browser` (compares page text). |
| Change a sidebar icon | `icon` (an inline SVG string) in that `registration.js` | `npm run build` |
| A scoring formula (composite score) | `calcCompositeVB` in `<sport>/src/services/scoring/composite.js` | `cd <sport> && npm test` (`tests/scoring.test.js` compares 1,479 cases to the original) |
| Norm tables / tier thresholds | `NORMS`, `calcTier` in `composite.js` | `npm test` |
| Radar-chart scoring | `radarNorm` and friends in `<sport>/src/services/scoring/radar.js` | `npm test` (scoring.test.js "radar") |
| Readiness scoring | `computeTeamReadiness` and the `READINESS_*` constants in `<sport>/src/services/scoring/readiness.js` | `npm test` |
| Outlier rejection ranges | `FP_HARD_RANGES`, `isOutlier` in `<sport>/src/services/scoring/outliers.js` | `npm test` |
| A chart in one feature | The `new Chart(...)` calls in `<sport>/src/features/<id>/<id>.js`. Canvas element: the feature's `.html`. | `npm run test:browser` (`HOCKEY_FEATURE=<id>` or `VOLLEYBALL_FEATURE=<id>` limits the run to one feature) |
| An import column / alias | `COL_ALIASES` and the per-source parsers in `<sport>/src/services/import/import.js`. Help text: `SRC_INFO` in the same file. Dialog markup: `import.html` | `npm test` (`tests/data.test.js` import characterisation) then `npm run test:browser` |
| Persisted athlete columns | `DB_FIELDS` in `<sport>/src/services/data/persistence.js` (and the matching Supabase table, outside this repo) | `npm test` (data.test.js "database mapping") |
| A demo fixture (athletes, sessions) | `<sport>/src/services/demo/demo-data.js` | `cd <sport> && npm test` then `npm run test:demo` |
| What Demo Mode blocks or fakes | `<sport>/src/services/demo/demo-backend.js` | `npm test` (demo.test.js) and `npm run test:demo` |
| Demo banner / entry / exit behaviour | `<sport>/src/services/demo/demo.js` | `npm run test:demo` |
| The login screen text or layout | `<sport>/src/services/authentication/authentication.html` | `npm run test:demo` (clicks it) and `npm run test:browser` |
| Login / sign-out / reset logic | `<sport>/src/services/authentication/authentication.js` | `npm test` (data.test.js auth tests) |
| The "Sports Home" link | `<sport>/src/services/authentication/authentication.html` (login) and `<sport>/src/layout/shell.html` (dashboard) | root `npm run build && npm run test:browser` |
| Add a sport card to the portal | One entry in `src/sports.js` | root `npm test` |
| Portal card styling | `src/portal.css` | root `npm run build && npm run test:browser` |
| Build / dev server wiring | `tools/*.mjs`, `vite.config.js`, per-sport `vite.config.js` | root `npm run build` and `npm run test:browser` |

**Note on parity tests.** `<sport>/tests/browser-check.js` renders every feature in the new app and in the untouched original HTML and compares page text and chart inputs (labels, data, `borderColor`, `backgroundColor`). A deliberate change to visible text or chart colours therefore fails that comparison even though nothing is broken. This is a design choice of the migration, not a bug. How the project intends to retire the baseline is **UNRESOLVED**; see `hockey/HANDOVER.md`.

---

## 3. Sports Home portal

Repo root. Static, no authentication, no athlete data. Cards come only from the registry.

**`src/sports.js`**
- *Responsibility:* the registry array `sports` (id, name, description, inline SVG icon, `path` such as `hockey/`, `enabled`, `order`).
- *Depends on:* nothing.
- *Visible effect:* which cards exist and in what order.
- *Edit when:* adding, hiding or renaming a sport.
- *Risk:* `path` must end in `/` and match the sport's folder name, because the dev, build and preview tools also read it.
- *Test:* `tests/portal.test.js` ("registry defines hockey and volleyball with required fields").

**`src/portal.js`**
- *Responsibility:* turns the registry into cards. Functions: `selectableSports` (filters enabled and well-formed entries, sorts by `order`); `isApplicationAvailable` (fetches the path and checks that real HTML that is not the portal itself answers); `availableSports`; `renderCards` (escapes registry text); `startPortal(root, registry, {fetchFn})`.
- *Depends on:* `src/sports.js` (via `src/main.js`).
- *Visible effect:* the card grid. A card disappears if its app does not answer.
- *Edit when:* changing card markup or the availability rule.
- *Risk:* weakening escaping, or a card that stays visible although its app is missing.
- *Test:* `tests/portal.test.js`; `tests/browser-check.js` for the real build.

**`src/main.js`**
- *Responsibility:* imports the registry and `startPortal`, and mounts into `#portal-root`.
- *Edit when:* wiring changes only.
- *Test:* `tests/browser-check.js`.

**`src/portal.css`** — card layout and mobile stacking. *Edit when:* restyling the portal. *Test:* `tests/browser-check.js` (390px width: no horizontal scroll, cards stack).

**`index.html`** — the portal page, with the `#portal-root` container. It contains no hardcoded cards (a portal test asserts this).

**`vite.config.js`** — `base: './'`, multi-page mode. The relative base is what lets the portal and the sports work under any deployment sub-path.

**`tools/sports.mjs`** — `sportApplications()` reads the registry and skips sports lacking `index.html` and `package.json`. Used by dev, build and preview. *Test:* `tests/dev-check.js`.

**`tools/dev.mjs`** — one port (default 5170): the portal at `/`, each sport's own Vite dev server mounted at `/<folder>/`. *Test:* `tests/dev-check.js`.

**`tools/build.mjs`** — builds the portal into `dist/` and each sport into `dist/<folder>/`. *Test:* `npm run build`, then `tests/browser-check.js`.

**`tools/preview.mjs`** — serves `dist/` for local preview.

**Sports Home links (in the sports, not the portal).** Each sport has a plain `<a href="../">`. The two copies in each sport are `#login-sports-home` in `authentication.html` and `#shell-sports-home` in `shell.html`. A relative link needs no host name and works at `/hockey/` in dev and under any sub-directory. *Test:* `tests/browser-check.js` clicks both links in both sports, then checks Back and checks that the link resolves under a sub-directory.

**Portal tests:**
- `tests/portal.test.js` — 6 unit tests.
- `tests/browser-check.js` — runs against the built `dist/`.
- `tests/dev-check.js` — starts the dev server briefly.

---

## 4. Hockey layout

Folder `hockey/src/layout/` plus the entry files. The Volleyball layout (§7) has the same files with the same roles.

**`hockey/index.html`** — page shell with `<div id="hockey-app">` and the module script `src/main.js`; loads Google Fonts (blocked in tests).

**`hockey/src/main.js`** — one line of behaviour: `await startApplication()`.

**`hockey/src/application.js`** — `startApplication({bootAuthentication=true, config})`.
- *Does:* creates the layout, injects the auth and import overlays, builds the services context, installs error handlers, binds delegated events, discovers and starts features, then calls `startDemo()` or `bootSupabase()`.
- *Config:* in Live mode `config` is the Vite env: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, plus optional `VITE_HOCKEY_NICKNAME_ALIASES` and `VITE_HOCKEY_FORMER_PLAYERS`. In Demo Mode `config` is empty (`{}`), so no URL, key or alias list is read.
- *Depends on:* every `layout/*` file, `services/context.js`, `services/demo/demo.js` (`isDemoRequested`).
- *Edit when:* changing boot order or adding a context dependency.
- *Risk:* breaks every feature. The demo-versus-live switch lives here.
- *Test:* all of `tests/browser-check.js`, `tests/demo-check.js`.

**`hockey/src/layout/shell.html`** — the static frame:
- sidebar brand;
- empty `#feature-nav`;
- footer with the **Sports Home** link and the season tag;
- top bar with the title, global search, **Import Data**, **Export CSV**, sync indicator and the sign-out button `#signout-btn`;
- `#feature-errors` and `#feature-content`.
- *Edit when:* changing global chrome. Do **not** add features here.
- *Risk:* ids such as `gsearch`, `sync-dot` and `signout-btn` are referenced by services. Renaming them breaks search, the sync status and sign-out.
- *Test:* `tests/browser-check.js`; `tests/demo-check.js` for Sports Home.

**`hockey/src/layout/layout.js`** — `createLayout(root)` returns `{navigate, refreshFeature, report, start, destroy, activeId}`.
- `start` builds the sidebar buttons from the feature list, grouping by `section`.
- `navigate` is serialised on a queue. It cancels and disposes the previous feature and shows the title.
- A stale navigation never overwrites a newer one.
- *Edit when:* changing navigation or lifecycle behaviour.
- *Risk:* race conditions on rapid navigation.
- *Test:* `tests/browser-check.js` (abandoned slow import, quick leave and return, recoverable errors).

**`hockey/src/layout/feature-loader.js`** — `validateMetadata`, `discoverFeatures`. It checks that `id` matches the folder name, the `icon` is a string, `order` is numeric and `feature.js` exists. It imports metadata only and never runs feature code. Duplicates and invalid entries are reported and skipped. *Test:* `tests/loader.test.js`.

**`hockey/src/layout/feature-runtime.js`** — `createFeature(metadata, definition)`.
- Creates the shadow root with the common and feature CSS.
- Builds a per-feature scoped `context`: a scoped `document`, tracked timers and animation frames, and an abort `signal`.
- Merges the feature module's functions into `context.api` on mount and removes them on unmount.
- Destroys the canvases' charts on cleanup.
- *Risk:* a feature function name that equals a service name throws "Feature action collides with an existing service".
- *Test:* `tests/loader.test.js`, `tests/browser-check.js`.

**`hockey/src/layout/dom-scope.js`** — `scopedDocument(root, ownerDocument)` gives a feature a restricted `document`. `serviceDocument(document)` is a Proxy that lets *services* find ids in the main document and in every feature shadow root.
- *Risk:* assigning to document properties through that proxy throws "Illegal invocation" (this happened with `document.title` in Demo Mode, so `demo.js` uses `window.document.title`).
- *Test:* `tests/browser-check.js`.

**`hockey/src/layout/events.js`** — `runHandler`, `bindEvents`. Evaluates the small expression language inside `data-onclick`, `data-onchange` and similar attributes against `context.api` actions only. Unsupported syntax raises an error. *Edit when:* a feature needs a new handler syntax (rare). *Risk:* security-sensitive, because it is the replacement for inline `onclick`. *Test:* `tests/browser-check.js` (real delegated interactions).

**`hockey/src/layout/error-handler.js`** — `createErrorHandler`: shows an error banner with a Retry button inside `#feature-errors`. A failing feature leaves the sidebar usable.

**`hockey/src/layout/layout.css`** — four lines of shell-level CSS. Most styling is in `styles/reference.css`.

**`hockey/src/styles/reference.css`** — global design tokens (`:root` variables) and shared component classes (cards, tables, pills, tier colours, sidebar). It is imported into the document and copied into every feature's shadow root. *Edit when:* any site-wide visual change. *Risk:* large blast radius. *Test:* `npm run build`, then `tests/browser-check.js` for text.

---

## 5. Hockey sidebar features

Sidebar groups and order come from each `registration.js`:

| Group | Order → feature (label) |
|---|---|
| Overview | 0 `dashboard` (Team Dashboard), 1 `roster` (Roster Setup, with a badge), 2 `profile` (Athlete Profile) |
| Performance | 3 `jumping` (Power Testing), 4 `forceplate` (Force Plate (VALD)), 5 `readiness` (Readiness Hub), 6 `workload` (Workload (Firstbeat)) |
| Leaderboards | 7 `leaderboard` (All Metrics), 8 `position` (By Position) |
| Analysis | 9 `progress` (Progress Tracking), 10 `compare` (Athlete Compare), 11 `audit` (Change History) |

### Anatomy shared by every feature folder `hockey/src/features/<id>/`

| File | Role | Edit it for |
|---|---|---|
| `registration.js` | Literal metadata only: `id`, `title`, `label`, `icon`, `order`, `section` (and `badgeId` for roster). Never executes feature code. | Sidebar entry text, icon, position. |
| `feature.js` | Six lines: `createFeature(metadata, {template, styles, createModule, initialize})`. `initialize` names the function in `<id>.js` that runs on mount. | Almost never; only the initial function name. |
| `<id>.html` | The page markup, ids included (`#page-<id>`). | Layout and design structure. |
| `<id>.css` | Scoped CSS. | Look and feel of this page. |
| `<id>.js` | `createModule(context)` returns the feature's functions: render and interaction handlers, plus calculations specific to the page. | Interactions, charts, data shaping. |
| `<id>.test.js` | One exported `verify(page)` that clicks or selects something real. | The scenario run by the browser suite. |

Risk common to all: ids in the `.html` are looked up by the `.js`, and by `<id>.test.js`. Rename an id in one place and the page silently breaks. Test for all features: `hockey/tests/browser-check.js` (it mounts every feature, compares it with the original HTML, then runs `verify`) and `hockey/tests/demo-check.js` (renders all 12 with synthetic data).

### 5.1 `dashboard` — Team Dashboard

- *Files:* `hockey/src/features/dashboard/{registration,feature,dashboard,test}.js`, `dashboard.html`, `dashboard.css`.
- *`dashboard.js` functions:* `initDash`, `populateKpiSort`, `sortKpi`, `renderKpiTable`, `renderTierDonut`, `renderTeamRadar`, `renderJumpCompareBar`, `renderTrendLine`.
- *Depends on services:* `data/roster.js`, `data/presentation.js`, `data/charts.js`, `scoring/composite.js`, `scoring/radar.js`, `data/metric-select.js`.
- *Shows:* team KPI table (sortable), tier donut, team radar, jump comparison and trend charts.
- *Verify scenario:* picks `cmjHeight` in `#kpi-sort`.
- **How to change this feature**
  - *Design:* `dashboard.html`, `dashboard.css`.
  - *Interactions:* `sortKpi`, `populateKpiSort` in `dashboard.js`.
  - *Data:* athletes come from `rosterAthletes()` in `services/data/roster.js`; KPI columns from `ALL_METRICS` in `composite.js`.
  - *Calculations:* none here; scores come from `composite.js`.

### 5.2 `roster` — Roster Setup

- *Files:* `hockey/src/features/roster/{registration,feature,roster,test}.js`, `roster.html`, `roster.css`. `registration.js` sets `badgeId: "roster-badge"`.
- *Functions:* `setRosterFilter`, `initRoster`, `renderRosterGrid`, `archiveAthlete`, `restoreAthlete`, `openMergeModal`, `closeMergeModal`, `renderMergePreview`, `doMergeAthletes`, `draftName`, `draftPosition`, `draftYear`, `saveAllPositions`.
- *Depends on:* `data/interactions.js`, `data/roster.js`, `data/presentation.js`, `scoring/composite.js`, `authentication/authentication.js`, `data/notifications.js`, `data/identity.js`, `data/sessions.js`, `data/persistence.js`.
- *Shows:* the filterable roster grid, position and year editing, archive and restore, and the merge-duplicates dialog.
- *Writes to the backend (Live mode):* archive and restore update `athletes.archived`; merge reads `test_sessions` and deletes the source athlete. In Demo Mode these hit the in-memory client.
- *Verify scenario:* clicks the `#rf-G` filter.
- **How to change this feature**
  - *Design:* `roster.html`, `roster.css`.
  - *Interactions:* the functions above in `roster.js`.
  - *Data:* `ATHLETES` store and `dedupeATHLETES` in `services/data/roster.js`; persistence in `services/data/persistence.js`.
  - *Calculations:* merge logic uses `mergeAthleteRecords` in `services/data/identity.js`.
- *Risk:* the destructive paths (merge, delete) are Live-mode backend writes. Keep their `sb && currentUser && _dbId` guards.

### 5.3 `profile` — Athlete Profile

- *Files:* `hockey/src/features/profile/{registration,feature,profile,test}.js`, `.html`, `.css`.
- *Functions:* `initProfile`, `renderProfile`, `renderProfileRadar`.
- *Depends on:* `data/charts.js`, `scoring/radar.js`, `data/roster.js`, `data/presentation.js`, `scoring/composite.js`, `data/identity.js`.
- *Shows:* hero card, KPI tiles, radar, jump bar, force-plate tiles, all-metrics grid with percentiles, and the data-sources panel.
- *Important behaviour (hand-edited):* the dropdown value is an athlete `id`, not an array position, so lookup is `ATHLETES.find(x=>x.id===id)`. Missing measurements show an em dash instead of throwing; "Pos Avg" averages only athletes who have the metric.
- *Verify scenario:* selects athlete `1`. A regression in `tests/browser-check.js` covers non-contiguous ids and partial records.
- **How to change this feature**
  - *Design:* `profile.html`, `profile.css`.
  - *Interactions:* `initProfile`, `renderProfile`.
  - *Data:* source fields on the athlete object (see `DB_FIELDS` in `persistence.js`).
  - *Calculations:* percentile in `pctile` (`presentation.js`); radar in `scoring/radar.js`.

### 5.4 `jumping` — Power Testing

- *Files:* `hockey/src/features/jumping/{registration,feature,jumping,test}.js`, `.html`, `.css`.
- *Functions:* `initJumping`.
- *Depends on:* `data/roster.js`, `data/presentation.js`, `data/charts.js`, `scoring/composite.js`.
- *Shows:* three charts of jump-type results (broad jump, vertical, etc.) and a table.
- *Verify scenario:* asserts that exactly three canvases are present, then checks more content.
- **How to change this feature**
  - *Design:* `jumping.html`, `jumping.css`.
  - *Interactions and charts:* `initJumping`.
  - *Data:* athlete fields (`approachJump`, `cmjHeight`, `standVert`…).
  - *Calculations:* none; norms are in `composite.js`.

### 5.5 `forceplate` — Force Plate (VALD)

- *Files:* `hockey/src/features/forceplate/{registration,feature,forceplate,test}.js`, `.html`, `.css`.
- *Functions:* `populateFPSort`, `initFP`, `renderCMJScatter`, `renderPRTracker`, `renderFPBoard`; exports `FP_SORT_KEYS`.
- *Depends on:* `data/metric-select.js`, `data/session-values.js`, `data/charts.js`, `scoring/composite.js`, `data/sessions.js`, `data/identity.js`, `data/roster.js`, `data/presentation.js`.
- *Shows:* a sortable VALD board, a CMJ scatter and a PR tracker.
- *Data rule:* sessions are included only if `jump_height` is 5–21 and `session_type` is not Match, Training or Lift (these are treated as Kinexon rows). Constants are inside `forceplate.js`.
- *Verify scenario:* sort by `rsi`, pick an athlete in `#cmj-athlete-sel`.
- **How to change this feature**
  - *Design:* `forceplate.html`, `.css`.
  - *Interactions:* `initFP`, `populateFPSort`.
  - *Data:* `SESSIONS` (`data/sessions.js`); latest-value shaping in `data/session-values.js`.
  - *Calculations:* outlier ranges in `scoring/outliers.js`.

### 5.6 `readiness` — Readiness Hub

- *Files:* `hockey/src/features/readiness/{registration,feature,readiness,test}.js`, `.html`, `.css`.
- *Functions:* `populateReadinessDates`, `initReadiness`, `renderReadiness`, `renderTeamReadinessScore`, `renderPRBanner`, `renderTeamStrip`.
- *Depends on:* `data/sessions.js`, `data/identity.js`, `data/roster.js`, `scoring/readiness.js`, `scoring/outliers.js`; the PDF button in `readiness.html` calls `exportReadinessPdf` from `export/readiness-pdf.js`.
- *Shows:* a date-selectable team readiness score, flagged athletes (z-scores against a 30-day average), a PR banner, a team strip and an exportable PDF.
- *Verify scenario:* selects date `2026-10-20` in `#readiness-date`.
- **How to change this feature**
  - *Design:* `readiness.html`, `.css`.
  - *Interactions:* the functions above.
  - *Data:* `SESSIONS`.
  - *Calculations:* **not here.** Edit `scoring/readiness.js` (`computeTeamReadiness`, `READINESS_*` constants, `computeReadinessPRs`).

### 5.7 `workload` — Workload (Firstbeat)

- *Files:* `hockey/src/features/workload/{registration,feature,workload,test}.js`, `.html`, `.css`.
- *Functions:* `populateWLSort`, `initWL` (returns its promise and checks `context.signal?.aborted`), `renderWLKpis`, `renderWLBoard`, `renderDrillBreakdown`, `renderDrillBreakdownTeamAvg`, `wlSelectAthlete`, `wlFocusRow`, `renderWLHistory`, `renderWLCalendar`.
- *Depends on:* `data/metric-select.js`, `data/sessions.js` (includes `loadAllSessionDrills`), `data/workload.js`, `data/presentation.js`, `data/roster.js`, `data/identity.js`, `data/charts.js`.
- *Shows:* team workload board, KPIs, per-athlete history, a calendar, and a drill breakdown from `SESSION_DRILLS`.
- *Data rule:* a session counts as Firstbeat when it has any of `trimp_total`, `avg_hr`, `trimp_per_min` or `effic_score` (`getKinexonSessions` in `data/workload.js`; the function name is historical).
- *Verify scenario:* sort `avgHR`, pick an athlete.
- **How to change this feature**
  - *Design:* `workload.html`, `.css`.
  - *Interactions:* `wlSelectAthlete`, `wlFocusRow`, and the render functions.
  - *Data:* `data/workload.js` and `data/sessions.js`.
  - *Calculations:* inside `renderWL*` in `workload.js`.
- *Risk:* the original page has a `#wl-focus-label` element that other code expects; test fixtures must include Firstbeat rows or the page may fail.

### 5.8 `leaderboard` — All Metrics

- *Files:* `hockey/src/features/leaderboard/{registration,feature,leaderboard,test}.js`, `.html`, `.css`.
- *Functions:* `initLB`, `setM`, `renderLB`; exports `activeM`.
- *Depends on:* `data/roster.js`, `scoring/composite.js`, `data/metric-select.js`, `data/presentation.js`, `data/charts.js`.
- *Shows:* a ranked bar list for the chosen metric.
- *Verify scenario:* clicks the "Broad Jump" metric button.
- **How to change this feature**
  - *Design:* `.html`, `.css`.
  - *Interactions:* `setM`, `renderLB`.
  - *Data:* athletes via `rosterAthletes()`.
  - *Calculations:* none here. Metric list and direction (`hb`) are in `ALL_METRICS` in `composite.js`.

### 5.9 `position` — By Position

- *Files:* `hockey/src/features/position/{registration,feature,position,test}.js`, `.html`, `.css`.
- *Functions:* `initPos`, `setPosTab`, `renderPosBoard`, `renderPositionRadar`; exports `activePos`.
- *Depends on:* `data/charts.js`, `scoring/radar.js`, `data/roster.js`, `scoring/composite.js`, `data/presentation.js`.
- *Shows:* a tab per position (F, D, G in Hockey), a board and a radar.
- *Verify scenario:* clicks the `D` tab.
- **How to change this feature**
  - *Design:* `.html`, `.css`.
  - *Interactions:* `setPosTab`.
  - *Data:* athlete `pos`; the list of positions is `POSITIONS` in `composite.js`.
  - *Calculations:* `groupRadarData` in `scoring/radar.js`.

### 5.10 `progress` — Progress Tracking (Hockey only)

- *Files:* `hockey/src/features/progress/{registration,feature,progress,test}.js`, `.html`, `.css`.
- *Functions:* `initProgress`, `renderProgressChart`, `renderProgressTeamTable`.
- *Depends on:* `data/sessions.js` (`KPI_HISTORY`), `data/roster.js`, `data/presentation.js`, `data/charts.js`, `data/identity.js`.
- *Shows:* one athlete's history for a chosen metric over the test dates, plus a team table.
- *Data source:* the `kpi_history` table (Hockey only). Volleyball has no such table or feature.
- *Verify scenario:* metric `sprint10`, athlete index 1.
- **How to change this feature**
  - *Design:* `.html`, `.css`.
  - *Interactions and charts:* `initProgress`, `renderProgressChart`.
  - *Data:* `loadKpiHistory` and `logKpiHistory` in `data/sessions.js`; "official" history helpers (`histFor`, `officialHist`) in `data/identity.js`.
  - *Calculations:* inside `renderProgress*`.

### 5.11 `compare` — Athlete Compare

- *Files:* `hockey/src/features/compare/{registration,feature,compare,test}.js`, `.html`, `.css`.
- *Functions:* `initCmp`, `renderCompare`, `renderCompareRadar`.
- *Depends on:* `data/charts.js`, `scoring/radar.js`, `data/roster.js`, `data/presentation.js`, `scoring/composite.js`.
- *Shows:* up to three athletes in a radar, cards and per-metric bars.
- *Important behaviour (hand-edited):* selectors hold athlete ids and are resolved by id; defaults are the first two options; an unknown or removed selection is skipped; missing metrics show a dash.
- *Verify scenario:* selects athlete `2` in `#cmp-c`.
- **How to change this feature**
  - *Design:* `.html`, `.css`.
  - *Interactions:* `initCmp`, `renderCompare`.
  - *Data:* `ATHLETES`.
  - *Calculations:* radar values from `athleteRadarData` in `scoring/radar.js`.

### 5.12 `audit` — Change History

- *Files:* `hockey/src/features/audit/{registration,feature,audit,test}.js`, `.html`, `.css`.
- *Functions:* `loadAuditLog`.
- *Depends on:* `authentication/authentication.js` (`sb`, `currentUser`).
- *Shows:* the latest 200 rows of the `audit_log` table (who, athlete, action, fields). Without a client and signed-in user it says "Sign in to view history."
- *Written by:* `services/data/persistence.js` when it saves or deletes athletes.
- *Verify scenario:* clicks the refresh button.
- **How to change this feature**
  - *Design:* `.html`, `.css`.
  - *Interactions and data:* `loadAuditLog`.
  - *Calculations:* none.

---

## 6. Hockey services

All in `hockey/src/services/`. Every service is a `createModule(context)` that returns getters (and setters for state). `modules.js` lists them in load order; `context.js` merges them into `context.api`. **Service tests:** `hockey/tests/{scoring,data,loader,integrity,demo}.test.js` (via `tests/support.js`), and the browser parity run.

### 6.1 Wiring

- **`services/context.js`** — `createServices(deps)`: creates `context.api` and merges each service's property descriptors; reports (does not throw) if one service fails to create. *Edit when:* never in normal work.
- **`services/modules.js`** — `serviceFactories`: the ordered list `{id, create}`. *Edit when:* adding a service. This is also where Demo Mode's `services/demo/demo` is registered. *Risk:* a name exported by two services is silently overwritten by the later one.

### 6.2 Scoring

- **`services/scoring/composite.js`**
  - *Does:* the shared definitions and the composite score.
    - Constants: `POSITIONS`, `CLASS_YEARS`, `POS_FULL`, `TIERS`, `TIER_COLORS`, `TEST_BLOCKS`, `NORMS` (per-position ranges), `ALL_METRICS` (key, label, unit, max, higher-is-better `hb`, formatter, colour, group).
    - Functions: `calcCompositeVB`, `rescoreAllAthletes`, `calcTier`, `calcACWR`, `acwrZone`, `getTeamNormRange`, `compositeDropFor`, `isApproachJumpFresh`, `refreshApproachJumpFreshness`.
  - *Depends on:* `presentation.js`, `roster.js`, `outliers.js`, `identity.js`, `sessions.js`.
  - *Visible:* nearly every number and score on every page.
  - *Edit when:* changing norms, metrics, tiers or the score formula.
  - *Risk:* highest. Anything that renders a score changes. `calcACWR` returns NaN when acute load is missing (UI code guards for it).
  - *Test:* `tests/scoring.test.js` (1,479 deterministic cases against the original script run in a Node `vm` sandbox).
- **`services/scoring/radar.js`** — `radarNorm`, `athleteRadarData`, `athleteRadarDataFiltered`, `groupRadarData`, `groupRadarFiltered`; constants `VB_RADAR`, `RADAR_LABELS`, `RADAR_OPTIONS`, `VB_RADAR_LEGEND_HTML`. Used by dashboard, position, profile and compare radars. Depends on `composite.js`, `presentation.js`. *Test:* `scoring.test.js`.
- **`services/scoring/readiness.js`** — `computeTeamReadiness`, `readinessTrendLine`, `computeReadinessPRs`, `prHardOk`; constants `READINESS_METRICS`, `READINESS_Z`, `READINESS_RED_PENALTY`, `READINESS_TIERS`, `PR_METRICS` and others. Used by the readiness feature. Depends on `outliers.js`, `sessions.js`. *Test:* `scoring.test.js` ("readiness").
- **`services/scoring/outliers.js`** — `isOutlier`, `cleanValue`, `sessionsForAthlete`; constants `FP_HARD_RANGES`, `OUTLIER_PCT_THRESHOLD` (30%), `MIN_SESSIONS_FOR_ROLLING` (3). A reading is an outlier if it is outside the hard range, or more than 30% from the athlete's rolling average when there are enough sessions. It keeps an index and memo, rebuilt when `SESSIONS` changes. Depends on `sessions.js`, `identity.js`. *Test:* `scoring.test.js`.

### 6.3 Data

- **`services/data/roster.js`** — the `ATHLETES` store (getter and setter) and roster views: `rosterAthletes`, `allAthletes`, `archivedAthletes`, `isAthleteActive` (recent-activity window `ACTIVE_WINDOW_DAYS`), `athleteOptions` (dropdown options; values are athlete ids), `dedupeATHLETES`, `posIsSet`, `unsetCount`, `postImportPositionCheck`, `refreshAll`. *Risk:* `id` equals array position only at load; after dedupe, merge or archive, ids and positions can diverge, so never index `ATHLETES` by an id. *Test:* `data.test.js` ("deduplication and active roster").
- **`services/data/identity.js`** — name handling and merging: `normName`, `nameSimilarity`, `findBestMatch`, `resolveNickname`, `isFormerPlayer`, `mergeAthleteRecords`, `logSource`, `sourceForKey`, plus history helpers `nameKey`, `athleteKey`, `histFor`, `officialHist`. Nickname aliases and the former-player list come from the optional env variables (values are not documented here). *Edit when:* changing how names match. *Risk:* wrong merges of different people. *Test:* `data.test.js`, `integrity.test.js` (no private identity constants in source).
- **`services/data/persistence.js`** — Live-mode athlete I/O: `loadAllAthletes`, `DB_FIELDS` / `REVERSE_DB_FIELDS`, `athleteToDbRow`, `dbRowToAthlete`, debounced saving (`queueSave`, `queueSaveAll`, `scheduleSave`, `flushPendingSaves`), realtime (`subscribeToChanges`, `handleRemoteChange`) and `deleteAthleteFromCloud`. See §11. *Test:* `data.test.js` ("database mapping").
- **`services/data/sessions.js`** — `SESSIONS`, `SESSION_DRILLS`, `KPI_HISTORY` and their loaders `loadAllSessions`, `loadAllSessionDrills`, `loadKpiHistory`, plus `fetchAllRows` (pages through 1000 rows at a time because the backend caps responses), `logKpiHistory`, `isValdSession`. Loaders return early unless both a client and a signed-in user exist. *Test:* `data.test.js` ("session reads are gated…", "paginated…").
- **`services/data/session-persistence.js`** — `saveTestSessions` (upserts into `test_sessions` with conflict key `athlete_id,test_date`, inserts unmatched) and `saveSessionDrills`. Used by the importer. Refuses when not signed in. *Test:* `data.test.js`.
- **`services/data/enrichment.js`** — merges session data into athletes: `enrichAthletesFromSessions` (peak power, RSI, impulse asymmetry), `applyBestRecentValues` (best value in the last 270 days from `KPI_HISTORY`), `bestPowerThisYear`, `academicYearStart`. It deliberately does not overwrite `cmjHeight` from force-plate data. *Test:* `data.test.js` / browser parity.
- **`services/data/session-values.js`** — `athletesWithLatestSession` for the Force Plate page. Depends on `roster.js`, `sessions.js`, `identity.js`, `outliers.js`.
- **`services/data/workload.js`** — `getKinexonSessions`, `getKinexonSessionForAthlete` (Firstbeat rows in Hockey). Used by the workload page.
- **`services/data/presentation.js`** — display helpers: `tierBadge`, `posPill`, `ava` (avatar), `spark`, `getM` (find metric), `pctile`, `metricDate`, `fmtDate`, `inchesToFeet`, `inToFtIn`, `METRIC_DATE_KEY`, `FP_SESSION_METRICS`. Shared by all pages. *Risk:* output format changes break parity text.
- **`services/data/metric-select.js`** — `populateMetricSelect`, `metricHasData`: fills dropdowns with metrics that have data.
- **`services/data/charts.js`** — `CH` (chart registry by canvas id) and `kc(id)` (destroy a chart). Every chart must be registered here so it can be cleaned up when a feature unmounts.
- **`services/data/interactions.js`** — global search (`gsearchFn`), `openAth` (jump to a profile), `clearMetric` (removes a value locally and, in Live mode, in the backend), `updateRosterBadge`.
- **`services/data/notifications.js`** — `toast`.
- **`services/data/photos.js`** — `handlePhotoUpload`, `removeAthletePhoto`: use the Supabase Storage bucket `athlete-photos`; refuse without sign-in. In Demo Mode the storage stub returns an error, so uploads are refused with a message.

### 6.4 Import / export

- **`services/import/import.js`** (2,398 lines — the largest file)
  - *Does:* the import dialog: file reading (`handleFileSelect`, `readFile`), CSV/XLSX/paste parsing (`parseCSV`, `parseCSVToRows`, `parsePaste`), header detection (`COL_ALIASES`), per-source help text (`SRC_INFO`), preview, name matching (`commitSmartMatch`, `addUnmatched`), commit (`commitCSV`, `commitPaste`, `applyAndClose`), sprint-placeholder audit, and collision handling for Firstbeat sessions.
  - *Depends on:* `roster.js`, `identity.js`, `composite.js`, `persistence.js`, `notifications.js`, `presentation.js`, `authentication.js`, `sessions.js`, `enrichment.js`, `session-persistence.js`.
  - *Visible:* the "Import Data" dialog opened from the top bar.
  - *Edit when:* adding a column or source, or changing validation.
  - *Risk:* high. It mutates `ATHLETES` and, in Live mode, saves to the backend.
  - *Test:* `data.test.js` (CSV quoting and source characterisation), `browser-check.js` (real file flows, including XLSX).
- **`services/import/import.html`** — modal markup, injected into `document.body`.
- **`services/export/csv.js`** — `doExport` (the "Export CSV" button). Compared with the original's download in `browser-check.js`.
- **`services/export/readiness-pdf.js`** — `exportReadinessPdf`, also compared in `browser-check.js`.

### 6.5 Authentication and demo services

See §10 and §11: `services/authentication/*` and `services/demo/*`.

---

## 7. Volleyball layout

Same roles as Hockey §4; paths are `volleyball/...`. Differences only:

| File | Same as Hockey? |
|---|---|
| `volleyball/index.html`, `src/main.js`, `src/application.js` | Same, except the mount id `#volleyball-app`, the env aliases `VITE_VOLLEYBALL_NICKNAME_ALIASES` / `VITE_VOLLEYBALL_FORMER_PLAYERS`, and no `XLSX` passed to the context at start-up. |
| `src/layout/{layout,feature-loader,feature-runtime,dom-scope,events,error-handler}.js`, `layout.css` | Same roles. |
| `src/layout/shell.html` | Same chrome, with "VOLLEYBALL S&C ANALYTICS". Contains the **Sports Home** link and `#signout-btn`. |
| `src/styles/reference.css` | Same token approach, its own copy (220 lines). |

*Tests:* `volleyball/tests/{loader,integrity,data,scoring,demo}.test.js`, `browser-check.js`, `demo-check.js`.

---

## 8. Volleyball sidebar features

Same file anatomy as §5 in `volleyball/src/features/<id>/`. Groups and order:

| Group | Order → feature |
|---|---|
| Overview | 0 `dashboard`, 1 `roster`, 2 `profile` |
| Performance | 3 `jumping` (Jump Testing), 4 `forceplate`, 5 `readiness`, 6 `workload` (Workload (Kinexon)) |
| Leaderboards | 7 `leaderboard`, 8 `position` |
| Analysis | 9 `compare`, 10 `audit` |

Test for all: `volleyball/tests/browser-check.js` (11 features compared with the original) and `volleyball/tests/demo-check.js` (11 rendered with synthetic data).

| Feature | `*.js` functions (same as Hockey unless noted) | Differences from Hockey |
|---|---|---|
| `dashboard` | `initDash`, `populateKpiSort`, `sortKpi`, `renderKpiTable`, `renderTierDonut`, `renderTeamRadar`, `renderJumpCompareBar`, `renderTrendLine` | Volleyball metrics. |
| `roster` | `setRosterFilter`, `initRoster`, `renderRosterGrid`, `archiveAthlete`, `restoreAthlete`, `openMergeModal`, `closeMergeModal`, `renderMergePreview`, `doMergeAthletes`, `draftName`, `draftPosition`, `saveAllPositions` | No `draftYear` function listed; no roster badge. Position filters are `OH, MB, S, RS, OPP, Lib, DS` (test clicks `#rf-Lib`). |
| `profile` | `initProfile`, `renderProfile`, `renderProfileRadar` | Same guards for missing measurements and id lookup (added in the Demo Mode work). |
| `jumping` | `initJumping` | Labelled "Jump Testing". |
| `forceplate` | `populateFPSort`, `initFP`, `renderCMJScatter`, `renderPRTracker`, `renderFPBoard` | Same. |
| `readiness` | `populateReadinessDates`, `initReadiness`, `renderReadiness`, `renderTeamReadinessScore`, `renderPRBanner`, `renderTeamStrip` | Uses the `power`, `mrsi`, `concentric_impulse` session columns. |
| `workload` | `populateWLSort`, `initWL`, `renderWLKpis`, `renderWLBoard`, `wlSelectAthlete`, `wlFocusRow`, `renderWLHistory`, `renderWLCalendar` | Kinexon data (`jumps_total`, `accel_load`, session types Match/Training/Lift); no drill breakdown functions. |
| `leaderboard` | `initLB`, `setM`, `renderLB` | Test clicks "Approach Touch". |
| `position` | `initPos`, `setPosTab`, `renderPosBoard`, `renderPositionRadar` | Seven positions; test clicks the `MB` tab. |
| `compare` | `initCmp`, `renderCompare`, `renderCompareRadar` | Same fix as Hockey (ids, missing metrics). |
| `audit` | `loadAuditLog` | Same. |

**How to change a Volleyball feature** is identical to §5: *design* → the feature's `.html` / `.css`; *interactions* → the feature's `.js`; *data* → `volleyball/src/services/data/*`; *calculations* → `volleyball/src/services/scoring/*`.

*Risk reminder:* editing Hockey's copy of a shared idea does not change Volleyball. Make the change in both when appropriate.

---

## 9. Volleyball services

`volleyball/src/services/`. Same wiring (`context.js`, `modules.js`) and same service names as Hockey, with these differences, established by comparing exports:

| Service | Difference from Hockey |
|---|---|
| `scoring/composite.js` | Positions `OH, MB, S, RS, OPP, Lib, DS`; its own `NORMS` and `ALL_METRICS` (strength lifts, jump volume, accelerometer load). No `CLASS_YEARS`, `getTeamNormRange` or `compositeDropFor`. |
| `scoring/{radar,outliers,readiness}.js` | Same roles; `readiness.js` has fewer constants. |
| `data/sessions.js` | Only `SESSIONS`, `loadAllSessions`, `isValdSession`. **No** drills, **no** `kpi_history`. `isValdSession` accepts `test_type === 'vald_forcedecks'`. |
| `data/enrichment.js` | Holds `enrichAthletesFromSessions` **and** `loadAllAthletes` (in Hockey, `loadAllAthletes` is in `persistence.js`). Overwrites `cmjHeight` from the best valid VALD `jump_height`. No best-recent logic. |
| `data/persistence.js` | `DB_FIELDS` differ (back squat, trap bar, front squat, bench, hang clean; no chin-up or beep); same save and realtime logic. |
| `data/identity.js` | Fewer helpers: no `FORMER_PLAYERS`, `nameKey`, `athleteKey`, `histFor` or `officialHist`. |
| `data/roster.js` | Has no `dedupeATHLETES`; it lives inside `import/import.js`. UNRESOLVED whether anything else calls it: grep for `dedupeATHLETES`. |
| `data/session-persistence.js` | Only `saveTestSessions`. |
| `data/workload.js` | `getKinexonSessions`: rows with jump or accelerometer data, or session type Match/Training/Lift. |
| `import/import.js` | 2,097 lines. Volleyball position and source help text (`SRC_INFO`), `COL_ALIASES`. Includes `dedupeATHLETES`. |
| `data/{presentation,metric-select,charts,interactions,notifications,photos,session-values}.js`, `export/{csv,readiness-pdf}.js` | Same roles. |

Tests: `volleyball/tests/data.test.js`, `scoring.test.js`, `integrity.test.js`, `loader.test.js`, `demo.test.js`.

---

## 10. Demo Mode and synthetic fixtures

Same three files in each sport: `hockey/src/services/demo/` and `volleyball/src/services/demo/`.

| File | Responsibility |
|---|---|
| `demo.js` | `isDemoRequested(location)` (true when the URL fragment is exactly `#demo`); `createModule` exports `demoMode`, `enterDemo`, `exitDemo`, `startDemo`. It registers a `hashchange` listener that reloads whenever the mode changes. `startDemo()` creates the in-memory client, sets a fake signed-in marker `{email:'demo@synthetic.invalid', demo:true}`, hides the login overlay, adds the "DEMO — SYNTHETIC DATA" banner with an Exit Demo button, then runs the normal `onLoginSuccess()`. |
| `demo-backend.js` | `createDemoClient(seed)`: a stand-in for the Supabase client. Query methods: `select`, `insert`, `update`, `upsert`, `delete`, `eq`, `neq`, `in`, `is`, `not`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `order`, `range`, `limit`, `single`, `maybeSingle`. The realtime channel does nothing. Storage and password calls return a "Disabled in Demo Mode" error. `getSession` always returns null. Seed rows are copied, so fixtures are never mutated. |
| `demo-data.js` | `buildDemoTables(today)`: seeded, deterministic synthetic tables with dates relative to `today`. 14 athletes per sport. |

**Hockey tables:** `athletes`, `test_sessions`, `kpi_history`, `session_drills` (empty), `audit_log`. Names are `Demo Forward Alpha`, `Demo Defense Alpha`, `Demo Goalie Alpha` and so on (digit-free on purpose: the identity normalisation strips digits, so numbered names were merged by dedupe).
**Volleyball tables:** `athletes`, `test_sessions`, `audit_log`. Names are `Demo Outside Alpha`, `Demo Middle Alpha`, `Demo Libero Alpha`, `Demo DefSpec Alpha` and so on (digit-free on purpose, see Hockey).
Deliberately incomplete athletes (no force plate, no strength tests, almost nothing) exercise the missing-data paths.

**Other files that know about Demo Mode** (the only ones):
- `<sport>/src/application.js` — picks empty config and calls `startDemo()`.
- `<sport>/src/services/authentication/authentication.js` — `initSupabase()` returns false and `bootSupabase()` returns early in demo; `doSignOut()` calls `exitDemo()`.
- `<sport>/src/services/authentication/authentication.html` — "Explore Demo" button.
- `<sport>/src/services/modules.js` — registers the demo service.

**Add fixtures to a new sport:** follow "Add demo fixtures for a new sport" in `hockey/HANDOVER.md` (copy `services/demo/`, rewrite `demo-data.js` in that app's database column shape, register the service, add the three authentication guards and the application switch, and copy the tests).

### Demo Mode vs Live Supabase Mode

| | **Demo Mode** (`#demo`) | **Live mode** (default) |
|---|---|---|
| Entered by | "Explore Demo" on the login screen (sets `#demo` and reloads), or a `#demo` URL | Normal page load, then Coach Login or a saved Supabase session |
| Supabase client | **Never created** (`initSupabase` returns false) | Created by `initSupabase()` in `authentication.js` |
| Credentials | None read. `config` is `{}`, so there is no URL, key or alias list | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (browser-safe public values; per-sport ignored `.env.local`) |
| "Signed-in user" | A marker object, not a Supabase user. No token or cookie exists. `getSession()` returns null | A Supabase user from `signInWithPassword` or a stored session |
| Authorization (RLS) | **Not involved, not bypassed.** There is no backend to authorise | Enforced by Supabase Row Level Security on the server |
| Reads | From seeded in-memory tables | From Supabase tables (paged 1000 rows at a time) |
| Writes (saves, imports, merges, archives, deletes) | Change only the in-memory tables; lost on reload; never sent anywhere | Sent to Supabase |
| Realtime | A no-op channel | Postgres changes subscription (`athletes`) |
| Photo upload | Refused with an error message | Uploaded to the `athlete-photos` bucket |
| Persistence | None. Reload resets everything; nothing goes to browser storage | Server database; the Supabase library keeps its session in browser storage |
| Network | None from app code (fonts still requested, blocked in tests) | Supabase REST, Auth, Realtime, Storage |
| Switching mode | Always a full page reload, including Back/Forward, so old state and in-flight requests are discarded | Sign-out reloads to the login screen and never enters Demo Mode |

**Security boundary.** Demo Mode is a separate data source, not an authorization shortcut. It never forges a session, token or user, and the real client is never constructed, so it cannot read, write or subscribe to the real backend. The protection against cross-mode leakage is the mandatory reload on every mode change; the previous page's memory and requests do not survive it.

*What is verified:* `tests/demo.test.js` (no real client in demo; source contains no network or storage APIs, checked by regex over non-comment text) and `tests/demo-check.js` (with external traffic blocked: no Supabase host or path contacted, no remote WebSocket, no Supabase storage key, no cookie).
*Not verified:* other browsers, and behaviour on a deployed site.

---

## 11. Supabase authentication and persistence

**Live mode only.** In Demo Mode these files are inert (see §10).

### Authentication

- **`<sport>/src/services/authentication/authentication.js`**
  - *Functions:* `initSupabase` (creates the client from `context.config`; shows a configuration message if URL or key is missing), `doLogin`, `doSignOut` (confirm, `signOut`, reload), `onLoginSuccess`, `bootSupabase` (restores an existing session, otherwise shows "SIGNED OUT"), `setSyncStatus`.
  - *Hockey only:* `doForgotPassword` (reset email with `redirectTo = origin + pathname`, so recovery returns to the sport route) and `doSetNewPassword`; `initSupabase` also handles the `PASSWORD_RECOVERY` event by showing the reset overlay. Volleyball's original has no password-recovery flow, and a test guards that.
  - *State exposed:* `sb`, `currentUser`, `syncing`, `isLocalChange`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
  - *`onLoginSuccess` order:* `loadAllSessions` → `loadAllAthletes` → `enrichAthletesFromSessions` → (Hockey: `loadKpiHistory`, `applyBestRecentValues`) → `rescoreAllAthletes` (Hockey only; Volleyball does not call it) → `subscribeToChanges` → navigate to the dashboard.
  - *Edit when:* changing sign-in, recovery or boot behaviour.
  - *Risk:* never add a service-role key. Do not weaken the `sb && currentUser` guards that many services use as the "signed-in" test.
  - *Test:* `data.test.js` (authentication delegation, rejected sign-in, Hockey reset redirect under any base path, recovery event).
- **`<sport>/src/services/authentication/authentication.html`** — the `#login-overlay` (email, password, **Sign In**, **Explore Demo**, **Sports Home**, and in Hockey "Forgot password?") and, in Hockey, `#reset-password-overlay`. Injected into `document.body`. *Edit when:* changing the login screen. *Risk:* `login-email`, `login-password`, `login-btn`, `login-msg` and `demo-btn` are looked up by id. *Test:* `tests/demo-check.js`, `tests/browser-check.js`.

### Persistence

| Concern | File | Notes |
|---|---|---|
| Athlete load | Hockey `services/data/persistence.js` `loadAllAthletes`; Volleyball `services/data/enrichment.js` `loadAllAthletes` | `select('*')` on `athletes`, then `dbRowToAthlete`, dedupe, re-id, rescore, re-render the active page |
| Field mapping | `DB_FIELDS` in `persistence.js` | Local key → database column, in both directions |
| Save | `queueSave`, `scheduleSave`, `flushPendingSaves` | Debounced upsert-by-canonical-name into `athletes`; writes `audit_log` rows |
| Sessions | `services/data/sessions.js`, `session-persistence.js` | `test_sessions` (read paged; written by the importer) |
| Hockey history/drills | `services/data/sessions.js` | `kpi_history`, `session_drills` |
| Realtime | `subscribeToChanges`, `handleRemoteChange` in `persistence.js` | Echo suppression via `isLocalChange` |
| Deletes | `deleteAthleteFromCloud`; roster merge | Both write to the backend |
| Photos | `services/data/photos.js` | Storage bucket `athlete-photos` |
| Audit | `features/audit/audit.js` reads `audit_log` | |

Tables referenced in code — Hockey: `athletes`, `test_sessions`, `kpi_history`, `session_drills`, `audit_log`, storage bucket `athlete-photos`. Volleyball: `athletes`, `test_sessions`, `audit_log`, storage bucket `athlete-photos`. The schema and Row Level Security policies live in Supabase, **not in this repository**, so they cannot be reviewed here (UNRESOLVED; ask the project owner).

**Environment configuration.** `hockey/.env.example` and `volleyball/.env.example` document `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Real values go in the ignored `.env.local` of each sport. Each sport uses a different Supabase project. `.gitignore` excludes `.env*` (except the example), `dist/`, `test-results/` and `originals/`. Never use a service-role key. The optional alias and former-player variables are read in `application.js`, but their format is not documented in the examples (UNRESOLVED; see `identity.js`).

**Manual dashboard steps** (outside the repo): add the deployed `<origin>/hockey/` URL to Hockey's Supabase Auth Redirect URLs (see `HANDOVER.md`).

---

## 12. Tests and build configuration

### Commands

| Where | Command | What it runs |
|---|---|---|
| root | `npm test` | `tests/portal.test.js` (6 unit tests) |
| root | `npm run build` | `tools/build.mjs`: portal plus both sports into `dist/` |
| root | `npm run test:browser` | `tests/browser-check.js` (against `dist/`) and `tests/dev-check.js` |
| root | `npm run test:all` | All of the above plus both sports' `npm test` |
| root | `npm run dev` / `preview` | Unified dev server (5170) / `dist/` preview |
| each sport | `npm test` | `node --test tests/*.test.js` |
| each sport | `npm run build` | `vite build` (relative base) |
| each sport | `npm run test:browser` | `tests/browser-check.js`: parity with the original HTML for every feature |
| each sport | `npm run test:demo` | `tests/demo-check.js`: Demo Mode in a real browser |

Browser tests need Chrome at the Windows default path; set `BGSU_BROWSER` (root, demo) or `HOCKEY_BROWSER` (Hockey parity) to use another executable. Local ports used: 5170/5171 (dev/preview), 5172 and 5174 (portal checks), 5178/5179 (Hockey parity, per `hockey/AGENTS.md`), 5181 and 5182 (demo checks).

### Configuration files

- **`package.json` (root)** — scripts above; dev dependencies `vite` and `playwright-core`.
- **`<sport>/package.json`** — runtime dependencies: `@supabase/supabase-js`, `chart.js`, `acorn`, and in Hockey `xlsx`; plus the scripts above.
- **`vite.config.js` (root)** — `base:'./'`, MPA mode. **`<sport>/vite.config.js`** — `base:'./'`, es2022 target, loopback host.
- **`<sport>/reference-manifest.json`** — which original-file line ranges each extracted file came from. Historical.
- **`<sport>/tools/`** — `extract-reference.mjs`, `inspect-reference.mjs` and `sanitize-reference-comments.mjs` are one-time migration scaffolding (do not re-run). `volleyball/tools/_vb_inspect.mjs` is tracked but its purpose is **UNRESOLVED** (name suggests a scratch inspector; read it before deleting).
- **`<sport>/AGENTS.md`, `HANDOVER.md`, `README.md`** — working rules, the history of decisions, and run instructions. Root `README.md` and `HANDOVER.md` cover the portal and deployment.

### Which test protects what

| Test file | Protects |
|---|---|
| `<sport>/tests/scoring.test.js` | Scoring parity with the original script on synthetic data: composite (1,479 cases), tiers, ACWR, outliers, radar, readiness. |
| `<sport>/tests/data.test.js` | Database field mapping, dedupe and active roster, CSV and import parsing, session read gating and paging, authentication behaviour. |
| `<sport>/tests/integrity.test.js` | Original HTML files unchanged (hash check; needs `originals/`); each original sidebar entry has a feature-owned UI, logic, CSS and test; source contains no backend configuration or private identity constants. |
| `<sport>/tests/loader.test.js` | Feature discovery never runs feature code; invalid features are isolated; failed imports are rejected. |
| `<sport>/tests/demo.test.js` | Demo data is synthetic and incomplete in places; the in-memory client works and mutates only copies; no real client in Demo Mode; Live flow unchanged. |
| `<sport>/tests/browser-check.js` | Every feature's text and chart inputs equal the original's; interactions (`verify` in each `<id>.test.js`); CSV and PDF exports; file imports; regressions (partial records, non-contiguous ids); navigation races. |
| `<sport>/tests/demo-check.js` | Demo entry and exit, all features render with no error or NaN, charts exist, sparse athletes, no backend traffic, Back/Forward, refresh. |
| `<sport>/tests/{browser-harness.html,browser-harness.js,fixtures.js,support.js}` | Helpers: a harness page that boots the app without authentication and injects synthetic data; synthetic athletes, sessions and history; a fake document, `services()` factory and original-script oracle. |
| `tests/portal.test.js`, `tests/browser-check.js`, `tests/dev-check.js` | Registry rules, built-portal behaviour and Sports Home navigation, dev-server mount points. |

Test data are synthetic. External traffic is blocked in the browser tests. Do not run automated checks against live Supabase.

---

## 13. Unresolved items

1. **Retiring the parity baseline** — the plan for when visible text or chart colours may legitimately diverge from the originals is not documented. See `hockey/HANDOVER.md` and `hockey/tests/browser-check.js`.
2. **`volleyball/tools/_vb_inspect.mjs`** — tracked; purpose not confirmed.
3. **Supabase schema and RLS** — not in the repository; cannot be audited here.
4. **Format of the optional alias and former-player environment variables** — read in each `application.js` and parsed as JSON; the expected shape is defined in each sport's `services/data/identity.js`, and no example is provided.
5. **Volleyball `dedupeATHLETES`** — defined in `volleyball/src/services/import/import.js`; confirm whether other code depends on it before moving it.
6. **Hosted deployment and non-Chrome browsers** — not verified (see root `HANDOVER.md`).
