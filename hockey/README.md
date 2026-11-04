# BGSU Hockey

Independent Vite application using vanilla JavaScript ES modules. The original Hockey HTML is the behavioral reference; neither original HTML file is modified.

## Run

Use Node 22 and npm. From this directory in PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the loopback URL printed by Vite. The application starts at the sign-in screen. Put the authorized project's public browser configuration in ignored `.env.local`, then restart Vite:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

Never use a service-role key. Vite variables are included in browser bundles. Supabase authentication, table access, and storage still rely on the project's existing policies; this refactor changes no database schema or policies. No production backend is configured by default.

Reference-specific nickname aliases and former-player exclusions were moved to ignored `.env.local` under `VITE_HOCKEY_NICKNAME_ALIASES` (JSON object) and `VITE_HOCKEY_FORMER_PLAYERS` (JSON array). Preserve this local file during handoff. A new checkout needs those organization-owned rules supplied separately if it must reproduce those specific identity matches. Empty rules affect identity matching, not formulas. Do not commit identities or environment files.

## Find the code

| Component | Owner |
| --- | --- |
| Startup and dependency composition | `src/main.js`, `src/application.js`, `src/services/context.js` |
| Sidebar, topbar, navigation, main container, recovery | `src/layout/layout.js`, `shell.html`, `layout.css`, `error-handler.js` |
| Discovery and lazy implementation imports | `src/layout/feature-loader.js`, Vite globs in `application.js` |
| Feature DOM, charts, timers and mount/unmount | `src/layout/feature-runtime.js`, `dom-scope.js` |
| Existing UI event compatibility | `src/layout/events.js` |
| Dashboard, roster, profile, jumping, forceplate, readiness, workload, leaderboard, position, progress, compare, audit | Corresponding `src/features/<id>/` folder |
| Fixed standards, composite/decline rules | `src/services/scoring/composite.js` |
| Readiness score, PRs, outlier filtering, radar normalization | `src/services/scoring/readiness.js`, `outliers.js`, `radar.js` |
| Supabase sign-in/reset/session boot | `src/services/authentication/` |
| CSV/XLSX/custom/VALD/Firstbeat/Teambuildr imports and validation | `src/services/import/` |
| CSV export and readiness print report | `src/services/export/` |
| Database mapping, debounced saves, realtime and audit writes | `src/services/data/persistence.js` |
| Session/history reads and writes | `src/services/data/sessions.js`, `session-persistence.js` |
| Identity, active roster, photos, metric merge and availability | Other named modules in `src/services/data/` |
| Common original UI primitives/theme | `src/styles/reference.css` |

Every feature has `registration.js`, `feature.js`, `<id>.html`, `<id>.js`, `<id>.css`, and `<id>.test.js`. Feature-specific styles also remain with their original inline UI where appropriate. Profile, workload and position stylesheet sections live with those features. Common primitives are reused inside each feature's ShadowRoot.

`reference-manifest.json` records the original Hockey SHA-256 and each extracted symbol's owner/dependencies. Logic has comments pointing to original source lines. The one-time extraction tools are retained for auditability; they are not the application runtime or a normal rebuild step.

## Lifecycle and data flow

Vite discovers `features/*/registration.js` modules and imports their metadata. These modules contain literals only; they import no UI or calculations. The loader validates each entry and matches its lazy `feature.js` chunk. A valid feature folder appears in the sidebar automatically.

The shell mounts one feature at a time and awaits initialization. It catches chunk, contract, mount and cleanup errors and provides a retry action while keeping navigation usable. A new navigation cancels waiting for an older import or mount. Feature cleanup removes delegated handlers, clears timers/animation frames, destroys charts and unregisters feature actions. Detached feature DOM and local selection state are cached for later navigation. Async workload/progress rendering checks the mount's cancellation signal.

Each application creates a context with a service API. Domain state stays in service closures and is exposed with explicit getters/setters; feature state stays in feature closures. Dependencies use `context.api.<name>` rather than application globals. `services/modules.js` is the service composition list. Features register their own actions only while mounted, with collision checks. A trusted service document adapter can find the active feature's nodes; a feature's document adapter only searches its own ShadowRoot. Cross-feature profile navigation goes through the shell and waits for mounting before selecting the athlete.

Trace a value through `DB_FIELDS`/session records → `enrichAthletesFromSessions` and `applyBestRecentValues` → `rescoreAllAthletes`/`calcCompositeVB` → the feature's rendering function → its Chart.js dataset. Historical metric names are intentionally preserved: `approachJump` means broad jump, `standVert` means Goal to Blue, and workload keys retain the reference's Firstbeat mappings. Do not reinterpret them based on their old names.

The reference used inline event-handler strings. They are now inert `data-on...` attributes interpreted by `events.js`, which supports the reference's small call/assignment/conditional language. It exposes known actions, `this`, `event`, and a scoped document without `eval` or window functions. New code can use ordinary `addEventListener` with cleanup. Unsupported event syntax produces a labeled interaction error.

## Add a feature

For example, create `src/features/notes/registration.js`:

```js
export default {id:'notes', title:'Notes', icon:'', order:100, section:'Analysis'};
```

Then `src/features/notes/feature.js` can implement the contract directly:

```js
import metadata from './registration.js';
let host;
export default {
  ...metadata,
  mount(container, context) {
    host = container;
    const root = host.attachShadow({mode:'open'});
    const heading = container.ownerDocument.createElement('h2');
    heading.textContent = 'Notes';
    root.append(heading);
  },
  unmount() { host?.shadowRoot?.replaceChildren(); host = undefined; }
};
```

This is a documentation example, not an installed production feature. For a real extracted feature, follow the existing `createFeature` pattern, keep UI/logic/CSS/tests together, and use the provided scoped document and lifecycle signal. Do not query, replace, or restyle shell nodes. No layout change is needed. Rename/remove the whole folder to rename/remove a feature, and run checks.

## Verify and debug

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
```

The original files must remain available at `../originals/` for reference comparisons. They are intentionally untracked. Browser checks use installed Chrome at the documented Windows path; set `$env:HOCKEY_BROWSER` to another Chromium executable if needed. They use ports 5178/5179, reject external traffic, and never use production Supabase. Build before browser verification to include production startup checks. Results go to ignored `test-results/`.

Run an individual feature's browser scenario and reference comparison:

```powershell
$env:HOCKEY_FEATURE='profile'
npm.cmd run test:browser
Remove-Item Env:HOCKEY_FEATURE
```

The browser runner imports `<id>.test.js` from that feature's folder. Each scenario changes a filter, selector, tab, or equivalent UI control and compares the resulting text and chart inputs against the reference. It also runs shared navigation/error/export checks. Unit tests can be focused with `node --test tests/scoring.test.js` or `node --test tests/data.test.js`.

Console messages begin with `[Hockey:<scope>]`. A feature error is displayed above the main content; retry it or navigate elsewhere. To diagnose a value, use its reference line annotation and the flow above. ShadowRoots are open for inspection in browser DevTools. The production application has no test API; only `tests/browser-harness.html` exposes synthetic test state.

## Validation limits

- No prior tests or historical 1,479-case fixtures were supplied. The 1,479-case corpus here is newly generated synthetic characterization against the local original, supplemented with readiness/outlier/radar/data tests. It is not a recovered historical suite.
- Browser comparisons cover synthetic visible text, chart type/data/color inputs, per-feature interactions, CSV/XLSX previews, CSV export, readiness report HTML, cleanup and failure recovery. They do not prove exhaustive dataset parity or pixel-perfect rendering. Fonts are blocked during automated checks; installed fallback fonts are used in both versions.
- PDF report HTML and print cleanup are tested; physical printer output and a human's Save-as-PDF interaction are not automated.
- Supabase auth/data calls are tested with mocks. Live sign-in, production RLS, realtime across two actual coaches, storage upload, and a full corpus of source-specific spreadsheet variants remain manual or future synthetic acceptance work. Never point automated tests at production.
- The reference profile renderer assumes all displayed metrics exist; incomplete imported profiles can still fail in that renderer. The shell contains the failure and remains navigable. This migration intentionally preserves existing rendering/calculation behavior rather than silently filling missing metrics.
- ES modules and Shadow DOM prevent ordinary coupling, not arbitrary/malicious JavaScript, infinite loops, memory exhaustion, or third-party global failures. Service state and the chart registry are shared within the application. Authenticated requests may finish after a feature is canceled. A chunk with an evaluation failure may require a page reload after a fix because browsers cache module failures.
- The pinned Chart.js/XLSX dependencies produce a large initial bundle warning. Splitting those libraries further is optional optimization, not required for behavior preservation.

See HANDOVER.md for exact checkpoint, test results, pending acceptance work and continuation instructions.

## Demo Mode
The login screen has "Explore Demo" (synthetic data, no credentials/network) and "Sports Home". See HANDOVER.md, "Demo Mode". Run `npm run test:demo`.
