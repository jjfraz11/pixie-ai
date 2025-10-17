import { TestContext } from '../core/context';
import { CacheManager } from '../memoization/cache-manager';

/**
 * User factory for creating and managing test users with memoization support
 */
export class UserFactory {
  private uniqueCounter = 0;

  constructor(private context: TestContext, private cacheManager: CacheManager) {}

  /**
   * Create a test user with memoization support
   */
  async createTestUser(
    userService: any,
    email: string,
    password: string = 'TestPassword123!@#',
    additionalData: any = {},
    makeUnique: boolean = true,
  ): Promise<any> {
    // Normalize roles for consistent caching
    const normalizedRoles = additionalData.roles
      ? additionalData.roles.map((role: string) => role.toUpperCase()).sort()
      : ['USER'];

    // Create cache key properties
    const cacheKeyProps = {
      email: makeUnique ? `${this.uniqueCounter++}-${email}` : email,
      password,
      roles: normalizedRoles,
      ...Object.keys(additionalData)
        .filter((key) => key !== 'roles') // Already normalized above
        .reduce((obj, key) => ({ ...obj, [key]: additionalData[key] }), {}),
    };

    // Try to get from cache first
    const cachedUser = this.cacheManager.getCached<any>('users', cacheKeyProps);
    if (cachedUser) {
      console.log(`Cache hit: Reusing cached user ${cachedUser.email} with ID ${cachedUser.id}`);
      this.context.track('users', {
        id: cachedUser.id,
        type: 'user',
        data: cachedUser,
      });
      return cachedUser;
    }

    const userEmail = cacheKeyProps.email;

    // Check for existing user in database (use the original email for query)
    try {
      const existingUsers = await userService.find({ query: { email: userEmail } });
      if (existingUsers && existingUsers.data && existingUsers.data.length > 0) {
        const existingUser = existingUsers.data[0];
        // Cache the existing user using the query email as key
        this.cacheManager.setCached('users', cacheKeyProps, existingUser);

        console.log(`Database hit: Reusing existing user ${existingUser.email} with ID ${existingUser.id}`);
        this.context.track('users', {
          id: existingUser.id,
          type: 'user',
          data: existingUser,
        });
        return existingUser;
      }
    } catch (error) {
      // If find fails, continue with creation
      console.warn(`Could not check for existing user ${userEmail}, will create new:`, error);
    }

    // Create new user if none exists
    const user = await userService.create({
      email: userEmail,
      password,
      roles: normalizedRoles,
      ...Object.keys(additionalData)
        .filter((key) => key !== 'roles')
        .reduce((obj, key) => ({ ...obj, [key]: additionalData[key] }), {}),
    });

    // In test environment, ensure the user has proper structure
    if (process.env.NODE_ENV === 'test' && user) {
      // Ensure user has an ID
      if (!user.id) {
        user.id = `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Ensure password is preserved (it might be lost in the spread operation)
      if (user.password === undefined && password) {
        user.password = password;
      }

      // Ensure roles are properly formatted
      if (user.roles && typeof user.roles === 'string') {
        // Convert string roles back to array if needed for consistency
        user.roles = user.roles.split(',').map((role: string) => role.trim());
      }
    }

    // Cache the newly created user
    this.cacheManager.setCached('users', cacheKeyProps, user);

    this.context.track('users', {
      id: user.id,
      type: 'user',
      data: user,
    });

    return user;
  }

  /**
   * Create multiple test users
   */
  async createTestUsers(
    userService: any,
    userConfigs: Array<{
      email: string;
      password?: string;
      additionalData?: any;
      makeUnique?: boolean;
    }>,
  ): Promise<any[]> {
    const users = [];
    for (const config of userConfigs) {
      const user = await this.createTestUser(
        userService,
        config.email,
        config.password,
        config.additionalData,
        config.makeUnique,
      );
      users.push(user);
    }
    return users;
  }

  /**
   * Invalidate user cache for specific properties
   */
  invalidateUserCache(properties?: Record<string, any>): void {
    this.cacheManager.invalidateCache('users', properties);
  }

  /**
   * Clear all user cache
   */
  clearUserCache(): void {
    this.cacheManager.invalidateCache('users');
  }
}
