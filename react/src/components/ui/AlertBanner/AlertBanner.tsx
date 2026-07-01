import React from 'react';
import styles from './AlertBanner.module.scss';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface AlertBannerProps {
  severity: 'warning' | 'error' | 'info' | 'success';
  message: string;
}

const AlertBanner: React.FC<AlertBannerProps> = ({
  severity,
  message,
}) => {
  const getIcon = () => {
    switch (severity) {
      case 'warning':
        return <ErrorOutlineIcon />;
      case 'error':
        return <ErrorIcon />;
      case 'info':
        return <InfoIcon />;
      case 'success':
        return <CheckCircleIcon />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <div className={`${styles.alertBanner} ${styles[severity]}`}>
      <span className={styles.icon}>{getIcon()}</span>
      <span className={styles.message}>{message}</span>
    </div>
  );
};

export default AlertBanner;