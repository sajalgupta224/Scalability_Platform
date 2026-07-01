
import React from 'react';
import styles from './ChatDataTabs.module.scss';

export type DataTabType = 'results' | 'sql' | 'data-visualization' | 'plan';

interface ChatDataTabsProps {
  activeTab: DataTabType | null;
  onChange: (tab: DataTabType) => void;
}

const ChatDataTabs: React.FC<ChatDataTabsProps> = ({ activeTab, onChange }) => {
  const tabs: { label: string; value: DataTabType; disabled?: boolean }[] = [
    { label: 'Results', value: 'results' },
    { label: 'SQL', value: 'sql' },
    { label: 'Data visualization', value: 'data-visualization' },
    { label: 'Plan', value: 'plan' }, // ✅ make it visible
  ];

  return (
    <div className={styles.tabsWrapper}>
      <div className={styles.tabsContainer}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`${styles.tab} ${activeTab === tab.value ? styles.active : ''} ${
              tab.disabled ? styles.disabled : ''
            }`}
            onClick={() => !tab.disabled && onChange(tab.value)}
            disabled={tab.disabled}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChatDataTabs;
