import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  IconButton,
  Box,
  Typography,
  Button,
  Slide,
  Fade,
  Grow,
  Collapse
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Notifications as NotificationIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [activeNotification, setActiveNotification] = useState(null);
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [settings, setSettings] = useState({
    position: 'top-right',
    autoHideDuration: 6000,
    maxNotifications: 5,
    enableSound: true,
    enablePersistence: true,
    enableActions: true,
    enableGrouping: true,
    enableRealtime: true
  });

  // Notification types configuration
  const notificationTypes = {
    success: {
      icon: SuccessIcon,
      color: '#4caf50',
      defaultDuration: 4000
    },
    error: {
      icon: ErrorIcon,
      color: '#f44336',
      defaultDuration: 8000
    },
    warning: {
      icon: WarningIcon,
      color: '#ff9800',
      defaultDuration: 6000
    },
    info: {
      icon: InfoIcon,
      color: '#2196f3',
      defaultDuration: 5000
    }
  };

  // Show notification function
  const showNotification = useCallback((message, type = 'info', options = {}) => {
    const notification = {
      id: `notification-${Date.now()}-${Math.random()}`,
      message,
      type,
      timestamp: new Date(),
      duration: options.duration || notificationTypes[type]?.defaultDuration || settings.autoHideDuration,
      persistent: options.persistent || false,
      actions: options.actions || [],
      data: options.data || {},
      priority: options.priority || 'normal', // low, normal, high, urgent
      category: options.category || 'general',
      source: options.source || 'system',
      read: false,
      dismissed: false
    };

    // Add to notifications list
    setNotifications(prev => {
      const newNotifications = [notification, ...prev];
      
      // Limit notifications if not persistent
      if (!settings.enablePersistence) {
        return newNotifications.slice(0, settings.maxNotifications);
      }
      
      return newNotifications;
    });

    // Add to queue for display
    setNotificationQueue(prev => [...prev, notification]);

    // Play sound if enabled
    if (settings.enableSound && type !== 'info') {
      playNotificationSound(type);
    }

    // Store in localStorage for persistence
    if (settings.enablePersistence) {
      const stored = JSON.parse(localStorage.getItem('notifications') || '[]');
      stored.unshift(notification);
      localStorage.setItem('notifications', JSON.stringify(stored.slice(0, 100))); // Keep last 100
    }

    return notification.id;
  }, [settings]);

  // Hide notification
  const hideNotification = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, dismissed: true }
          : notification
      )
    );

    setNotificationQueue(prev => 
      prev.filter(notification => notification.id !== notificationId)
    );

    if (activeNotification?.id === notificationId) {
      setActiveNotification(null);
    }
  }, [activeNotification]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setNotificationQueue([]);
    setActiveNotification(null);
    
    if (settings.enablePersistence) {
      localStorage.removeItem('notifications');
    }
  }, [settings.enablePersistence]);

  // Clear notifications by type
  const clearByType = useCallback((type) => {
    setNotifications(prev => prev.filter(n => n.type !== type));
    setNotificationQueue(prev => prev.filter(n => n.type !== type));
    
    if (activeNotification?.type === type) {
      setActiveNotification(null);
    }
  }, [activeNotification]);

  // Clear notifications by category
  const clearByCategory = useCallback((category) => {
    setNotifications(prev => prev.filter(n => n.category !== category));
    setNotificationQueue(prev => prev.filter(n => n.category !== category));
    
    if (activeNotification?.category === category) {
      setActiveNotification(null);
    }
  }, [activeNotification]);

  // Play notification sound
  const playNotificationSound = useCallback((type) => {
    if (!settings.enableSound) return;

    try {
      const audio = new Audio();
      
      switch (type) {
        case 'success':
          audio.src = '/sounds/success.mp3';
          break;
        case 'error':
          audio.src = '/sounds/error.mp3';
          break;
        case 'warning':
          audio.src = '/sounds/warning.mp3';
          break;
        default:
          audio.src = '/sounds/notification.mp3';
      }
      
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore audio play errors (user interaction required)
      });
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  }, [settings.enableSound]);

  // Process notification queue
  useEffect(() => {
    if (notificationQueue.length > 0 && !activeNotification) {
      const nextNotification = notificationQueue[0];
      setActiveNotification(nextNotification);
      setNotificationQueue(prev => prev.slice(1));

      // Auto-hide if not persistent
      if (!nextNotification.persistent && nextNotification.duration > 0) {
        setTimeout(() => {
          hideNotification(nextNotification.id);
        }, nextNotification.duration);
      }
    }
  }, [notificationQueue, activeNotification, hideNotification]);

  // Real-time notifications via socket
  useEffect(() => {
    if (!socket || !isConnected || !settings.enableRealtime) return;

    socket.on('notification', (notificationData) => {
      showNotification(
        notificationData.message,
        notificationData.type || 'info',
        {
          ...notificationData.options,
          source: 'realtime',
          data: notificationData.data
        }
      );
    });

    socket.on('system-notification', (notificationData) => {
      showNotification(
        notificationData.message,
        'warning',
        {
          persistent: true,
          category: 'system',
          source: 'system',
          priority: 'high',
          ...notificationData.options
        }
      );
    });

    socket.on('urgent-notification', (notificationData) => {
      showNotification(
        notificationData.message,
        'error',
        {
          persistent: true,
          category: 'urgent',
          source: 'system',
          priority: 'urgent',
          duration: 0, // Don't auto-hide
          ...notificationData.options
        }
      );
    });

    return () => {
      socket.off('notification');
      socket.off('system-notification');
      socket.off('urgent-notification');
    };
  }, [socket, isConnected, settings.enableRealtime, showNotification]);

  // Load persisted notifications
  useEffect(() => {
    if (settings.enablePersistence) {
      const stored = JSON.parse(localStorage.getItem('notifications') || '[]');
      if (stored.length > 0) {
        setNotifications(stored.map(n => ({
          ...n,
          timestamp: new Date(n.timestamp)
        })));
      }
    }
  }, [settings.enablePersistence]);

  // Update settings
  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    localStorage.setItem('notificationSettings', JSON.stringify({ ...settings, ...newSettings }));
  }, [settings]);

  // Load settings
  useEffect(() => {
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      try {
        setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
      } catch (error) {
        console.warn('Failed to load notification settings:', error);
      }
    }
  }, []);

  // Get unread count
  const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;

  // Get notifications by category
  const getNotificationsByCategory = useCallback((category) => {
    return notifications.filter(n => n.category === category && !n.dismissed);
  }, [notifications]);

  // Get notifications by type
  const getNotificationsByType = useCallback((type) => {
    return notifications.filter(n => n.type === type && !n.dismissed);
  }, [notifications]);

  // Custom notification component
  const NotificationComponent = ({ notification, onClose, onAction }) => {
    const TypeIcon = notificationTypes[notification.type]?.icon || InfoIcon;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <Alert
          severity={notification.type}
          onClose={() => onClose(notification.id)}
          sx={{
            minWidth: 300,
            maxWidth: 500,
            boxShadow: 3,
            borderRadius: 2,
            '& .MuiAlert-icon': {
              fontSize: '1.5rem'
            }
          }}
          icon={<TypeIcon />}
          action={
            <Box display="flex" gap={0.5}>
              {notification.actions?.map((action, index) => (
                <Button
                  key={index}
                  size="small"
                  onClick={() => onAction(notification.id, action)}
                  variant={action.variant || 'text'}
                  color={action.color || 'inherit'}
                >
                  {action.label}
                </Button>
              ))}
              <IconButton
                size="small"
                onClick={() => onClose(notification.id)}
                color="inherit"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          }
        >
          <AlertTitle>
            {notification.title || notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
          </AlertTitle>
          <Typography variant="body2">
            {notification.message}
          </Typography>
          {notification.timestamp && (
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              {notification.timestamp.toLocaleTimeString()}
            </Typography>
          )}
        </Alert>
      </motion.div>
    );
  };

  // Handle notification action
  const handleNotificationAction = useCallback((notificationId, action) => {
    if (action.handler) {
      action.handler(notificationId);
    }
    
    if (action.dismiss !== false) {
      hideNotification(notificationId);
    }
  }, [hideNotification]);

  const value = {
    // Core functions
    showNotification,
    hideNotification,
    clearAll,
    clearByType,
    clearByCategory,
    markAsRead,

    // Data
    notifications: notifications.filter(n => !n.dismissed),
    unreadCount,
    activeNotification,

    // Getters
    getNotificationsByCategory,
    getNotificationsByType,

    // Settings
    settings,
    updateSettings,

    // Utilities
    notificationTypes
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Active Notification Display */}
      <Box
        sx={{
          position: 'fixed',
          top: settings.position.includes('top') ? 24 : 'auto',
          bottom: settings.position.includes('bottom') ? 24 : 'auto',
          left: settings.position.includes('left') ? 24 : 'auto',
          right: settings.position.includes('right') ? 24 : 'auto',
          zIndex: 9999,
          pointerEvents: 'none'
        }}
      >
        <AnimatePresence>
          {activeNotification && (
            <Box sx={{ pointerEvents: 'auto' }}>
              <NotificationComponent
                notification={activeNotification}
                onClose={hideNotification}
                onAction={handleNotificationAction}
              />
            </Box>
          )}
        </AnimatePresence>
      </Box>
    </NotificationContext.Provider>
  );
};