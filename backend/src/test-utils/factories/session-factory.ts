import { SessionType } from '@prisma/client';
import { TestContext, TestObject } from '../core/context';
import { CacheManager } from '../memoization/cache-manager';

/**
 * Session factory for creating and managing test sessions with memoization support
 */
export class SessionFactory {
  constructor(private context: TestContext, private cacheManager: CacheManager) {}

  /**
   * Create a test session with memoization support
   */
  async createTestSession(
    sessionService: any,
    type: SessionType,
    host: TestObject,
    additionalData: any = {},
  ): Promise<any> {
    const sessionData = {
      title: `Test Session ${type}`,
      description: `A test ${type} session`,
      type,
      hostId: host.id,
      ...additionalData,
    };

    // Create cache key properties
    const cacheKeyProps = {
      title: sessionData.title,
      description: sessionData.description,
      type: sessionData.type,
      hostId: sessionData.hostId,
      ...additionalData,
    };

    // Try to get from cache first
    const cachedSession = this.cacheManager.getCached<any>('sessions', cacheKeyProps);
    if (cachedSession) {
      console.log(`Cache hit: Reusing cached session ${cachedSession.title} with ID ${cachedSession.id}`);
      this.context.track('sessions', {
        id: cachedSession.id,
        type: 'session',
        data: cachedSession,
      });
      return cachedSession;
    }

    // Check for existing session in database (fallback for non-cached scenarios)
    try {
      const existingSessions = await sessionService.find({ query: cacheKeyProps });
      if (existingSessions && existingSessions.data && existingSessions.data.length > 0) {
        const existingSession = existingSessions.data[0];
        // Cache the existing session for future use
        this.cacheManager.setCached('sessions', cacheKeyProps, existingSession);

        console.log(`Database hit: Reusing existing session ${existingSession.title} with ID ${existingSession.id}`);
        this.context.track('sessions', {
          id: existingSession.id,
          type: 'session',
          data: existingSession,
        });

        return existingSession;
      }
    } catch (error) {
      // If find fails, continue with creation
      console.warn(`Could not check for existing session, will create new:`, error);
    }

    const session = await sessionService.create(sessionData, {
      user: { id: host.id, roles: ['USER', 'BROADCASTER'] },
    });

    // Cache the newly created session
    this.cacheManager.setCached('sessions', cacheKeyProps, session);

    this.context.track('sessions', {
      id: session.id,
      type: 'session',
      data: session,
    });

    return session;
  }

  /**
   * Create multiple test sessions
   */
  async createTestSessions(
    sessionService: any,
    sessionConfigs: Array<{
      type: SessionType;
      host: TestObject;
      additionalData?: any;
    }>,
  ): Promise<any[]> {
    const sessions = [];
    for (const config of sessionConfigs) {
      const session = await this.createTestSession(sessionService, config.type, config.host, config.additionalData);
      sessions.push(session);
    }
    return sessions;
  }

  /**
   * Create session with custom data
   */
  async createCustomSession(
    sessionService: any,
    sessionData: {
      title: string;
      description?: string;
      type: SessionType;
      host: TestObject;
      additionalData?: any;
    },
  ): Promise<any> {
    const cacheKeyProps = {
      title: sessionData.title,
      description: sessionData.description || '',
      type: sessionData.type,
      hostId: sessionData.host.id,
      ...sessionData.additionalData,
    };

    // Try to get from cache first
    const cachedSession = this.cacheManager.getCached<any>('sessions', cacheKeyProps);
    if (cachedSession) {
      console.log(`Cache hit: Reusing cached session ${cachedSession.title} with ID ${cachedSession.id}`);
      this.context.track('sessions', {
        id: cachedSession.id,
        type: 'session',
        data: cachedSession,
      });

      return cachedSession;
    }

    // Check for existing session in database
    try {
      const existingSessions = await sessionService.find({ query: cacheKeyProps });
      if (existingSessions && existingSessions.data && existingSessions.data.length > 0) {
        const existingSession = existingSessions.data[0];
        this.cacheManager.setCached('sessions', cacheKeyProps, existingSession);

        console.log(`Database hit: Reusing existing session ${existingSession.title} with ID ${existingSession.id}`);
        this.context.track('sessions', {
          id: existingSession.id,
          type: 'session',
          data: existingSession,
        });

        return existingSession;
      }
    } catch (error) {
      console.warn(`Could not check for existing session, will create new:`, error);
    }

    const session = await sessionService.create(
      {
        title: sessionData.title,
        description: sessionData.description || '',
        type: sessionData.type,
        hostId: sessionData.host.id,
        ...sessionData.additionalData,
      },
      {
        user: { id: sessionData.host.id, roles: ['USER', 'BROADCASTER'] },
      },
    );

    // Cache the newly created session
    this.cacheManager.setCached('sessions', cacheKeyProps, session);

    this.context.track('sessions', {
      id: session.id,
      type: 'session',
      data: session,
    });

    return session;
  }

  /**
   * Invalidate session cache for specific properties
   */
  invalidateSessionCache(properties?: Record<string, any>): void {
    this.cacheManager.invalidateCache('sessions', properties);
  }

  /**
   * Clear all session cache
   */
  clearSessionCache(): void {
    this.cacheManager.invalidateCache('sessions');
  }
}
