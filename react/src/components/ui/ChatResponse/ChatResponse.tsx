
import React, { useCallback, useMemo, useState } from 'react';
import { IconButton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

import ChatBubble from '../ChatBubble/ChatBubble';
import ChatTabs from '../ChatTabs/ChatTabs';
import ChatFooterActions, { type DownloadFormat } from '../ChatFooterActions/ChatFooterActions';
import chatbotLogo from '../../../assets/chatbot.svg';
import styles from './ChatResponse.module.scss';
import { formatBotMessage } from '../../../utility';
import ReactMarkdown from 'react-markdown';

interface TabItem {
  label: string;
  /** MUST match backend model key: e.g., "mistral-large2" */
  value: string;
}

type PerModelText = Record<string, string | undefined>;

interface ChatResponseProps {
  userText: string;
  /**
   * - While streaming or for legacy content, botText can be a single string.
   * - For model-wise display, pass an object keyed by model name:
   *   { "mistral-large2": "...", "llama3.1-70b": "...", "llama3.1-8b": "..." }
   */
  botText: string | PerModelText;
  tabs: TabItem[];
  onRefresh?: () => void;

  /** Optional: feedback callback (1 = like, 0 = dislike) */
  onFeedback?: (rating01: 1 | 0, payload: { question: string; response: string }) => void;

  /** Optional: download callback for current active tab response */
  onDownload?: (payload: {
    question: string;
    response: string;
    format: DownloadFormat;
    modelResponses?: Array<{ modelName: string; response: string }>;
  }) => void;

  // Optional: thinking text passed from parent (either string or per-model map)
  thinking?: string | Record<string, string>;
}

/* ------------------------------------------------------------------
   DeepSeek-only sanitizer: remove <think>...</think> blocks
   - Handles raw and HTML-escaped tags.
   - Removes complete blocks; if tags are dangling, removes just tags.
------------------------------------------------------------------- */
const stripDeepSeekThink = (text: string): string => {
  if (!text) return '';

  let out = String(text);

  // Remove full, properly closed blocks
  out = out.replace(/<\s*think\b[^>]*>[\s\S]*?<\s*\/\s*think\s*>/gi, '');
  out = out.replace(/&lt;\s*think\b[^&]*&gt;[\s\S]*?&lt;\s*\/\s*think\s*&gt;/gi, '');

  // Remove any strays
  out = out.replace(/<\s*think\b[^>]*>/gi, '');
  out = out.replace(/<\s*\/\s*think\s*>/gi, '');
  out = out.replace(/&lt;\s*think\b[^&]*&gt;/gi, '');
  out = out.replace(/&lt;\s*\/\s*think\s*&gt;/gi, '');

  // Gentle newline tidy
  return out.replace(/\r/g, '').replace(/\n{4,}/g, '\n\n\n').trim();
};

const ChatResponse: React.FC<ChatResponseProps> = ({
  userText,
  botText,
  tabs,
  onRefresh,
  onFeedback,
  onDownload,
  thinking,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const isPerModel = typeof botText !== 'string';
  const activeModelKey: string | undefined = tabs[activeTab]?.value;

  // Derive text for active tab safely
  const textForActiveTab: string = useMemo(() => {
    if (isPerModel) {
      if (!activeModelKey) {
        return '';
      }
      const perModel = botText as PerModelText;
      return perModel[activeModelKey] ?? '';
    }
    return botText as string;
  }, [isPerModel, botText, activeModelKey]);

  const thinkingForActiveTab: string | undefined = useMemo(() => {
    if (!thinking) return undefined;
    if (typeof thinking === 'string') return thinking;
    if (activeModelKey) return thinking[activeModelKey];
    return undefined;
  }, [thinking, activeModelKey]);

  // DeepSeek-only think removal (response text only, not the Thinking panel)
  const cleanedTextForActiveTab = useMemo(() => {
    if ((activeModelKey || '').toLowerCase() === 'deepseek-r1') {
      return stripDeepSeekThink(textForActiveTab);
    }
    return textForActiveTab;
  }, [textForActiveTab, activeModelKey]);

  // Normalize/format for Markdown rendering
  const formattedBotText = useMemo(
    () => formatBotMessage(cleanedTextForActiveTab),
    [cleanedTextForActiveTab]
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(cleanedTextForActiveTab || '');
    } catch {
      /* ignore copy errors */
    }
  }, [cleanedTextForActiveTab]);

  const handleLike = useCallback(() => {
    onFeedback?.(1, { question: userText, response: cleanedTextForActiveTab || '' });
  }, [onFeedback, userText, cleanedTextForActiveTab]);

  const handleDislike = useCallback(() => {
    onFeedback?.(0, { question: userText, response: cleanedTextForActiveTab || '' });
  }, [onFeedback, userText, cleanedTextForActiveTab]);

  const handleDownload = useCallback((format: DownloadFormat) => {
    if (!cleanedTextForActiveTab?.trim()) return;

    // Build modelResponses from all model texts when multi-model
    let modelResponses: Array<{ modelName: string; response: string }> | undefined;
    if (isPerModel && tabs.length > 1) {
      const perModel = botText as PerModelText;
      modelResponses = tabs
        .map((tab) => {
          let text = perModel[tab.value] ?? '';
          // Strip DeepSeek think blocks for each model
          if (tab.value.toLowerCase() === 'deepseek-r1') {
            text = stripDeepSeekThink(text);
          }
          return { modelName: tab.label, response: text };
        })
        .filter((m) => m.response.trim().length > 0);
    }

    onDownload?.({
      question: userText,
      response: cleanedTextForActiveTab,
      format,
      modelResponses,
    });
  }, [onDownload, userText, cleanedTextForActiveTab, isPerModel, botText, tabs]);

  const botHeader = useMemo(
    () => (
      <div className={styles.header}>
        <div className={styles.brand}>
          <img src={chatbotLogo} alt="RAISE" className={styles.logo} />
        </div>

        {isPerModel && tabs?.length > 0 && (
          <ChatTabs tabs={tabs} activeIndex={activeTab} onChange={setActiveTab} />
        )}

        {onRefresh && (
          <IconButton
            aria-label="Refresh response"
            size="small"
            onClick={onRefresh}
            className={styles.refreshBtn}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        )}
      </div>
    ),
    [isPerModel, tabs, activeTab, onRefresh]
  );

  const botFooter = useMemo(
    () => (
      <ChatFooterActions
        onCopy={handleCopy}
        onLike={handleLike}
        onDislike={handleDislike}
        onDownload={handleDownload}
        disableDownload={!cleanedTextForActiveTab?.trim()}
      />
    ),
    [handleCopy, handleLike, handleDislike, handleDownload, cleanedTextForActiveTab]
  );

  return (
    <div className={styles.container}>
      {/* User Bubble */}
      <ChatBubble variant="user">{userText}</ChatBubble>

      {/* Bot Bubble with header + footer */}
      <ChatBubble variant="bot" header={botHeader} footer={botFooter}>
        {/* Show Details toggle */}
        <div className={styles.showDetailsRow}>
          <button
            className={styles.showDetailsBtn}
            onClick={() => setShowDetails((s) => !s)}
            aria-expanded={showDetails}
          >
            {showDetails ? 'Hide Thinking Details' : 'Show Thinking Details'}
          </button>
        </div>

        {/* Details box - only shown in UI, NOT exported to PDF */}
        <div
          className={showDetails ? `${styles.detailsBox} ${styles.detailsBoxOpen}` : styles.detailsBox}
          role="region"
          aria-hidden={!showDetails}
        >
          <div className={styles.detailsContent}>
            <strong>Thinking</strong>
            <div className={styles.thinkingText}>{thinkingForActiveTab ?? 'Not available'}</div>
          </div>
        </div>

        {/* Markdown output */}
        <div className={styles.botContent}>
          <ReactMarkdown>{formattedBotText}</ReactMarkdown>
        </div>
      </ChatBubble>
    </div>
  );
};

export default React.memo(ChatResponse);
