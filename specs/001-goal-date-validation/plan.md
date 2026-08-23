# Implementation Plan: Goal Date Range Validation

**Spec**: [spec.md](spec.md) · **Tier**: HOP

## Approach

Pure client-side validation, no schema or API change.

1. `app/notes/_lib/goalsUtils.ts` — add `isValidGoalDateRange(startDate, targetDate)`:
   returns `false` only when both dates are non-empty and `startDate > targetDate`
   (string comparison is safe: both are `YYYY-MM-DD`). Returns `true` for empty/missing
   dates or `start <= target`.
2. `app/notes/_hooks/useGoalsActions.ts` — in `saveEditingGoal`, after the existing
   title-empty check, call `isValidGoalDateRange(editingGoalDraft.start_date, editingGoalDraft.target_date)`;
   if it returns `false`, `toast.error(t('notes.goals.dateRangeError'))` and return
   (same early-return pattern as the title check).
3. `src/lib/i18n/dictionaries/en.ts` / `vi.ts` — add `dateRangeError` next to the
   existing `nameEmptyError` key under `notes.goals`.
4. `app/notes/_lib/goalsUtils.test.ts` — add cases: start after target (invalid),
   start before target (valid), start equals target (valid), one date empty (valid).

## Why this shape

- Matches the existing `nameEmptyError` guard already in `saveEditingGoal` — same
  function, same toast pattern, same dictionary structure. No new UI component.
- Pure function in `goalsUtils.ts` keeps the check unit-testable without touching
  Supabase or React state, per this repo's testing convention (CLAUDE.md §7 / the
  project constitution's Quality standards section).
- No new files needed beyond the two dictionaries' new key — smallest possible diff.

## Out of scope

- `useGoalsActions.ts`'s goal-*item* create/edit path (checklist items) is untouched —
  only the goal-level `start_date`/`target_date` fields are in scope.
- No change to `GoalsTab.tsx`'s progress-bar rendering — preventing bad data at the
  source removes the need to defensively clamp the display.

## Note on process

gstack's `/autoplan` (the PLAN gate's documented provider) runs a 4-stage
CEO → design → eng → DX review pipeline intended for substantial plans. For a
~30-40 LOC pure-function validation change, that pipeline is disproportionate to
the change size — this plan was written directly instead. Flagged as a friction
finding for rocket-core: the PLAN gate has no lighter-weight provider option for
HOP-tier work the way IMPLEMENT's provider is configurable in config.yml.

## Tasks

See [tasks.md](tasks.md).
