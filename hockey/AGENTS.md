# Hockey application instructions

- Read HANDOVER.md before editing. Update it after meaningful checkpoints and before stopping.
- This is a behavior-preserving Vite / vanilla JavaScript migration. No React, TypeScript, redesign, placeholders, or new product features.
- Never modify ../originals/hockey.html or ../originals/volleyball.html. Their hashes are checked by tests. Do not work on Volleyball or create shared code outside hockey/.
- Treat ../originals/hockey.html as the behavioral oracle. It is an ignored local input because it contains backend configuration and identity rules. Never stage originals/, .env.local, real athlete data, credentials, or test-results/.
- Tests must use synthetic data and block external traffic. Never run automated checks against production Supabase. Preserve auth checks, Supabase RLS expectations, field mappings, pagination, deduplication, import validation, and scoring formulas.
- Feature metadata belongs in src/features/<id>/registration.js and must export a literal object only. The folder must match id. Implementation belongs in feature.js; keep its loading lazy. Do not edit the layout to add a feature.
- Features own their HTML, logic, CSS, and browser scenario. Use createFeature for scoped DOM, cached local UI state, delegated actions, cleanup and cancellation. Shared domain functions belong in the specific services/ directory. Never add window application globals.
- Keep dependencies explicit through the per-app context. reference-manifest.json lists extraction ownership and dependencies; source comments point to original lines. Do not change mathematical behavior merely to make a test pass.
- Do not rerun tools/extract-reference.mjs in normal development: it is historical scaffolding and overwrites later lifecycle/CSS edits. Its output needs a reviewed diff and all checks. sanitize-reference-comments.mjs only changes comment examples.
- Required checks from hockey/: npm.cmd test; npm.cmd run build; npm.cmd run test:browser. The browser suite uses installed Chrome, serves loopback ports 5178/5179, and closes its own server/browser. Set HOCKEY_BROWSER for another Chromium executable. See README.md for individual-feature checks.
- Preserve unrelated changes and verified Git checkpoints. Use the current local branch. Do not reset work. Commit verified milestones only, and record actual results and limitations in HANDOVER.md.
- On this Windows machine the sandbox blocks Node resolving C:/Users/soter and Git index writes. Use the relevant approved escalated npm command or request narrow execution escalation; do not change parent-repository ownership/configuration or execution policy.
