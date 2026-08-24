# Release Notes: Goal Detail Preview

**What shipped**: Clicking a goal's title in the Notes dashboard's Goals tab now opens a read-only detail preview — description, timeline/progress, a computed "Overdue" indicator for active goals past their target date, and the goal's item list — with quick Edit/Close actions. No schema, API, or auth changes.

**Risk level**: Low — pure client-side addition (new modal component + two new pure helpers). Existing goal-row interactions (icons, status dropdown, completion slider, drag-and-drop reorder) are unaffected, confirmed both in code review and live manual testing.

**What was verified**:
- Unit tests: 18 tests in `goalsUtils.test.ts` covering the new `computeGoalProgress`/`computeGoalDisplayStatus` helpers (including edge cases: missing dates, pre-start negative elapsed days, exact-boundary target date, timezone-consistent local-date parsing).
- Full project suite: 24 files / 173 tests passing.
- CORRECTNESS: 8-angle adversarial code review found and fixed a real timezone bug (UTC-vs-local date parsing could shift overdue detection by up to a day), 2 CLAUDE.md icon-size convention violations, and several code-quality/consistency nits; also surfaced and fixed 3 unrelated rocket-core (devcore.py) issues discovered along the way (a stale command-display bug, a PowerShell `Remove-Item` guard gap, and a git-global-flag false positive).
- QA: manual walkthrough against real authenticated data — verified the preview opens with full detail, the Overdue/Active badge distinction on two real goals with opposite expected outcomes, Edit correctly hands off to the existing inline-edit flow, existing icon/control interactions are unaffected, and Escape closes the modal.
