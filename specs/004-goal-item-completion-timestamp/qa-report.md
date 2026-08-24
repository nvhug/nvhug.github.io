# QA Report: Goal Item Completion Timestamp

**Method**: This feature has no new visible UI surface — `completed_at` is stored/maintained only (spec explicitly scopes display out). QA therefore covers (1) the backend transition semantics via automated unit tests, and (2) the one new interactive UI change (disabling the completion toggle while an item is being edited, added during CORRECTNESS review to close a real concurrent-write race) via a live manual check with the user, since there is no browser-automation tool in this session. Supplemented by `npx tsc --noEmit` (clean), `npx eslint` on changed files (clean), and the full unit suite (24 files / 183 tests passing).

## Results (against specs/004-goal-item-completion-timestamp/spec.md)

| # | Scenario | Result |
|---|----------|--------|
| 1 | Completing a not-completed item sets `completed_at` (via toggle) | ✅ Covered by automated test (`useGoalsActions.test.ts`: "sets completed_at when completing a not-yet-completed item") |
| 2 | Un-completing a completed item clears `completed_at` to null (via toggle) | ✅ Covered by automated test ("clears completed_at when un-completing a completed item") |
| 3 | A failed write rolls back both `is_completed` and `completed_at`, not just the former | ✅ Covered by automated test ("rolls back completed_at (not just is_completed) on a failed write") |
| 4 | Completing/un-completing via the edit form's "Done" checkbox sets/clears `completed_at` the same way (per Clarifications) | ✅ Covered by 2 automated tests (`saveEditingGoalItem` set/clear cases) |
| 5 | An unrelated edit (content/type/result/metadata, completed state unchanged) leaves `completed_at` untouched | ✅ Covered by automated test ("leaves completed_at untouched when re-saving with completed state unchanged") |
| 6 | (CORRECTNESS finding, fixed pre-QA) The dedicated completion toggle must not remain clickable while that same item is being edited — was a real concurrent-write race that could silently wipe a just-set `completed_at` | ✅ Pass — live-verified with the user: toggle circle is visibly disabled/dimmed and unclickable while the item's edit form (opened via its Pencil icon) is active |
| 7 | The toggle re-enables after leaving edit mode (Save or Cancel) | Not re-confirmed live (user moved on after scenario 6) — verified by code inspection instead: the `disabled` prop is bound directly to `editingGoalItemId === item.id`, and both the existing Save and Cancel handlers already call `setEditingGoalItemId(null)` unchanged by this diff, so the toggle re-enables as soon as either fires |
| 8 | Double-click does not open a goal item's edit mode | ❌ **Found broken during this QA pass** (pre-existing, not introduced by this feature) — see Known Issues below |

## Known Issues (pre-existing, out of scope for this feature)

- **Double-click-to-edit does not work for goal items.** CLAUDE.md documents "double-click on a row to enter edit mode" as a global convention, and `GoalsTab.tsx`'s item row does wire an `onDoubleClick={() => startEditingGoalItem(item)}` handler — but the user confirmed live that double-clicking a goal item does nothing. The same row also has `draggable` set, which is a plausible cause (a native drag gesture can consume the first click of what would otherwise register as a double-click). The Pencil icon (always a separate, working entry point) is unaffected. Not fixed here: unrelated to this feature's diff, and worth its own investigation rather than a guessed fix under this feature's changes.
- CORRECTNESS review surfaced several other pre-existing issues from earlier features (reorder position-vs-id diff never persisting once orders are sequential; `GoalDetailPreviewModal` showing a false empty item list for a goal never expanded; a timezone-inconsistent date badge in `GoalsTab.tsx` vs. the preview modal; a DST off-by-one in `computeGoalProgress`; a duplicate `formatLocalDateString`/`toLocalISODate`; duplicated modal shell markup vs. `ConfirmModal`; a missing direct unit test for `parseLocalDate`) — none introduced by this feature's diff, not fixed here, reported to the user separately for backlog triage.

## Verdict

All functional requirements (FR-001 through FR-005) for this feature are verified — the backend semantics exhaustively by automated tests (which is appropriate here, since there's no UI surface for them to be observed through), and the one genuine new interactive behavior by a live manual check. One pre-existing, unrelated UI bug (double-click-to-edit) was discovered incidentally during this QA pass and is documented above, not fixed under this feature.
