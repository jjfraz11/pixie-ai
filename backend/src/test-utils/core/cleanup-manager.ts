import { TestContext } from './context';

/**
 * Object cleanup coordination and lifecycle management
 */
export class CleanupManager {
  constructor(private context: TestContext) {}

  /**
   * Clean up a specific object
   */
  async cleanupObject(type: string, id: string, service: any): Promise<void> {
    if (!service || !id) {
      console.warn(`Skipping cleanup of ${type} ${id}: service or id is missing`);
      return;
    }

    try {
      await service.remove(id);
    } catch (error) {
      // Don't throw error during cleanup - just log it
      console.error(`Error cleaning up ${type} ${id}:`, error);
    } finally {
      // Always untrack the object, even if cleanup failed
      this.context.untrack(type, id);
    }
  }

  /**
   * Clean up all tracked objects of a specific type
   */
  async cleanupTracked(type: string, service: any): Promise<void> {
    const objects = this.context.getTracked(type);

    // Clean up in reverse order to handle foreign key constraints
    for (const obj of objects.reverse()) {
      await this.cleanupObject(type, obj.id, service);
    }

    this.context.clearTracked(type);
  }

  /**
   * Clean up all tracked objects
   */
  async cleanupAll(services: { [key: string]: any }): Promise<void> {
    // Clean up in order to handle foreign key constraints
    const cleanupOrder = ['participants', 'sessions', 'users'];

    for (const type of cleanupOrder) {
      if (this.context.getTracked(type).length > 0 && services && services[type]) {
        try {
          await this.cleanupTracked(type, services[type]);
        } catch (error) {
          console.error(`Error during cleanup of ${type}:`, error);
        }
      }
    }
  }
}
