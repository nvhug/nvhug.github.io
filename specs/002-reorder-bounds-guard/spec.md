# Feature Specification: Reorder Bounds Guard

**Feature Branch**: `002-reorder-bounds-guard`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Guard reorderGoalItemsLocal against out-of-bounds fromIndex/toIndex so a stale or invalid index can't silently corrupt the goal list order."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reorder never corrupts the list on a bad index (Priority: P1)

A user drags a goal item to reorder it within a goal's item list. If the drag interaction produces a stale or invalid index (e.g. the list changed between drag start and drop), the reorder must be rejected rather than silently scrambling the list.

**Why this priority**: A corrupted item order is a silent data-integrity issue the user may not notice until much later, and it's the only behavior this feature changes.

**Independent Test**: Call the reorder function directly with an out-of-range index and confirm the returned list is unchanged from the input.

**Acceptance Scenarios**:

1. **Given** a list of goal items, **When** reordering with a negative `fromIndex` or `toIndex`, **Then** the returned list is unchanged (same order, same items).
2. **Given** a list of goal items, **When** reordering with a `fromIndex` or `toIndex` greater than or equal to the list length, **Then** the returned list is unchanged.
3. **Given** a list of goal items, **When** reordering with both indices in range, **Then** the item moves to the new position exactly as before this change.

---

### Edge Cases

- What happens when the list is empty and any index is passed? → Returns the (empty) list unchanged.
- What happens when `fromIndex === toIndex` and both are in range? → No-op, list returned unchanged (existing behavior, unaffected).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The reorder function MUST return the input list unchanged when `fromIndex` is negative or `>= items.length`.
- **FR-002**: The reorder function MUST return the input list unchanged when `toIndex` is negative or `>= items.length`.
- **FR-003**: The reorder function MUST preserve its existing valid-reorder behavior when both indices are in range.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An out-of-range reorder call never changes item order or count — verified by unit test.
- **SC-002**: 100% of existing and new unit tests for the reorder function pass.

## Assumptions

- Out-of-range indices are treated as a no-op (return the original list), not thrown errors — consistent with the existing `fromIndex === toIndex` no-op behavior in the same function.
- No UI change is required; this is a pure-function hardening of logic already wired into the drag-and-drop handler.
