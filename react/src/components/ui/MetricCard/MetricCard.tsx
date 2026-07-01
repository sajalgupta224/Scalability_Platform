import React from 'react';
import styles from './MetricCard.module.scss';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

interface MetricCardProps {
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor?: string;
  value: string | number;
  label: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    isPositive: boolean;
    label: string;
  };
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  iconBgColor,
  iconColor,
  value,
  label,
  trend,
}) => {
  const getTrendClass = () => {
    if (!trend) return '';
    if (trend.direction === 'up' && trend.isPositive) return styles.positive;
    if (trend.direction === 'down' && !trend.isPositive) return styles.positive;
    return styles.negative;
  };

  return (
    <div className={styles.metricCard}>
      <div 
        className={styles.iconWrapper} 
        style={{ 
          backgroundColor: iconBgColor,
          color: iconColor 
        }}
      >
        {icon}
      </div>
      <div className={styles.content}>
        <div className={styles.value}>{value}</div>
        <div className={styles.label}>{label}</div>
        {trend && (
          <div className={`${styles.trend} ${getTrendClass()}`}>
            {trend.direction === 'up' ? (
              <ArrowUpwardIcon className={styles.trendIcon} fontSize="small" />
            ) : (
              <ArrowDownwardIcon className={styles.trendIcon} fontSize="small" />
            )}
            <span className={styles.trendValue}>{trend.value}%</span>
            <span className={styles.trendLabel}>{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;