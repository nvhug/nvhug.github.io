# Feature Specification: Horoscope Onboarding (Tử Vi Onboarding)

**Feature Branch**: `005-tu-vi-onboarding`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "Onboarding step of the 'Xem tử vi' feature — a form to collect birth date, birth time, and gender, saved as a personal horoscope profile for a logged-in user, then routed to a fortune-overview destination. Excludes fortune scoring, AI Q&A, compatibility matching, and gamification — those are separate future features."

## Clarifications

### Session 2026-08-24

- Q: Should the user enter their birth date on the solar (Gregorian) calendar, or directly on the lunar calendar? → A: Solar calendar input; the system automatically converts it to the lunar-calendar equivalent internally, hidden from the user.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-time onboarding (Priority: P1)

A logged-in user who has never set up a horoscope profile opens the horoscope feature for the first time. They are asked for their birth date, gender, and (optionally) birth time. After submitting, their information is saved and they land on the fortune-overview destination.

**Why this priority**: Without this flow, no other horoscope feature (daily fortune, AI Q&A, compatibility) has the birth data it depends on. This is the entry point for the entire feature area.

**Independent Test**: Log in as a user with no saved horoscope profile, open the horoscope entry point, fill in birth date + gender, submit, and confirm the profile is saved and the user is routed onward — independent of any other horoscope screen existing yet.

**Acceptance Scenarios**:

1. **Given** a logged-in user with no saved horoscope profile, **When** they open the horoscope entry point, **Then** they see a form asking for birth date, birth time (optional), and gender.
2. **Given** the user has filled in a valid birth date and selected a gender, **When** they submit the form, **Then** their horoscope profile is saved and they are taken to the fortune-overview destination.
3. **Given** the user leaves birth time blank and checks "Không rõ giờ sinh", **When** they submit, **Then** the profile is saved successfully without a birth time value.

---

### User Story 2 - Returning user skips onboarding (Priority: P2)

A logged-in user who already completed onboarding opens the horoscope feature again. Instead of seeing the onboarding form, they go straight to the fortune-overview destination.

**Why this priority**: Re-showing the onboarding form on every visit would break the "quick daily check-in" habit the feature is meant to build.

**Independent Test**: Log in as a user with an existing saved profile, open the horoscope entry point, and confirm the onboarding form is not shown and the user lands directly on the fortune-overview destination.

**Acceptance Scenarios**:

1. **Given** a logged-in user with a previously saved horoscope profile, **When** they open the horoscope entry point, **Then** they are routed directly to the fortune-overview destination without seeing the onboarding form.

---

### User Story 3 - Edit saved birth info (Priority: P3)

A user who already has a saved profile wants to correct or update their birth information (e.g., they entered the wrong birth time).

**Why this priority**: Data entry mistakes are common for a date/time form; without an edit path, a wrong entry becomes permanent and taints every downstream horoscope reading.

**Independent Test**: As a user with an existing profile, navigate to the edit entry point, change a field, save, and confirm the updated values are what subsequent reads return.

**Acceptance Scenarios**:

1. **Given** a user with a saved horoscope profile, **When** they open the edit entry point, **Then** the form is pre-filled with their currently saved values.
2. **Given** the user changes one or more fields and submits, **When** the save succeeds, **Then** the profile reflects the new values on the next read.

---

### Edge Cases

- What happens when the user submits a birth date that doesn't exist on the calendar (e.g., 31/02) or is in the future? → Rejected with an inline error; nothing is saved.
- What happens when the user submits the form without selecting a gender? → Rejected with an inline error; gender is a required field.
- What happens when an unauthenticated visitor tries to reach the onboarding form directly? → They are redirected to sign in first.
- What happens when a user with an existing profile navigates straight to the onboarding URL (not the edit URL)? → They see their existing info pre-filled for editing, not a blank first-time form.
- What happens if the fortune-overview destination page doesn't exist yet at the time this feature ships? → The user is routed to a lightweight placeholder screen instead of a broken link.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST require the user to be authenticated before accessing the onboarding or edit form.
- **FR-002**: System MUST collect birth date (required, entered on the solar/Gregorian calendar), gender (required), and birth time (optional) from the user.
- **FR-003**: System MUST let the user explicitly mark birth time as unknown instead of forcing a guessed value.
- **FR-004**: System MUST validate that the birth date is a real calendar date and not later than today.
- **FR-004a**: System MUST automatically derive the lunar-calendar equivalent of the entered solar birth date and store it alongside the profile, without requiring the user to perform the conversion themselves.
- **FR-005**: System MUST block submission and show a clear, non-technical inline error when a required field is missing or invalid, without discarding the values the user already entered.
- **FR-006**: System MUST persist a submitted profile as the user's personal horoscope profile, associated with their account.
- **FR-007**: System MUST route the user to the fortune-overview destination immediately after a successful save.
- **FR-008**: System MUST detect, on opening the horoscope entry point, whether the user already has a saved profile, and skip straight to the fortune-overview destination when one exists.
- **FR-009**: System MUST let a user with an existing profile view and edit their previously saved values, and persist the changes.
- **FR-010**: System MUST display a disclaimer that the horoscope content is for reference/entertainment purposes only, visible on the onboarding form.
- **FR-011**: System MUST support exactly one horoscope profile per user account for this feature (profiles for other people, e.g., a partner for compatibility matching, are out of scope here).

### Key Entities

- **Horoscope Profile**: One per user account. Holds birth date (required, entered on the solar calendar, with its lunar-calendar equivalent auto-derived and stored alongside it), birth time (optional, may be explicitly "unknown"), and gender (Nam / Nữ / Khác). Editable after creation. Owned by exactly one user account; not shared or visible to other users.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can complete the birth-info onboarding and reach the fortune-overview destination in under 1 minute.
- **SC-002**: 100% of invalid birth-date submissions (future date, non-existent calendar date) are rejected before a profile is saved.
- **SC-003**: A returning user with a saved profile reaches the fortune-overview destination without ever seeing the onboarding form again.
- **SC-004**: A user can edit their saved birth info and have the new values reflected immediately, with zero loss of other account data.

## Assumptions

- Gender is offered as three options: Nam / Nữ / Khác.
- Birth time is optional; the form provides an explicit "Không rõ giờ sinh" (birth time unknown) choice rather than forcing a default time.
- Exactly one horoscope profile exists per user account for this feature; multi-person profiles (e.g., for the future "So sánh hai người" feature) are out of scope here.
- The fortune-overview destination page is being built as a separate feature; this feature only needs a valid route to land on (a placeholder screen is acceptable if the real page isn't ready yet).
- The existing site authentication (PIN/OAuth session) is reused; no new auth flow is introduced.
- Fortune scoring, AI Q&A, compatibility matching, and gamification (streaks, cards, badges) are explicitly out of scope for this feature and will be specified separately.
