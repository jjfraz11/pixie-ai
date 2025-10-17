import { TestContext } from '../core/context';
import { CacheManager } from '../memoization/cache-manager';

/**
 * Participant factory for creating and managing test participants with memoization support
 */
export class ParticipantFactory {
  constructor(private context: TestContext, private cacheManager: CacheManager) {}

  /**
   * Create a test participant with memoization support
   */
  async createTestParticipant(
    participantService: any,
    sessionId: string,
    userId: string,
    additionalData: any = {},
  ): Promise<any> {
    const participantData = {
      sessionId,
      userId,
      ...additionalData,
    };

    // Create cache key properties
    const cacheKeyProps = {
      sessionId,
      userId,
      ...additionalData,
    };

    // Try to get from cache first
    const cachedParticipant = this.cacheManager.getCached<any>('participants', cacheKeyProps);
    if (cachedParticipant) {
      console.log(
        `Cache hit: Reusing cached participant for session ${sessionId}, user ${userId} with ID ${cachedParticipant.id}`,
      );
      this.context.track('participants', {
        id: cachedParticipant.id,
        type: 'participant',
        data: cachedParticipant,
      });
      return cachedParticipant;
    }

    // Check for existing participant in database (fallback for non-cached scenarios)
    try {
      const existingParticipants = await participantService.find({ query: cacheKeyProps });
      if (existingParticipants && existingParticipants.data && existingParticipants.data.length > 0) {
        const existingParticipant = existingParticipants.data[0];
        // Cache the existing participant for future use
        this.cacheManager.setCached('participants', cacheKeyProps, existingParticipant);

        console.log(
          `Database hit: Reusing existing participant for session ${sessionId}, user ${userId} with ID ${existingParticipant.id}`,
        );
        this.context.track('participants', {
          id: existingParticipant.id,
          type: 'participant',
          data: existingParticipant,
        });
        return existingParticipant;
      }
    } catch (error) {
      // If find fails, continue with creation
      console.warn(`Could not check for existing participant, will create new:`, error);
    }

    const participant = await participantService.create(participantData);

    // Cache the newly created participant
    this.cacheManager.setCached('participants', cacheKeyProps, participant);

    this.context.track('participants', {
      id: participant.id,
      type: 'participant',
      data: participant,
    });

    return participant;
  }

  /**
   * Create multiple test participants
   */
  async createTestParticipants(
    participantService: any,
    participantConfigs: Array<{
      sessionId: string;
      userId: string;
      additionalData?: any;
    }>,
  ): Promise<any[]> {
    const participants = [];
    for (const config of participantConfigs) {
      const participant = await this.createTestParticipant(
        participantService,
        config.sessionId,
        config.userId,
        config.additionalData,
      );
      participants.push(participant);
    }
    return participants;
  }

  /**
   * Create participant with custom data
   */
  async createCustomParticipant(
    participantService: any,
    participantData: {
      sessionId: string;
      userId: string;
      additionalData?: any;
    },
  ): Promise<any> {
    const cacheKeyProps = {
      sessionId: participantData.sessionId,
      userId: participantData.userId,
      ...participantData.additionalData,
    };

    // Try to get from cache first
    const cachedParticipant = this.cacheManager.getCached<any>('participants', cacheKeyProps);
    if (cachedParticipant) {
      console.log(
        `Cache hit: Reusing cached participant for session ${participantData.sessionId}, user ${participantData.userId} with ID ${cachedParticipant.id}`,
      );
      return this.context.track('participants', {
        id: cachedParticipant.id,
        type: 'participant',
        data: cachedParticipant,
      });
    }

    // Check for existing participant in database
    try {
      const existingParticipants = await participantService.find({ query: cacheKeyProps });
      if (existingParticipants && existingParticipants.data && existingParticipants.data.length > 0) {
        const existingParticipant = existingParticipants.data[0];
        this.cacheManager.setCached('participants', cacheKeyProps, existingParticipant);

        console.log(
          `Database hit: Reusing existing participant for session ${participantData.sessionId}, user ${participantData.userId} with ID ${existingParticipant.id}`,
        );
        return this.context.track('participants', {
          id: existingParticipant.id,
          type: 'participant',
          data: existingParticipant,
        });
      }
    } catch (error) {
      console.warn(`Could not check for existing participant, will create new:`, error);
    }

    const participant = await participantService.create({
      sessionId: participantData.sessionId,
      userId: participantData.userId,
      ...participantData.additionalData,
    });

    // Cache the newly created participant
    this.cacheManager.setCached('participants', cacheKeyProps, participant);

    this.context.track('participants', {
      id: participant.id,
      type: 'participant',
      data: participant,
    });

    return participant;
  }

  /**
   * Invalidate participant cache for specific properties
   */
  invalidateParticipantCache(properties?: Record<string, any>): void {
    this.cacheManager.invalidateCache('participants', properties);
  }

  /**
   * Clear all participant cache
   */
  clearParticipantCache(): void {
    this.cacheManager.invalidateCache('participants');
  }
}
