import React from "react";
import styles from "./ChatBubble.module.scss";

interface ChatBubbleProps {
  variant: "user" | "bot";
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ variant, children, header, footer }) => {
  if (variant === "user") {
    return (
      <div className={styles.userBubbleWrapper}>
        <div className={styles.userBubble}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.botBubbleWrapper}>
      {header && <div className={styles.botHeader}>{header}</div>}
      <div className={styles.botBubble}>
        {children}
      </div>
      {footer && <div className={styles.botFooter}>{footer}</div>}
    </div>
  );
};

export default ChatBubble;