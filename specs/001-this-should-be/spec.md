# Feature Specification: Multi-purpose Real-time Communication Platform

**Version**: 1.0
**Status**: DRAFT

## 1. Overview

This feature will introduce a versatile real-time communication platform. It enables users to interact in two primary ways: private, peer-to-peer (P2P) video chats and large-scale livestream broadcasts that many users can view simultaneously. The platform will be secure, ensuring only authenticated users can initiate or join sessions.

## 2. User Scenarios & Testing

### Scenario 0: User Login

*   **As a user, I want to log into the platform so that I can access authenticated features.**

*   **Acceptance Criteria**:
    *   Given I am on the login page, when I enter my registered email and password and submit the form, I am successfully authenticated.
    *   Upon successful login, I am redirected to the user dashboard.
    *   If I provide incorrect credentials, I receive an error message.

### Scenario 1: User Registration

*   **As a new user, I want to register for an account so that I can access the platform's features.**

*   **Acceptance Criteria**:
    *   Given I am on the registration page, when I provide a valid email and password and submit the form, my account is successfully created.
    *   Upon successful registration, I am automatically logged in and redirected to the user dashboard.
    *   If I provide invalid or already-registered credentials, I receive an appropriate error message.

### Scenario 2: Password Recovery

*   **As a user, I want to recover my account if I forget my password so that I can regain access to the platform.**

*   **Acceptance Criteria**:
    *   Given I am on the login page, when I click "Forgot Password", I am prompted to enter my email address.
    *   When I enter my registered email and submit, I receive an email with a password reset link.
    *   When I click the reset link, I am directed to a page where I can set a new password.
    *   Upon successfully setting a new password, I can log in with my new credentials.

### Scenario 2: Broadcast a Livestream

*   **As a user, I want to start a private video chat with another user so that we can communicate directly and securely.**

*   **Acceptance Criteria**:
    *   Given I am logged in, when I select another user, I can generate a unique link for a P2P chat.
    *   I can choose to make the P2P link public (anyone with the link can join) or private (requires a password to join).
    *   When the invited user receives and opens the link, a private session is established between only the two of us.
    *   If the link is private, the invited user must provide the correct password to join.
    *   No other users can join this session.
    *   (Future: A dedicated view for listing open invites will be added.)

### Scenario 2: Broadcast a Livestream

*   **As a broadcaster, I want to start a livestream that many viewers can join so that I can present information to a large audience.**

*   **Acceptance Criteria**:
    *   Given I have broadcaster permissions, when I choose to go live, a new broadcast session is created.
    *   A unique, shareable link is generated for my livestream.
    *   My audio and video are streamed to all connected viewers.
    *   I can see a real-time count of the number of viewers.
    *   I can end the broadcast, which terminates the session for all viewers.

### Scenario 3: View a Livestream

*   **As a viewer, I want to join and watch a livestream so that I can consume content being broadcast.**

*   **Acceptance Criteria**:
    *   Given I have a link to a livestream, when I navigate to it, I can join the session as a viewer.
    *   I can see and hear the broadcaster clearly.
    *   My own camera and microphone are not enabled, and I cannot broadcast.

## 3. Functional Requirements

*   **FR0**: The system must provide a mechanism for users to log in using their registered email and password.
*   **FR1**: The system must ensure users are authenticated before they can initiate or join any communication session.
*   **FR9**: The system must provide a mechanism for new users to register for an account using their email and password.
*   **FR10**: The system must provide a standard email-based password reset flow for users who forget their password.
*   **FR2**: Authenticated users must be able to initiate a P2P video chat with another single user.
*   **FR3**: Users can join a P2P chat by opening a unique invitation link.
*   **FR8**: The host of a P2P session must be able to choose between a public (anyone with link) or private (password-gated) invitation link.
*   **FR4**: A user with "broadcaster" privileges must be able to start and stop a livestream broadcast.
*   **FR5**: Any user (including anonymous users, if applicable) must be able to view an active livestream broadcast using a public link.
*   **FR6**: Participants in a P2P chat can mute/unmute their own audio and enable/disable their own video.
*   **FR7**: Broadcasters can mute/unmute their own audio and enable/disable their own video.

## 4. Data Model

*   **User**:
    *   `id`: Unique identifier for the user.
    *   `sessions`: A list of `Session` entities hosted by this user.
*   **Session**:
    *   `sessionId`: Unique identifier for the communication session.
    *   `type`: The type of session (`p2p` or `broadcast`).
    *   `accessType`: The access type of the session (`public` or `private`).
    *   `password`: (Optional) Password for private sessions.
    *   `hostId`: The ID of the user who initiated the session.
    *   `host`: The `User` entity who initiated this session (foreign key relationship via `hostId`).
    *   `participants`: List of active participants.
*   **Participant**:
    *   `participantId`: Unique identifier for the user in the session.
    *   `name`: Display name for the user.
    *   `role`: The role of the participant (`host`, `guest` in P2P, or `broadcaster`, `viewer` in a broadcast).

## 5. Non-Functional Requirements

*   **Performance**:
    *   P2P audio and video latency must be below 200ms.
    *   Broadcast stream delay should be no more than 10 seconds.
*   **Scalability**:
    *   P2P sessions are limited to 2 participants.
    *   Broadcast sessions should support up to 1,000 concurrent viewers.
*   **Reliability & Availability**:
    *   Prioritize simplicity of use and speed to market over strict uptime guarantees.
    *   Basic error recovery mechanisms should be in place to prevent complete system failure.
*   **Security**:
    *   All communication streams must be encrypted.
    *   P2P sessions can be configured as public (anyone with the link) or private (password-gated).
    *   For private P2P sessions, the correct password must be provided to join.
    *   Unauthenticated users may join public P2P sessions if provided with a valid link.
    *   User passwords must meet the following minimum requirements: 6 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character.
    *   Brute-force login attempts must be protected against using rate limiting per IP address and CAPTCHA integration on the login form.
*   **Edge Cases & Failure Handling**:
    *   Network disconnections during active sessions should trigger an attempt at automatic reconnection with a brief "reconnecting" message.

## 6. Assumptions

*   The technical implementation will use a Next.js frontend with React components.
*   The backend, including real-time services and authentication, will be provided by Feathers.js and LiveKit.
*   A permissions system exists to differentiate standard users from "broadcasters".
*   (Future: Integration with Alchemy Smart Accounts is planned for a subsequent version, leveraging the existing Feathers-based authentication system.)

## 7. Out of Scope

*   Text-based chat in any session.
*   Recording and playback of sessions.
*   Screen sharing.
*   Multi-host/co-hosting in broadcast sessions.

## Clarifications

### Session 2025-10-14
- Q: How should the `Session` entity explicitly relate to the `User` entity in the data model? → A: `Session` should have a direct foreign key relationship to `User` via `hostId`.
- Q: What are the detailed steps for a user to send and another user to accept a P2P chat invitation? → A: Invitation is a direct link shared out-of-band, no in-app acceptance flow. Unauthenticated users may join if needed.
- Q: How is authorization enforced for P2P chat invitations to ensure only the intended recipient can accept? → A: Enforcement should be an option. The host can choose to make the link public (anyone with access can join) or private (gated by a password).
- Q: What are the uptime and recovery expectations for the platform (e.g., target uptime percentage, recovery time objective)? → A: Simplicity of use and speed to market are prioritized over uptime.
- Q: How should the platform handle network disconnections during active P2P or broadcast sessions? → A: Attempt automatic reconnection with a brief "reconnecting" message.

### Session 2025-10-14 (Sign-in Flow)
- Q: What are the detailed steps a user takes to log into the platform? → A: User enters email/password on a login form, submits, and is redirected to the user dashboard upon success. (Future: Integration with Alchemy Smart Accounts is planned for a subsequent version.)
- Q: What are the detailed steps a new user takes to register for an account? → A: User provides email/password on a registration form, submits, and is automatically logged in and redirected to the user dashboard.
- Q: What are the minimum requirements for user passwords (e.g., length, complexity)? → A: Minimum 6 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character.
- Q: How can users recover their accounts if they forget their password? → A: Standard email-based password reset flow.
- Q: What measures should be in place to protect against brute-force login attempts? → A: Rate limiting on login attempts per IP address, and CAPTCHA integration on login form.