# Task Breakdown: Real-time Communication Platform

**Feature**: Multi-purpose Real-time Communication Platform
**Approach**: Test-Driven Development (TDD)

This document breaks down the implementation of the feature into a series of actionable, dependency-ordered tasks. Tasks are grouped by user story to facilitate incremental, testable development.

## Phase 1: Project Scaffolding

*Goal: Initialize the frontend and backend projects and install initial dependencies.*

- [x] **T001**: [Setup] Create a new Next.js application in the `frontend` directory using the App Router.
- [x] **T002**: [Setup] Create a new Node.js project in the `backend` directory and initialize it for Feathers.js.
- [x] **T003**: [Deps] Install core frontend dependencies in `frontend`: `@livekit/components-react`, `livekit-client`.
- [x] **T004**: [Deps] Install core backend dependencies in `backend`: `@feathersjs/feathers`, `@feathersjs/express`, `feathers-prisma`, `prisma`.

## Phase 2: Foundational Setup (Blocking)

*Goal: Establish the core infrastructure (database, auth, testing frameworks) required for all user stories.*

- [x] **T005**: [Test] [Backend] Configure Jest/Mocha for service-level testing in the `backend` project.
- [x] **T006**: [Test] [Frontend] Configure Jest and React Testing Library in the `frontend` project.
- [x] **T007**: [Backend] Define the `User` and `Session` models in `backend/prisma/schema.prisma` as specified in `data-model.md`.
- **T008**: [Backend] Run `npx prisma migrate dev` to generate the Prisma client and create the initial database schema.
- **T009**: [Backend] [Auth] Implement the Feathers.js authentication service, configuring it to use the `User` model.
- **T010**: [Frontend] [Auth] Create a global Auth context/provider in the `frontend` to manage JWTs and user state.
- **T011**: [Frontend] Create the main application layout in `frontend/app/layout.tsx`, including the new Auth provider.

---
**Checkpoint**: Foundational infrastructure is in place. The application has a database schema and working authentication. The project is ready for feature development.
---

## Phase 3: User Story 1 - P2P Video Chat

*Goal: A user can start a private, secure video chat with another user.*

- **T012**: [Test] [Backend] Write a service test for creating a P2P session. It should fail initially.
- **T013**: [Backend] Create a `sessions` service in Feathers.js using `feathers-prisma` that can create a `p2p` type session.
- **T014**: [Test] [Frontend] Write a component test for a user list/search component that allows selecting a user to invite.
- **T015**: [Frontend] [P] Implement the user list/search component that fetches users from the backend.
- **T016**: [Test] [Frontend] Write a test for the LiveKit token generation endpoint.
- **T017**: [Frontend] Implement the `/api/livekit-token` Route Handler in Next.js to securely generate LiveKit tokens.
- **T018**: [Test] [Frontend] Write a component test for the P2P chat room UI, mocking the LiveKit connection.
- **T019**: [Frontend] Implement the P2P chat room component (`/p2p/[sessionId]`), which uses the LiveKit React components to establish a connection.

---
**Checkpoint**: User Story 1 is complete. Users can now initiate and participate in private P2P video calls.
---

## Phase 4: User Story 2 - Broadcast a Livestream

*Goal: A broadcaster can start a livestream that others can view.*

- **T020**: [Test] [Backend] Write a service test to ensure only users with the 'broadcaster' role can create a 'broadcast' type session.
- **T021**: [Backend] Add the RBAC hook to the `sessions` service to protect the creation of 'broadcast' sessions.
- **T022**: [Test] [Frontend] Write a component test for a "Go Live" control panel for broadcasters.
- **T023**: [Frontend] [P] Implement the "Go Live" component, visible only to users with the 'broadcaster' role.
- **T024**: [Frontend] Implement the broadcaster's view of the livestream room, which sends their audio/video.

---
**Checkpoint**: User Story 2 is complete. Broadcasters can now create and manage livestreams.
---

## Phase 5: User Story 3 - View a Livestream

*Goal: A viewer can watch a livestream.*

- **T025**: [Test] [Frontend] Write a test for the public-facing livestream viewer page.
- **T026**: [Frontend] Implement the public viewer page (`/broadcast/[sessionId]`) that connects to LiveKit as a viewer (no audio/video sent).

---
**Checkpoint**: User Story 3 is complete. The core feature set is now implemented and testable.
---

## Dependencies & Strategy

*   **Implementation Strategy**: The tasks are ordered to deliver a functional MVP (P2P chat) first, followed by broadcast capabilities. Each user story phase is a self-contained, deliverable increment.
*   **Dependency Graph**:
    ```
    (Phase 1: Scaffolding) -> (Phase 2: Foundational) -> (Phase 3: US1)
                                                     -> (Phase 4: US2) -> (Phase 5: US3)
    ```
    *Note: US2 is a prerequisite for US3.*

*   **Parallel Execution Example (Phase 3)**:
    *   Team member A can work on **T013** (Backend service).
    *   Team member B can work on **T015** (Frontend UI) in parallel, using a mocked API until the backend is ready.
