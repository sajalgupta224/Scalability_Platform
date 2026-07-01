import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Notification, NotificationConfig, NotificationContextValue } from '../types/notification.types';
import { notificationService } from '../api/notificationService';

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((config: NotificationConfig) => {
    const id = config.id || `notification-${Date.now()}-${Math.random()}`;
    const notification: Notification = {
      ...config,
      id,
      autoHideDuration: config.autoHideDuration ?? 5000,
    };

    setNotifications((prev) => [...prev, notification]);

    // Auto-hide if duration is set
    if (notification.autoHideDuration) {
      setTimeout(() => {
        hideNotification(id);
      }, notification.autoHideDuration);
    }
  }, []);

  const hideNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Initialize notification service for API error handling
  useEffect(() => {
    notificationService.initialize(showNotification);
  }, [showNotification]);

  return (
    <NotificationContext.Provider value={{ showNotification, hideNotification, clearAll }}>
      {children}
      {/* Render notifications */}
      {notifications.map((notification) => (
        <NotificationRenderer
          key={notification.id}
          notification={notification}
          onClose={() => hideNotification(notification.id)}
        />
      ))}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
};

// NotificationRenderer component to render individual notifications
import NotificationBanner from '../components/ui/NotificationBanner/NotificationBanner';

interface NotificationRendererProps {
  notification: Notification;
  onClose: () => void;
}

const NotificationRenderer: React.FC<NotificationRendererProps> = ({ notification, onClose }) => {
  return (
    <NotificationBanner
      type={notification.type}
      message={notification.message}
      onCancel={notification.onCancel}
      onClose={onClose}
      visible={true}
    />
  );
};
