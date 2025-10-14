# Research & Decisions

This document records the decisions made to resolve technical unknowns identified in the implementation plan.

## 1. Feathers.js Role-Based Access Control (RBAC)

*   **Task**: Determine the standard pattern for implementing role-based access control (e.g., 'broadcaster' vs 'user') in Feathers.js.
*   **Decision**: Implement RBAC using a `roles` array on the `user` model combined with a custom authorization hook.
*   **Rationale**: This is a common, flexible, and scalable pattern within the Feathers.js ecosystem. A custom hook provides granular control, allowing checks for specific roles (e.g., 'broadcaster') on protected service methods (e.g., creating a broadcast). The `feathers-authentication-hooks` library can be used to easily check for role existence.
*   **Alternatives Considered**:
    *   *Separate Permissions Service*: Considered overly complex for the current scope. It would involve creating and managing a separate service just for permissions, which is unnecessary at this stage.

## 2. LiveKit Integration with Next.js App Router

*   **Task**: Find best practices for integrating LiveKit with a Next.js App Router frontend.
*   **Decision**: Generate LiveKit access tokens on the server side using a Next.js Route Handler. Client components will fetch a token from this endpoint before connecting to a LiveKit room.
*   **Rationale**: This is the official recommended and most secure method. It prevents LiveKit API keys and secrets from being exposed on the client side. Next.js Route Handlers are the standard way to create API endpoints within the App Router paradigm, making them a perfect fit for this task.

## 3. Prisma Integration with Feathers.js

*   **Task**: Find best practices for using Prisma as the ORM for a Feathers.js backend.
*   **Decision**: Use the official `feathers-prisma` adapter.
*   **Rationale**: This adapter is purpose-built to connect Prisma with Feathers.js services. It significantly simplifies the creation of CRUD services by mapping Feathers methods directly to Prisma queries, reducing boilerplate code and ensuring a consistent data access pattern.
