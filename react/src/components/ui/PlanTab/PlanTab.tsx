
import React from 'react';
import styles from './PlanTab.module.scss';

interface PlanTabProps {
  planText?: string;
  planId?: string;
}

const PlanTab: React.FC<PlanTabProps> = ({ planText, planId }) => {
  if (!planText || planText.trim().length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.noData}>No plan to display</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {planId && <div className={styles.planId}>Query ID: {planId}</div>}

      <div className={styles.codeWrapper}>
        <pre className={styles.codeBlock}>
          <code>{planText}</code>
        </pre>
      </div>
    </div>
  );
};

export default PlanTab;
