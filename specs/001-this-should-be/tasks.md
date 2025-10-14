# Task Breakdown: Multi-purpose Real-time Communication Platform

**Feature**: Multi-purpose Real-time Communication Platform
**Approach**: Test-Driven Development (TDD)

This document breaks down the implementation of the feature into a series of actionable, dependency-ordered tasks. Tasks are grouped by user story to facilitate incremental, testable development.

## Phase 1: Project Scaffolding

*Goal: Initialize the frontend and backend projects and install initial dependencies.*

- [ ] **T001**: [Setup] Create a new Next.js application in the `frontend` directory using the App Router.
- [ ] **T002**: [Setup] Create a new Node.js project in the `backend` directory and initialize it for Feathers.js.
- [ ] **T003**: [Deps] Install core frontend dependencies in `frontend`: `@livekit/components-react`, `livekit-client`.
- [ ] **T004**: [Deps] Install core backend dependencies in `backend`: `@feathersjs/feathers`, `@feathersjs/express`, `feathers-prisma`, `prisma`.

## Phase 2: Foundational Setup (Blocking)

*Goal: Establish the core infrastructure (database, auth, testing frameworks) required for all user stories.*

- [ ] **T005**: [Test] [Backend] Configure Jest/Mocha for service-level testing in the `backend` project.
- [ ] **T006**: [Test] [Frontend] Configure Jest and React Testing Library in the `frontend` project.
- [ ] **T007**: [Backend] Define the `User` and `Session` models in `backend/prisma/schema.prisma` as specified in `data-model.md`.
- [ ] **T008**: [Backend] Run `npx prisma migrate dev` to generate the Prisma client and create the initial database schema.
- [ ] **T009**: [Backend] [Auth] Implement the Feathers.js authentication service, configuring it to use the `User` model.
- [ ] **T010**: [Frontend] [Auth] Create a global Auth context/provider in the `frontend` to manage JWTs and user state.
- [ ] **T011**: [Frontend] Create the main application layout in `frontend/app/layout.tsx`, including the new Auth provider.

---
**Checkpoint**: Foundational infrastructure is in place. The application has a database schema and working authentication. The project is ready for feature development.
---

## Phase 3: User Story 0 - User Login

*Goal: A user can log into the platform.*

- [x] **T012**: [Test] [Frontend] Write a component test for the login form. (`frontend/app/components/LoginForm.tsx`)
- [x] **T013**: [Frontend] Implement the login form component. (`frontend/app/components/LoginForm.tsx`)
- [x] **T014**: [Frontend] Implement the `/api/authentication` Next.js API route to proxy login requests to the backend. (`frontend/app/api/authentication/route.ts`)
- [x] **T015**: [Frontend] Update `AuthContext` to handle login state and token storage. (`frontend/app/contexts/AuthContext.tsx`)
- [x] **T016**: [Frontend] Update `frontend/app/page.tsx` to display the login form and redirect on successful login.

---
**Checkpoint**: User Story 0 is complete. Users can now log into the platform.
---

## Phase 4: User Story 1 - User Registration

*Goal: A new user can register for an account.*

- [x] **T017**: [Test] [Frontend] Write a component test for the registration form. (`frontend/app/components/RegisterForm.tsx`)
- [x] **T018**: [Frontend] Implement the registration form component. (`frontend/app/components/RegisterForm.tsx`)
- [x] **T019**: [Frontend] Implement the `/api/users` Next.js API route to proxy registration requests to the backend. (`frontend/app/api/users/route.ts`)
- [x] **T020**: [Backend] Ensure the `users` service `create` method allows unauthenticated access and hashes passwords. (`backend/src/services/users/users.service.ts`)
- [x] **T021**: [Frontend] Update `frontend/app/page.tsx` to display the registration form and redirect on successful registration.

---
**Checkpoint**: User Story 1 is complete. New users can now register for an account.
---

## Phase 5: User Story 2 - Password Recovery

*Goal: A user can recover their account if they forget their password.*

- [x] **T022**: [Test] [Backend] Write service tests for password reset request and password change.
- [x] **T023**: [Backend] Implement password reset request endpoint (`POST /authentication/reset-password`).
- [x] **T024**: [Backend] Implement password change endpoint (`POST /authentication/change-password`).
- [x] **T025**: [Test] [Frontend] Write a component test for the "Forgot Password" form.
- [x] **T026**: [Frontend] Implement the "Forgot Password" form and password reset page.

---
**Checkpoint**: User Story 2 is complete. Users can now recover their accounts.
---

## Phase 6: User Story 3 - P2P Video Chat

*Goal: A user can start a private, secure video chat with another user.*

- [x] **T027**: [Test] [Backend] Write a service test for creating a P2P session.
- [x] **T028**: [Backend] Create a `sessions` service in Feathers.js that can create a `p2p` type session. (`backend/src/services/sessions/sessions.service.ts`)
- [x] **T029**: [Test] [Frontend] Write a component test for a user list/search component that allows selecting a user to invite.
- [x] **T030**: [Frontend] [P] Implement the user list/search component that fetches users from the backend. (`frontend/app/components/UserList.tsx`)
- [x] **T031**: [Test] [Frontend] Write a test for the LiveKit token generation endpoint.
- [x] **T032**: [Frontend] Implement the `/api/livekit-token` Route Handler in Next.js to securely generate LiveKit tokens. (`frontend/app/api/livekit-token/route.ts`)
- [x] **T033**: [Test] [Frontend] Write a component test for the P2P chat room UI, mocking the LiveKit connection.
- [ ] **T034**: [Frontend] Implement the P2P chat room component (`/p2p/[sessionId]`), which uses the LiveKit React components to establish a connection.

---
**Checkpoint**: User Story 3 is complete. Users can now initiate and participate in private P2P video calls.
---

## Phase 7: User Story 4 - Broadcast a Livestream

*Goal: A broadcaster can start a livestream that others can view.*

- [ ] **T035**: [Test] [Backend] Write a service test to ensure only users with the 'broadcaster' role can create a 'broadcast' type session.
- [ ] **T036**: [Backend] Add the RBAC hook to the `sessions` service to protect the creation of 'broadcast' sessions. (`backend/src/services/sessions/sessions.service.ts`)
- [ ] **T037**: [Test] [Frontend] Write a component test for a "Go Live" control panel for broadcasters.
- [ ] **T038**: [Frontend] [P] Implement the "Go Live" component, visible only to users with the 'broadcaster' role. (`frontend/app/components/GoLivePanel.tsx`)
- [ ] **T039**: [Frontend] Implement the broadcaster's view of the livestream room, which sends their audio/video.

---
**Checkpoint**: User Story 4 is complete. Broadcasters can now create and manage livestreams.
---

## Phase 8: User Story 5 - View a Livestream

*Goal: A viewer can watch a livestream.*

- [ ] **T040**: [Test] [Frontend] Write a test for the public-facing livestream viewer page.
- [ ] **T041**: [Frontend] Implement the public viewer page (`/broadcast/[sessionId]`) that connects to LiveKit as a viewer (no audio/video sent).

---
**Checkpoint**: User Story 5 is complete. The core feature set is now implemented and testable.
---

## Dependencies & Strategy

*   **Implementation Strategy**: The tasks are ordered to deliver a functional MVP (User Login, Registration, Password Recovery) first, followed by P2P chat and broadcast capabilities. Each user story phase is a self-contained, deliverable increment.
*   **Dependency Graph**:
    ```
    (Phase 1: Scaffolding) -> (Phase 2: Foundational) -> (Phase 3: US0) -> (Phase 4: US1) -> (Phase 5: US2) 
                                                                       -> (Phase 6: US3) -> (Phase 7: US4) -> (Phase 8: US5)
    ```
    *Note: US0, US1, US2 are foundational for all other user stories.*

*   **Parallel Execution Example (Phase 6)**:
    *   Team member A can work on **T028** (Backend service).
    *   Team member B can work on **T030** (Frontend UI) in parallel, using a mocked API until the backend is ready.