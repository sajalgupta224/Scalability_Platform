
import React, { useCallback } from 'react';
import type { ChatItem } from '../../../types/pages.types';
import ChatResponse from '../../../components/ui/ChatResponse/ChatResponse';
import { type DownloadFormat } from '../../../components/ui/ChatFooterActions/ChatFooterActions';
import styles from '../Experimentation.module.scss';

interface TabItem {
  label: string; // UI name e.g. "Claude Sonnet 4"
  value: string; // model id e.g. "claude-4-sonnet"
}

interface ChatHistoryDisplayProps {
  chatHistory: ChatItem[];
  models: TabItem[];
  onFeedback: (rating: 1 | 0, payload: { question: string; response: string }) => void;
  onDownload?: (payload: {
    question: string;
    response: string;
    format: DownloadFormat;
    modelResponses?: Array<{ modelName: string; response: string }>;
  }) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

const EMPTY = '';

const ChatHistoryDisplay: React.FC<ChatHistoryDisplayProps> = ({
  chatHistory,
  models,
  onFeedback,
  onDownload,
  scrollRef,
}) => {
  /**
   * If backend/history gives a plain string, we show the same response in all tabs.
   * If string is empty/undefined, use EMPTY (blank).
   */
  const fillAllTabsWithText = useCallback(
    (text: string): Record<string, string> => {
      const t = text ?? EMPTY;
      return models.reduce((acc: Record<string, string>, m: TabItem) => {
        acc[m.value] = t;
        return acc;
      }, {});
    },
    [models]
  );

  /**
   * If backend/history gives an object map { modelId: text }, normalize it to ensure:
   * - every selected model has a key
   * - missing keys fallback to EMPTY (blank)
   */
  const normalizeModelMap = useCallback(
    (modelMap: Record<string, string> | null | undefined): Record<string, string> => {
      const safe = modelMap ?? {};
      return models.reduce((acc: Record<string, string>, m: TabItem) => {
        acc[m.value] = safe[m.value] ?? EMPTY;
        return acc;
      }, {});
    },
    [models]
  );

  const noop = useCallback(() => {}, []);

  return (
    <div className={styles.chatScroll} ref={scrollRef}>
      {chatHistory.map((chat, idx) => {
        const botText =
          typeof chat.bot === 'string'
            ? fillAllTabsWithText(chat.bot)
            : normalizeModelMap(chat.bot as Record<string, string>);

        const thinkingText =
          typeof chat.thinking === 'string'
            ? fillAllTabsWithText(chat.thinking)
            : normalizeModelMap(chat.thinking as Record<string, string>);

        return (
          <ChatResponse
            key={idx}
            userText={chat.user}
            botText={botText}
            tabs={models}
            onRefresh={noop}
            onFeedback={onFeedback}
            onDownload={onDownload}
            thinking={thinkingText}
          />
        );
      })}
    </div>
  );
};

export default React.memo(ChatHistoryDisplay);
