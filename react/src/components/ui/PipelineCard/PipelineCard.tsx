import React from 'react';
import styles from './PipelineCard.module.scss';

export interface PipelineCardProps {
  children: React.ReactNode;
}

const PipelineCard: React.FC<PipelineCardProps> = ({ children }) => {
  return <div className={styles.card}>{children}</div>;
};

export default PipelineCard;
