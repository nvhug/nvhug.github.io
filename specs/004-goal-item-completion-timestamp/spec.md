# Feature Specification: Goal Item Completion Timestamp

**Feature Branch**: `004-goal-item-completion-timestamp`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Track when a goal item was completed. Add a nullable completed_at timestamp column to goal_items, following the project's existing schema-change convention (a plain .sql file under sql/, e.g. sql/add_order_column.sql, sql/add_result_field.sql -- NOT the Supabase-CLI supabase/migrations/ convention, which this project does not use). When a user toggles a goal item from not-completed to completed, set completed_at to the current time. When a user toggles it back from completed to not-completed, clear completed_at to NULL. No other update to the item (editing content, type, result, metadata) should change completed_at. No UI surface for this timestamp yet -- it is stored and maintained only; displaying it is out of scope for this feature. No new API routes, no new auth, no destructive migration (no DROP, no backfill, no default value, no NOT NULL constraint)."

## Clarifications

### Session 2026-08-24

- Q: `is_completed` can change via two separate code paths — the dedicated completion toggle, and the "Done" checkbox inside the item edit form (which always re-writes `is_completed` on every save). Should the completion-timestamp set/clear semantics (FR-002/FR-003) apply to both paths, or only the dedicated toggle? → A: Apply to both paths — either one is a user-valid way to change completion state, and there's no reason to distinguish between them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Completing an item records when it happened (Priority: P1)

A user working through a goal's item list marks an item as done. The system silently records the moment that happened, without the user needing to do anything extra.

**Why this priority**: This is the entire feature — without it there is nothing to build.

**Independent Test**: Toggle a goal item from not-completed to completed and confirm the stored record now carries a completion timestamp.

**Acceptance Scenarios**:

1. **Given** a goal item that is not completed and has no completion timestamp, **When** the user marks it completed, **Then** the item's completion timestamp is set to the current time.
2. **Given** a goal item that is already completed with a completion timestamp, **When** the user marks it not-completed, **Then** the completion timestamp is cleared back to empty.

---

### User Story 2 - Unrelated edits never disturb the completion timestamp (Priority: P2)

A user edits an item's text, type, result notes, or metadata without touching its completed state. The completion timestamp must not change as a side effect.

**Why this priority**: Prevents the timestamp from silently losing its meaning ("when it was actually completed") if any unrelated save accidentally refreshes it.

**Independent Test**: Set an item's completion timestamp, then edit its content/type/result/metadata without changing its completed state, and confirm the timestamp is unchanged.

**Acceptance Scenarios**:

1. **Given** a completed goal item with a completion timestamp, **When** the user edits its content, type, result, or metadata (completed state unchanged), **Then** the completion timestamp remains exactly as it was.

---

### Edge Cases

- What happens to existing goal items that were already completed before this feature shipped? They keep no completion timestamp (empty) until the next time they are explicitly toggled off and back on — there is no retroactive backfill.
- What happens if a user rapidly toggles an item completed → not-completed → completed? The completion timestamp reflects only the most recent completion moment; intermediate states are not retained.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST persist, per goal item, an optional point in time representing when that item was most recently marked completed.
- **FR-002**: The system MUST set that completion timestamp to the current time whenever an item's completed state transitions from not-completed to completed, regardless of which of the product's two completion-changing paths (the dedicated completion toggle, or the "Done" checkbox in the item edit form) triggered the transition.
- **FR-003**: The system MUST clear that completion timestamp whenever an item's completed state transitions from completed to not-completed, regardless of which of the two completion-changing paths triggered the transition.
- **FR-004**: The system MUST NOT modify the completion timestamp as a result of any update that does not change the item's completed state (content, type, result, or metadata edits saved without a completed-state change).
- **FR-005**: The system MUST NOT retroactively populate the completion timestamp for goal items that were completed before this feature existed.

### Key Entities

- **Goal Item**: An existing entity representing one action item under a goal. Gains one new optional attribute: the moment it was most recently marked completed (empty until first completed).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of completion-toggle actions result in the completion timestamp correctly reflecting the new state (set on completion, cleared on un-completion), verified by automated tests.
- **SC-002**: 0% of non-completion-related item edits change the stored completion timestamp, verified by automated tests.
- **SC-003**: The change introduces no visible behavior difference anywhere else in the product — existing goal/item workflows (add, edit, delete, reorder, filter) are unaffected.

## Assumptions

- No UI will display the completion timestamp in this feature; it is captured for future use (e.g. a future "completed on" display or streak/history feature).
- The existing completed-toggle action is the only place completed state changes, so it is the only code path that needs to set/clear the timestamp.
- The database column is added as nullable with no default and no backfill, matching the project's established non-destructive schema-change pattern (see sql/add_order_column.sql, sql/add_result_field.sql).
