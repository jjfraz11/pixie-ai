# pixie-ai Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-15

## Phase 2 Active Technologies

### Core Technology Stack

- **Frontend**: Next.js 15.5.5 + React 19.1.0 + TypeScript 5.0
- **Backend**: Feathers.js v5.0.35 + Node.js v18.17.0 + TypeScript 5.5.4
- **Database**: PostgreSQL 15.0 + Prisma 6.17.1
- **Real-time Communication**: LiveKit v1.7.0
- **Styling**: Tailwind CSS v3.4.0
- **Functional Programming**: Ramda.js v0.29.0 + Immer v10.0.0
- **Security**: Zod v3.22.0 + Helmet.js v7.1.0 + OpenTelemetry v1.20.0
- **Development Tools**: Jest v29.7.0 + React Testing Library v14.0.0

## Project Structure

```
src/
├── services/          # Business logic services (authentication, sessions, users)
├── hooks/            # Authentication and authorization hooks
├── types/            # TypeScript type definitions
├── utils/            # Utility functions and helpers
└── validators/       # Input validation schemas
tests/
├── services/         # Service layer tests
├── integration/      # Integration tests
└── e2e/             # End-to-end tests
prisma/
└── migrations/       # Database schema migrations
```

## Phase 2 Commands

### Backend Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server

# Database
npx prisma generate     # Generate Prisma client
npx prisma migrate dev  # Run database migrations
npx prisma studio       # Open database browser
npx prisma db seed      # Seed database with test data

# Testing
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # Run TypeScript checks
```

### Frontend Commands

```bash
# Development
npm run dev             # Start development server
npm run build           # Build for production
npm run start           # Start production server

# Testing
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # Run TypeScript checks
```

## Phase 2 Code Style and Architecture

### TypeScript Conventions

- **Strict Mode**: Enabled for maximum type safety
- **Module Resolution**: Node.js ES modules with TypeScript paths
- **Target**: ES2022 for modern JavaScript features
- **Import/Export**: ES6 modules throughout

### Functional Programming Patterns

- **Immutable State**: Immer for immutable state updates with imperative API
- **Data Transformation**: Ramda.js for currying and functional composition
- **Error Handling**: Either monad pattern for predictable error management
- **Pure Functions**: All business logic functions are pure and testable

### Security Architecture

- **Authentication**: JWT with RS256 algorithm and refresh token rotation
- **Authorization**: Role-based access control (RBAC) with granular permissions
- **Input Validation**: Zod schemas for runtime type validation
- **Security Headers**: Helmet.js for comprehensive security headers
- **Password Policies**: 12+ characters, mixed case, numbers, special characters

### Real-time Communication

- **WebRTC Optimization**: P2P latency <200ms, broadcast <10s delay
- **Scalability**: Support for 1000+ concurrent viewers
- **Room Management**: Server-side token generation for security
- **Connection Management**: React context for centralized state management

### Performance Monitoring

- **Observability**: OpenTelemetry for distributed tracing and metrics
- **Structured Logging**: Correlation IDs for request tracing
- **Custom Metrics**: Active users, request duration, error rates
- **Health Checks**: Comprehensive endpoint monitoring

### Database Architecture

- **Repository Pattern**: Data access abstraction for testability
- **Migration Strategy**: Prisma migrations with descriptive naming
- **Connection Pooling**: Optimized PostgreSQL connection management
- **Query Optimization**: Indexed queries for performance

## Phase 2 Architectural Decisions

### 1. Functional Programming Architecture

**Decision**: Implement functional programming patterns using Ramda.js for data transformations and Immer for immutable state updates.
**Rationale**: Provides predictability and testability while maintaining performance.
**Pattern**: Repository pattern with Either error handling throughout.

### 2. Multi-layered Security

**Decision**: JWT authentication + refresh tokens, RBAC, password policies, input validation with Zod, security headers via Helmet.js.
**Rationale**: Stateless authentication suitable for distributed systems with comprehensive protection.

### 3. LiveKit Integration

**Decision**: Server-side token generation with React context for connection management and room state synchronization.
**Rationale**: Prevents credential exposure while maintaining security and optimal performance.

### 4. Performance Monitoring & Observability

**Decision**: OpenTelemetry for distributed tracing, custom metrics collection, structured logging with correlation IDs.
**Rationale**: Provides vendor-neutral observability for production debugging.

### 5. Authentication Architecture

**Decision**: JWT-based authentication with refresh tokens, comprehensive password policies, secure session management.
**Rationale**: Balances security with scalability and user experience.

## Recent Changes

- 001-this-should-be: Phase 2 implementation with comprehensive security, functional programming, and real-time communication features
- Added LiveKit v1.7.0 for real-time video streaming
- Implemented functional programming patterns with Ramda.js and Immer
- Added OpenTelemetry for observability and monitoring
- Enhanced security with JWT refresh tokens and RBAC
- Updated to latest stable versions of all core technologies

## Constitution Compliance Verification

✅ **Functional Programming**: Implemented with Ramda.js and Immer patterns throughout codebase
✅ **Security Requirements**: Multi-layered security with JWT, RBAC, input validation, and security headers
✅ **Real-time Communication**: LiveKit integration with <200ms P2P latency and <10s broadcast delay
✅ **Scalability**: Architecture supports 1000+ concurrent viewers with optimized performance
✅ **Error Handling**: Either monad pattern for predictable error management
✅ **Testing**: Comprehensive test coverage with Jest and React Testing Library
✅ **Observability**: OpenTelemetry integration for production monitoring

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
