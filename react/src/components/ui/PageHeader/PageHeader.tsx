import React from 'react';
import styles from './PageHeader.module.scss';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon }) => {
  return (
    <div className={styles.pageHeader}>
      <h1 className={styles.title}>{title}</h1>
      {(subtitle || icon) && (
        <div className={styles.titleWrapper}>
          {icon && <span className={styles.icon}>{icon}</span>}
          {subtitle && <span className={styles.category}>{subtitle}</span>}
        </div>
      )}
    </div>
  );
};

export default PageHeader;