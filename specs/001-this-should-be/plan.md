# Implementation Plan: Multi-purpose Real-time Communication Platform

## 1. Technical Context

This document outlines the technical approach for building the real-time communication platform.

*   **Frontend Framework**: Next.js (App Router)
*   **UI Components**: React (specifically LiveKit React Components)
*   **Backend Framework**: Feathers.js
*   **Real-time Engine**: LiveKit
*   **Database ORM**: Prisma
*   **Authentication**: Handled by Feathers.js
*   **Key Challenge/Unknown**: The specification requires a "broadcaster" role. The precise method for implementing Role-Based Access Control (RBAC) within the Feathers.js framework needs to be determined. **[NEEDS CLARIFICATION: What is the standard pattern for implementing role-based access control (e.g., 'broadcaster' vs 'user') in Feathers.js?]**

## 2. Constitution Check

*This section will be populated with the contents of `.specify/memory/constitution.md` to ensure all design decisions align with project principles.*

## 3. Implementation Phases

*This plan will proceed in phases, starting with research to resolve unknowns, followed by detailed design and contract definition.*