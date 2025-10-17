import { TestContext } from '../core/context';
import { CleanupManager } from '../core/cleanup-manager';
import { disconnectPrisma } from '../../prisma';

/**
 * Setup function for security tests that require rate limiting
 */
export async function setupSecurityTestEnvironment(): Promise<{
  context: TestContext;
}> {
  // Enable rate limiting for security tests
  process.env.ENABLE_RATE_LIMITING = 'true';
  process.env.NODE_ENV = 'test';

  const context = new TestContext();
  return { context };
}

/**
 * Setup function for tests - tracks objects (server management handled separately)
 */
export async function setupTestEnvironment(): Promise<{
  context: TestContext;
}> {
  const context = new TestContext();
  return { context };
}

/**
 * Teardown function for tests - stops server and cleans up
 */
export async function teardownTestEnvironment(services: { [key: string]: any }): Promise<void> {
  // Note: We'll need to integrate with server-manager for complete teardown
  // For now, this provides the basic structure
  const context = new TestContext();
  const cleanupManager = new CleanupManager(context);

  await cleanupManager.cleanupAll(services);
  await disconnectPrisma();
  context.clearAllTracked();
}

/**
 * Enhanced teardown that works with an existing context
 */
export async function teardownTestEnvironmentWithContext(
  context: TestContext,
  services: { [key: string]: any },
): Promise<void> {
  const cleanupManager = new CleanupManager(context);

  await cleanupManager.cleanupAll(services);
  await disconnectPrisma();
  context.clearAllTracked();
}

/**
 * Enhanced setup with cleanup manager integration
 */
export async function setupTestEnvironmentWithCleanup(): Promise<{
  context: TestContext;
  cleanupManager: CleanupManager;
}> {
  const context = new TestContext();
  const cleanupManager = new CleanupManager(context);

  return { context, cleanupManager };
}

/**
 * Enhanced teardown with cleanup manager integration
 */
export async function teardownTestEnvironmentWithCleanup(
  context: TestContext,
  cleanupManager: CleanupManager,
  services: { [key: string]: any },
): Promise<void> {
  // Parameter validation
  if (!context) {
    throw new Error('TestContext is required for teardown');
  }
  if (!cleanupManager) {
    throw new Error('CleanupManager is required for teardown');
  }
  if (!services || typeof services !== 'object') {
    throw new Error('Services object is required for teardown');
  }

  let cleanupSucceeded = false;

  // Cleanup operations with timeout wrapper
  const withTimeout = async (operation: Promise<any>, timeoutMs: number, operationName: string) => {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const result = await operation;
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  };

  try {
    // Cleanup all services with 5 second timeout
    await withTimeout(cleanupManager.cleanupAll(services), 5000, 'Cleanup operation');
    cleanupSucceeded = true;
  } catch (error) {
    // Log cleanup error but don't throw yet
    console.error('Error during cleanup manager cleanup:', error);
    cleanupSucceeded = false;
  }

  try {
    // Disconnect Prisma with 3 second timeout - use global version if mocked
    const disconnectPromise = (global as any).disconnectPrisma
      ? (global as any).disconnectPrisma()
      : disconnectPrisma();

    await withTimeout(disconnectPromise, 3000, 'Prisma disconnect');
  } catch (error) {
    // Log Prisma disconnect error
    console.error('Error during Prisma disconnect:', error);
    // Don't throw here - context clearing is still important
  }

  // Only clear context if cleanup succeeded
  if (cleanupSucceeded) {
    try {
      context.clearAllTracked();
    } catch (error) {
      console.error('Error clearing context after successful cleanup:', error);
      // Don't throw - the main cleanup is done
    }
  } else {
    console.warn('Context not cleared due to cleanup failure');
  }
}
