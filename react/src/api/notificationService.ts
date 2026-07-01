import type { NotificationConfig } from '../types/notification.types';

/**
 * Singleton service to bridge axios interceptors with React notification context
 */
class NotificationService {
  private showNotificationFn: ((config: NotificationConfig) => void) | null = null;

  /**
   * Initialize the service with the notification function from context
   * Called once after app initialization
   */
  initialize(showNotification: (config: NotificationConfig) => void) {
    this.showNotificationFn = showNotification;
  }

  /**
   * Show a notification
   */
  showNotification(config: NotificationConfig) {
    if (this.showNotificationFn) {
      this.showNotificationFn(config);
    } else {
      // Fallback to console if service not initialized (shouldn't happen in production)
      console.error('NotificationService not initialized. Notification:', config);
    }
  }

  /**
   * Show an error notification with standard formatting
   */
  showError(message: string, autoHideDuration: number = 5000) {
    this.showNotification({
      type: 'error',
      message,
      autoHideDuration,
    });
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.showNotificationFn !== null;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
