/**
 * Scenario Templates - Quick setup templates for common testing scenarios
 *
 * Provides quick templates with smart defaults for common scenarios:
 * - quickBroadcast(): Basic broadcast scenario with 1 host and 3 viewers
 * - quickP2P(): Basic P2P scenario with 2 participants
 * - authOnly(): Authentication testing scenario with multiple user roles
 *
 * All templates use fluent builder pattern with method chaining for customization.
 */

import { SessionType } from '@prisma/client';
import { TestContext } from '../core/context';
import { CacheManager } from '../memoization/cache-manager';
import { UserFactory } from '../factories/user-factory';
import { SessionFactory } from '../factories/session-factory';
import { ParticipantFactory } from '../factories/participant-factory';
import { ScenarioFactory, ScenarioConfig } from '../scenario-factories/scenario-factories';
import { TestServiceBuilder } from './test-service-builder';

/**
 * Fluent scenario template configuration
 */
export interface ScenarioTemplateConfig {
  userCount?: number;
  sessionCount?: number;
  participantsPerSession?: number;
  userRoles?: string[];
  sessionTypes?: SessionType[];
  additionalUserData?: Record<string, any>;
  additionalSessionData?: Record<string, any>;
  additionalParticipantData?: Record<string, any>;
  makeUnique?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableCaching?: boolean;
}

/**
 * Base scenario template class with fluent API
 */
export abstract class BaseScenarioTemplate {
  protected config: ScenarioTemplateConfig;
  protected builder?: TestServiceBuilder;

  constructor(config: ScenarioTemplateConfig = {}) {
    this.config = {
      userCount: 3,
      sessionCount: 1,
      participantsPerSession: 2,
      userRoles: ['USER'],
      makeUnique: true,
      enablePerformanceMonitoring: false,
      enableCaching: true,
      ...config,
    };
  }

  /**
   * Set number of users to create
   */
  withUsers(count: number): this {
    this.config.userCount = count;
    return this;
  }

  /**
   * Set number of sessions to create
   */
  withSessions(count: number): this {
    this.config.sessionCount = count;
    return this;
  }

  /**
   * Set participants per session
   */
  withParticipants(count: number): this {
    this.config.participantsPerSession = count;
    return this;
  }

  /**
   * Set user roles
   */
  withRoles(...roles: string[]): this {
    this.config.userRoles = roles;
    return this;
  }

  /**
   * Add additional user data
   */
  withUserData(data: Record<string, any>): this {
    this.config.additionalUserData = {
      ...this.config.additionalUserData,
      ...data,
    };
    return this;
  }

  /**
   * Add additional session data
   */
  withSessionData(data: Record<string, any>): this {
    this.config.additionalSessionData = {
      ...this.config.additionalSessionData,
      ...data,
    };
    return this;
  }

  /**
   * Add additional participant data
   */
  withParticipantData(data: Record<string, any>): this {
    this.config.additionalParticipantData = {
      ...this.config.additionalParticipantData,
      ...data,
    };
    return this;
  }

  /**
   * Enable/disable unique user creation
   */
  withUniqueUsers(unique: boolean): this {
    this.config.makeUnique = unique;
    return this;
  }

  /**
   * Enable performance monitoring
   */
  withPerformanceMonitoring(enabled: boolean = true): this {
    this.config.enablePerformanceMonitoring = enabled;
    return this;
  }

  /**
   * Enable/disable caching
   */
  withCaching(enabled: boolean = true): this {
    this.config.enableCaching = enabled;
    return this;
  }

  /**
   * Use existing TestServiceBuilder
   */
  withBuilder(builder: TestServiceBuilder): this {
    this.builder = builder;
    return this;
  }

  /**
   * Build scenario configuration
   */
  protected buildScenarioConfig(): ScenarioConfig {
    return {
      userCount: this.config.userCount,
      sessionCount: this.config.sessionCount,
      participantsPerSession: this.config.participantsPerSession,
      userRoles: this.config.userRoles,
      additionalUserData: this.config.additionalUserData,
      additionalSessionData: this.config.additionalSessionData,
      additionalParticipantData: this.config.additionalParticipantData,
      makeUnique: this.config.makeUnique,
    };
  }

  /**
   * Create and configure TestServiceBuilder
   */
  protected async createBuilder(): Promise<TestServiceBuilder> {
    if (this.builder) {
      return this.builder;
    }

    let builder = new TestServiceBuilder();

    if (this.config.enablePerformanceMonitoring) {
      builder = builder.withPerformanceMonitoring();
    }

    return builder.build();
  }

  /**
   * Abstract method to execute the scenario
   */
  abstract execute(userService: any, sessionService?: any, participantService?: any): Promise<any>;
}

/**
 * Quick broadcast scenario template
 */
export class QuickBroadcastTemplate extends BaseScenarioTemplate {
  constructor(config?: ScenarioTemplateConfig) {
    super({
      userCount: 4, // 1 host + 3 viewers
      sessionCount: 1,
      participantsPerSession: 3,
      userRoles: ['BROADCASTER', 'USER'],
      ...config,
    });
  }

  async execute(userService: any, sessionService: any, participantService: any): Promise<any> {
    const builder = await this.createBuilder();
    return builder.createBroadcastScenario(userService, sessionService, participantService, this.buildScenarioConfig());
  }
}

/**
 * Quick P2P scenario template
 */
export class QuickP2PTemplate extends BaseScenarioTemplate {
  constructor(config?: ScenarioTemplateConfig) {
    super({
      userCount: 2,
      sessionCount: 1,
      participantsPerSession: 1,
      userRoles: ['USER'],
      ...config,
    });
  }

  async execute(userService: any, sessionService: any, participantService: any): Promise<any> {
    const builder = await this.createBuilder();
    return builder.createP2PScenario(userService, sessionService, participantService, this.buildScenarioConfig());
  }
}

/**
 * Authentication-only scenario template
 */
export class AuthOnlyTemplate extends BaseScenarioTemplate {
  constructor(config?: ScenarioTemplateConfig) {
    super({
      userCount: 3,
      sessionCount: 0,
      participantsPerSession: 0,
      userRoles: ['ADMIN', 'USER', 'BROADCASTER'],
      ...config,
    });
  }

  async execute(userService: any): Promise<any> {
    const builder = await this.createBuilder();
    return builder.createAuthScenario(userService, this.buildScenarioConfig());
  }
}

/**
 * Complex mixed scenario template
 */
export class MixedScenarioTemplate extends BaseScenarioTemplate {
  private broadcastCount: number = 1;
  private p2pCount: number = 1;

  constructor(config?: ScenarioTemplateConfig) {
    super({
      userCount: 6,
      sessionCount: 2,
      ...config,
    });
  }

  /**
   * Set number of broadcast scenarios
   */
  withBroadcastCount(count: number): this {
    this.broadcastCount = count;
    return this;
  }

  /**
   * Set number of P2P scenarios
   */
  withP2PCount(count: number): this {
    this.p2pCount = count;
    return this;
  }

  async execute(userService: any, sessionService: any, participantService: any): Promise<any> {
    const builder = await this.createBuilder();

    // Create broadcast scenarios
    const broadcastScenarios: any[] = [];
    for (let i = 0; i < this.broadcastCount; i++) {
      const scenario = await builder.createBroadcastScenario(userService, sessionService, participantService, {
        ...this.buildScenarioConfig(),
        makeUnique: true,
      });
      broadcastScenarios.push(scenario);
    }

    // Create P2P scenarios
    const p2pScenarios: any[] = [];
    for (let i = 0; i < this.p2pCount; i++) {
      const scenario = await builder.createP2PScenario(userService, sessionService, participantService, {
        ...this.buildScenarioConfig(),
        makeUnique: true,
      });
      p2pScenarios.push(scenario);
    }

    // Combine all resources
    const allUsers = [...broadcastScenarios.flatMap((s: any) => s.users), ...p2pScenarios.flatMap((s: any) => s.users)];
    const allSessions = [
      ...broadcastScenarios.flatMap((s: any) => s.sessions),
      ...p2pScenarios.flatMap((s: any) => s.sessions),
    ];
    const allParticipants = [
      ...broadcastScenarios.flatMap((s: any) => s.participants),
      ...p2pScenarios.flatMap((s: any) => s.participants),
    ];

    return {
      users: allUsers,
      sessions: allSessions,
      participants: allParticipants,
      userService,
      sessionService,
      participantService,
      broadcastScenarios,
      p2pScenarios,
      context: builder.getContext(),
      cleanup: async () => {
        for (const scenario of [...broadcastScenarios, ...p2pScenarios]) {
          if (scenario.cleanup) {
            await scenario.cleanup();
          }
        }
      },
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a quick broadcast scenario with default settings
 */
export async function quickBroadcast(
  userService: any,
  sessionService: any,
  participantService: any,
  config?: ScenarioTemplateConfig,
): Promise<any> {
  const template = new QuickBroadcastTemplate(config);
  return template.execute(userService, sessionService, participantService);
}

/**
 * Create a quick P2P scenario with default settings
 */
export async function quickP2P(
  userService: any,
  sessionService: any,
  participantService: any,
  config?: ScenarioTemplateConfig,
): Promise<any> {
  const template = new QuickP2PTemplate(config);
  return template.execute(userService, sessionService, participantService);
}

/**
 * Create an authentication-only scenario with default settings
 */
export async function authOnly(userService: any, config?: ScenarioTemplateConfig): Promise<any> {
  const template = new AuthOnlyTemplate(config);
  return template.execute(userService);
}

/**
 * Create a mixed scenario with both broadcast and P2P sessions
 */
export async function mixedScenario(
  userService: any,
  sessionService: any,
  participantService: any,
  config?: ScenarioTemplateConfig & {
    broadcastCount?: number;
    p2pCount?: number;
  },
): Promise<any> {
  const template = new MixedScenarioTemplate(config);
  if (config?.broadcastCount !== undefined) {
    template.withBroadcastCount(config.broadcastCount);
  }
  if (config?.p2pCount !== undefined) {
    template.withP2PCount(config.p2pCount);
  }
  return template.execute(userService, sessionService, participantService);
}

// ============================================================================
// Fluent Builder Factory Functions
// ============================================================================

/**
 * Create a broadcast scenario builder
 */
export function broadcastScenario(): QuickBroadcastTemplate {
  return new QuickBroadcastTemplate();
}

/**
 * Create a P2P scenario builder
 */
export function p2pScenario(): QuickP2PTemplate {
  return new QuickP2PTemplate();
}

/**
 * Create an authentication scenario builder
 */
export function authScenario(): AuthOnlyTemplate {
  return new AuthOnlyTemplate();
}

/**
 * Create a mixed scenario builder
 */
export function mixedScenarios(): MixedScenarioTemplate {
  return new MixedScenarioTemplate();
}
