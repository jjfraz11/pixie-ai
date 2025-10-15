# Pixie-AI Project Constitution

**Multi-Purpose Real-Time Communication Platform**

_Version: 1.0.0 | Last Updated: 2025-10-15_

---

## Table of Contents

1. [Core Architectural Principles](#1-core-architectural-principles)
2. [Functional Programming Standards](#2-functional-programming-standards)
3. [Repository Pattern Requirements](#3-repository-pattern-requirements)
4. [Configuration Management Standards](#4-configuration-management-standards)
5. [Business Logic Layer Architecture](#5-business-logic-layer-architecture)
6. [Development Standards](#6-development-standards)
7. [Testing Requirements](#7-testing-requirements)
8. [Error Handling Strategies](#8-error-handling-strategies)
9. [Authorization Patterns](#9-authorization-patterns)
10. [Real-Time Communication Standards](#10-real-time-communication-standards)

---

## 1. Core Architectural Principles

### 1.1 SOLID Principles Enforcement

**Single Responsibility Principle (SRP)**: Every module, class, and function must have one and only one reason to change.

**Open/Closed Principle (OCP)**: Software entities should be open for extension but closed for modification through strategy patterns and composition.

**Liskov Substitution Principle (LSP)**: Objects of a superclass should be replaceable with objects of its subclasses without affecting the correctness of the program.

**Interface Segregation Principle (ISP)**: No client should be forced to depend on methods it does not use through role interfaces.

**Dependency Inversion Principle (DIP)**: High-level modules should not depend on low-level modules. Both should depend on abstractions.

### 1.2 Functional Programming Principles

**Pure Functions**: Functions must not have side effects and must return the same output for the same input.

**Immutability**: All data transformations must create new data structures rather than mutating existing ones.

**Referential Transparency**: Expressions can be replaced with their values without changing program behavior.

**Function Composition**: Complex operations built by combining simpler, reusable functions.

### 1.3 Governance Rules

**All code changes must**:

- Include comprehensive tests covering both success and failure scenarios
- Follow functional programming patterns for predictable behavior
- Implement proper error handling with Either/Result types
- Include TypeScript type definitions for all public APIs
- Maintain backward compatibility unless explicitly versioned
- Include security considerations for all authentication and authorization logic

**All services must**:

- Use dependency injection for testability and composability
- Implement proper logging for debugging and monitoring
- Handle all edge cases and error conditions gracefully
- Provide clear, consistent API responses
- Support pagination for list operations
- Follow functional programming patterns

---

## 2. Functional Programming Standards

### 2.1 Pure Function Requirements

**✅ CORRECT**:

```typescript
// Pure function - no side effects, same output for same input
const createUser = (userData: UserData): User => ({
  id: generateId(), // Deterministic ID generation
  ...userData,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Function composition with pure functions
const processUser = (userData: UserData): User =>
  setUpdatedAt(setCreatedAt(createUser(userData)));
```

**❌ INCORRECT**:

```typescript
// Impure function - has side effects
let userCount = 0;
const createUser = (userData: UserData): User => {
  userCount++; // Side effect - modifies external state
  return {
    id: generateId(),
    ...userData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};
```

### 2.2 Immutability Standards

**✅ CORRECT**:

```typescript
// Immutable data transformations
const addParticipant = (
  session: Session,
  participant: Participant
): Session => ({
  ...session,
  participants: [...session.participants, participant],
  updatedAt: new Date(),
});

const removeParticipant = (
  session: Session,
  participantId: string
): Session => ({
  ...session,
  participants: session.participants.filter((p) => p.id !== participantId),
  updatedAt: new Date(),
});
```

### 2.3 Function Composition Patterns

**✅ CORRECT**:

```typescript
// Higher-order functions for composition
const withValidation =
  <T>(validator: (data: T) => boolean, fn: (data: T) => T) =>
  (data: T): T => {
    if (!validator(data)) {
      throw new ValidationError("Invalid data");
    }
    return fn(data);
  };

const withLogging =
  <T>(logger: Logger, fn: (data: T) => T) =>
  (data: T): T => {
    logger.info("Processing data", { data });
    const result = fn(data);
    logger.info("Data processed", { result });
    return result;
  };

// Composed function
const processUserWithValidationAndLogging = compose(
  withValidation(validateUserData, identity),
  withLogging(logger, identity),
  createUser
);
```

### 2.4 Error Handling with Functional Patterns

**Either Monad for Error Handling**:

```typescript
// Either type for functional error handling
type Either<L, R> = Left<L> | Right<R>;

class Left<L> {
  constructor(public readonly value: L) {}
  isLeft(): this is Left<L> {
    return true;
  }
  isRight(): this is Right<R> {
    return false;
  }
  map<R2>(fn: (r: R) => R2): Either<L, R2> {
    return this as any;
  }
  chain<R2>(fn: (r: R) => Either<L, R2>): Either<L, R2> {
    return this as any;
  }
}

class Right<R> {
  constructor(public readonly value: R) {}
  isLeft(): this is Left<L> {
    return false;
  }
  isRight(): this is Right<R> {
    return true;
  }
  map<R2>(fn: (r: R) => R2): Either<L, R2> {
    return new Right(fn(this.value));
  }
  chain<R2>(fn: (r: R) => Either<L, R2>): Either<L, R2> {
    return fn(this.value);
  }
}

// Usage in services
const findUserById = (id: string): Either<Error, User> => {
  try {
    const user = await userRepository.findById(id);
    return user
      ? new Right(user)
      : new Left(new NotFoundError("User not found"));
  } catch (error) {
    return new Left(error as Error);
  }
};
```

### 2.5 Functional Data Validation

**✅ CORRECT**:

```typescript
// Functional validation with composition
const validateEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validatePassword = (password: string): boolean =>
  password.length >= 8 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const validateUser = (user: UserData): UserValidationResult => {
  const errors: string[] = [];

  if (!validateEmail(user.email)) {
    errors.push("Invalid email format");
  }

  if (!validatePassword(user.password)) {
    errors.push(
      "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
    );
  }

  return errors.length === 0 ? { isValid: true } : { isValid: false, errors };
};

// Composed validation
const validateAndCreateUser = compose(
  withValidation(validateUser, identity),
  createUser
);
```

---

## 3. Repository Pattern Requirements

### 3.1 Functional Repository Interface

```typescript
// Functional approach to repository pattern
interface BaseRepository<T, TId = string> {
  findById(id: TId): Either<Error, T>;
  findAll(options?: QueryOptions): Either<Error, PaginatedResult<T>>;
  findByCriteria(criteria: QueryCriteria): Either<Error, T[]>;
  create(data: CreateData<T>): Either<Error, T>;
  update(id: TId, data: UpdateData<T>): Either<Error, T>;
  delete(id: TId): Either<Error, boolean>;
  exists(id: TId): Either<Error, boolean>;
  count(criteria?: QueryCriteria): Either<Error, number>;
}
```

### 3.2 Functional Repository Implementation

**✅ CORRECT**:

```typescript
export class UserRepository implements BaseRepository<User> {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Either<Error, User> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: { sessions: true },
      });
      return user
        ? new Right(user)
        : new Left(new NotFoundError("User not found"));
    } catch (error) {
      return new Left(error as Error);
    }
  }

  findAll(options?: QueryOptions): Either<Error, PaginatedResult<User>> {
    try {
      const {
        limit = 10,
        offset = 0,
        orderBy = "createdAt",
        orderDirection = "desc",
      } = options || {};

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          take: limit,
          skip: offset,
          orderBy: { [orderBy]: orderDirection },
        }),
        this.prisma.user.count(),
      ]);

      return new Right({
        data: users,
        total,
        limit,
        offset,
        hasNext: offset + limit < total,
        hasPrev: offset > 0,
      });
    } catch (error) {
      return new Left(error as Error);
    }
  }

  create(data: CreateUserData): Either<Error, User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          ...data,
          id: generateId(), // Functional ID generation
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return new Right(user);
    } catch (error) {
      return new Left(error as Error);
    }
  }
}
```

---

## 4. Configuration Management Standards

### 4.1 Functional Configuration Pattern

**✅ CORRECT**:

```typescript
// Functional configuration with validation
const createConfig = (env: NodeJS.ProcessEnv): Either<Error, AppConfig> => {
  const config = {
    server: {
      port: parseInt(env.PORT || "3030", 10),
      host: env.HOST || "localhost",
      environment: (env.NODE_ENV ||
        "development") as AppConfig["server"]["environment"],
    },
    database: {
      url: env.DATABASE_URL || "postgresql://localhost:5432/pixieai",
    },
    authentication: {
      secret:
        env.AUTHENTICATION_SECRET || "fallback-secret-key-for-development",
      jwtExpiresIn: env.JWT_EXPIRES_IN || "1h",
      refreshTokenExpiresIn: env.REFRESH_TOKEN_EXPIRES_IN || "7d",
    },
    livekit: {
      serverUrl: env.LIVEKIT_SERVER_URL || "ws://localhost:7880",
      apiKey: env.LIVEKIT_API_KEY || "dev-key",
      apiSecret: env.LIVEKIT_API_SECRET || "dev-secret",
    },
    email: {
      from: env.EMAIL_FROM || "noreply@pixieai.com",
      provider:
        (env.EMAIL_PROVIDER as AppConfig["email"]["provider"]) || "smtp",
      sendgrid: {
        apiKey: env.SENDGRID_API_KEY || "",
      },
      ses: {
        region: env.SES_REGION || "us-east-1",
        accessKeyId: env.SES_ACCESS_KEY_ID || "",
        secretAccessKey: env.SES_SECRET_ACCESS_KEY || "",
      },
    },
  };

  return validateConfig(config).isValid
    ? new Right(config)
    : new Left(
        new Error(
          `Configuration errors: ${validateConfig(config).errors.join(", ")}`
        )
      );
};
```

---

## 5. Business Logic Layer Architecture

### 5.1 Functional Service Layer

**✅ CORRECT**:

```typescript
// Functional approach to service layer
export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly logger: Logger
  ) {}

  createUser = (request: CreateUserRequest): Either<Error, UserResponse> =>
    this.validateCreateUserRequest(request)
      .chain(() => this.checkUserExists(request.email))
      .chain(() => this.createUserEntity(request))
      .map((user) => this.mapToResponse(user));

  private validateCreateUserRequest = (
    request: CreateUserRequest
  ): Either<Error, void> => {
    const errors: string[] = [];

    if (!this.isValidEmail(request.email)) {
      errors.push("Valid email is required");
    }

    if (!this.isValidPassword(request.password)) {
      errors.push("Password must be at least 8 characters");
    }

    return errors.length === 0
      ? new Right(undefined)
      : new Left(new ValidationError(errors.join(", ")));
  };

  private checkUserExists = (email: string): Either<Error, void> =>
    this.userRepository
      .findByEmail(email)
      .map((user) =>
        user
          ? new Left(new ConflictError("User with this email already exists"))
          : new Right(undefined)
      )
      .chain((either) => either);

  private createUserEntity = (
    request: CreateUserRequest
  ): Either<Error, User> =>
    this.userRepository
      .create({
        email: request.email,
        passwordHash: await this.hashPassword(request.password),
        roles: request.roles || ["user"],
      })
      .map((user) => {
        this.eventPublisher.publish(
          new UserRegisteredEvent(user.id, user.email)
        );
        return user;
      });
}
```

---

## 6. Development Standards

### 6.1 Functional Code Organization

**File Organization**:

```
src/
├── domain/              # Pure business logic and types
├── repositories/        # Data access abstraction
├── services/           # Application services with composition
├── handlers/           # HTTP/WebSocket handlers
├── utils/              # Pure utility functions
├── types/              # TypeScript type definitions
└── config/             # Configuration management
```

### 6.2 TypeScript Functional Standards

**Strict TypeScript Configuration**:

```typescript
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

---

## 7. Testing Requirements

### 7.1 Functional Testing Patterns

**Property-Based Testing**:

```typescript
// Property-based tests for pure functions
describe("createUser", () => {
  it("should always generate a valid user", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (email, password) => {
        const user = createUser({ email, password });
        return user.id.length > 0 && user.email === email;
      })
    );
  });
});
```

### 7.2 Functional Test Structure

```typescript
// Functional approach to testing
describe("UserService", () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    userService = new UserService(
      mockUserRepository,
      mockEventPublisher,
      mockLogger
    );
  });

  describe("createUser", () => {
    it("should create a user successfully", async () => {
      const request: CreateUserRequest = {
        email: "test@example.com",
        password: "ValidPass123!",
      };

      mockUserRepository.findByEmail.mockReturnValue(new Right(null));
      mockUserRepository.create.mockReturnValue(new Right(expectedUser));

      const result = await userService.createUser(request);

      expect(result.isRight()).toBe(true);
      expect(result.getOrElse(null)?.email).toBe("test@example.com");
    });
  });
});
```

---

## 8. Error Handling Strategies

### 8.1 Functional Error Types

**Either-Based Error Handling**:

```typescript
// Functional error handling in services
export class SessionService {
  createSession = (request: CreateSessionRequest): Either<Error, Session> =>
    this.validateCreateSessionRequest(request)
      .chain(() => this.checkHostCanCreateSession(request.hostId))
      .chain(() => this.createSessionEntity(request))
      .map((session) => {
        this.eventPublisher.publish(new SessionCreatedEvent(session.id));
        return session;
      });

  private validateCreateSessionRequest = (
    request: CreateSessionRequest
  ): Either<Error, void> => {
    const errors: string[] = [];

    if (!request.hostId) {
      errors.push("Host ID is required");
    }

    if (!["p2p", "broadcast"].includes(request.type)) {
      errors.push("Invalid session type");
    }

    return errors.length === 0
      ? new Right(undefined)
      : new Left(new ValidationError(errors.join(", ")));
  };
}
```

---

## 9. Authorization Patterns

### 9.1 Functional Authorization

**✅ CORRECT**:

```typescript
// Functional authorization with composition
const hasPermission = (user: User, resource: string, action: string): boolean =>
  user.roles.some((role) =>
    ROLE_PERMISSIONS[role].some((permission) =>
      matchesPermission(permission, `${resource}:${action}`)
    )
  );

const authorizeUser = (
  user: User,
  resource: string,
  action: string
): Either<Error, User> =>
  hasPermission(user, resource, action)
    ? new Right(user)
    : new Left(new ForbiddenError(`Access denied for ${resource}:${action}`));

const withAuthorization =
  <T extends any[], R>(
    resource: string,
    action: string,
    fn: (user: User, ...args: T) => Either<Error, R>
  ) =>
  (user: User, ...args: T): Either<Error, R> =>
    authorizeUser(user, resource, action).chain((authorizedUser) =>
      fn(authorizedUser, ...args)
    );
```

---

## 10. Real-Time Communication Standards

### 10.1 Session Management Patterns

**Functional Session Creation**:

```typescript
// Pure session creation functions
const createP2PSession = (hostId: string, accessType: AccessType): Session => ({
  id: generateId(),
  type: "p2p",
  hostId,
  accessType,
  participants: [],
  maxParticipants: 2,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createBroadcastSession = (
  hostId: string,
  accessType: AccessType
): Session => ({
  id: generateId(),
  type: "broadcast",
  hostId,
  accessType,
  participants: [],
  maxParticipants: 1000,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Composed session creation
const createSession = (
  type: SessionType,
  hostId: string,
  accessType: AccessType
): Session =>
  type === "p2p"
    ? createP2PSession(hostId, accessType)
    : createBroadcastSession(hostId, accessType);
```

### 10.2 LiveKit Integration Patterns

**Functional LiveKit Service**:

```typescript
// Functional approach to LiveKit integration
export class LiveKitService {
  createToken = (
    roomName: string,
    participantName: string,
    metadata?: any
  ): Either<Error, string> => {
    try {
      const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
        identity: participantName,
        ttl: "24h",
      });

      token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });

      return new Right(token.toJwt());
    } catch (error) {
      return new Left(
        new Error(`Failed to create LiveKit token: ${error.message}`)
      );
    }
  };

  validateWebhook = (
    body: string,
    signature: string
  ): Either<Error, WebhookEvent> => {
    try {
      const event = this.verifySignature(body, signature);
      return new Right(JSON.parse(body));
    } catch (error) {
      return new Left(new Error(`Invalid webhook signature: ${error.message}`));
    }
  };
}
```

---

## 11. Implementation Roadmap

This constitution serves as the foundation for refactoring the existing codebase. The current implementation shows several areas that need improvement:

1. **Repository Pattern Implementation**: Replace direct Prisma usage in services with functional repositories
2. **Error Handling Standardization**: Implement Either-based error handling throughout
3. **Functional Programming Adoption**: Refactor services to use pure functions and composition
4. **Configuration Management**: Implement functional configuration with validation
5. **Service Layer Architecture**: Separate pure business logic from side effects
6. **Testing Infrastructure**: Implement property-based and functional testing patterns

All new code must follow these guidelines, and existing code should be gradually refactored to comply with these standards.

**Version**: 1.0.0 | **Ratified**: 2025-10-15 | **Last Amended**: 2025-10-15
