import React from "react";
import styles from "./ChatTabs.module.scss";

interface ChatTabsProps {
  tabs: { label: string, value: string }[];
  activeIndex: number;
  onChange: (index: number) => void;
}

const ChatTabs: React.FC<ChatTabsProps> = ({ tabs, activeIndex, onChange }) => {
  return (
    <div className={styles.tabsWrapper}>
      <div className={styles.tabsContainer}>
        {tabs.map((tab, index) => {
          const { label } = tab;
          return <button
          key={index}
          className={`${styles.tab} ${activeIndex === index ? styles.active : ""}`}
          onClick={() => onChange(index)}
        >
          {label}
        </button>;
        })}
      </div>
    </div>
  );
};

export default ChatTabs;