import React, { useEffect, useMemo, useState } from 'react';
import styles from './ServiceMonitoring.module.scss';
import PageHeader from '../../components/ui/PageHeader/PageHeader';
import Dropdown from '../../components/ui/Dropdown/Dropdown';
import DateRangePicker from '../../components/ui/DateRangePicker/DateRangePicker';
import MetricCard from '../../components/ui/MetricCard/MetricCard';
import AlertBanner from '../../components/ui/AlertBanner/AlertBanner';
import ChartCard from '../../components/ui/ChartCard/ChartCard';
import CSATBarChart from '../../components/ui/charts/CSATBarChart/CSATBarChart';
import UserTrendAreaChart from '../../components/ui/charts/UserTrendAreaChart/UserTrendAreaChart';
import TokenTrendLineChart from '../../components/ui/charts/TokenTrendLineChart/TokenTrendLineChart';
import MonitorIcon from '@mui/icons-material/Monitor';
import { useNotification } from '../../hooks/useNotification';
import dayjs from 'dayjs';
import type { DateRange } from '../../types/ui.types';
import GenericChart from '../../components/ui/GenericChart/GenericChart';
const toYmd = (d: Date) => dayjs(d).format('YYYY-MM-DD');
const url = import.meta.env.VITE_API_BASE_URL as string;

const Monitoring: React.FC = () => {
  const { showNotification } = useNotification();

  // --- Types (local) ---
  type CsatRow = { month: string; avg_feedback: number };
  type CsatPoint = { date: string; score: number };
  type TokenTrendDataPoint = { month: string; tokens: number };
  type UserTrendDataPoint = { month: string; users: number }; // chart expects this
  type MonthlyUsersRow = { month: string; count: number };
  type DropdownOption = { label: string; value: string };

  // ➕ Spike alert type
  type AlertData = {
    id: string;
    severity: 'error' | 'warning' | 'success' | 'info';
    message: string;
    timestamp: Date;
  };

  // --- Helpers / transforms ---
  const transformCsatRows = (rows: CsatRow[]): CsatPoint[] =>
    rows
      .map((r) => ({
        date: r.month, // e.g. "2025-11-30"
        score: Math.round(Number(r.avg_feedback)), // e.g. 76
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

  const MONTH_ORDER = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const toUserTrendData = (rows: MonthlyUsersRow[]): UserTrendDataPoint[] =>
    rows
      .slice()
      .sort((a, b) => MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month))
      .map((r) => ({ month: r.month, users: Number(r.count) }));

  const pctDelta = (curr: number, prev: number, decimals = 2): number =>
    Number((curr - prev).toFixed(decimals));

  // ➕ thresholds (tune to taste)
  const SPIKE = {
    TOKEN_UP_PCT: 0.4, // >40% jump => red
    TOKEN_DOWN_PCT: -0.2, // >20% drop => green
    USERS_UP_PCT: 0.3, // >30% users growth => green
    CONV_UP_PCT: 0.8, // >80% conversations jump => red
    CONV_DOWN_PCT: -0.2, // >20% conversations drop => green
    LATENCY_RED_MS: 60, // >2000ms => red
    CSAT_RED: 0.6, // <60 => red
    CSAT_GREEN_DELTA: 0.1, // +10 points vs previous => green
    ADOPTION_GREEN: 70, // ≥70% => green
    ADOPTION_RED: 30, // ≤30% => red
  };

  // --- Selections / filters ---
  const [selectedApplication, setSelectedApplication] = useState('All');
  const [applicationOptions, setApplicationOptions] = useState<DropdownOption[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(dayjs().subtract(120, 'day').format('YYYY-MM-DD')),
    to: new Date(dayjs().format('YYYY-MM-DD')),
  });

  // Derived ISO dates used by multiple effects
  const startYmd = dateRange?.from ? dayjs(dateRange.from).format('YYYY-MM-DD') : undefined;
  const endYmd = dateRange?.to ? dayjs(dateRange.to).format('YYYY-MM-DD') : undefined;

  // --- Token usage trend (by month) ---
  const [tokenTrendData, setTokenTrendData] = useState<TokenTrendDataPoint[]>([]);

  // --- CSAT chart points ---
  const [csatPoints, setCsatPoints] = useState<CsatPoint[]>([]);
  const [csatChartLoading, setCsatChartLoading] = useState<boolean>(false);
  const [csatChartError, setCsatChartError] = useState<string | null>(null);

  // --- Total Users ---
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [isLoadingTotalUsers, setIsLoadingTotalUsers] = useState(false);
  const [totalUsersError, setTotalUsersError] = useState<string | null>(null);

  // --- Monthly Users trend (for area chart) ---
  const [monthlyUsersTrend, setMonthlyUsersTrend] = useState<UserTrendDataPoint[]>([]);
  const [isLoadingMonthlyUsers, setIsLoadingMonthlyUsers] = useState(false);
  const [monthlyUsersError, setMonthlyUsersError] = useState<string | null>(null);

  // --- Total Token Usage ---
  const [tokenUsage, setTokenUsage] = useState<number | null>(null);
  const [isLoadingTokenUsage, setIsLoadingTokenUsage] = useState(false);
  const [tokenUsageError, setTokenUsageError] = useState<string | null>(null);

  // --- Average Latency ---
  const [averageLatency, setAverageLatency] = useState<number | null>(null);
  const [isLoadingAverageLatency, setIsLoadingAverageLatency] = useState(false);
  const [averageLatencyError, setAverageLatencyError] = useState<string | null>(null);

  // --- CSAT (avg) ---
  const [csat, setCsat] = useState<number | null>(null);
  const [isLoadingCsat, setIsLoadingCsat] = useState(false);
  const [csatError, setCsatError] = useState<string | null>(null);

  // --- Adoption Rate ---
  const [adoptionRate, setAdoptionRate] = useState<number | null>(null);
  const [isLoadingAdoptionRate, setIsLoadingAdoptionRate] = useState<boolean>(false);
  const [adoptionRateError, setAdoptionRateError] = useState<string | null>(null);

  // --- Total Conversations ---
  const [totalConversations, setTotalConversations] = useState<number | null>(null);
  const [isLoadingTotalConversations, setIsLoadingTotalConversations] = useState(false);
  const [totalConversationsError, setTotalConversationsError] = useState<string | null>(null);

  // ➕ Previous-period Total Conversations
  const [prevTotalConversations, setPrevTotalConversations] = useState<number | null>(null);
  const [prevTotalConversationsError, setPrevTotalConversationsError] = useState<string | null>(
    null
  );
  const [isLoadingPrevTotalConversations, setIsLoadingPrevTotalConversations] = useState(false);

  // --- Correctness split (VALID / INVALID per month or for selected range) ---
  const [correctnessSplitPoints, setCorrectnessSplitPoints] = useState<
    { month: string; VALID?: number; INVALID?: number }[]
  >([]);
  const [isLoadingCorrectnessSplit, setIsLoadingCorrectnessSplit] = useState<boolean>(false);
  const [correctnessSplitError, setCorrectnessSplitError] = useState<string | null>(null);

  // Spike alerts state (used by alerts grid)
  const [spikeAlerts, setSpikeAlerts] = useState<AlertData[]>([]);

  // Fetch correctness split (single overall or month-buckets). Server returns rows like:
  // [ { CATEGORY: 'INVALID', TOTAL_QUERIES: 1, PERCENT_OF_TOTAL: 10 }, { CATEGORY: 'VALID', TOTAL_QUERIES: 9, PERCENT_OF_TOTAL: 90 } ]
  useEffect(() => {
    let cancelled = false;
    async function fetchCorrectnessSplit() {
      setIsLoadingCorrectnessSplit(true);
      setCorrectnessSplitError(null);
      try {
        // require both dates — server validates YYYY-MM-DD
        if (!startYmd || !endYmd) {
          if (!cancelled) setCorrectnessSplitPoints([]);
          return;
        }

        const params = new URLSearchParams();
        params.set('from', startYmd);
        params.set('to', endYmd);
        // include chatbot filter only when a specific app is selected
        if (selectedApplication && selectedApplication.toUpperCase() !== 'ALL') {
          params.set('chatbot_name', selectedApplication);
        }

        const resp = await fetch(`${url}/api/correctness-monthly-split?${params.toString()}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const rows = (await resp.json()) || [];

        // Normalize rows to an array of plain objects
        const normalized = Array.isArray(rows) ? rows : [rows];

        // Detect month field
        const sample = normalized[0] || {};
        const monthField =
          sample.MONTH ||
          sample.month ||
          sample.MONTH_LABEL ||
          sample.month_label ||
          sample.START_TIME ||
          sample.start_time ||
          null;

        const toShortMonth = (m: any) => {
          if (!m) return '';
          try {
            // If ISO date, format to short month
            const asDate = dayjs(String(m));
            if (asDate.isValid()) return asDate.format('MMM');
          } catch (_) {}
          const s = String(m).trim();
          // If full month name, take first 3 chars
          if (/^[A-Za-z]+$/.test(s) && s.length > 3) return s.slice(0, 3);
          // Fallback: truncate to 6 chars
          return s.length > 6 ? s.slice(0, 6) : s;
        };

        let shaped: { month: string; VALID?: number; INVALID?: number }[] = [];

        if (monthField) {
          // Group by month value found on each row
          const byMonth = new Map<string, { VALID?: number; INVALID?: number }>();
          for (const r of normalized) {
            // extract month label
            const m =
              (r.MONTH ??
                r.month ??
                r.MONTH_LABEL ??
                r.month_label ??
                r.START_TIME ??
                r.start_time) ||
              '';
            const rawMonthLabel = typeof m === 'string' ? m : String(m);
            const monthLabel = toShortMonth(rawMonthLabel);

            // If row already contains both valid_pct/invalid_pct, use them
            const hasValidPct =
              r.valid_pct !== undefined || r.VALID_PCT !== undefined || r.valid_pct !== null;
            const hasInvalidPct =
              r.invalid_pct !== undefined || r.INVALID_PCT !== undefined || r.invalid_pct !== null;

            const cur = byMonth.get(monthLabel) ?? {};

            if (hasValidPct || hasInvalidPct) {
              const vp = Number(r.valid_pct ?? r.VALID_PCT ?? r.valid_pct ?? 0);
              const ip = Number(r.invalid_pct ?? r.INVALID_PCT ?? r.invalid_pct ?? 0);
              if (!Number.isNaN(vp)) cur.VALID = vp;
              if (!Number.isNaN(ip)) cur.INVALID = ip;
            } else {
              // Old format: CATEGORY + PERCENT_OF_TOTAL
              const cat = String(r.CATEGORY ?? r.category ?? '')?.toUpperCase();
              const pct = Number(
                r.PERCENT_OF_TOTAL ??
                  r.percent_of_total ??
                  r.PERCENT ??
                  r.percent ??
                  r.PERCENT_OF_CORRECTNESS ??
                  0
              );

              if (cat === 'VALID') cur.VALID = pct;
              else cur.INVALID = pct;
            }

            byMonth.set(monthLabel, cur);
          }

          shaped = Array.from(byMonth.entries()).map(([month, vals]) => ({ month, ...vals }));
        } else {
          // No month buckets — server returned aggregate CATEGORY rows for the selected range.
          // Also support aggregate rows that already contain valid_pct/invalid_pct
          const point: { month: string; VALID?: number; INVALID?: number } = {
            month: `${dayjs(startYmd).format('MMM')}→${dayjs(endYmd).format('MMM')}`,
          };

          if (
            normalized.length === 1 &&
            (normalized[0].valid_pct !== undefined || normalized[0].invalid_pct !== undefined)
          ) {
            const r = normalized[0];
            const vp = Number(r.valid_pct ?? r.VALID_PCT ?? 0);
            const ip = Number(r.invalid_pct ?? r.INVALID_PCT ?? 0);
            if (!Number.isNaN(vp)) point.VALID = vp;
            if (!Number.isNaN(ip)) point.INVALID = ip;
          } else {
            for (const r of normalized) {
              const cat = String(r.CATEGORY ?? r.category ?? '')?.toUpperCase();
              const pct = Number(
                r.PERCENT_OF_TOTAL ?? r.percent_of_total ?? r.PERCENT ?? r.percent ?? 0
              );
              if (cat === 'VALID') point.VALID = pct;
              else point.INVALID = pct;
            }
          }

          shaped = [point];
        }

        if (!cancelled) setCorrectnessSplitPoints(shaped);
      } catch (e: any) {
        if (!cancelled) setCorrectnessSplitError(e?.message ?? 'Failed to load correctness split');
      } finally {
        if (!cancelled) setIsLoadingCorrectnessSplit(false);
      }
    }
    fetchCorrectnessSplit();
    return () => {
      cancelled = true;
    };
  }, [startYmd, endYmd, url, selectedApplication]);

  // ---------- Effect: initial token trend + total users based on dateRange ----------

  useEffect(() => {
    let aborted = false;

    const fetchTotalUsers = async () => {
      setIsLoadingTotalUsers(true);
      setTotalUsersError(null);
      try {
        const params = new URLSearchParams();
        if (startYmd) params.set('start_date', startYmd);
        if (endYmd) params.set('end_date', endYmd);

        const resp = await fetch(
          `${url}/api/total_user${params.toString() ? `?${params.toString()}` : ''}`
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const json = await resp.json();
        const raw = (json as Record<string, unknown>).totalUsers;
        const value =
          typeof raw === 'number' ? raw : Number.isFinite(Number(raw)) ? Number(raw) : null;

        if (!aborted) setTotalUsers(value);
      } catch (err: unknown) {
        console.error('Failed to fetch total users', err);
        if (!aborted) {
          setTotalUsers(null);
          setTotalUsersError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!aborted) setIsLoadingTotalUsers(false);
      }
    };

    const fetchTokenUsage = async () => {
      setIsLoadingTokenUsage(true);
      setTokenUsageError(null);

      try {
        const params = new URLSearchParams();

        // Send chatbot_name only if it's not "ALL" and not empty.
        if (selectedApplication && selectedApplication !== 'ALL') {
          params.set('chatbot_name', selectedApplication);
        }

        if (startYmd) params.set('start_date', startYmd);
        if (endYmd) params.set('end_date', endYmd);

        const resp = await fetch(
          `${url}/api/token_usage${params.toString() ? `?${params.toString()}` : ''}`
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const json = await resp.json();
        const raw =
          (json as Record<string, unknown>).total_token_usage ??
          (json as Record<string, unknown>).totalTokenUsage;

        const value =
          typeof raw === 'number' ? raw : Number.isFinite(Number(raw)) ? Number(raw) : null;

        if (!aborted) setTokenUsage(value);
      } catch (err: unknown) {
        console.error('Failed to fetch token usage', err);
        if (!aborted) {
          setTokenUsage(null);
          setTokenUsageError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!aborted) setIsLoadingTokenUsage(false);
      }
    };

    // Only run when we have a valid date range
    if (startYmd && endYmd) {
      fetchTotalUsers();
      fetchTokenUsage();
    } else {
      // Optional: reset values if date range is incomplete
      setTotalUsers(null);
      setTokenUsage(null);
    }

    return () => {
      aborted = true;
    };
  }, [selectedApplication]);

  // ---------- Effect: load chatbots for dropdown ----------
  useEffect(() => {
    const fetchChatbots = async () => {
      try {
        const resp = await fetch(`${url}/api/get_chatbots`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: Array<{ chatbot_name: string }> = await resp.json();
        const options: DropdownOption[] = data.map((b) => ({
          label: b.chatbot_name,
          value: b.chatbot_name,
        }));
        setApplicationOptions(options);
        if (!selectedApplication && options.length > 0 && options[0]) {
          setSelectedApplication(options[0].value);
        }
      } catch (e: unknown) {
        console.error('Failed to load chatbots:', e);
      }
    };
    fetchChatbots();
  }, []);

  // ---------- Effect: main data loads for selected app & date range ----------
  useEffect(() => {
    let aborted = false;
    let cancelled = false;

    const fetchAdoptionRate = async () => {
      setIsLoadingAdoptionRate(true);
      setAdoptionRateError(null);
      try {
        const params = new URLSearchParams();
        if (selectedApplication) params.set('chatbot_name', selectedApplication);
        if (startYmd) params.set('start_date', startYmd);
        if (endYmd) params.set('end_date', endYmd);
        const respUrl = `${url}/api/adoption_rate${params.toString() ? `?${params.toString()}` : ''}`;
        const resp = await fetch(respUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const raw =
          (json as Record<string, unknown>).adoption_rate ??
          (json?.data as Record<string, unknown>)?.adoption_rate;
        const value =
          typeof raw === 'number' ? raw : Number.isFinite(Number(raw)) ? Number(raw) : null;
        if (!aborted) setAdoptionRate(value);
      } catch (err: unknown) {
        console.error('Failed to fetch adoption rate', err);
        if (!aborted) {
          setAdoptionRate(null);
          setAdoptionRateError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!aborted) setIsLoadingAdoptionRate(false);
      }
    };

    const fetchTotalUsers = async () => {
      setIsLoadingTotalUsers(true);
      setTotalUsersError(null);
      try {
        const params = new URLSearchParams();
        if (startYmd) params.set('start_date', startYmd);
        if (endYmd) params.set('end_date', endYmd);
        const resp = await fetch(
          `${url}/api/total_user${params.toString() ? `?${params.toString()}` : ''}`
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const raw = (json as Record<string, unknown>).totalUsers;
        const value =
          typeof raw === 'number' ? raw : Number.isFinite(Number(raw)) ? Number(raw) : null;
        if (!aborted) setTotalUsers(value);
      } catch (err: unknown) {
        console.error('Failed to fetch total users', err);
        if (!aborted) {
          setTotalUsers(null);
          setTotalUsersError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!aborted) setIsLoadingTotalUsers(false);
      }
    };

    const fetchCsatGraph = async () => {
      setCsatChartLoading(true);
      setCsatChartError(null);
      try {
        const params = new URLSearchParams();
        if (startYmd) params.set('start_date', startYmd);
        if (endYmd) params.set('end_date', endYmd);

        if (selectedApplication && selectedApplication.trim()) {
          params.set('chatbot_name', selectedApplication.trim());
        } else {
          params.set('chatbot_name', 'ALL');
        }

        const resUrl = `${url}/api/csat_graph${params.toString() ? `?${params.toString()}` : ''}`;
        const resp = await fetch(resUrl, { method: 'GET' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const rows: CsatRow[] = Array.isArray(json?.data) ? json.data : [];
        const points = transformCsatRows(rows);

        if (!cancelled) setCsatPoints(points);
      } catch (e: any) {
        console.error('CSAT graph fetch failed:', e);
        if (!cancelled) setCsatChartError(e?.message ?? 'Failed to load CSAT data');
      } finally {
        if (!cancelled) setCsatChartLoading(false);
      }
    };

    const fetchMonthlyUsers = async () => {
      setIsLoadingMonthlyUsers(true);
      setMonthlyUsersError(null);
      try {
        const params = new URLSearchParams();
        if (startYmd) params.set('start_date', startYmd);
        if (endYmd) params.set('end_date', endYmd);

        if (selectedApplication && selectedApplication.trim()) {
          params.set('chatbot_name', selectedApplication.trim());
        } else {
          params.set('chatbot_name', 'ALL');
        }

        const resUrl = `${url}/api/monthly_users${params.toString() ? `?${params.toString()}` : ''}`;
        const resp = await fetch(resUrl, { method: 'GET' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();

        // Backend returns an array; still resilient if wrapped
        const rows: MonthlyUsersRow[] = Array.isArray(json) ? json : (json?.data ?? []);
        const points = toUserTrendData(rows);

        if (!cancelled) setMonthlyUsersTrend(points);
      } catch (e: unknown) {
        console.error('Monthly users fetch failed:', e);
        if (!cancelled)
          setMonthlyUsersError(e instanceof Error ? e.message : 'Failed to load monthly users');
      } finally {
        if (!cancelled) setIsLoadingMonthlyUsers(false);
      }
    };

    fetchMonthlyUsers();
    fetchTotalUsers();
    fetchCsatGraph();
    fetchAdoptionRate();

    return () => {
      aborted = true;
      cancelled = true;
    };
  }, [selectedApplication, dateRange]);

  // ---------- Effect: Total Conversations (current range) ----------
  useEffect(() => {
    let aborted = false;
    const fetchTotalConversations = async () => {
      setIsLoadingTotalConversations(true);
      setTotalConversationsError(null);
      try {
        const qs = new URLSearchParams({
          chatbot_name: selectedApplication,
          start_date: toYmd(dateRange.from),
          end_date: toYmd(dateRange.to),
        }).toString();
        const resp = await fetch(`${url}/api/total_conversations?${qs}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const raw =
          (data as Record<string, unknown>).totalConversations ??
          (data as Record<string, unknown>).total_conversations;
        const value =
          typeof raw === 'number' ? raw : Number.isFinite(Number(raw)) ? Number(raw) : null;
        if (!aborted) setTotalConversations(value);
        setPrevTotalConversations(value);
      } catch (err: unknown) {
        console.error('Failed to fetch total conversations', err);
        if (!aborted) {
          setTotalConversations(null);
          setTotalConversationsError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!aborted) setIsLoadingTotalConversations(false);
      }
    };
    fetchTotalConversations();
    return () => {
      aborted = true;
    };
  }, [selectedApplication, dateRange]);

  // ---------- ➕ Effect: Previous-period Total Conversations ----------
  useEffect(() => {
    let aborted = false;

    // previous period = same length window immediately before current range
    const start = dayjs(dateRange.from);
    const end = dayjs(dateRange.to);
    const days = end.diff(start, 'day') + 1; // inclusive window length
    const prevEnd = start.subtract(1, 'day');
    const prevStart = prevEnd.subtract(days - 1, 'day');

    const fetchPrevTotalConversations = async () => {
      setIsLoadingPrevTotalConversations(true);
      setPrevTotalConversationsError(null);
      try {
        const qs = new URLSearchParams({
          chatbot_name: selectedApplication,
          start_date: prevStart.format('YYYY-MM-DD'),
          end_date: prevEnd.format('YYYY-MM-DD'),
        }).toString();

        const resp = await fetch(`${url}/api/total_conversations?${qs}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const raw =
          (data as Record<string, unknown>).totalConversations ??
          (data as Record<string, unknown>).total_conversations;
        const value =
          typeof raw === 'number' ? raw : Number.isFinite(Number(raw)) ? Number(raw) : null;
        setPrevTotalConversations(value);
      } catch (err: unknown) {
        console.error('Prev total conversations fetch failed', err);
        if (!aborted) {
          // setPrevTotalConversations(null);
          setPrevTotalConversationsError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!aborted) setIsLoadingPrevTotalConversations(false);
      }
    };

    fetchPrevTotalConversations();
    return () => {
      aborted = true;
    };
  }, [selectedApplication, dateRange]);

  // ---------- Effect: Total Token Usage ----------
  useEffect(() => {
    let aborted = false;

    const fetchTokenUsageTrend = async () => {
      try {
        const startYmd = dateRange?.from ? dayjs(dateRange.from).format('YYYY-MM-DD') : undefined;
        const endYmd = dateRange?.to ? dayjs(dateRange.to).format('YYYY-MM-DD') : undefined;
        const params = new URLSearchParams();
        if (startYmd) params.set('start_date', startYmd);
        if (endYmd) params.set('end_date', endYmd);

        // Always send chatbot_name; backend treats ALL as "no filter"
        if (selectedApplication && selectedApplication.trim()) {
          params.set('chatbot_name', selectedApplication.trim());
        } else {
          // If no selection present, default to ALL
          params.set('chatbot_name', 'ALL');
        }

        const resp = await fetch(
          `${url}/api/token_usage_by_month${params.toString() ? `?${params.toString()}` : ''}`
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        const rows: Record<string, unknown>[] = Array.isArray(json?.data) ? json.data : [];

        const FULL_TO_ABBR: Record<string, string> = {
          January: 'Jan',
          February: 'Feb',
          March: 'Mar',
          April: 'Apr',
          May: 'May',
          June: 'Jun',
          July: 'Jul',
          August: 'Aug',
          September: 'Sep',
          November: 'Nov',
          December: 'Dec',
        };
        const toAbbr = (value: string) => {
          const cleaned = (value ?? '').trim();
          if (!cleaned) return '';
          if (cleaned.length <= 3) return cleaned;
          const norm = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
          return FULL_TO_ABBR[norm] ?? norm.slice(0, 3);
        };

        const agg = new Map<string, number>();
        for (const r of rows) {
          const monthLabel = r?.month_label ?? r?.MONTH_LABEL;
          const abbr = toAbbr(typeof monthLabel === 'string' ? monthLabel : '');
          const tokens = Number(r?.total_token_usage ?? r?.TOTAL_TOKEN_USAGE ?? 0);
          if (!abbr) continue;
          agg.set(abbr, (agg.get(abbr) ?? 0) + tokens);
        }

        const shaped: TokenTrendDataPoint[] = MONTH_ORDER.map((m) => ({
          month: m,
          tokens: agg.get(m) ?? 0,
        })).filter((p) => p.tokens > 0);

        if (!aborted) setTokenTrendData(shaped);
      } catch (err: unknown) {
        console.error('Failed to fetch token usage trend', err);
        if (!aborted) setTokenTrendData([]);
      }
    };
    fetchTokenUsageTrend();
    return () => {
      aborted = true;
    };
  }, [selectedApplication, dateRange]);

  // ---------- Effect: Average Latency ----------
  useEffect(() => {
    let aborted = false;
    const fetchAverageLatency = async () => {
      setIsLoadingAverageLatency(true);
      setAverageLatencyError(null);
      try {
        const qs = new URLSearchParams({
          chatbot_name: selectedApplication,
          start_date: toYmd(dateRange.from),
          end_date: toYmd(dateRange.to),
        }).toString();
        const resp = await fetch(`${url}/api/average_latency?${qs}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const raw =
          (data as Record<string, unknown>).average_latency_ms ??
          (data as Record<string, unknown>).averageLatency;
        const value =
          typeof raw === 'number' ? raw : Number.isFinite(Number(raw)) ? Number(raw) : null;
        if (!aborted) setAverageLatency(value);
      } catch (err: unknown) {
        console.error('Failed to fetch average latency', err);
        if (!aborted) {
          setAverageLatency(null);
          setAverageLatencyError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!aborted) setIsLoadingAverageLatency(false);
      }
    };
    fetchAverageLatency();
    return () => {
      aborted = true;
    };
  }, [selectedApplication, dateRange]);

  // ---------- Effect: CSAT (avg) ----------
  useEffect(() => {
    let aborted = false;
    const fetchCsat = async () => {
      setIsLoadingCsat(true);
      setCsatError(null);
      try {
        const qs = new URLSearchParams({
          chatbot_name: selectedApplication,
          start_date: toYmd(dateRange.from),
          end_date: toYmd(dateRange.to),
        }).toString();
        const resp = await fetch(`${url}/api/csat?${qs}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const raw = (data as Record<string, unknown>).csat;
        const value =
          typeof raw === 'number' ? raw : Number.isFinite(Number(raw)) ? Number(raw) : null;
        if (!aborted) setCsat(value);
      } catch (err: unknown) {
        console.error('Failed to fetch CSAT', err);
        if (!aborted) {
          setCsat(null);
          setCsatError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!aborted) setIsLoadingCsat(false);
      }
    };
    fetchCsat();
    return () => {
      aborted = true;
    };
  }, [selectedApplication, dateRange]);

  // ---------- Metrics (with trend/spike deltas) ----------
  const metrics = useMemo(() => {
    // Users trend delta (MoM from monthlyUsersTrend)
    let usersDeltaPct: number | null = null;
    if (monthlyUsersTrend.length >= 2) {
      const lastU = monthlyUsersTrend[monthlyUsersTrend.length - 1]?.users;
      const prevU = monthlyUsersTrend[monthlyUsersTrend.length - 2]?.users;
      if (lastU !== undefined && prevU !== undefined) {
        usersDeltaPct = pctDelta(lastU, prevU);
      }
    }

    // Users metric
    const usersDisplay = isLoadingTotalUsers
      ? '…'
      : totalUsersError
        ? 'Error'
        : totalUsers === null
          ? '—'
          : totalUsers.toLocaleString();
    const usersDirection: 'up' | 'down' =
      usersDeltaPct === null
        ? isLoadingTotalUsers
          ? 'up'
          : totalUsers === null
            ? 'down'
            : 'up'
        : usersDeltaPct >= 0
          ? 'up'
          : 'down';
    const usersMetric = {
      id: 'total-users',
      icon: '👥',
      iconBgColor: '#E8F5E9',
      iconColor: '#2E7D32',
      value: usersDisplay,
      label: 'Users',
      trend: {
        value: usersDeltaPct === null ? 0 : Math.round(usersDeltaPct),
        direction: usersDirection,
        isPositive:
          usersDeltaPct === null
            ? isLoadingTotalUsers
              ? true
              : totalUsers !== null
            : usersDeltaPct >= 0,
        label: totalUsersError
          ? totalUsersError
          : usersDeltaPct === null
            ? isLoadingTotalUsers
              ? 'Loading'
              : totalUsers === null
                ? 'Unavailable'
                : 'vs previous period'
            : 'vs previous month',
      },
    };

    // Conversations trend delta (current vs previous period)
    let convDeltaPct: number | null = null;
    if (
      totalConversations !== null &&
      prevTotalConversations !== null &&
      !isLoadingPrevTotalConversations &&
      !prevTotalConversationsError
    ) {
      convDeltaPct = pctDelta(totalConversations, prevTotalConversations);
    }
    const convDisplay = isLoadingTotalConversations
      ? '…'
      : totalConversationsError
        ? 'Error'
        : totalConversations === null
          ? '—'
          : totalConversations.toLocaleString();
    const convDirection: 'up' | 'down' =
      convDeltaPct === null
        ? isLoadingTotalConversations
          ? 'up'
          : totalConversations === null
            ? 'down'
            : 'up'
        : convDeltaPct >= 0
          ? 'up'
          : 'down';
    const convMetric = {
      id: 'total-conversations',
      icon: '💬',
      iconBgColor: '#E3F2FD',
      iconColor: '#1565C0',
      value: convDisplay,
      label: 'Conversations',
      trend: {
        value: convDeltaPct === null ? 0 : Math.round(convDeltaPct),
        direction: convDirection,
        isPositive:
          convDeltaPct === null
            ? isLoadingTotalConversations
              ? true
              : totalConversations !== null
            : convDeltaPct >= 0,
        label: totalConversationsError
          ? totalConversationsError
          : prevTotalConversationsError
            ? prevTotalConversationsError
            : isLoadingPrevTotalConversations
              ? 'Loading comparison data'
              : convDeltaPct === null
                ? isLoadingTotalConversations
                  ? 'Loading'
                  : totalConversations === null
                    ? 'Unavailable'
                    : 'vs previous period'
                : 'vs previous period',
      },
    };

    // Token usage delta (MoM from tokenTrendData)
    let tokenDeltaPct: number | null = null;
    if (tokenTrendData.length >= 2) {
      const last = tokenTrendData[tokenTrendData.length - 1]?.tokens;
      const prev = tokenTrendData[tokenTrendData.length - 2]?.tokens;
      if (last !== undefined && prev !== undefined) {
        tokenDeltaPct = pctDelta(last, prev);
      }
    }
    const tokenDisplay = isLoadingTokenUsage
      ? '…'
      : tokenUsageError
        ? 'Error'
        : tokenUsage === null
          ? '—'
          : tokenUsage.toLocaleString();
    const tokenDirection: 'up' | 'down' =
      tokenDeltaPct === null
        ? isLoadingTokenUsage
          ? 'up'
          : tokenUsage === null
            ? 'down'
            : 'up'
        : tokenDeltaPct >= 0
          ? 'up'
          : 'down';
    const tokenUsageMetric = {
      id: 'total-token-usage',
      icon: '🔢',
      iconBgColor: '#FFF3E0',
      iconColor: '#EF6C00',
      value: tokenDisplay,
      label: 'Token Usage',
      trend: {
        value: tokenDeltaPct === null ? 0 : Math.round(tokenDeltaPct),
        direction: tokenDirection,
        isPositive:
          tokenDeltaPct === null
            ? isLoadingTokenUsage
              ? true
              : tokenUsage !== null
            : tokenDeltaPct >= 0,
        label: tokenUsageError
          ? tokenUsageError
          : tokenDeltaPct === null
            ? isLoadingTokenUsage
              ? 'Loading'
              : tokenUsage === null
                ? 'Unavailable'
                : 'vs previous month'
            : 'vs previous month',
      },
    };

    // Latency trend (threshold-based)
    const latencyDisplay = isLoadingAverageLatency
      ? '…'
      : averageLatencyError
        ? 'Error'
        : averageLatency === null
          ? '—'
          : `${Math.round(averageLatency)} ms`;
    const latencyDirection: 'up' | 'down' =
      averageLatency === null
        ? isLoadingAverageLatency
          ? 'up'
          : 'down' // not loaded => neutral
        : averageLatency <= SPIKE.LATENCY_RED_MS
          ? 'down'
          : 'up';
    const latencyMetric = {
      id: 'average-latency',
      icon: '⏱️',
      iconBgColor: '#F3E5F5',
      iconColor: '#6A1B9A',
      value: latencyDisplay,
      label: 'Average Latency',
      trend: {
        value: averageLatency === null ? 0 : Math.round(averageLatency),
        direction: latencyDirection,
        isPositive:
          averageLatency === null
            ? isLoadingAverageLatency
              ? true
              : averageLatency !== null
            : averageLatency <= SPIKE.LATENCY_RED_MS, // good if below threshold
        label: averageLatencyError
          ? averageLatencyError
          : averageLatency === null
            ? isLoadingAverageLatency
              ? 'Loading'
              : 'Unavailable'
            : `threshold ${SPIKE.LATENCY_RED_MS} ms`,
      },
    };

    // Adoption Rate (threshold-based)
    const adoptionDisplay = isLoadingAdoptionRate
      ? '…'
      : adoptionRateError
        ? 'Error'
        : adoptionRate === null
          ? '—'
          : `${adoptionRate.toFixed(2)}%`;
    const adoptionDirection: 'up' | 'down' =
      adoptionRate === null
        ? isLoadingAdoptionRate
          ? 'up'
          : 'down'
        : adoptionRate >= SPIKE.ADOPTION_GREEN
          ? 'up'
          : 'down';
    const adoptionMetric = {
      id: 'adoption-rate',
      icon: '📈',
      iconBgColor: '#E8EAF6',
      iconColor: '#3949AB',
      value: adoptionDisplay,
      label: 'Adoption Rate',
      trend: {
        value: adoptionRate === null ? 0 : Math.round(adoptionRate),
        direction: adoptionDirection,
        isPositive:
          adoptionRate === null
            ? isLoadingAdoptionRate
              ? true
              : adoptionRate !== null
            : adoptionRate >= SPIKE.ADOPTION_GREEN,
        label: adoptionRateError
          ? adoptionRateError
          : adoptionRate === null
            ? isLoadingAdoptionRate
              ? 'Loading'
              : 'Unavailable'
            : `target ≥ ${SPIKE.ADOPTION_GREEN}%`,
      },
    };

    // CSAT delta (last vs previous point from csatPoints)
    let csatDeltaAbs: number | null = null;
    if (csatPoints.length >= 2) {
      const lastC = csatPoints[csatPoints.length - 1]?.score;
      const prevC = csatPoints[csatPoints.length - 2]?.score;
      if (lastC !== undefined && prevC !== undefined) {
        csatDeltaAbs = lastC - prevC;
      }
    }
    const csatDisplay = isLoadingCsat
      ? '…'
      : csatError
        ? 'Error'
        : csat === null
          ? '—'
          : csat.toFixed(2);
    const csatDirection: 'up' | 'down' =
      csatDeltaAbs === null
        ? isLoadingCsat
          ? 'up'
          : csat === null
            ? 'down'
            : 'up'
        : csatDeltaAbs >= 0
          ? 'up'
          : 'down';
    const csatMetric = {
      id: 'average-csat',
      icon: '⭐',
      iconBgColor: '#FFFDE7',
      iconColor: '#F9A825',
      value: csatDisplay,
      label: 'CSAT (avg)',
      trend: {
        value: csatDeltaAbs === null ? 0 : Math.round(csatDeltaAbs),
        direction: csatDirection,
        isPositive:
          csatDeltaAbs === null ? (isLoadingCsat ? true : csat !== null) : csatDeltaAbs >= 0,
        label: csatError
          ? csatError
          : csatDeltaAbs === null
            ? isLoadingCsat
              ? 'Loading'
              : csat === null
                ? 'Unavailable'
                : 'vs previous point'
            : 'vs previous point',
      },
    };

    return [usersMetric, convMetric, tokenUsageMetric, latencyMetric, csatMetric, adoptionMetric];
  }, [
    totalUsers,
    isLoadingTotalUsers,
    totalUsersError,
    totalConversations,
    isLoadingTotalConversations,
    totalConversationsError,
    prevTotalConversations,
    prevTotalConversationsError,
    isLoadingPrevTotalConversations,
    tokenUsage,
    isLoadingTokenUsage,
    tokenUsageError,
    averageLatency,
    isLoadingAverageLatency,
    averageLatencyError,
    csat,
    isLoadingCsat,
    csatError,
    adoptionRate,
    isLoadingAdoptionRate,
    adoptionRateError,
    monthlyUsersTrend,
    tokenTrendData,
    csatPoints,
  ]);

  // ---------- Dynamic Spike Alerts (RED/GREEN) ----------
  useEffect(() => {
    const alerts: AlertData[] = [];
    const now = new Date();

    // Token usage: MoM spike
    if (tokenTrendData.length >= 2) {
      const last = tokenTrendData[tokenTrendData.length - 1];
      const prev = tokenTrendData[tokenTrendData.length - 2];
      if (last && prev) {
        const delta = pctDelta(last.tokens, prev.tokens);
        if (delta >= SPIKE.TOKEN_UP_PCT) {
          alerts.push({
            id: `token-red-${now.getTime()}`,
            severity: 'warning',
            message: `Spike: Token usage up ${Math.round(delta)}% (${prev.month}→${last.month}).`,
            timestamp: now,
          });
        } else if (delta <= SPIKE.TOKEN_DOWN_PCT) {
          alerts.push({
            id: `token-green-${now.getTime()}`,
            severity: 'success',
            message: `Positive: Token usage down ${Math.abs(Math.round(delta))}% (${prev.month}→${last.month}).`,
            timestamp: now,
          });
        }
      }
    }

    // Users: MoM spike
    if (monthlyUsersTrend.length >= 2) {
      const lastU = monthlyUsersTrend[monthlyUsersTrend.length - 1];
      const prevU = monthlyUsersTrend[monthlyUsersTrend.length - 2];
      if (lastU && prevU) {
        const uDelta = pctDelta(lastU.users, prevU.users);
        if (uDelta >= SPIKE.USERS_UP_PCT) {
          alerts.push({
            id: `users-green-${now.getTime()}`,
            severity: 'success',
            message: `Positive: Monthly users up ${Math.round(uDelta)}% (${prevU.month}→${lastU.month}).`,
            timestamp: now,
          });
        }
      }
    }

    // Conversations: current vs previous period spike
    if (totalConversations !== null && prevTotalConversations !== null) {
      const cDelta = pctDelta(totalConversations, prevTotalConversations);

      if (cDelta >= SPIKE.CONV_UP_PCT) {
        alerts.push({
          id: `conv-red-${now.getTime()}`,
          severity: 'warning',
          message: `Spike: Conversations up ${Math.round(cDelta)}% vs previous period.`,
          timestamp: now,
        });
      } else if (cDelta <= SPIKE.CONV_DOWN_PCT) {
        alerts.push({
          id: `conv-green-${now.getTime()}`,
          severity: 'success',
          message: `Positive: Conversations down ${Math.abs(Math.round(cDelta))}% vs previous period.`,
          timestamp: now,
        });
      }
    }

    // Latency: threshold breach (red)
    if (averageLatency !== null && averageLatency > SPIKE.LATENCY_RED_MS) {
      alerts.push({
        id: `latency-red-${now.getTime()}`,
        severity: 'warning',
        message: `Performance: Avg latency ${Math.round(averageLatency)} ms (> ${SPIKE.LATENCY_RED_MS} ms).`,
        timestamp: now,
      });
    }

    // CSAT: level and improvement
    if (csat !== null && csat < SPIKE.CSAT_RED) {
      alerts.push({
        id: `csat-red-${now.getTime()}`,
        severity: 'warning',
        message: `CSAT low at ${csat.toFixed(1)} (below ${SPIKE.CSAT_RED}).`,
        timestamp: now,
      });
    }
    if (csatPoints.length >= 2) {
      const lastC = csatPoints[csatPoints.length - 1]?.score;
      const prevC = csatPoints[csatPoints.length - 2]?.score;
      if (lastC !== undefined && prevC !== undefined) {
        const deltaC = lastC - prevC;
        if (deltaC >= SPIKE.CSAT_GREEN_DELTA) {
          alerts.push({
            id: `csat-green-${now.getTime()}`,
            severity: 'success',
            message: `CSAT improved by ${deltaC.toFixed(1)} points.`,
            timestamp: now,
          });
        }
      }
    }

    // Adoption: thresholds (green/red)
    if (adoptionRate !== null) {
      if (adoptionRate >= SPIKE.ADOPTION_GREEN) {
        alerts.push({
          id: `adoption-green-${now.getTime()}`,
          severity: 'success',
          message: `Adoption strong at ${adoptionRate.toFixed(1)}%.`,
          timestamp: now,
        });
      } else if (adoptionRate <= SPIKE.ADOPTION_RED) {
        alerts.push({
          id: `adoption-red-${now.getTime()}`,
          severity: 'warning',
          message: `Adoption weak at ${adoptionRate.toFixed(1)}%.`,
          timestamp: now,
        });
      }
    }

    setSpikeAlerts(alerts);
  }, [
    tokenTrendData,
    monthlyUsersTrend,
    totalConversations,
    prevTotalConversations,
    averageLatency,
    csat,
    csatPoints,
    adoptionRate,
  ]);

  // ---------- Initial recommendation notification ----------
  useEffect(() => {
    showNotification({
      type: 'success',
      message: 'Recommended model Llama 3.0 based on CSAT and Latency performance',
      onCancel: () => {
        // Cancel notification
      },
      autoHideDuration: null,
    });
  }, [showNotification]);

  return (
    <div className={styles.serviceMonitoring}>
      <PageHeader
        title="Application performance and monitoring dashboard"
        subtitle="Monitoring"
        icon={<MonitorIcon />}
      />

      {/* Filters Row */}
      <div className={styles.filtersRow}>
        <Dropdown
          label="Choose an application"
          options={applicationOptions}
          value={selectedApplication}
          onChange={setSelectedApplication}
          placeholder="Select application"
        />
        <DateRangePicker label="Select date" value={dateRange} onChange={setDateRange} />
      </div>

      {/* Metrics Grid */}
      <div className={styles.metricsGrid}>
        {metrics.map((metric) => (
          <MetricCard
            key={metric.id}
            icon={metric.icon}
            iconBgColor={metric.iconBgColor}
            iconColor={metric.iconColor}
            value={metric.value}
            label={metric.label}
            trend={metric.trend}
          />
        ))}
      </div>

      {/* Charts */}
      <div
        className={styles.chartsGrid}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gridAutoRows: 'minmax(320px, auto)',
          gap: '24px',
          alignItems: 'stretch',
        }}
      >
        <ChartCard
          title="CSAT Score (Date-wise)"
          subtitle={
            csatChartError ? 'Unable to load CSAT data' : 'Daily % of positive feedback (Up votes)'
          }
        >
          {csatChartLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Loading CSAT data...</div>
          ) : csatChartError ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>
              {csatChartError}
            </div>
          ) : (
            <CSATBarChart data={csatPoints} />
          )}
        </ChartCard>

        <ChartCard
          title="User usage trend"
          subtitle={
            monthlyUsersError
              ? 'Unable to load user data'
              : '#Consider optimizing prompts or fine-tuning.'
          }
        >
          {isLoadingMonthlyUsers ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Loading user trend data...</div>
          ) : monthlyUsersError ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>
              {monthlyUsersError}
            </div>
          ) : (
            <UserTrendAreaChart data={monthlyUsersTrend} />
          )}
        </ChartCard>

        <ChartCard
          title="Token usage trend"
          subtitle={tokenUsageError ? 'Unable to load token data' : '#Consider optimizing prompts.'}
        >
          {isLoadingTokenUsage ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Loading token trend data...</div>
          ) : tokenUsageError ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>
              {tokenUsageError}
            </div>
          ) : (
            <div style={{ padding: '1rem', boxSizing: 'border-box', height: '100%' }}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: 260,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1, height: '100%', minHeight: 0 }}>
                  <div style={{ width: '100%', height: '100%' }}>
                    <TokenTrendLineChart data={tokenTrendData} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Text‑to‑SQL Schema Alignment Scorecard"
          subtitle={
            correctnessSplitError
              ? 'Unable to load accuracy data'
              : '#Consider optimizing "Talk to Data".'
          }
        >
          {isLoadingCorrectnessSplit ? (
            <div className="chart-loading">Loading...</div>
          ) : correctnessSplitError ? (
            <div className="chart-error">{correctnessSplitError}</div>
          ) : correctnessSplitPoints.length ? (
            <GenericChart
              data={correctnessSplitPoints}
              chartType="bar"
              xKey="month"
              yKeys={['INVALID', 'VALID']}
              colors={['#e74c3c', '#27ae60']}
              yAxisLabel="Avg Correctness Score (%)"
              yAxisFormatter={(v: number) => `${Number(v).toFixed(0)}%`}
              barStacks={undefined}
            />
          ) : (
            <div className="chart-empty">No accuracy data available for selected range.</div>
          )}
        </ChartCard>
      </div>

      <div className={styles.alertsGrid}>
        {spikeAlerts.length === 0 ? (
          <AlertBanner severity="info" message="No spikes detected for the selected period." />
        ) : (
          spikeAlerts.map((alert) => (
            <AlertBanner key={alert.id} severity={alert.severity} message={alert.message} />
          ))
        )}
      </div>
    </div>
  );
};

export default Monitoring;
