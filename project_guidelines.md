# Pixie-AI Project Guidelines

**Project Constitution and Development Standards**

_Version: 1.0.0 | Last Updated: 2025-10-15_

---

## Table of Contents

1. [Project Constitution](#1-project-constitution)
2. [SOLID Principles Enforcement](#2-solid-principles-enforcement)
3. [Repository Pattern Requirements](#3-repository-pattern-requirements)
4. [Configuration Management Standards](#4-configuration-management-standards)
5. [Business Logic Layer Architecture](#5-business-logic-layer-architecture)
6. [Development Standards](#6-development-standards)
7. [Testing Requirements](#7-testing-requirements)
8. [Error Handling Strategies](#8-error-handling-strategies)
9. [Authorization Patterns](#9-authorization-patterns)

---

## 1. Project Constitution

### 1.1 Core Architectural Principles

**Single Responsibility Principle (SRP)**: Every module, class, and function must have one and only one reason to change.

**Dependency Inversion Principle (DIP)**: High-level modules should not depend on low-level modules. Both should depend on abstractions.

**Interface Segregation Principle (ISP)**: No client should be forced to depend on methods it does not use.

**Liskov Substitution Principle (LSP)**: Objects of a superclass should be replaceable with objects of its subclasses without affecting the correctness of the program.

**Open/Closed Principle (OCP)**: Software entities should be open for extension but closed for modification.

### 1.2 Governance Rules

**All code changes must**:

- Include comprehensive tests covering both success and failure scenarios
- Follow the repository pattern for data access
- Implement proper error handling with structured error responses
- Include TypeScript type definitions for all public APIs
- Maintain backward compatibility unless explicitly versioned
- Include security considerations for all authentication and authorization logic

**All services must**:

- Use dependency injection for testability
- Implement proper logging for debugging and monitoring
- Handle all edge cases and error conditions gracefully
- Provide clear, consistent API responses
- Support pagination for list operations

### 1.3 Technology Stack Enforcement

**Required Technologies**:

- **Backend**: TypeScript, Node.js (latest LTS), Feathers.js v5, Prisma ORM
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Real-time**: LiveKit
- **Database**: PostgreSQL
- **Testing**: Jest, @testing-library/react

**Prohibited Patterns**:

- Direct database queries in service classes (use Repository pattern)
- Hard-coded secrets or configuration values
- Missing error handling in async operations
- Inconsistent API response formats
- Lack of input validation and sanitization

---

## 2. SOLID Principles Enforcement

### 2.1 Single Responsibility Principle (SRP)

**✅ CORRECT**:

```typescript
// Each class has one responsibility
class UserRepository {
  async findById(id: string): Promise<User> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}

class UserService {
  constructor(private userRepo: UserRepository) {}

  async getUser(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return user;
  }
}

class UserController {
  constructor(private userService: UserService) {}

  async getUser(req: Request, res: Response) {
    const user = await this.userService.getUser(req.params.id);
    res.json(user);
  }
}
```

**❌ INCORRECT**:

```typescript
// Multiple responsibilities in one class
class UserService {
  async findById(id: string): Promise<User> {
    return this.prisma.user.findUnique({ where: { id } }); // Data access
  }

  async getUser(id: string): Promise<User> {
    const user = await this.findById(id); // Business logic
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  async getUser(req: Request, res: Response) {
    // Controller logic
    const user = await this.getUser(req.params.id);
    res.json(user);
  }
}
```

### 2.2 Open/Closed Principle (OCP)

**✅ CORRECT**:

```typescript
interface SessionStrategy {
  canJoin(session: Session, user: User): boolean;
  getMaxParticipants(): number;
}

class P2PSessionStrategy implements SessionStrategy {
  canJoin(session: Session, user: User): boolean {
    return session.participants.length < 2;
  }
  getMaxParticipants(): number {
    return 2;
  }
}

class BroadcastSessionStrategy implements SessionStrategy {
  canJoin(session: Session, user: User): boolean {
    return true; // Unlimited viewers
  }
  getMaxParticipants(): number {
    return 1000;
  }
}

class SessionService {
  constructor(private strategy: SessionStrategy) {}

  async joinSession(sessionId: string, user: User): Promise<void> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!this.strategy.canJoin(session, user)) {
      throw new ConflictError("Session is full");
    }
    // ... join logic
  }
}
```

### 2.3 Liskov Substitution Principle (LSP)

**✅ CORRECT**:

```typescript
interface AuthStrategy {
  authenticate(credentials: Credentials): Promise<User>;
  refreshToken(token: string): Promise<string>;
}

class JWTStrategy implements AuthStrategy {
  async authenticate(credentials: Credentials): Promise<User> {
    // JWT implementation
  }
  async refreshToken(token: string): Promise<string> {
    // JWT refresh implementation
  }
}

class OAuthStrategy implements AuthStrategy {
  async authenticate(credentials: Credentials): Promise<User> {
    // OAuth implementation
  }
  async refreshToken(token: string): Promise<string> {
    // OAuth refresh implementation
  }
}

class AuthenticationService {
  constructor(private strategy: AuthStrategy) {}

  async login(credentials: Credentials): Promise<User> {
    return this.strategy.authenticate(credentials);
  }

  async refreshToken(token: string): Promise<string> {
    return this.strategy.refreshToken(token);
  }
}
```

### 2.4 Interface Segregation Principle (ISP)

**✅ CORRECT**:

```typescript
// Segregated interfaces
interface UserReader {
  findById(id: string): Promise<User>;
  findByEmail(email: string): Promise<User>;
}

interface UserWriter {
  create(userData: CreateUserData): Promise<User>;
  update(id: string, userData: UpdateUserData): Promise<User>;
  delete(id: string): Promise<void>;
}

interface UserPasswordManager {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
}

class UserRepository implements UserReader, UserWriter, UserPasswordManager {
  // Implementation of all segregated interfaces
}
```

**❌ INCORRECT**:

```typescript
// Fat interface forcing unnecessary dependencies
interface UserService {
  findById(id: string): Promise<User>;
  create(userData: CreateUserData): Promise<User>;
  hashPassword(password: string): Promise<string>;
  sendEmail(email: string, template: string): Promise<void>; // Unrelated
  logActivity(activity: string): Promise<void>; // Unrelated
}
```

### 2.5 Dependency Inversion Principle (DIP)

**✅ CORRECT**:

```typescript
interface EmailService {
  sendEmail(to: string, template: string, data: any): Promise<void>;
}

interface NotificationService {
  sendNotification(userId: string, message: string): Promise<void>;
}

class UserService {
  constructor(
    private emailService: EmailService,
    private notificationService: NotificationService
  ) {}

  async notifyUser(userId: string, message: string): Promise<void> {
    await this.notificationService.sendNotification(userId, message);
  }
}

// Dependency injection at composition root
const emailService = new SendGridEmailService();
const notificationService = new EmailNotificationService(emailService);
const userService = new UserService(emailService, notificationService);
```

---

## 3. Repository Pattern Requirements

### 3.1 Repository Interface Contract

All repositories must implement the following interface pattern:

```typescript
interface BaseRepository<T, TId = string> {
  findById(id: TId): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<PaginatedResult<T>>;
  findByCriteria(criteria: QueryCriteria): Promise<T[]>;
  create(data: CreateData<T>): Promise<T>;
  update(id: TId, data: UpdateData<T>): Promise<T>;
  delete(id: TId): Promise<boolean>;
  exists(id: TId): Promise<boolean>;
  count(criteria?: QueryCriteria): Promise<number>;
}

interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}

interface QueryCriteria {
  [key: string]: any;
}
```

### 3.2 Repository Implementation Pattern

**✅ CORRECT**:

```typescript
import { User, Prisma } from "@prisma/client";
import { BaseRepository, QueryOptions, QueryCriteria } from "../interfaces";

export class UserRepository implements BaseRepository<User> {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { sessions: true },
    });
  }

  async findAll(options?: QueryOptions): Promise<PaginatedResult<User>> {
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

    return {
      data: users,
      total,
      limit,
      offset,
      hasNext: offset + limit < total,
      hasPrev: offset > 0,
    };
  }

  async findByCriteria(criteria: QueryCriteria): Promise<User[]> {
    return this.prisma.user.findMany({
      where: criteria,
      include: { sessions: true },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        id: undefined, // Let Prisma generate cuid()
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return false; // Record not found
      }
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!user;
  }

  async count(criteria?: QueryCriteria): Promise<number> {
    return this.prisma.user.count({ where: criteria });
  }
}
```

### 3.3 Repository Factory Pattern

```typescript
import { PrismaClient } from "@prisma/client";

export class RepositoryFactory {
  constructor(private readonly prisma: PrismaClient) {}

  createUserRepository(): UserRepository {
    return new UserRepository(this.prisma);
  }

  createSessionRepository(): SessionRepository {
    return new SessionRepository(this.prisma);
  }

  createParticipantRepository(): ParticipantRepository {
    return new ParticipantRepository(this.prisma);
  }
}

// Usage in services
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return user;
  }
}
```

---

## 4. Configuration Management Standards

### 4.1 Environment-Based Configuration

**✅ CORRECT**:

```typescript
// config/env.ts
export interface AppConfig {
  server: {
    port: number;
    host: string;
    environment: "development" | "staging" | "production";
  };
  database: {
    url: string;
  };
  authentication: {
    secret: string;
    jwtExpiresIn: string;
    refreshTokenExpiresIn: string;
  };
  livekit: {
    serverUrl: string;
    apiKey: string;
    apiSecret: string;
  };
  email: {
    from: string;
    provider: "sendgrid" | "ses" | "smtp";
    sendgrid?: {
      apiKey: string;
    };
    ses?: {
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
}

export function loadConfig(): AppConfig {
  const env = process.env.NODE_ENV || "development";

  return {
    server: {
      port: parseInt(process.env.PORT || "3030", 10),
      host: process.env.HOST || "localhost",
      environment: env as AppConfig["server"]["environment"],
    },
    database: {
      url: process.env.DATABASE_URL || "postgresql://localhost:5432/pixieai",
    },
    authentication: {
      secret:
        process.env.AUTHENTICATION_SECRET ||
        "fallback-secret-key-for-development",
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
      refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
    },
    livekit: {
      serverUrl: process.env.LIVEKIT_SERVER_URL || "ws://localhost:7880",
      apiKey: process.env.LIVEKIT_API_KEY || "dev-key",
      apiSecret: process.env.LIVEKIT_API_SECRET || "dev-secret",
    },
    email: {
      from: process.env.EMAIL_FROM || "noreply@pixieai.com",
      provider:
        (process.env.EMAIL_PROVIDER as AppConfig["email"]["provider"]) ||
        "smtp",
      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY || "",
      },
      ses: {
        region: process.env.SES_REGION || "us-east-1",
        accessKeyId: process.env.SES_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.SES_SECRET_ACCESS_KEY || "",
      },
    },
  };
}
```

### 4.2 Configuration Validation

```typescript
// config/validation.ts
import { AppConfig } from "./env";

export function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push("DATABASE_URL is required");
  }

  if (
    !config.authentication.secret ||
    config.authentication.secret === "fallback-secret-key-for-development"
  ) {
    if (config.server.environment === "production") {
      errors.push("AUTHENTICATION_SECRET must be set in production");
    }
  }

  if (config.server.environment === "production") {
    if (!config.livekit.apiKey || config.livekit.apiKey === "dev-key") {
      errors.push("LIVEKIT_API_KEY must be set in production");
    }
    if (
      !config.livekit.apiSecret ||
      config.livekit.apiSecret === "dev-secret"
    ) {
      errors.push("LIVEKIT_API_SECRET must be set in production");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join("\n")}`);
  }
}
```

### 4.3 Service Configuration Pattern

```typescript
// services/base-service.ts
import { AppConfig } from "../config/env";

export abstract class BaseService {
  protected readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  protected getConfig(): AppConfig {
    return this.config;
  }
}

// services/authentication.service.ts
export class AuthenticationService extends BaseService {
  constructor(
    config: AppConfig,
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService
  ) {
    super(config);
  }

  async authenticate(email: string, password: string): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isValidPassword = await this.verifyPassword(
      password,
      user.passwordHash
    );
    if (!isValidPassword) {
      throw new InvalidCredentialsError();
    }

    const token = this.generateJWT(user);
    return { user, token };
  }

  private generateJWT(user: User): string {
    return jwt.sign(
      { userId: user.id, email: user.email },
      this.config.authentication.secret,
      { expiresIn: this.config.authentication.jwtExpiresIn }
    );
  }
}
```

---

## 5. Business Logic Layer Architecture

### 5.1 Service Layer Separation

**✅ CORRECT**:

```typescript
// Domain Models
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  roles?: string[];
}

export interface UserResponse {
  id: string;
  email: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

// Repository Interface
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
}

// Service Layer
export class UserService {
  constructor(private readonly userRepository: IUserRepository) {}

  async getUserById(id: string): Promise<UserResponse> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return this.mapToResponse(user);
  }

  async createUser(request: CreateUserRequest): Promise<UserResponse> {
    // Business logic validation
    await this.validateCreateUserRequest(request);

    const existingUser = await this.userRepository.findByEmail(request.email);
    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    // Domain logic
    const user = await this.userRepository.create({
      email: request.email,
      passwordHash: await this.hashPassword(request.password),
      roles: request.roles || ["user"],
    });

    return this.mapToResponse(user);
  }

  private async validateCreateUserRequest(
    request: CreateUserRequest
  ): Promise<void> {
    if (!request.email || !this.isValidEmail(request.email)) {
      throw new ValidationError("Valid email is required");
    }

    if (!request.password || request.password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }
  }

  private mapToResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
```

### 5.2 Domain-Driven Design Patterns

```typescript
// Domain Events
export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly occurredAt: Date = new Date()
  ) {}
}

export class DomainEventPublisher {
  private handlers: Map<string, Function[]> = new Map();

  publish(event: any): void {
    const eventType = event.constructor.name;
    const handlers = this.handlers.get(eventType) || [];

    handlers.forEach((handler) => handler(event));
  }

  subscribe(eventType: string, handler: Function): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }
}

// Usage in Service
export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async createUser(request: CreateUserRequest): Promise<UserResponse> {
    // ... validation logic

    const user = await this.userRepository.create({
      email: request.email,
      passwordHash: await this.hashPassword(request.password),
      roles: request.roles || ["user"],
    });

    // Publish domain event
    this.eventPublisher.publish(new UserRegisteredEvent(user.id, user.email));

    return this.mapToResponse(user);
  }
}
```

---

## 6. Development Standards

### 6.1 Code Style and Structure

**File Organization**:

```
src/
├── controllers/          # HTTP request handlers
├── services/            # Business logic layer
├── repositories/        # Data access layer
├── models/             # Domain models and DTOs
├── middleware/         # Custom middleware
├── hooks/              # Feathers.js hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── constants/          # Application constants
└── config/             # Configuration management
```

**Naming Conventions**:

- Files: `kebab-case` (e.g., `user-service.ts`)
- Classes: `PascalCase` (e.g., `UserService`)
- Methods: `camelCase` (e.g., `getUserById`)
- Interfaces: `PascalCase` prefixed with 'I' (e.g., `IUserRepository`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `MAX_SESSION_PARTICIPANTS`)

### 6.2 TypeScript Standards

**Strict TypeScript Configuration**:

```json
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

**Generic Type Patterns**:

```typescript
// Generic service response wrapper
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ValidationError[];
}

// Generic pagination interface
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Generic repository interface
export interface IRepository<T, TId = string> {
  findById(id: TId): Promise<T | null>;
  findAll(options?: QueryOptions): Promise<PaginatedResult<T>>;
  create(data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T>;
  update(id: TId, data: Partial<T>): Promise<T>;
  delete(id: TId): Promise<void>;
}
```

### 6.3 Async/Await Patterns

**✅ CORRECT**:

```typescript
export class SessionService {
  async createSession(request: CreateSessionRequest): Promise<Session> {
    // Validate input
    await this.validateCreateSessionRequest(request);

    // Check business rules
    const existingSession = await this.sessionRepository.findByHostId(
      request.hostId
    );
    if (existingSession) {
      throw new ConflictError("User already has an active session");
    }

    // Create session
    const session = await this.sessionRepository.create({
      type: request.type,
      hostId: request.hostId,
      accessType: request.accessType || "public",
    });

    // Publish events
    await this.eventPublisher.publish(new SessionCreatedEvent(session.id));

    return session;
  }

  private async validateCreateSessionRequest(
    request: CreateSessionRequest
  ): Promise<void> {
    if (!request.hostId) {
      throw new ValidationError("Host ID is required");
    }

    if (!["p2p", "broadcast"].includes(request.type)) {
      throw new ValidationError("Invalid session type");
    }
  }
}
```

**❌ INCORRECT**:

```typescript
// Nested async operations without proper error handling
export class BadSessionService {
  async createSession(request: CreateSessionRequest): Promise<Session> {
    this.sessionRepository
      .create(request)
      .then((session) => {
        this.eventPublisher.publish(new SessionCreatedEvent(session.id));
      })
      .catch((error) => {
        console.error("Failed to create session:", error);
      });
    // Missing return value
  }
}
```

### 6.4 Logging Standards

```typescript
import { Logger } from "winston";

export class BaseService {
  protected readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  protected logInfo(message: string, meta?: any): void {
    this.logger.info(message, { service: this.constructor.name, ...meta });
  }

  protected logError(message: string, error?: Error, meta?: any): void {
    this.logger.error(message, {
      service: this.constructor.name,
      error: error?.message,
      stack: error?.stack,
      ...meta,
    });
  }

  protected logWarn(message: string, meta?: any): void {
    this.logger.warn(message, { service: this.constructor.name, ...meta });
  }
}

export class UserService extends BaseService {
  async createUser(request: CreateUserRequest): Promise<User> {
    this.logInfo("Creating new user", { email: request.email });

    try {
      const user = await this.userRepository.create(request);
      this.logInfo("User created successfully", { userId: user.id });
      return user;
    } catch (error) {
      this.logError("Failed to create user", error as Error, {
        email: request.email,
      });
      throw error;
    }
  }
}
```

---

## 7. Testing Requirements

### 7.1 Testing Structure

**Unit Tests**:

```typescript
// services/__tests__/user.service.test.ts
describe("UserService", () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    userService = new UserService(mockUserRepository);
  });

  describe("createUser", () => {
    it("should create a user successfully", async () => {
      const request: CreateUserRequest = {
        email: "test@example.com",
        password: "ValidPass123!",
      };

      const expectedUser: User = {
        id: "user-id",
        email: "test@example.com",
        passwordHash: "hashed-password",
        roles: ["user"],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(expectedUser);

      const result = await userService.createUser(request);

      expect(result.email).toBe("test@example.com");
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          passwordHash: expect.any(String),
        })
      );
    });

    it("should throw error when email already exists", async () => {
      const request: CreateUserRequest = {
        email: "existing@example.com",
        password: "ValidPass123!",
      };

      const existingUser: User = {
        id: "existing-id",
        email: "existing@example.com",
        passwordHash: "hashed-password",
        roles: ["user"],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(userService.createUser(request)).rejects.toThrow(
        ConflictError
      );
    });
  });
});
```

### 7.2 Integration Tests

```typescript
// tests/integration/user.integration.test.ts
describe("User API Integration", () => {
  let app: Application;
  let testUser: User;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe("POST /users", () => {
    it("should create user and return 201", async () => {
      const requestBody = {
        email: "test@example.com",
        password: "ValidPass123!",
        roles: ["user"],
      };

      const response = await request(app)
        .post("/users")
        .send(requestBody)
        .expect(201);

      expect(response.body).toMatchObject({
        email: "test@example.com",
        roles: ["user"],
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.password).toBeUndefined();
    });

    it("should return 409 for duplicate email", async () => {
      const requestBody = {
        email: "duplicate@example.com",
        password: "ValidPass123!",
      };

      // Create first user
      await request(app).post("/users").send(requestBody).expect(201);

      // Try to create duplicate
      await request(app).post("/users").send(requestBody).expect(409);
    });
  });
});
```

### 7.3 Test Data Management

```typescript
// tests/fixtures/users.ts
export const createTestUser = (overrides?: Partial<User>): User => ({
  id: "test-user-id",
  email: "test@example.com",
  passwordHash: "hashed-password",
  roles: ["user"],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createInvalidUserData = () => [
  { email: "", password: "ValidPass123!" },
  { email: "invalid-email", password: "ValidPass123!" },
  { email: "test@example.com", password: "" },
  { email: "test@example.com", password: "weak" },
];

// tests/setup/test-database.ts
export class TestDatabase {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async connect(): Promise<void> {
    await this.prisma.$connect();
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async clear(): Promise<void> {
    await this.prisma.participant.deleteMany();
    await this.prisma.session.deleteMany();
    await this.prisma.user.deleteMany();
  }

  async createUser(data?: Partial<User>): Promise<User> {
    return this.prisma.user.create({
      data: {
        id: "test-user-id",
        email: "test@example.com",
        passwordHash: "hashed-password",
        roles: ["user"],
        ...data,
      },
    });
  }
}
```

---

## 8. Error Handling Strategies

### 8.1 Structured Error Types

```typescript
// errors/base.error.ts
export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  abstract readonly isOperational: boolean;

  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// errors/validation.error.ts
export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly errorCode = "VALIDATION_ERROR";
  readonly isOperational = true;

  constructor(message: string, public readonly field?: string) {
    super(message);
  }
}

// errors/not-found.error.ts
export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly errorCode = "NOT_FOUND";
  readonly isOperational = true;

  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` with id ${id}` : ""} not found`);
  }
}

// errors/conflict.error.ts
export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly errorCode = "CONFLICT";
  readonly isOperational = true;

  constructor(message: string) {
    super(message);
  }
}

// errors/forbidden.error.ts
export class ForbiddenError extends BaseError {
  readonly statusCode = 403;
  readonly errorCode = "FORBIDDEN";
  readonly isOperational = true;

  constructor(message: string = "Access denied") {
    super(message);
  }
}
```

### 8.2 Error Handling Middleware

```typescript
// middleware/error.middleware.ts
import { Request, Response, NextFunction } from "express";
import { BaseError } from "../errors/base.error";

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logger.error("Unhandled error", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Handle known operational errors
  if (error instanceof BaseError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.errorCode,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        res.status(409).json({
          success: false,
          error: {
            code: "DUPLICATE_ENTRY",
            message: "A record with this information already exists",
          },
        });
        return;
      case "P2025":
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "The requested record was not found",
          },
        });
        return;
    }
  }

  // Handle unknown errors
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
```

### 8.3 Service Layer Error Handling

```typescript
export class UserService {
  async getUserById(id: string): Promise<User> {
    try {
      const user = await this.userRepository.findById(id);

      if (!user) {
        throw new NotFoundError("User", id);
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error; // Re-throw known errors
      }

      // Wrap unknown errors
      throw new InternalServerError("Failed to retrieve user", {
        originalError: error.message,
      });
    }
  }

  async createUser(request: CreateUserRequest): Promise<User> {
    // Validate input
    const validationResult = await this.validateUserData(request);
    if (!validationResult.isValid) {
      throw new ValidationError(
        `Validation failed: ${validationResult.errors.join(", ")}`
      );
    }

    // Check business rules
    const existingUser = await this.userRepository.findByEmail(request.email);
    if (existingUser) {
      throw new ConflictError("A user with this email already exists");
    }

    // Create user
    try {
      return await this.userRepository.create({
        email: request.email,
        passwordHash: await this.hashPassword(request.password),
        roles: request.roles || ["user"],
      });
    } catch (error) {
      throw new InternalServerError("Failed to create user", {
        originalError: error.message,
      });
    }
  }
}
```

---

## 9. Authorization Patterns

### 9.1 Role-Based Access Control (RBAC)

```typescript
// types/authorization.ts
export type UserRole = "admin" | "moderator" | "user" | "guest";

export interface User {
  id: string;
  email: string;
  roles: UserRole[];
  permissions: Permission[];
}

export interface Permission {
  resource: string;
  action: string;
  scope?: string;
}

// Available roles with their permissions
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    { resource: "*", action: "*" }, // Full access
  ],
  moderator: [
    { resource: "session", action: "read" },
    { resource: "session", action: "update" },
    { resource: "user", action: "read" },
  ],
  user: [
    { resource: "session", action: "create" },
    { resource: "session", action: "read", scope: "own" },
    { resource: "session", action: "update", scope: "own" },
    { resource: "user", action: "read", scope: "own" },
    { resource: "user", action: "update", scope: "own" },
  ],
  guest: [{ resource: "session", action: "read", scope: "public" }],
};
```

### 9.2 Authorization Hook Pattern

```typescript
// hooks/authorization.ts
import { HookContext } from "@feathersjs/feathers";
import { ForbiddenError } from "../errors/forbidden.error";
import { ROLE_PERMISSIONS, UserRole } from "../types/authorization";

export interface AuthenticatedContext extends HookContext {
  params: HookContext["params"] & {
    user?: {
      id: string;
      roles: UserRole[];
      permissions: Permission[];
    };
  };
}

export function authorize(permissions: string[] = []) {
  return async (context: AuthenticatedContext): Promise<HookContext> => {
    const { user } = context.params;

    // Check if user is authenticated
    if (!user) {
      throw new ForbiddenError("Authentication required");
    }

    // If no specific permissions required, just need authentication
    if (permissions.length === 0) {
      return context;
    }

    // Check if user has required permissions
    const hasPermission = permissions.every((requiredPermission) => {
      return userHasPermission(user, requiredPermission);
    });

    if (!hasPermission) {
      throw new ForbiddenError(
        `Insufficient permissions. Required: ${permissions.join(", ")}`
      );
    }

    return context;
  };
}

function userHasPermission(user: any, requiredPermission: string): boolean {
  // Check role-based permissions
  for (const role of user.roles) {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    if (rolePermissions.some((p) => matchesPermission(p, requiredPermission))) {
      return true;
    }
  }

  // Check explicit permissions
  return (
    user.permissions?.some((p) => matchesPermission(p, requiredPermission)) ||
    false
  );
}

function matchesPermission(
  userPermission: Permission,
  requiredPermission: string
): boolean {
  const [requiredResource, requiredAction] = requiredPermission.split(":");

  return (
    (userPermission.resource === "*" ||
      userPermission.resource === requiredResource) &&
    (userPermission.action === "*" || userPermission.action === requiredAction)
  );
}
```

### 9.3 Service-Level Authorization

```typescript
// services/session.service.ts
export class SessionService {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly authorizationService: IAuthorizationService
  ) {}

  async updateSession(
    sessionId: string,
    updates: SessionUpdateData,
    userId: string
  ): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError("Session", sessionId);
    }

    // Check authorization
    await this.authorizationService.authorizeUserAction(
      userId,
      "session:update",
      { sessionId, hostId: session.hostId }
    );

    return this.sessionRepository.update(sessionId, updates);
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError("Session", sessionId);
    }

    // Check authorization
    await this.authorizationService.authorizeUserAction(
      userId,
      "session:delete",
      { sessionId, hostId: session.hostId }
    );

    await this.sessionRepository.delete(sessionId);
  }
}

// services/authorization.service.ts
export class AuthorizationService {
  async authorizeUserAction(
    userId: string,
    action: string,
    context?: any
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }

    // Implement authorization logic based on user roles/permissions
    const [resource, requiredAction] = action.split(":");

    // Check if user has permission for this action
    const hasPermission = this.checkPermission(
      user,
      resource,
      requiredAction,
      context
    );

    if (!hasPermission) {
      throw new ForbiddenError(
        `User ${userId} does not have permission to ${action}`
      );
    }
  }

  private checkPermission(
    user: User,
    resource: string,
    action: string,
    context?: any
  ): boolean {
    // Implement permission checking logic
    // This could check against role permissions, explicit permissions, or ownership
    return false; // Placeholder
  }
}
```

---

## 10. Implementation Roadmap

This guidelines document serves as the foundation for refactoring the existing codebase. The current implementation shows several areas that need improvement:

1. **Repository Pattern Implementation**: Replace direct Prisma usage in services
2. **Error Handling Standardization**: Implement structured error types
3. **Authorization Hook Fixes**: Complete the authorization hook implementation
4. **Configuration Management**: Implement centralized configuration with validation
5. **Service Layer Architecture**: Separate business logic from data access
6. **Testing Infrastructure**: Implement comprehensive testing patterns

All new code must follow these guidelines, and existing code should be gradually refactored to comply with these standards.
