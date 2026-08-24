# Implementation Plan: Goal Item Completion Timestamp

## Approach

Purely additive: one nullable column, set/cleared from the two existing places that already write `is_completed`. No new abstraction needed — the spec's requirements map directly onto code that already exists.

### Files that change

- **New**: `sql/add_goal_items_completed_at.sql` — schema change, following this project's established convention (see `sql/add_order_column.sql`, `sql/add_result_field.sql`) rather than the Supabase-CLI `supabase/migrations/` convention this project does not use.
  ```sql
  ALTER TABLE goal_items ADD COLUMN completed_at timestamptz NULL;
  ```
  No default, no backfill, no NOT NULL — matches constitution.md's "only additive schema changes are safe."
- **`app/notes/_hooks/useGoalsActions.ts`**: two existing write sites both need the same transition logic added (per Clarifications — both are valid ways a user changes completed state):
  - `toggleGoalItem` — currently flips `is_completed` and writes it alone; add `completed_at: nextIsCompleted ? new Date().toISOString() : null` to the same Supabase `update()` call and to the matching local-state update.
  - `saveEditingGoalItem` — currently always re-writes `is_completed` from the draft regardless of whether it changed; must compare the draft's `is_completed` against the item's *current* `is_completed` to detect an actual transition, then set/clear `completed_at` the same way. Only a genuine transition should touch `completed_at` — re-saving the form with `is_completed` unchanged must leave `completed_at` alone (FR-004).
- **`src/types.ts`** (or wherever `GoalItem` is declared): add `completed_at?: string | null` to the type.
- **Tests**: `app/notes/_hooks/useGoalsActions.test.ts` gains cases for both write sites (set-on-complete, clear-on-uncomplete, untouched-on-unrelated-edit, untouched-on-no-op-resave).

### No schema/migration surprise

This IS a real, intentional schema change (additive `ALTER TABLE ... ADD COLUMN`, nullable, no default) — flagged here explicitly rather than hidden, since it's the entire point of this feature (exercising the MIGRATION and SECURITY gates on a real diff for the first time). Nothing about it requires anything beyond the standard non-breaking pattern already established by this project's own prior `sql/add_*.sql` files.

### Consistency with constitution.md / existing code

- Matches "only additive schema changes are safe" exactly.
- Matches the existing `sql/` file-per-change convention (not introducing a new migration tooling convention).
- No UI changes — matches the spec's explicit no-UI-surface scope, and keeps this feature from re-triggering DESIGN/QA (already proven working on Feature #2; this feature is deliberately testing the "no UI diff → skip" branch instead).
- No new component/hook — reuses `useGoalsActions.ts`'s existing two write paths, no speculative abstraction introduced.

### Risk / tradeoff

- Low risk: additive column, two small, well-isolated call-site changes, fully covered by unit tests. The only non-trivial logic is `saveEditingGoalItem` needing to detect a *transition* (compare draft vs. current) rather than unconditionally stamping `completed_at` on every save — this is exactly what FR-004 and the Clarifications answer require, and is the one place a careless implementation could get it wrong.
