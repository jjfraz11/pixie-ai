/**
 * Fluent TestDataBuilder - Method chaining for complex test data creation
 *
 * Provides a fluent API for creating test data with intelligent defaults
 * and override capabilities. Integrates with existing factories while
 * providing a more intuitive interface for complex data structures.
 */

import { SessionType } from '@prisma/client';
import { TestContext } from '../core/context';
import { CacheManager } from '../memoization/cache-manager';
import { UserFactory } from '../factories/user-factory';
import { SessionFactory } from '../factories/session-factory';
import { ParticipantFactory } from '../factories/participant-factory';
import { TestServiceBuilder } from './test-service-builder';

/**
 * User data configuration for fluent building
 */
export interface FluentUserConfig {
  email?: string;
  password?: string;
  roles?: string[];
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  profileData?: Record<string, any>;
  preferences?: Record<string, any>;
  metadata?: Record<string, any>;
  makeUnique?: boolean;
}

/**
 * Session data configuration for fluent building
 */
export interface FluentSessionConfig {
  title?: string;
  description?: string;
  type?: SessionType;
  isActive?: boolean;
  isPublic?: boolean;
  maxParticipants?: number;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
  scheduledStart?: Date;
  scheduledEnd?: Date;
}

/**
 * Participant data configuration for fluent building
 */
export interface FluentParticipantConfig {
  joinedAt?: Date;
  leftAt?: Date;
  role?: string;
  permissions?: string[];
  isMuted?: boolean;
  isBanned?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Complex test data result
 */
export interface FluentTestData {
  users: any[];
  sessions: any[];
  participants: any[];
  userService?: any;
  sessionService?: any;
  participantService?: any;
  context?: TestContext;
  cleanup?: () => Promise<void>;
}

/**
 * Base fluent builder class
 */
export abstract class BaseFluentBuilder {
  protected builder?: TestServiceBuilder;
  protected context?: TestContext;
  protected services: Map<string, any> = new Map();

  /**
   * Set services for the builder
   */
  withServices(services: { [key: string]: any }): this {
    Object.entries(services).forEach(([name, service]) => {
      this.services.set(name, service);
    });
    return this;
  }

  /**
   * Set TestServiceBuilder instance
   */
  withBuilder(builder: TestServiceBuilder): this {
    this.builder = builder;
    return this;
  }

  /**
   * Set test context
   */
  withContext(context: TestContext): this {
    this.context = context;
    return this;
  }

  /**
   * Get service by name
   */
  protected getService(name: string): any {
    return this.services.get(name);
  }

  /**
   * Abstract build method
   */
  abstract build(): Promise<FluentTestData>;
}

/**
 * Fluent user builder with method chaining
 */
export class FluentUserBuilder extends BaseFluentBuilder {
  private userConfigs: FluentUserConfig[] = [];
  private currentConfig: FluentUserConfig = {};

  /**
   * Create a new user with fluent configuration
   */
  static user(email?: string): FluentUserBuilder {
    const builder = new FluentUserBuilder();
    if (email) {
      builder.currentConfig.email = email;
    }
    return builder;
  }

  /**
   * Set user email
   */
  withEmail(email: string): this {
    this.currentConfig.email = email;
    return this;
  }

  /**
   * Set user password
   */
  withPassword(password: string): this {
    this.currentConfig.password = password;
    return this;
  }

  /**
   * Set user roles
   */
  withRoles(...roles: string[]): this {
    this.currentConfig.roles = roles;
    return this;
  }

  /**
   * Set user first name
   */
  withFirstName(firstName: string): this {
    this.currentConfig.firstName = firstName;
    return this;
  }

  /**
   * Set user last name
   */
  withLastName(lastName: string): this {
    this.currentConfig.lastName = lastName;
    return this;
  }

  /**
   * Set user as active/inactive
   */
  withActive(isActive: boolean = true): this {
    this.currentConfig.isActive = isActive;
    return this;
  }

  /**
   * Set email verification status
   */
  withEmailVerified(verified: boolean = true): this {
    this.currentConfig.emailVerified = verified;
    return this;
  }

  /**
   * Set profile data
   */
  withProfile(data: Record<string, any>): this {
    this.currentConfig.profileData = data;
    return this;
  }

  /**
   * Set user preferences
   */
  withPreferences(preferences: Record<string, any>): this {
    this.currentConfig.preferences = preferences;
    return this;
  }

  /**
   * Set metadata
   */
  withMetadata(metadata: Record<string, any>): this {
    this.currentConfig.metadata = metadata;
    return this;
  }

  /**
   * Set unique user creation
   */
  withUnique(makeUnique: boolean = true): this {
    this.currentConfig.makeUnique = makeUnique;
    return this;
  }

  /**
   * Add current user config to the list and reset for next user
   */
  and(): this {
    if (Object.keys(this.currentConfig).length > 0) {
      this.userConfigs.push({ ...this.currentConfig });
      this.currentConfig = {};
    }
    return this;
  }

  /**
   * Create another user with different configuration
   */
  another(email?: string): FluentUserBuilder {
    this.and();
    if (email) {
      this.currentConfig.email = email;
    }
    return this;
  }

  /**
   * Build the users
   */
  async build(): Promise<FluentTestData> {
    this.and(); // Add final user config

    if (this.userConfigs.length === 0) {
      throw new Error('No user configurations provided');
    }

    const userService = this.getService('userService') || this.getService('users');
    if (!userService) {
      throw new Error('User service not provided');
    }

    const users: any[] = [];
    const context = this.context || new TestContext();
    const cacheManager = new CacheManager();

    const userFactory = new UserFactory(context, cacheManager);

    for (const config of this.userConfigs) {
      const email = config.email || `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
      const password = config.password || 'TestPassword123!@#';
      const roles = config.roles || ['USER'];

      const additionalData = {
        firstName: config.firstName,
        lastName: config.lastName,
        isActive: config.isActive,
        emailVerified: config.emailVerified,
        profileData: config.profileData,
        preferences: config.preferences,
        metadata: config.metadata,
        roles,
      };

      // Remove undefined values
      Object.keys(additionalData).forEach((key) => {
        if ((additionalData as any)[key] === undefined) {
          delete (additionalData as any)[key];
        }
      });

      const user = await userFactory.createTestUser(userService, email, password, additionalData, config.makeUnique);

      users.push(user);
    }

    return {
      users,
      sessions: [],
      participants: [],
      userService,
      context,
      cleanup: async () => {
        // Cleanup users if context supports it
        for (const user of users) {
          try {
            await userService.remove(user.id);
          } catch (error) {
            console.warn(`Failed to cleanup user ${user.id}:`, error);
          }
        }
      },
    };
  }
}

/**
 * Fluent session builder with method chaining
 */
export class FluentSessionBuilder extends BaseFluentBuilder {
  private sessionConfigs: FluentSessionConfig[] = [];
  private currentConfig: FluentSessionConfig = {};
  private hostUsers: any[] = [];

  /**
   * Create a new session with fluent configuration
   */
  static session(title?: string): FluentSessionBuilder {
    const builder = new FluentSessionBuilder();
    if (title) {
      builder.currentConfig.title = title;
    }
    return builder;
  }

  /**
   * Set session title
   */
  withTitle(title: string): this {
    this.currentConfig.title = title;
    return this;
  }

  /**
   * Set session description
   */
  withDescription(description: string): this {
    this.currentConfig.description = description;
    return this;
  }

  /**
   * Set session type
   */
  withType(type: SessionType): this {
    this.currentConfig.type = type;
    return this;
  }

  /**
   * Set session as active/inactive
   */
  withActive(isActive: boolean = true): this {
    this.currentConfig.isActive = isActive;
    return this;
  }

  /**
   * Set session as public/private
   */
  withPublic(isPublic: boolean = true): this {
    this.currentConfig.isPublic = isPublic;
    return this;
  }

  /**
   * Set maximum participants
   */
  withMaxParticipants(max: number): this {
    this.currentConfig.maxParticipants = max;
    return this;
  }

  /**
   * Set session settings
   */
  withSettings(settings: Record<string, any>): this {
    this.currentConfig.settings = settings;
    return this;
  }

  /**
   * Set metadata
   */
  withMetadata(metadata: Record<string, any>): this {
    this.currentConfig.metadata = metadata;
    return this;
  }

  /**
   * Set scheduled start time
   */
  withScheduledStart(startTime: Date): this {
    this.currentConfig.scheduledStart = startTime;
    return this;
  }

  /**
   * Set scheduled end time
   */
  withScheduledEnd(endTime: Date): this {
    this.currentConfig.scheduledEnd = endTime;
    return this;
  }

  /**
   * Set host user for this session
   */
  withHost(hostUser: any): this {
    this.hostUsers.push(hostUser);
    return this;
  }

  /**
   * Add current session config to the list and reset for next session
   */
  and(): this {
    if (Object.keys(this.currentConfig).length > 0) {
      this.sessionConfigs.push({ ...this.currentConfig });
      this.currentConfig = {};
    }
    return this;
  }

  /**
   * Create another session with different configuration
   */
  another(title?: string): FluentSessionBuilder {
    this.and();
    if (title) {
      this.currentConfig.title = title;
    }
    return this;
  }

  /**
   * Build the sessions
   */
  async build(): Promise<FluentTestData> {
    this.and(); // Add final session config

    if (this.sessionConfigs.length === 0) {
      throw new Error('No session configurations provided');
    }

    const sessionService = this.getService('sessionService') || this.getService('sessions');
    if (!sessionService) {
      throw new Error('Session service not provided');
    }

    if (this.hostUsers.length === 0) {
      throw new Error('No host users provided for sessions');
    }

    const sessions: any[] = [];
    const context = this.context || new TestContext();
    const cacheManager = new CacheManager();

    const sessionFactory = new SessionFactory(context, cacheManager);

    for (let i = 0; i < this.sessionConfigs.length; i++) {
      const config = this.sessionConfigs[i];
      const host = this.hostUsers[i % this.hostUsers.length];

      const title = config.title || `Test Session ${i + 1}`;
      const type = config.type || SessionType.BROADCAST;

      const additionalData = {
        description: config.description,
        isActive: config.isActive,
        isPublic: config.isPublic,
        maxParticipants: config.maxParticipants,
        settings: config.settings,
        metadata: config.metadata,
        scheduledStart: config.scheduledStart,
        scheduledEnd: config.scheduledEnd,
      };

      // Remove undefined values
      Object.keys(additionalData).forEach((key) => {
        if ((additionalData as any)[key] === undefined) {
          delete (additionalData as any)[key];
        }
      });

      const session = await sessionFactory.createTestSession(sessionService, type, host, additionalData);

      sessions.push(session);
    }

    return {
      users: [],
      sessions,
      participants: [],
      sessionService,
      context,
      cleanup: async () => {
        // Cleanup sessions if context supports it
        for (const session of sessions) {
          try {
            await sessionService.remove(session.id);
          } catch (error) {
            console.warn(`Failed to cleanup session ${session.id}:`, error);
          }
        }
      },
    };
  }
}

/**
 * Fluent participant builder with method chaining
 */
export class FluentParticipantBuilder extends BaseFluentBuilder {
  private participantConfigs: Array<{
    sessionId: string;
    userId: string;
    config: FluentParticipantConfig;
  }> = [];

  private currentConfig: FluentParticipantConfig = {};
  private currentSessionId?: string;
  private currentUserId?: string;

  /**
   * Create a new participant with fluent configuration
   */
  static participant(sessionId: string, userId: string): FluentParticipantBuilder {
    const builder = new FluentParticipantBuilder();
    builder.currentSessionId = sessionId;
    builder.currentUserId = userId;
    return builder;
  }

  /**
   * Set joined at timestamp
   */
  withJoinedAt(joinedAt: Date): this {
    this.currentConfig.joinedAt = joinedAt;
    return this;
  }

  /**
   * Set left at timestamp
   */
  withLeftAt(leftAt: Date): this {
    this.currentConfig.leftAt = leftAt;
    return this;
  }

  /**
   * Set participant role
   */
  withRole(role: string): this {
    this.currentConfig.role = role;
    return this;
  }

  /**
   * Set participant permissions
   */
  withPermissions(...permissions: string[]): this {
    this.currentConfig.permissions = permissions;
    return this;
  }

  /**
   * Set mute status
   */
  withMuted(isMuted: boolean = true): this {
    this.currentConfig.isMuted = isMuted;
    return this;
  }

  /**
   * Set ban status
   */
  withBanned(isBanned: boolean = true): this {
    this.currentConfig.isBanned = isBanned;
    return this;
  }

  /**
   * Set metadata
   */
  withMetadata(metadata: Record<string, any>): this {
    this.currentConfig.metadata = metadata;
    return this;
  }

  /**
   * Add current participant config to the list and reset for next participant
   */
  and(): this {
    if (this.currentSessionId && this.currentUserId && Object.keys(this.currentConfig).length > 0) {
      this.participantConfigs.push({
        sessionId: this.currentSessionId,
        userId: this.currentUserId,
        config: { ...this.currentConfig },
      });
      this.currentConfig = {};
    }
    return this;
  }

  /**
   * Create another participant with different configuration
   */
  another(sessionId: string, userId: string): FluentParticipantBuilder {
    this.and();
    this.currentSessionId = sessionId;
    this.currentUserId = userId;
    return this;
  }

  /**
   * Build the participants
   */
  async build(): Promise<FluentTestData> {
    this.and(); // Add final participant config

    if (this.participantConfigs.length === 0) {
      throw new Error('No participant configurations provided');
    }

    const participantService = this.getService('participantService') || this.getService('participants');
    if (!participantService) {
      throw new Error('Participant service not provided');
    }

    const participants: any[] = [];
    const context = this.context || new TestContext();
    const cacheManager = new CacheManager();

    const participantFactory = new ParticipantFactory(context, cacheManager);

    for (const { sessionId, userId, config } of this.participantConfigs) {
      const additionalData = {
        joinedAt: config.joinedAt,
        leftAt: config.leftAt,
        role: config.role,
        permissions: config.permissions,
        isMuted: config.isMuted,
        isBanned: config.isBanned,
        metadata: config.metadata,
      };

      // Remove undefined values
      Object.keys(additionalData).forEach((key) => {
        if ((additionalData as any)[key] === undefined) {
          delete (additionalData as any)[key];
        }
      });

      const participant = await participantFactory.createTestParticipant(
        participantService,
        sessionId,
        userId,
        additionalData,
      );

      participants.push(participant);
    }

    return {
      users: [],
      sessions: [],
      participants,
      participantService,
      context,
      cleanup: async () => {
        // Cleanup participants if context supports it
        for (const participant of participants) {
          try {
            await participantService.remove(participant.id);
          } catch (error) {
            console.warn(`Failed to cleanup participant ${participant.id}:`, error);
          }
        }
      },
    };
  }
}

/**
 * Master fluent test data builder that combines all builders
 */
export class FluentTestDataBuilder extends BaseFluentBuilder {
  private userBuilder?: FluentUserBuilder;
  private sessionBuilder?: FluentSessionBuilder;
  private participantBuilder?: FluentParticipantBuilder;

  /**
   * Start building users
   */
  users(email?: string): FluentUserBuilder {
    this.userBuilder = FluentUserBuilder.user(email);
    return this.userBuilder;
  }

  /**
   * Start building sessions
   */
  sessions(title?: string): FluentSessionBuilder {
    this.sessionBuilder = FluentSessionBuilder.session(title);
    return this.sessionBuilder;
  }

  /**
   * Start building participants
   */
  participants(sessionId: string, userId: string): FluentParticipantBuilder {
    this.participantBuilder = FluentParticipantBuilder.participant(sessionId, userId);
    return this.participantBuilder;
  }

  /**
   * Build all configured test data
   */
  async build(): Promise<FluentTestData> {
    const results: FluentTestData[] = [];

    if (this.userBuilder) {
      const userResult = await this.userBuilder.build();
      results.push(userResult);
    }

    if (this.sessionBuilder) {
      const sessionResult = await this.sessionBuilder.build();
      results.push(sessionResult);
    }

    if (this.participantBuilder) {
      const participantResult = await this.participantBuilder.build();
      results.push(participantResult);
    }

    if (results.length === 0) {
      throw new Error('No builders configured');
    }

    // Combine all results
    const combinedResult: FluentTestData = {
      users: results.flatMap((r) => r.users),
      sessions: results.flatMap((r) => r.sessions),
      participants: results.flatMap((r) => r.participants),
      userService: results[0].userService,
      sessionService: results[0].sessionService,
      participantService: results[0].participantService,
      context: results[0].context,
      cleanup: async () => {
        for (const result of results) {
          if (result.cleanup) {
            await result.cleanup();
          }
        }
      },
    };

    return combinedResult;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a fluent test data builder
 */
export function createTestData(): FluentTestDataBuilder {
  return new FluentTestDataBuilder();
}

/**
 * Create users with fluent API
 */
export function createUsers(email?: string): FluentUserBuilder {
  return FluentUserBuilder.user(email);
}

/**
 * Create sessions with fluent API
 */
export function createSessions(title?: string): FluentSessionBuilder {
  return FluentSessionBuilder.session(title);
}

/**
 * Create participants with fluent API
 */
export function createParticipants(sessionId: string, userId: string): FluentParticipantBuilder {
  return FluentParticipantBuilder.participant(sessionId, userId);
}
