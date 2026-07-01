import React from 'react';
import { Snackbar, IconButton } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import styles from './NotificationBanner.module.scss';

interface NotificationBannerProps {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  onCancel?: () => void;
  onClose: () => void;
  visible: boolean;
}

const NotificationBanner: React.FC<NotificationBannerProps> = ({
  type,
  message,
  onCancel,
  onClose,
  visible,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className={styles.iconSvg} />;
      case 'warning':
        return <WarningIcon className={styles.iconSvg} />;
      case 'error':
        return <ErrorIcon className={styles.iconSvg} />;
      case 'info':
        return <InfoIcon className={styles.iconSvg} />;
      default:
        return <InfoIcon className={styles.iconSvg} />;
    }
  };

  return (
    <Snackbar
      open={visible}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      className={styles.snackbar}
    >
      <div className={`${styles.notificationBanner} ${styles[type]}`}>
        <div className={styles.content}>
          <div className={styles.icon}>{getIcon()}</div>
          <div className={styles.message}>{message}</div>
        </div>
        <div className={styles.actions}>
          {onCancel && (
            <button className={styles.cancelButton} onClick={onCancel}>
              Cancel
            </button>
          )}
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close notification"
            className={styles.closeButton}
          >
            <CloseIcon className={styles.closeIcon} />
          </IconButton>
        </div>
      </div>
    </Snackbar>
  );
};

export default NotificationBanner;