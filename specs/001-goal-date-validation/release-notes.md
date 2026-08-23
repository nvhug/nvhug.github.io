# Release Notes: Goal Date Range Validation

**Tier**: HOP · **Gates passed**: FRAME, PLAN, IMPLEMENT, MIGRATION, CORRECTNESS, SECURITY

## What shipped

Editing a goal in the Notes dashboard now rejects saving when the start date is
later than the target date, with a toast error (English/Vietnamese). Previously
this was silently allowed and produced a nonsensical negative progress bar.

## Risk

Low. Client-side-only validation, no schema change, no new dependency, no auth/API
surface touched. Backward compatible: existing goals with valid or partial dates are
unaffected (see `app/notes/_lib/goalsUtils.test.ts`).

## Verification

- `npm run test` — 23 files / 159 tests pass (including 6 new cases in `goalsUtils.test.ts`).
- `npx tsc --noEmit` — clean.
- Manual code review (`/code-review`) — no findings.
- Security review — no findings (plain string comparison, no injection surface).

## Process note

`/release-review`, the command this gate's documentation names, does not exist as
an installed skill/command anywhere in this project (same gap as `/superpowers` for
IMPLEMENT). `devcore.py gate auto-release` was tried first but failed with
"Diff includes binary file(s)" — caused by the ~1,444 uncommitted files rocket-core's
own install left in the working tree (unrelated to this feature). These release notes
were written by hand as the pragmatic fallback.
