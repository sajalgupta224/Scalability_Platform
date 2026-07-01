
import React, { useCallback } from 'react';
import type { ChatItem } from '../../../types/pages.types';
import ChatDataResponse from '../../../components/ui/ChatDataResponse/ChatDataResponse';
import styles from '../Experimentation.module.scss';

interface StructuredDataItem {
  sql: string;
  rows: Array<Record<string, unknown>>;
  chartSpec?: Record<string, unknown>;
  agent?: string;
  queryId?: string;

  // ✅ This already exists in your data structure and comes from parseAnswerText()
  planningSteps?: string;
}

interface ChatDataHistoryDisplayProps {
  chatHistory: ChatItem[];
  structuredData?: Map<number, StructuredDataItem>;
  onFeedback: (rating: 1 | 0, payload: { question: string; response: string }) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

const ChatDataHistoryDisplay: React.FC<ChatDataHistoryDisplayProps> = ({
  chatHistory,
  structuredData,
  onFeedback,
  scrollRef,
}) => {
  // Extract bot text from the first model if botText is an object
  const getBotText = useCallback((bot: string | Record<string, string>): string => {
    if (typeof bot === 'string') return bot;
    const firstKey = Object.keys(bot)[0];
    return firstKey ? bot[firstKey] || 'No response' : 'No response';
  }, []);

  // Scroll to bottom when a tab is selected
  const handleTabChange = useCallback(() => {
    if (scrollRef?.current) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [scrollRef]);

  // Extract chart configuration from chartSpec (memoized)
  const getChartConfig = useCallback((chartSpec?: Record<string, unknown>) => {
    if (!chartSpec) return undefined;

    // Extract all necessary chart properties from chartSpec
    const encoding = chartSpec.encoding as Record<string, any> | undefined;
    const data = (chartSpec.data as Record<string, any>)?.values as
      | Array<Record<string, unknown>>
      | undefined;
    const mark = chartSpec.mark as Record<string, any> | string | undefined;
    const description = (chartSpec.description as string) || undefined;
    const width = chartSpec.width as number | undefined;
    const height = chartSpec.height as number | undefined;

    if (encoding && data) {
      const xKey = encoding.x?.field;
      const yKey = encoding.y?.field;
      const xType = encoding.x?.type;
      const yType = encoding.y?.type;
      const xTitle = encoding.x?.title || xKey;
      const yTitle = encoding.y?.title || yKey;

      // Extract tooltip fields
      const tooltipFields = Array.isArray(encoding.tooltip)
        ? encoding.tooltip.map((t: any) => ({
            field: t.field,
            title: t.title || t.field,
            type: t.type,
          }))
        : [];

      // Determine chart type from mark
      let chartType = 'bar';
      if (typeof mark === 'string') {
        chartType = mark;
      } else if (mark && typeof mark === 'object' && mark.type) {
        chartType = mark.type;
      }

      return {
        data,
        xKey,
        yKey,
        xType,
        yType,
        xTitle,
        yTitle,
        tooltipFields,
        chartType,
        title: description,
        width,
        height,
      };
    }

    return undefined;
  }, []);

  const noop = useCallback(() => {}, []);

  return (
    <div className={styles.chatScroll} ref={scrollRef}>
      {chatHistory.map((chat, idx) => {
        const data = structuredData?.get(idx);

        return (
          <ChatDataResponse
            key={idx}
            userText={chat.user}
            botText={getBotText(chat.bot)}
            resultsData={data?.rows}
            sqlQuery={data?.sql}
            queryId={data?.queryId}
            chartConfig={getChartConfig(data?.chartSpec)}

            // ✅ NEW: Pass planning steps into ChatDataResponse for Plan tab
            planText={data?.planningSteps}

            onRefresh={noop}
            onFeedback={onFeedback}
            onTabChange={handleTabChange}
          />
        );
      })}
    </div>
  );
};

export default React.memo(ChatDataHistoryDisplay);
