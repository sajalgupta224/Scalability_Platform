import { useState, useRef, useCallback } from 'react';
import type { ChatItem } from '../types/pages.types';
import { ChatbotAPI } from '../api/endpoints/chatbot.api';
import { countTokensApprox } from '../utils/tokenUtils';
import { getSignedInUserId } from '../utils/sessionUtils';
import { GENERATING_TEXT } from '../constants/chatUi';
 
/* ---------------------------------------------------------
   Structured Data Returned from Hook
--------------------------------------------------------- */
interface StructuredDataItem {
  sql: string;
  rows: Array<Record<string, unknown>>;
  chartSpec?: Record<string, unknown>;
  agent?: string;
  queryId?: string;             // ✔ REAL Snowflake Query ID (verified only)
  queryIdVerified?: boolean;    // ✔
  planningSteps?: string;       // stored/persisted but NOT shown in response bubble
}
 
interface UseStructuredAgentProps {
  chatbotId: number | undefined;
  agentUrl: string;
  models: Record<string, unknown>[];
  showWarning: (message: string) => void;
}
 
interface UseStructuredAgentReturn {
  chatHistory: ChatItem[];
  structuredData: Map<number, StructuredDataItem>;
  isLoading: boolean;
  handleSend: (message: string, onMessageCleared?: () => void) => Promise<void>;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatItem[]>>;
  setStructuredData: React.Dispatch<React.SetStateAction<Map<number, StructuredDataItem>>>;
  stopGeneration: () => void;
}
 
/* ---------------------------------------------------------
   MODEL MAPPING
--------------------------------------------------------- */
const asModelMap = (text: string, models: Record<string, unknown>[]): Record<string, string> => {
  const keys = (models ?? [])
    .map((m: any) => m?.value ?? m?.modelId)
    .filter(Boolean);
 
  if (keys.length === 0) return { default: text ?? 'No response' };
 
  return keys.reduce((acc: Record<string, string>, k: any) => {
    acc[String(k)] = text ?? 'No response';
    return acc;
  }, {});
};
 
const keyOf = (q: string, r: string) => `${q}@@${r}`;
 
/* ---------------------------------------------------------
   STRICT RESPONSE SANITIZATION (bubble must be clean)
--------------------------------------------------------- */
 
const stripQueryIdsEverywhere = (input: string): string => {
  let text = input || '';
 
  // Remove "Query ID: <id>" inline or standalone
  text = text.replace(
    /(?:\*\*)?\s*query\s*id\s*(?:\*\*)?\s*[:\-–—]?\s*[a-f0-9-]{16,}\s*/gim,
    ''
  );
 
  // Remove UUID-like tokens anywhere
  text = text.replace(
    /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi,
    ''
  );
 
  return text;
};
 
const stripThinkingBlocks = (input: string): string => {
  let text = (input || '').replace(/\r\n/g, '\n');
 
  // Remove common meta/planning lines
  text = text.replace(
    /(^|\n)\s*(thinking part|thinking|analysis|plan|planning|step\s*\d+|decision|now i need to|now i should)\s*[:\-–—].*(?=\n|$)/gim,
    '\n'
  );
 
  // Remove multi-line step sections
  text = text.replace(
    /(^|\n)\s*step\s*\d+\s*[:\-–—]?\s*.*?(?=\n\s*\n|$)/gims,
    '\n'
  );
 
  // Remove typical meta statements
  text = text.replace(/(^|\n)\s*i now have sufficient information.*?(?=\n\s*\n|$)/gims, '\n');
  text = text.replace(/(^|\n)\s*the chart was generated.*?(?=\n|$)/gim, '\n');
 
  return text.replace(/\n{3,}/g, '\n\n').trim();
};
 
const normalizeHeading = (line: string) =>
  line.replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').trim().toLowerCase();
 
const isHeadingLike = (line: string) => {
  const t = line.trim();
  if (!t) return false;
  if (t.startsWith('|')) return false;          // avoid tables
  if (/^[-*+]\s+/.test(t)) return false;        // avoid bullets
  if (/^\d+[.)]\s+/.test(t)) return false;      // avoid numbered list
  if (t.length < 8) return false;
  const markdownHeading = /^#{1,6}\s+/.test(t);
  const titleLike = /^[A-Za-z0-9][A-Za-z0-9\s,&()\-]+$/.test(t) && !/[.:;!?]$/.test(t);
  return markdownHeading || titleLike;
};
 
const removeDuplicateHeadings = (text: string): string => {
  const lines = (text || '').split('\n');
  const seen = new Set<string>();
  const out: string[] = [];
 
  for (const line of lines) {
    const trimmed = line.trim();
    if (isHeadingLike(trimmed)) {
      const key = normalizeHeading(trimmed);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
 
const sanitizeForResponseBubble = (raw: string): string => {
  let t = raw || '';
  t = stripQueryIdsEverywhere(t);
  t = stripThinkingBlocks(t);
  t = removeDuplicateHeadings(t);
  t = stripQueryIdsEverywhere(t); // run twice
  return t.replace(/\n{3,}/g, '\n\n').trim();
};
 
/* ---------------------------------------------------------
   ROWS -> NARRATIVE (always prefer narrative, never tables)
--------------------------------------------------------- */
 
const findKeyCI = (obj: Record<string, unknown>, candidates: string[]) => {
  const keys = Object.keys(obj || {});
  const lowerMap = new Map(keys.map((k) => [k.toLowerCase(), k]));
  for (const c of candidates) {
    const hit = lowerMap.get(c.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
};
 
const parseDateSafe = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
 
const formatMoney = (n: unknown) => {
  const num = typeof n === 'number' ? n : Number(String(n));
  if (Number.isNaN(num)) return String(n ?? '');
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};
 
const formatMonthYear = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
 
const detectMetricFromQuestion = (question: string) => {
  const q = (question || '').toLowerCase();
  if (q.includes('total')) return 'TOTAL';
  if (q.includes('maximum') || q.includes('max') || q.includes('highest')) return 'MAX';
  if (q.includes('minimum') || q.includes('min') || q.includes('lowest')) return 'MIN';
  if (q.includes('average') || q.includes('avg') || q.includes('mean')) return 'AVG';
  return 'UNKNOWN';
};
 
const daysInYear = (year: number) => {
  const isLeap = new Date(year, 1, 29).getMonth() === 1;
  return isLeap ? 366 : 365;
};
 
const extractYearRangeFromNumbers = (years: number[]) => {
  const ys = Array.from(new Set(years)).sort((a, b) => a - b);
  if (ys.length === 0) return '';
  if (ys.length === 1) return `${ys[0]}`;
  return `${ys[0]}–${ys[ys.length - 1]}`;
};
 
/**
* Yearly totals narrative:
* Detects YEAR + TOTAL_REVENUE (or similar)
*/
const buildYearlyRevenueNarrative = (
  rows: Array<Record<string, unknown>>,
  question: string
): string => {
  if (!rows || rows.length === 0) return '';
 
  const sample = rows[0] ?? {};
  const yearKey = findKeyCI(sample, ['YEAR', 'year']);
  if (!yearKey) return '';
 
  // Choose metric key
  const pref = detectMetricFromQuestion(question);
  const totalKey =
    findKeyCI(sample, ['TOTAL_REVENUE', 'total_revenue', 'REVENUE_TOTAL', 'revenue_total', 'SUM_REVENUE', 'sum_revenue']) ??
    findKeyCI(sample, ['REVENUE', 'revenue']); // fallback if already aggregated
 
  if (!totalKey) return '';
 
  const startKey = findKeyCI(sample, ['START_DATE', 'start_date']);
  const endKey = findKeyCI(sample, ['END_DATE', 'end_date']);
  const countKey = findKeyCI(sample, ['RECORD_COUNT', 'record_count', 'DATA_POINTS', 'data_points', 'COUNT', 'count']);
 
  // Parse and sort by year
  const parsed = rows
    .map((r) => {
      const yRaw = (r as Record<string, unknown>)[yearKey];
      const yNum = typeof yRaw === 'number' ? yRaw : Number(String(yRaw));
      return { r, year: Number.isNaN(yNum) ? null : yNum };
    })
    .filter((x) => x.year != null)
    .sort((a, b) => (a.year! - b.year!));
 
  if (parsed.length === 0) return '';
 
  const yearsRange = extractYearRangeFromNumbers(parsed.map((p) => p.year!));
  const title = `Total Revenue by Year (${yearsRange})`;
 
  // Breakdown bullets
  const bullets = parsed.map(({ r, year }) => {
    const rowObj = r as Record<string, unknown>;
    return `- **${year}:** ${formatMoney(rowObj[totalKey as keyof typeof rowObj])}`;
  });
 
  // Insights: highest/lowest total
  const numVal = (v: unknown) => {
    const n = typeof v === 'number' ? v : Number(String(v));
    return Number.isNaN(n) ? null : n;
  };
 
  let highest: { year: number; v: number } | null = null;
  let lowest: { year: number; v: number } | null = null;
 
  for (const { r, year } of parsed) {
    const rowObj = r as Record<string, unknown>;
    const n = numVal(rowObj[totalKey as keyof typeof rowObj]);
    if (n == null) continue;
    if (!highest || n > highest.v) highest = { year: year!, v: n };
    if (!lowest || n < lowest.v) lowest = { year: year!, v: n };
  }
 
  const keyFindings: string[] = [];
  if (highest) keyFindings.push(`- **Highest total revenue:** ${highest.year} with ${formatMoney(highest.v)}`);
  if (lowest) keyFindings.push(`- **Lowest total revenue:** ${lowest.year} with ${formatMoney(lowest.v)}`);
 
  // Notes for incomplete year (record_count < expected days)
  const notes: string[] = [];
  if (countKey) {
    for (const { r, year } of parsed) {
      const rowObj = r as Record<string, unknown>;
      const cntRaw = rowObj[countKey as keyof typeof rowObj];
      const cnt = typeof cntRaw === 'number' ? cntRaw : Number(String(cntRaw));
      if (Number.isNaN(cnt)) continue;
 
      // Expected: full year days OR based on start/end if present
      let expected = daysInYear(year!);
 
      if (startKey && endKey) {
        const sd = parseDateSafe(rowObj[startKey as keyof typeof rowObj]);
        const ed = parseDateSafe(rowObj[endKey as keyof typeof rowObj]);
        if (sd && ed) {
          const diff = Math.round((ed.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          if (diff > 0 && diff <= 370) expected = diff;
        }
      }
 
      if (cnt > 0 && cnt < expected) {
        notes.push(
          `Note: **${year}** data is incomplete (${cnt} records), so the total revenue may not represent the full year.`
        );
      }
    }
  }
 
  return [
    `## ${title}`,
    `Here is the total revenue for each year in ${yearsRange}:`,
    ``,
    `### Yearly Breakdown:`,
    ...bullets,
    ``,
    `### Key Findings:`,
    ...(keyFindings.length ? keyFindings : ['- (No numeric values detected for insights)']),
    ...(notes.length ? ['', ...notes] : []),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
 
/**
* Monthly revenue narrative (MIN/MAX/AVG/TOTAL per month) — generalized
*/
const buildMonthlyRevenueNarrative = (
  rows: Array<Record<string, unknown>>,
  question: string
): string => {
  if (!rows || rows.length === 0) return '';
 
  const sample = rows[0] ?? {};
  const monthKey =
    findKeyCI(sample, ['MONTH', 'month']) ??
    findKeyCI(sample, ['MONTH_START', 'month_start']) ??
    findKeyCI(sample, ['MONTH_DATE', 'month_date']);
 
  if (!monthKey) return '';
 
  // Candidate metric keys
  const maxKey = findKeyCI(sample, ['MAX_REVENUE', 'max_revenue', 'MAXIMUM_REVENUE', 'maximum_revenue']);
  const minKey = findKeyCI(sample, ['MIN_REVENUE', 'min_revenue', 'MINIMUM_REVENUE', 'minimum_revenue']);
  const avgKey = findKeyCI(sample, ['AVG_REVENUE', 'avg_revenue', 'AVERAGE_REVENUE', 'average_revenue']);
  const totalKey = findKeyCI(sample, ['TOTAL_REVENUE', 'total_revenue', 'SUM_REVENUE', 'sum_revenue']);
 
  const pref = detectMetricFromQuestion(question);
  let metricKey: string | undefined;
  let metricLabel = 'Revenue';
 
  if (pref === 'TOTAL' && totalKey) { metricKey = totalKey; metricLabel = 'Total Revenue'; }
  else if (pref === 'MAX' && maxKey) { metricKey = maxKey; metricLabel = 'Maximum Revenue'; }
  else if (pref === 'MIN' && minKey) { metricKey = minKey; metricLabel = 'Minimum Revenue'; }
  else if (pref === 'AVG' && avgKey) { metricKey = avgKey; metricLabel = 'Average Revenue'; }
  else {
    metricKey = totalKey ?? maxKey ?? minKey ?? avgKey;
    if (metricKey === totalKey) metricLabel = 'Total Revenue';
    else if (metricKey === maxKey) metricLabel = 'Maximum Revenue';
    else if (metricKey === minKey) metricLabel = 'Minimum Revenue';
    else if (metricKey === avgKey) metricLabel = 'Average Revenue';
  }
 
  if (!metricKey) return '';
 
  // Parse and sort by date
  const parsed = rows
    .map((r) => {
      const rowObj = r as Record<string, unknown>;
      const md = parseDateSafe(rowObj[monthKey as keyof typeof rowObj]);
      return { r, md };
    })
    .filter((x) => x.md)
    .sort((a, b) => (a.md!.getTime() - b.md!.getTime()));
 
  if (parsed.length === 0) return '';
 
  const years = Array.from(new Set(parsed.map((p) => p.md!.getFullYear()))).sort((a, b) => a - b);
  const yearsRange = years.length === 1 ? `${years[0]}` : `${years[0]}–${years[years.length - 1]}`;
 
  const title = `${metricLabel} by Month (${yearsRange})`;
 
  const bullets = parsed.map(({ r, md }) => {
    const rowObj = r as Record<string, unknown>;
    return `- **${formatMonthYear(md!)}:** ${formatMoney(rowObj[metricKey as keyof typeof rowObj])}`;
  });
 
  // Insights: highest/lowest for selected metric
  const numVal = (v: unknown) => {
    const n = typeof v === 'number' ? v : Number(String(v));
    return Number.isNaN(n) ? null : n;
  };
 
  let highest: { md: Date; v: number } | null = null;
  let lowest: { md: Date; v: number } | null = null;
 
  for (const { r, md } of parsed) {
    const rowObj = r as Record<string, unknown>;
    const n = numVal(rowObj[metricKey as keyof typeof rowObj]);
    if (n == null) continue;
    if (!highest || n > highest.v) highest = { md: md!, v: n };
    if (!lowest || n < lowest.v) lowest = { md: md!, v: n };
  }
 
  const keyFindings: string[] = [];
  if (highest) keyFindings.push(`- **Highest ${metricLabel.toLowerCase()}:** ${formatMonthYear(highest.md)} with ${formatMoney(highest.v)}`);
  if (lowest) keyFindings.push(`- **Lowest ${metricLabel.toLowerCase()}:** ${formatMonthYear(lowest.md)} with ${formatMoney(lowest.v)}`);
 
  return [
    `## ${title}`,
    `Here is the ${metricLabel.toLowerCase()} recorded for each month in ${yearsRange}:`,
    ``,
    `### Monthly Breakdown:`,
    ...bullets,
    ``,
    `### Key Findings:`,
    ...(keyFindings.length ? keyFindings : ['- (No numeric values detected for insights)']),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
 
/**
* Generic narrative fallback for any rows:
* - Uses the first column as label
* - Shows remaining columns as "key: value" inline
* - Never returns a markdown table
*/
const buildGenericNarrative = (
  rows: Array<Record<string, unknown>>,
  question: string
): string => {
  if (!rows || rows.length === 0) return '';
  const cols = Object.keys(rows[0] ?? {});
  if (cols.length === 0) return '';
 
  const labelCol = cols[0];
  const valueCols = cols.slice(1);
 
  const title = `Results Summary`;
 
  const lines = rows.slice(0, 50).map((r) => {
    const rowObj = r as Record<string, unknown>;
    const label = String(rowObj[labelCol as keyof typeof rowObj] ?? '').trim() || '(row)';
    const parts = valueCols.map(
      (c) => `${c}: ${String(rowObj[c as keyof typeof rowObj] ?? '')}`
    );
    return `- **${label}**${parts.length ? ` — ${parts.join(', ')}` : ''}`;
  });
 
  return [
    `## ${title}`,
    `Here are the results based on your query:`,
    '',
    ...lines,
  ].join('\n').trim();
};
 
/**
* Master narrative selector:
* Yearly -> Monthly -> Generic
*/
const buildNarrativeFromRows = (
  rows: Array<Record<string, unknown>>,
  question: string
): string => {
  return (
    buildYearlyRevenueNarrative(rows, question) ||
    buildMonthlyRevenueNarrative(rows, question) ||
    buildGenericNarrative(rows, question) ||
    ''
  );
};
 
/* ---------------------------------------------------------
   Extract text/sql/rows/chart from backend JSON
--------------------------------------------------------- */
function extractAgentAnswerFromJson(data: any): {
  text: string;
  sql: string;
  rows: Array<Record<string, unknown>>;
  chartSpec?: Record<string, unknown>;
  planning?: string;
} {
  let text = '';
  let sql = '';
  let rows: Array<Record<string, unknown>> = [];
  let chartSpec: Record<string, unknown> | undefined;
  let planning = '';
 
  const msgs = Array.isArray(data?.messages) ? data.messages : [];
  if (msgs.length > 0) {
    const last = msgs[msgs.length - 1];
    const content = Array.isArray(last?.content) ? last.content : [];
    for (const part of content) {
      if (part?.type === 'text') text += part.text || '';
      if (part?.type === 'sql') sql = part.text || '';
      if (part?.type === 'table') rows = part.data || [];
      if (part?.type === 'chart') chartSpec = part.spec;
      if (part?.type === 'planning' || part?.type === 'analysis') planning += part.text || '';
    }
  }
 
  return {
    text: String(text || '').trim(),
    sql: String(sql || '').trim(),
    rows,
    chartSpec,
    planning: String(planning || '').trim(),
  };
}
 
/* ---------------------------------------------------------
   Extract saved response ID safely
--------------------------------------------------------- */
const extractId = (res: unknown): number | undefined => {
  if (typeof res === 'number') return res;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    const keys = ['id', 'RID', 'responseId', 'savedId', 'response_id'];
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === 'number') return v;
    }
  }
  return undefined;
};
 
/* ---------------------------------------------------------
   MAIN HOOK
--------------------------------------------------------- */
export const useStructuredAgent = ({
  chatbotId,
  agentUrl,
  models,
  showWarning,
}: UseStructuredAgentProps): UseStructuredAgentReturn => {
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);
  const [structuredData, setStructuredData] =
    useState<Map<number, StructuredDataItem>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const savedIdsRef = useRef<Map<string, number>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);
 
  const handleSend = async (message: string, onMessageCleared?: () => void) => {
    if (!message.trim()) return;
 
    if (!chatbotId) {
      showWarning('Please create the chatbot before sending messages.');
      return;
    }
 
    try {
      setIsLoading(true);
      if (onMessageCleared) onMessageCleared();
 
      const index = chatHistory.length;
 
      // Add user message
      setChatHistory((prev) => [
        ...prev,
        { user: message, bot: asModelMap(GENERATING_TEXT, models) },
      ]);
 
      // Call backend
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(agentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: message }),
        signal: controller.signal,
      });
 
      if (!response.ok) {
        throw new Error(`Structured agent failed: ${response.status}`);
      }
 
      const data = await response.json();
 
      // ✅ DO NOT use planningText in the response bubble
      const possibleAnswerText =
        data?.answerText ??
        data?.finalText ??
        data?.agent_text ??
        data?.text ??
        data?.message ??
        '';
 
      let rawAnswerText: string = String(possibleAnswerText || '').trim();
 
      // planning for Plan tab only
      const rawPlanningText: string = String(
        data?.planningText ?? data?.thinking ?? data?.analysis ?? ''
      ).trim();
 
      // SQL / Rows / Chart
      let sql: string = String(data?.sql ?? data?.sqlText ?? data?.sql_text ?? '').trim();
 
      let rows: Array<Record<string, unknown>> = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.data)
        ? data.data
        : [];
 
      let chartSpec: Record<string, unknown> | undefined =
        data?.chartSpec ?? data?.chart_spec ?? undefined;
 
      // Fallback extraction from messages
      if (!rawAnswerText || (!sql && rows.length === 0 && !chartSpec)) {
        const derived = extractAgentAnswerFromJson(data);
        if (!rawAnswerText && derived.text) rawAnswerText = derived.text;
        if (!sql && derived.sql) sql = derived.sql;
        if ((!rows || rows.length === 0) && derived.rows?.length) rows = derived.rows;
        if (!chartSpec && derived.chartSpec) chartSpec = derived.chartSpec;
      }
 
      // ✅ 1) Narrative from rows (preferred, always clean)
      const narrative = buildNarrativeFromRows(rows, message);
 
      // ✅ 2) Sanitized model text (no thinking, no query id)
      const sanitized = sanitizeForResponseBubble(rawAnswerText);
 
      // ✅ Final: NEVER show a table. Prefer narrative; else sanitized; else generic narrative if rows exist; else safe message.
      let finalAnswer =
        narrative ||
        sanitized ||
        (rows && rows.length ? buildGenericNarrative(rows, message) : '') ||
        'No response';
 
      // Update chat bubble
      setChatHistory((prev) => {
        const updated = [...prev];
        if (updated[index]) updated[index].bot = asModelMap(finalAnswer, models);
        return updated;
      });
 
      // ========= ⭐ STORE ONLY VERIFIED QUERY ID ⭐ =========
      const verifiedQueryId =
        data?.queryIdVerified === true ? (data?.queryId as string) : undefined;
 
      // keep planning for Plan tab, never displayed in bubble
      const planningSteps = stripQueryIdsEverywhere(rawPlanningText).trim();
 
      setStructuredData((prev) => {
        const map = new Map(prev);
        map.set(index, {
          sql,
          rows,
          chartSpec,
          agent: data?.agent,
          queryId: verifiedQueryId,
          queryIdVerified: Boolean(data?.queryIdVerified),
          planningSteps,
        });
        return map;
      });
 
      // Persist
      const sqlDetails =
        sql || verifiedQueryId
          ? { sql: sql || null, queryId: verifiedQueryId || null, queryIdVerified: Boolean(verifiedQueryId) }
          : null;
 
      const modelNameJoined =
        (models || [])
          .map((m: any) => m?.modelId ?? m?.value)
          .filter(Boolean)
          .join(',') || 'unknown';
 
      try {
        // Build payload and include sqlDetails only when present (avoids unknown key error)
        const payload = {
          chatbotId,
          modelName: modelNameJoined,
          question: message,
          response: finalAnswer,
          tokenCount: countTokensApprox(finalAnswer),
          userId: getSignedInUserId(),
          thinking: planningSteps ? planningSteps.slice(0, 20000) : null,
          ...(sqlDetails ? { sqlDetails } : {}),
        };
 
        const saveRes = await ChatbotAPI.saveResponseREST(payload as any);
 
        const savedId = extractId(saveRes);
        if (savedId != null) {
          savedIdsRef.current.set(keyOf(message, finalAnswer), savedId);
        }
      } catch (e) {
        console.warn('Failed to save response', e);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User stopped generation
        setChatHistory((prev) => {
          const updated = [...prev];
          const last = updated.length - 1;
          if (updated[last]) {
            const currentBot = updated[last].bot as Record<string, string>;
            const hasContent = Object.values(currentBot).some(
              (v) => v && v !== GENERATING_TEXT
            );
            if (!hasContent) {
              updated[last].bot = asModelMap('Generation stopped.', models);
            }
          }
          return updated;
        });
        return;
      }

      console.error(err);
 
      setChatHistory((prev) => {
        const updated = [...prev];
        const last = updated.length - 1;
        if (updated[last]) {
          updated[last].bot = asModelMap(
            'Something went wrong. Please try again later.',
            models
          );
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };
 
  return {
    chatHistory,
    structuredData,
    isLoading,
    handleSend,
    setChatHistory,
    setStructuredData,
    stopGeneration,
  };
};
 