import { SessionType } from '@prisma/client';
import { TestContext } from '../core/context';
import { CacheManager } from '../memoization/cache-manager';
import { UserFactory } from '../factories/user-factory';
import { SessionFactory } from '../factories/session-factory';
import { ParticipantFactory } from '../factories/participant-factory';

/**
 * Scenario configuration interface
 */
export interface ScenarioConfig {
  userCount?: number;
  sessionCount?: number;
  participantsPerSession?: number;
  userRoles?: string[];
  sessionTypes?: SessionType[];
  additionalUserData?: Record<string, any>;
  additionalSessionData?: Record<string, any>;
  additionalParticipantData?: Record<string, any>;
  makeUnique?: boolean;
}

/**
 * Authentication scenario result
 */
export interface AuthScenario {
  users: any[];
  userService: any;
  context: TestContext;
  cleanup: () => Promise<void>;
}

/**
 * Broadcast scenario result
 */
export interface BroadcastScenario {
  users: any[];
  sessions: any[];
  participants: any[];
  userService: any;
  sessionService: any;
  participantService: any;
  context: TestContext;
  cleanup: () => Promise<void>;
}

/**
 * P2P scenario result
 */
export interface P2PScenario {
  users: any[];
  sessions: any[];
  participants: any[];
  userService: any;
  sessionService: any;
  participantService: any;
  context: TestContext;
  cleanup: () => Promise<void>;
}

/**
 * Scenario factory for creating complex test scenarios with relationship management
 */
export class ScenarioFactory {
  private userFactory: UserFactory;
  private sessionFactory: SessionFactory;
  private participantFactory: ParticipantFactory;
  private cacheManager: CacheManager;

  constructor(private context: TestContext) {
    this.cacheManager = new CacheManager();
    this.userFactory = new UserFactory(context, this.cacheManager);
    this.sessionFactory = new SessionFactory(context, this.cacheManager);
    this.participantFactory = new ParticipantFactory(context, this.cacheManager);
  }

  /**
   * Create an authentication testing scenario with multiple users
   */
  async createAuthScenario(userService: any, config: ScenarioConfig = {}): Promise<AuthScenario> {
    const { userCount = 3, userRoles = ['USER'], additionalUserData = {}, makeUnique = true } = config;

    const users: any[] = [];

    // Create users with different roles for comprehensive auth testing
    for (let i = 0; i < userCount; i++) {
      const role = i === 0 ? 'ADMIN' : userRoles[i % userRoles.length];
      const email = `auth-test-${makeUnique ? `${Date.now()}-` : ''}user${i}@example.com`;

      const user = await this.userFactory.createTestUser(
        userService,
        email,
        'TestPassword123!@#',
        {
          roles: [role],
          ...additionalUserData,
        },
        makeUnique,
      );

      users.push(user);
    }

    // Track all created objects for cleanup
    users.forEach((user) => {
      this.context.track('users', {
        id: user.id,
        type: 'user',
        data: user,
      });
    });

    return {
      users,
      userService,
      context: this.context,
      cleanup: async () => {
        await this.cleanupScenario('users', userService);
      },
    };
  }

  /**
   * Create a broadcast testing scenario with users, sessions, and participants
   */
  async createBroadcastScenario(
    userService: any,
    sessionService: any,
    participantService: any,
    config: ScenarioConfig = {},
  ): Promise<BroadcastScenario> {
    const {
      userCount = 5,
      sessionCount = 2,
      participantsPerSession = 3,
      userRoles = ['USER', 'BROADCASTER'],
      additionalUserData = {},
      additionalSessionData = {},
      additionalParticipantData = {},
      makeUnique = true,
    } = config;

    const users: any[] = [];
    const sessions: any[] = [];
    const participants: any[] = [];

    // Create host users (broadcasters)
    for (let i = 0; i < Math.min(userCount, 2); i++) {
      const email = `broadcast-host-${makeUnique ? `${Date.now()}-` : ''}${i}@example.com`;
      const user = await this.userFactory.createTestUser(
        userService,
        email,
        'TestPassword123!@#',
        {
          roles: ['BROADCASTER'],
          ...additionalUserData,
        },
        makeUnique,
      );
      users.push(user);
    }

    // Create regular users (viewers)
    for (let i = 2; i < userCount; i++) {
      const email = `broadcast-viewer-${makeUnique ? `${Date.now()}-` : ''}${i}@example.com`;
      const user = await this.userFactory.createTestUser(
        userService,
        email,
        'TestPassword123!@#',
        {
          roles: ['USER'],
          ...additionalUserData,
        },
        makeUnique,
      );
      users.push(user);
    }

    // Create broadcast sessions
    for (let i = 0; i < sessionCount && i < users.length; i++) {
      const host = users[i];
      const session = await this.sessionFactory.createTestSession(sessionService, SessionType.BROADCAST, host, {
        title: `Test Broadcast Session ${i + 1}`,
        description: 'A test broadcast session for scenario testing',
        ...additionalSessionData,
      });
      sessions.push(session);
    }

    // Add participants to each session
    for (const session of sessions) {
      const availableUsers = users.filter((user) => user.id !== session.hostId);
      const participantsToAdd = Math.min(participantsPerSession, availableUsers.length);

      for (let i = 0; i < participantsToAdd; i++) {
        const user = availableUsers[i];
        const participant = await this.participantFactory.createTestParticipant(
          participantService,
          session.id,
          user.id,
          {
            joinedAt: new Date(),
            ...additionalParticipantData,
          },
        );
        participants.push(participant);
      }
    }

    return {
      users,
      sessions,
      participants,
      userService,
      sessionService,
      participantService,
      context: this.context,
      cleanup: async () => {
        await this.cleanupScenario('participants', participantService);
        await this.cleanupScenario('sessions', sessionService);
        await this.cleanupScenario('users', userService);
      },
    };
  }

  /**
   * Create a P2P testing scenario with users, sessions, and participants
   */
  async createP2PScenario(
    userService: any,
    sessionService: any,
    participantService: any,
    config: ScenarioConfig = {},
  ): Promise<P2PScenario> {
    const {
      userCount = 4,
      sessionCount = 1,
      participantsPerSession = 3,
      userRoles = ['USER'],
      additionalUserData = {},
      additionalSessionData = {},
      additionalParticipantData = {},
      makeUnique = true,
    } = config;

    const users: any[] = [];
    const sessions: any[] = [];
    const participants: any[] = [];

    // Create users for P2P scenario
    for (let i = 0; i < userCount; i++) {
      const email = `p2p-user-${makeUnique ? `${Date.now()}-` : ''}${i}@example.com`;
      const user = await this.userFactory.createTestUser(
        userService,
        email,
        'TestPassword123!@#',
        {
          roles: userRoles,
          ...additionalUserData,
        },
        makeUnique,
      );
      users.push(user);
    }

    // Create P2P sessions
    for (let i = 0; i < sessionCount && i < users.length; i++) {
      const host = users[i];
      const session = await this.sessionFactory.createTestSession(sessionService, SessionType.P2P, host, {
        title: `Test P2P Session ${i + 1}`,
        description: 'A test P2P session for scenario testing',
        ...additionalSessionData,
      });
      sessions.push(session);
    }

    // Add participants to each session
    for (const session of sessions) {
      const availableUsers = users.filter((user) => user.id !== session.hostId);
      const participantsToAdd = Math.min(participantsPerSession, availableUsers.length);

      for (let i = 0; i < participantsToAdd; i++) {
        const user = availableUsers[i];
        const participant = await this.participantFactory.createTestParticipant(
          participantService,
          session.id,
          user.id,
          {
            joinedAt: new Date(),
            ...additionalParticipantData,
          },
        );
        participants.push(participant);
      }
    }

    return {
      users,
      sessions,
      participants,
      userService,
      sessionService,
      participantService,
      context: this.context,
      cleanup: async () => {
        await this.cleanupScenario('participants', participantService);
        await this.cleanupScenario('sessions', sessionService);
        await this.cleanupScenario('users', userService);
      },
    };
  }

  /**
   * Create a complex scenario with multiple session types
   */
  async createMixedScenario(
    userService: any,
    sessionService: any,
    participantService: any,
    config: ScenarioConfig & {
      broadcastCount?: number;
      p2pCount?: number;
    } = {},
  ): Promise<BroadcastScenario & P2PScenario> {
    const { broadcastCount = 1, p2pCount = 1, ...scenarioConfig } = config;

    const broadcastScenarios: BroadcastScenario[] = [];
    const p2pScenarios: P2PScenario[] = [];

    // Create broadcast scenarios
    for (let i = 0; i < broadcastCount; i++) {
      const scenario = await this.createBroadcastScenario(userService, sessionService, participantService, {
        ...scenarioConfig,
        makeUnique: true,
      });
      broadcastScenarios.push(scenario);
    }

    // Create P2P scenarios
    for (let i = 0; i < p2pCount; i++) {
      const scenario = await this.createP2PScenario(userService, sessionService, participantService, {
        ...scenarioConfig,
        makeUnique: true,
      });
      p2pScenarios.push(scenario);
    }

    // Combine all resources
    const allUsers = [...broadcastScenarios.flatMap((s) => s.users), ...p2pScenarios.flatMap((s) => s.users)];
    const allSessions = [...broadcastScenarios.flatMap((s) => s.sessions), ...p2pScenarios.flatMap((s) => s.sessions)];
    const allParticipants = [
      ...broadcastScenarios.flatMap((s) => s.participants),
      ...p2pScenarios.flatMap((s) => s.participants),
    ];

    return {
      users: allUsers,
      sessions: allSessions,
      participants: allParticipants,
      userService,
      sessionService,
      participantService,
      context: this.context,
      cleanup: async () => {
        // Cleanup all scenarios
        for (const scenario of [...broadcastScenarios, ...p2pScenarios]) {
          await scenario.cleanup();
        }
      },
    };
  }

  /**
   * Validate scenario integrity
   */
  private validateScenario(scenario: any, type: string): boolean {
    if (!scenario) {
      console.warn(`Invalid ${type} scenario: null or undefined`);
      return false;
    }

    switch (type) {
      case 'auth':
        return scenario.users && Array.isArray(scenario.users) && scenario.users.length > 0;
      case 'broadcast':
      case 'p2p':
        return (
          scenario.users &&
          Array.isArray(scenario.users) &&
          scenario.sessions &&
          Array.isArray(scenario.sessions) &&
          scenario.participants &&
          Array.isArray(scenario.participants)
        );
      default:
        return true;
    }
  }

  /**
   * Clean up scenario objects
   */
  private async cleanupScenario(type: string, service: any): Promise<void> {
    try {
      // Clear tracked objects and attempt cleanup
      this.context.clearTracked(type);

      // If service has cleanup capability, use it
      if (service && typeof service.cleanup === 'function') {
        await service.cleanup();
      }
    } catch (error) {
      console.warn(`Failed to cleanup ${type}:`, error);
    }
  }

  /**
   * Get scenario statistics
   */
  getScenarioStats(scenario: any): Record<string, number> {
    return {
      users: scenario.users?.length || 0,
      sessions: scenario.sessions?.length || 0,
      participants: scenario.participants?.length || 0,
    };
  }
}

// Convenience functions for easy scenario creation
export async function createAuthScenario(userService: any, config?: ScenarioConfig): Promise<AuthScenario> {
  const factory = new ScenarioFactory(new TestContext());
  return factory.createAuthScenario(userService, config);
}

export async function createBroadcastScenario(
  userService: any,
  sessionService: any,
  participantService: any,
  config?: ScenarioConfig,
): Promise<BroadcastScenario> {
  const factory = new ScenarioFactory(new TestContext());
  return factory.createBroadcastScenario(userService, sessionService, participantService, config);
}

export async function createP2PScenario(
  userService: any,
  sessionService: any,
  participantService: any,
  config?: ScenarioConfig,
): Promise<P2PScenario> {
  const factory = new ScenarioFactory(new TestContext());
  return factory.createP2PScenario(userService, sessionService, participantService, config);
}

export async function createMixedScenario(
  userService: any,
  sessionService: any,
  participantService: any,
  config?: ScenarioConfig & { broadcastCount?: number; p2pCount?: number },
): Promise<BroadcastScenario & P2PScenario> {
  const factory = new ScenarioFactory(new TestContext());
  return factory.createMixedScenario(userService, sessionService, participantService, config);
}
