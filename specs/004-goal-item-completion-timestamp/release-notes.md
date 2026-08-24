# Release Notes: Goal Item Completion Timestamp

**What shipped**: Goal items now record the moment they were most recently marked completed (`goal_items.completed_at`), set when an item transitions to completed and cleared when it transitions back to not-completed — via either the dedicated toggle or the item edit form's "Done" checkbox. No UI displays this yet; it's stored for future use. Also fixes a real concurrent-write bug found during review: the completion toggle stayed clickable while that same item's edit form was open, letting a stale edit-form save silently overwrite a concurrent toggle's result — the toggle is now disabled while editing.

**Risk level**: Low-medium — the first schema change (`ALTER TABLE goal_items ADD COLUMN completed_at TIMESTAMPTZ`, nullable, no default, no backfill) and the first security-sensitive-path diff put through this pipeline for real. Purely additive, matches the project's constitution ("only additive schema changes are safe"). No auth/RLS logic touched; the new column is written through the same `.update().eq('id', ...)` call and RLS enforcement point `is_completed` already used.

**Important operational note**: `sql/add_goal_items_completed_at.sql` must be applied to the Supabase database manually **before** this code is deployed (this project has no automated migration runner) — until it is, every completion toggle or item save will fail with a Supabase error for the missing column.

**What was verified**:
- Unit tests: 8 tests in `useGoalsActions.test.ts` (set/clear/rollback via toggle; set/clear/untouched via edit form) + 4 new tests in `goalsUtils.test.ts` (`nextCompletedAt`, updated `patchGoalItemCompletion`). Full suite: 24 files / 183 tests passing.
- MIGRATION: real gate run (first ever) — `sql/add_goal_items_completed_at.sql` scanned, no breaking patterns, passed.
- SECURITY: real `/security-review` run (first ever) — scoped to this feature's 5 changed files, findings quoted real source lines, no finding reached actionable confidence (see `security-report.md`).
- CORRECTNESS: found and fixed a real concurrent-write race (completion toggle usable during edit); several pre-existing, unrelated issues from earlier features were also surfaced and reported to the user as backlog, not fixed here.
- QA: automated tests cover the backend semantics (nothing else is visible to check); the one new interactive behavior (toggle disabled during edit) was live-verified with the user. A pre-existing, unrelated bug (double-click does not open item edit mode) was discovered incidentally and documented, not fixed.
