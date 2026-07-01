export type NotificationType = 'success' | 'warning' | 'error' | 'info';

export interface NotificationConfig {
  id?: string;
  type: NotificationType;
  message: string;
  onCancel?: () => void;
  autoHideDuration?: number | null;
}

export interface Notification extends NotificationConfig {
  id: string;
}

export interface NotificationContextValue {
  showNotification: (config: NotificationConfig) => void;
  hideNotification: (id: string) => void;
  clearAll: () => void;
}
