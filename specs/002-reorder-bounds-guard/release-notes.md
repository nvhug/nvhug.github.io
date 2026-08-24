# Release Notes: Reorder Bounds Guard

**What shipped**: Dragging a goal item to reorder it within a goal's item list now safely rejects an out-of-range drag (e.g. the list changed between drag start and drop) instead of silently corrupting the list order or persisting a stray write to Supabase.

**Risk level**: Low — pure client-side logic change in one hook and one utility function. No schema, auth, or API changes.

**What was verified**:
- Unit tests: `goalsUtils.test.ts` (4 new cases: negative `fromIndex`, negative `toIndex`, `fromIndex` out of range, `toIndex` out of range) and `useGoalsActions.test.ts` (2 new cases: rejected reorder is a full no-op even with `order: null` items, a genuine in-range reorder still persists).
- Full project suite: 24 files / 165 tests passing.
- CORRECTNESS: adversarial multi-angle code review (5 independent passes) found and fixed a real gap in the initial implementation — the local reorder guard alone didn't prevent a downstream Supabase write for items with a `null` `order` (never yet dragged); fixed in `useGoalsActions.ts` by detecting the no-op result before computing the update diff.
