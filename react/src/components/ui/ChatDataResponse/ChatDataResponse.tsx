
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { IconButton, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReactMarkdown from 'react-markdown';

import ChatBubble from '../ChatBubble/ChatBubble';
import ChatDataTabs, { type DataTabType } from '../ChatDataTabs/ChatDataTabs';
import ResultsTab from '../ResultsTab/ResultsTab';
import DataVisualizationTab from '../DataVisualizationTab/DataVisualizationTab';
import ChatFooterActions, { type DownloadFormat } from '../ChatFooterActions/ChatFooterActions';
import AIlogo from '../../../assets/AI_Scalability_Platform.svg';
import { downloadResponsePdf } from '../../../utils/downloadResponsePdf';
import { downloadResponseDocx } from '../../../utils/downloadResponseDocx';
import { downloadResponseTxt } from '../../../utils/downloadResponseTxt';
import { useAppContext } from '../../../context/AppContext';
import styles from './ChatDataResponse.module.scss';
import SQLTab from '../SQLTab/SQLTab';

// ✅ NEW
import PlanTab from '../PlanTab/PlanTab';

// ✅ (Optional) if you already created constants/chatUi.ts, use it.
// import { GENERATING_TEXT, isGeneratingText } from '../../../constants/chatUi';

interface ChatDataResponseProps {
  userText: string;
  botText: string;
  resultsData?: Array<Record<string, unknown>>;
  sqlQuery?: string;
  queryId?: string;
  chartConfig?: {
    xKey?: string;
    yKey?: string;
    title?: string;
  };

  // ✅ NEW
  planText?: string;

  onRefresh?: () => void;
  onFeedback?: (rating: 1 | 0, payload: { question: string; response: string }) => void;
  onTabChange?: () => void;
}

// ✅ If you are not importing from constants, keep this here:
const GENERATING_TEXT = 'Generating response...';
const isLoadingText = (t?: string) => {
  const s = (t ?? '').trim();
  return s === GENERATING_TEXT || s === 'Please wait...';
};

const ChatDataResponse: React.FC<ChatDataResponseProps> = ({
  userText,
  botText,
  resultsData,
  chartConfig,
  sqlQuery,
  queryId,
  planText, // ✅ NEW
  onRefresh,
  onFeedback,
  onTabChange,
}) => {
  const [activeTab, setActiveTab] = useState<DataTabType | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAppContext();

  // ✅ Spinner condition
  const isGenerating = useMemo(() => isLoadingText(botText), [botText]);

  useEffect(() => {
    if (activeTab !== null) {
      onTabChange?.();
    }
  }, [activeTab, onTabChange]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(botText || '');
    } catch {
      /* ignore */
    }
  }, [botText]);

  const handleLike = useCallback(() => {
    onFeedback?.(1, { question: userText, response: botText || '' });
  }, [onFeedback, userText, botText]);

  const handleDislike = useCallback(() => {
    onFeedback?.(0, { question: userText, response: botText || '' });
  }, [onFeedback, userText, botText]);

  const handleDownload = useCallback(async (format: DownloadFormat) => {
    const commonPayload = {
      question: userText,
      response: botText || '',
      generatedAt: new Date().toLocaleString(),
      userName: currentUser?.USERNAME || '',
      resultsData: resultsData as Array<Record<string, any>>,
      sqlQuery,
      planText,
    };

    switch (format) {
      case 'pdf':
        await downloadResponsePdf({
          ...commonPayload,
          chartElement: chartRef.current,
        });
        break;
      case 'docx':
      case 'doc':
        await downloadResponseDocx({
          ...commonPayload,
          fileExtension: format,
        });
        break;
      case 'txt':
        downloadResponseTxt(commonPayload);
        break;
    }
  }, [userText, botText, resultsData, sqlQuery, planText, currentUser]);

  const botHeader = useMemo(
    () => (
      <div className={styles.header}>
        <div className={styles.brand}>
          <img src={AIlogo} alt="AI Scalability Platform" className={styles.logo} />
        </div>

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
    [onRefresh]
  );

  // ✅ Include planText, so tabs show even if only plan exists
  const hasData = Boolean(resultsData || sqlQuery || chartConfig || planText);

  const botFooter = useMemo(
    () => (
      <div className={styles.footerWrapper}>
        {hasData && (
          <>
            <ChatDataTabs activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === 'results' && (
              <ResultsTab data={resultsData as Array<Record<string, any>>} title={chartConfig?.title} />
            )}

            {activeTab === 'sql' && <SQLTab query={sqlQuery} queryId={queryId} />}

            {/* Always render chart so chartRef is available for PDF capture via html2canvas */}
            <div
              style={
                activeTab === 'data-visualization'
                  ? undefined
                  : { position: 'absolute', left: '-9999px', top: 0, width: '600px', height: 'auto', overflow: 'hidden', pointerEvents: 'none' }
              }
            >
              <DataVisualizationTab ref={chartRef} chartConfig={chartConfig} />
            </div>

            {/* ✅ NEW: Plan Tab Rendering */}
            {activeTab === 'plan' && <PlanTab planText={planText} planId={queryId} />}
          </>
        )}

        <ChatFooterActions onCopy={handleCopy} onDownload={handleDownload} onLike={handleLike} onDislike={handleDislike} />
      </div>
    ),
    [
      hasData,
      activeTab,
      resultsData,
      chartConfig,
      sqlQuery,
      queryId,
      planText,
      handleCopy,
      handleDownload,
      handleLike,
      handleDislike,
    ]
  );

  // ✅ Only split note text when NOT loading
  const { mainText, noteText } = useMemo(() => {
    if (isGenerating) {
      return { mainText: botText, noteText: null as string | null };
    }

    const noteRegex = /Note that .+/i;
    const match = botText.match(noteRegex);

    if (match?.index !== undefined) {
      const mainText = botText.substring(0, match.index).trim();
      const noteText = match[0];
      return { mainText, noteText };
    }

    return { mainText: botText, noteText: null as string | null };
  }, [botText, isGenerating]);

  return (
    <div className={styles.container}>
      <ChatBubble variant="user">{userText}</ChatBubble>

      <ChatBubble variant="bot" header={botHeader} footer={botFooter}>
        <div className={styles.botText}>
          {isGenerating ? (
            // ✅ Spinner + text
            <div className={styles.loadingRow}>
              <CircularProgress size={16} thickness={5} />
              <span className={styles.loadingText}>{GENERATING_TEXT}</span>
            </div>
          ) : (
            <>
              <ReactMarkdown>{mainText}</ReactMarkdown>
              {noteText && (
                <div className={styles.noteSection}>
                  <ReactMarkdown>{noteText}</ReactMarkdown>
                </div>
              )}
            </>
          )}
        </div>
      </ChatBubble>
    </div>
  );
};

export default React.memo(ChatDataResponse);
``
