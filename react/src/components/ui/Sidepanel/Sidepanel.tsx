import React from 'react';
import { IconButton } from '@mui/material';
import styles from './Sidepanel.module.scss';
import toggleButton from '../../../assets/toggle-button.svg';

interface SidePanelProps {
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
}

const SidePanel: React.FC<SidePanelProps> = ({
  title,
  children,
  isExpanded,
  onToggle,
  className = '',
}) => {
  return (
    <>
      {/* Collapsed toggle button - shows when panel is hidden */}
      {!isExpanded && (
        <div className={styles.collapsedToggle}>
          <IconButton
            onClick={onToggle}
            className={styles.collapsedButton}
            aria-label={`Show ${title}`}
            size="medium"
          >
            <div className={styles.toggleIcon}>
              <img src={toggleButton} alt="Toggle button" className={styles.botImage} />
            </div>
          </IconButton>
        </div>
      )}

      {/* Expanded panel */}
      <div
        className={`${styles.panel} ${isExpanded ? styles.expanded : styles.collapsed} ${className}`}
      >
        <div className={styles.header}>
          <div className={styles.toggleButtonExpanded}>
            <IconButton
              onClick={onToggle}
              className={styles.expandedButton}
              aria-label={`Hide ${title}`}
              size="medium"
            >
              <div className={styles.toggleIcon}>
                <img src={toggleButton} alt="Toggle button" className={styles.botImage} />
              </div>
            </IconButton>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <div className={styles.innerContent}>{children}</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SidePanel;
