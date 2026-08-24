# Security Report: Goal Item Completion Timestamp

**Gate**: SECURITY (`/security-review`) — first real, non-phantom invocation of this gate in this project's dogfood history.

## Evidence this review actually read the diff content (not a rubber-stamp)

The reviewer was scoped to exactly this feature's 5 changed files and required to quote real
source lines. It did — verified against the actual files:

- Quoted `sql/add_goal_items_completed_at.sql` line 5 verbatim: `ALTER TABLE goal_items ADD COLUMN completed_at TIMESTAMPTZ;`
- Quoted the exact `nextCompletedAt` function body from `app/notes/_lib/goalsUtils.ts`.
- Quoted the exact `.update({ is_completed: nextIsCompleted, completed_at: nextCompletedAtValue }).eq('id', item.id)` call from `useGoalsActions.ts`'s `toggleGoalItem`.
- Quoted the exact `disabled={editingGoalItemId === item.id}` JSX added to `GoalsTab.tsx`'s toggle button (the CORRECTNESS-driven fix).
- Explicitly confirmed, by reading the file, that `GoalsTab.tsx` never renders `item.completed_at` anywhere in JSX (a claim that requires having actually opened and searched the file, not inferred from the file list).

This satisfies the standing requirement for this gate: evidence the review is grounded in the
actual diff content, not a generic "looks fine" response.

## Findings (all below the actionable-confidence threshold)

| # | File:line | Category | Confidence | Verdict |
|---|-----------|----------|------------|---------|
| F1 | `goalsUtils.ts:27-36`, `useGoalsActions.ts:179-183,260-277` | Data integrity (client-controlled timestamp) | 3/10 | Not a vulnerability — `goal_items` has no per-user ownership column; only the row's own owner can influence their own row's timestamp via their own browser clock, and `completed_at` has no downstream authorization/security use in this diff. Real observation, not actionable. |
| F2 | `GoalsTab.tsx:462-468` | UI-only guard | 2/10 | The `disabled` attribute is not a security boundary and isn't claimed to be one — it closes a data-race (CORRECTNESS finding), not an authorization gap. Bypassing it via devtools only lets a user race their own row's write, same as before this diff. |
| F3 | `sql/add_goal_items_completed_at.sql:5` | SQL injection surface | 0/10 | Static DDL, no interpolation, not exploitable. |
| F4 | `useGoalsActions.ts:275-277` | Stale-closure correctness | 2/10 | Cross-tab data inconsistency for the same user, no cross-user impact — a correctness note (already tracked as a CORRECTNESS-review finding), not a security finding. |
| F5 | `types/index.ts:141` | N/A | 0/10 | Type-only, erased at runtime. |

**Explicit finding on the feature's core question**: `completed_at` is written through the exact
same `.update()` call, same `.eq('id', item.id)` row-scoping, and therefore the same RLS
enforcement point that `is_completed` already used before this diff. No new query-construction
path, no new filter/criterion use of the new column, no new read/render path. It does not enlarge
this table's attack surface.

## Verdict

**PASS.** No finding reaches the ≥8/10 confidence bar this project's security-review process
requires for action. The review is evidence-backed (see above) rather than a pattern-matched
rubber stamp — this is the first real confirmation, on a real diff, that this gate does what its
name implies.
