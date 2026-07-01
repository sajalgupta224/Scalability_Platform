import React, { useState, useEffect, useMemo, useRef } from 'react';
import styles from './ErrorMonitoring.module.scss';
import PageHeader from '../../components/ui/PageHeader/PageHeader';
import Dropdown from '../../components/ui/Dropdown/Dropdown';
import ChartCard from '../../components/ui/ChartCard/ChartCard';
import DonutChart from '../../components/ui/DonutChart/DonutChart';
import GenericChart from '../../components/ui/GenericChart/GenericChart';
import ErrorLogTable from '../../components/ui/ErrorLogTable/ErrorLogTable';
import MonitorIcon from '@mui/icons-material/Monitor';
import axios from 'axios';
import DateRangePicker from '../../components/ui/DateRangePicker/DateRangePicker';
import type { DateRange } from '../../types/ui.types';
import dayjs from 'dayjs';
import {
  TablePagination,
  Box,
  Snackbar,
  Alert,
  FormControlLabel,
  Switch,
  Tooltip,
} from '@mui/material';
import type { ErrorLogEntry } from '../../types';

const url = import.meta.env.VITE_API_BASE_URL as string;

// Key to persist the toggle
const NOTIFY_TOGGLE_KEY = 'notifyToggle';

const ErrorMonitoring: React.FC = () => {
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [eventTypeOptions, setEventTypeOptions] = useState<{ label: string; value: string }[]>([
    { label: 'All', value: 'all' },
  ]);

  type ErrorLog = Record<string, unknown>;
  type AppErrorStat = { name: string; value: number; [key: string]: unknown };
  type ErrorTrendDataPoint = Record<string, unknown>;
  type BarStack = { dataKey: string; stackId: string; fill: string; name: string };

  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [appErrorStats, setAppErrorStats] = useState<AppErrorStat[]>([]);

  const [errorTrendData, setErrorTrendData] = useState<ErrorTrendDataPoint[]>([]);
  const [trendKeys, setTrendKeys] = useState<string[]>([]);
  const [barStacks, setBarStacks] = useState<BarStack[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(dayjs().subtract(365, 'day').format('YYYY-MM-DD')),
    to: new Date(dayjs().format('YYYY-MM-DD')),
  });

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // --- Sliding toggle (persisted)
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(false);

  // --- Track initial load to avoid auto-trigger on mount
  const didInitRef = useRef(false);
  const prevNotifyRef = useRef<boolean>(false);

  // --- Snackbar state
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('Email notification triggered successfully.');
  const [notifySeverity, setNotifySeverity] = useState<'success' | 'error' | 'info' | 'warning'>(
    'success'
  );

  const SMALL_PERCENT_THRESHOLD = 1; // hide slices smaller than 1%

  const toTitleCase = (s: string) =>
    s
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .split(' ')
      .map((w) => (w && w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
      .join(' ');

  const parseNumeric = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed.endsWith('%')) return parseFloat(trimmed.replace('%', '')) || 0;
      const num = parseFloat(trimmed);
      return Number.isFinite(num) ? num : 0;
    }
    return 0;
  };

  const computeTotal = (
    items: AppErrorStat[]
  ): { totalValue: number; totalCount: number; hasPercentage: boolean } => {
    let totalValue = 0;
    let totalCount = 0;
    let hasPercentage = true;

    for (const it of items) {
      if (it?.percentage === undefined && it?.Percentage === undefined) {
        hasPercentage = false;
      }
      totalValue += parseNumeric((it as any)?.value ?? (it as any)?.Value);
      totalCount += parseNumeric((it as any)?.count ?? (it as any)?.Count);
    }
    return { totalValue, totalCount, hasPercentage };
  };

  const getItemPercent = (
    item: AppErrorStat,
    totals: { totalValue: number; totalCount: number; hasPercentage: boolean }
  ): number => {
    const pctField = (item as any)?.percentage ?? (item as any)?.Percentage;
    const valField = (item as any)?.value ?? (item as any)?.Value;
    const cntField = (item as any)?.count ?? (item as any)?.Count;

    const val = parseNumeric(valField);
    const cnt = parseNumeric(cntField);

    if (totals.totalValue > 0) return (val / totals.totalValue) * 100;
    if (totals.totalCount > 0) return (cnt / totals.totalCount) * 100;
    if (pctField !== undefined) return parseNumeric(pctField);
    return 0;
  };

  const filterSmallSlices = (items: AppErrorStat[], thresholdPercent: number): AppErrorStat[] => {
    if (!Array.isArray(items) || items.length === 0) return [];
    const totals = computeTotal(items);
    return items.filter((it) => getItemPercent(it, totals) >= thresholdPercent);
  };

  const loadEventTypes = async () => {
    try {
      const resp = await axios.get(`${url}/api/event_types`);
      const list = Array.isArray(resp.data?.data) ? resp.data.data : [];
      const options = [{ label: 'All', value: 'all' }].concat(
        list.map((et: string) => ({ label: et, value: et }))
      );
      setEventTypeOptions(options);
    } catch {
      setEventTypeOptions([{ label: 'All', value: 'all' }]);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {};
      if (selectedEventType && selectedEventType !== 'all') {
        params.eventType = selectedEventType;
      }
      if (dateRange?.from && dateRange?.to) {
        params.startDate = dateRange.from.toISOString().split('T')[0]!;
        params.endDate = dateRange.to.toISOString().split('T')[0]!;
      }

      const response = await axios.get(`${url}/api/error-dashboard`, { params });
      const { errorLogs: logs, appStats, errorTrends } = response.data || {};

      setErrorLogs(Array.isArray(logs) ? logs : []);

      const rawAppStats: AppErrorStat[] = Array.isArray(appStats) ? appStats : [];
      const filteredAppStats = filterSmallSlices(rawAppStats, SMALL_PERCENT_THRESHOLD);
      setAppErrorStats(filteredAppStats);

      let data: ErrorTrendDataPoint[] = [];
      let series: string[] = [];

      if (errorTrends && Array.isArray(errorTrends.data) && Array.isArray(errorTrends.seriesKeys)) {
        data = errorTrends.data;
        series = errorTrends.seriesKeys;
      } else if (Array.isArray(errorTrends)) {
        data = errorTrends;
        const keys = new Set<string>();
        data.forEach((row) => {
          Object.keys(row).forEach((k) => {
            if (k !== 'month') keys.add(k);
          });
        });
        series = Array.from(keys);
      }

      setErrorTrendData(data);
      setTrendKeys(series);

      const palette = [
        '#1f77b4',
        '#ff7f0e',
        '#2ca02c',
        '#d62728',
        '#9467bd',
        '#8c564b',
        '#e377c2',
        '#7f7f7f',
        '#bcbd22',
        '#17becf',
      ];
      const stacks = series.map((k, idx) => ({
        dataKey: k,
        stackId: 'events',
        fill: palette[idx % palette.length]!,
        name: toTitleCase(k),
      }));
      setBarStacks(stacks);

      setPage(0);
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
      setError('Failed to load dashboard data.');
      setErrorTrendData([]);
      setTrendKeys([]);
      setBarStacks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEventTypes();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedEventType, dateRange]);

  // --- Load persisted toggle on mount (do NOT trigger email here)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIFY_TOGGLE_KEY);
      const initial = stored === 'true';
      setNotifyEnabled(initial);
      prevNotifyRef.current = initial;
    } catch {
      // ignore storage errors
    } finally {
      didInitRef.current = true;
    }
  }, []);

  // --- Persist toggle whenever it changes & trigger email only on OFF -> ON transitions
  useEffect(() => {
    // Persist the current state
    try {
      localStorage.setItem(NOTIFY_TOGGLE_KEY, String(notifyEnabled));
    } catch {
      // ignore storage errors
    }

    // Skip on initial mount
    if (!didInitRef.current) return;

    const was = prevNotifyRef.current;
    const now = notifyEnabled;

    // Update previous value for next diff
    prevNotifyRef.current = now;

    // Trigger only when user turns it ON (false -> true)
    if (was === false && now === true) {
      const notify = async () => {
        try {
          const resp = await axios.post(`${url}/api/notify-failed-audits`);
          const ok = resp?.data?.ok === true;
          const msg =
            resp?.data?.message || (ok ? 'Email notification triggered successfully.' : 'Done.');

          setNotifySeverity(ok ? 'success' : 'info');
          setNotifyMessage(msg);
          setNotifyOpen(true);
        } catch (err: any) {
          const msg =
            err?.response?.data?.error || err?.message || 'Failed to trigger email notification.';
          setNotifySeverity('error');
          setNotifyMessage(msg);
          setNotifyOpen(true);
          console.error('notify-failed-audits error:', err);
        }
      };
      notify();
    }
    // When turning OFF: do nothing (no API call).
  }, [notifyEnabled]);

  const handleNotifyClose = (_?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setNotifyOpen(false);
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseInt(event.target.value, 10);
    setRowsPerPage(next);
    setPage(0);
  };

  const pagedErrorLogs = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return errorLogs.slice(start, end) as ErrorLog[];
  }, [errorLogs, page, rowsPerPage]);

  return (
    <div className={styles.errorMonitoring}>
      {/* Header row with right-aligned sliding toggle */}
      <div className={styles.headerRow}>
        <PageHeader title="Error Logging" subtitle="Monitoring" icon={<MonitorIcon />} />
        <div className={styles.headerRight}>
          <Tooltip
            title={
              notifyEnabled
                ? 'Switch is ON. It will remain ON until you turn it OFF.'
                : 'Slide ON to trigger email...'
            }
          >
            <FormControlLabel
              className={styles.notifyToggle}
              control={
                <Switch
                  color="primary"
                  checked={notifyEnabled}
                  onChange={(e) => setNotifyEnabled(e.target.checked)}
                />
              }
              label="Trigger Email"
              labelPlacement="start"
            />
          </Tooltip>
        </div>
      </div>

      <div className={styles.filtersRow}>
        <Dropdown
          label="Event type"
          options={eventTypeOptions}
          value={selectedEventType}
          onChange={setSelectedEventType}
          placeholder="All"
        />
        <DateRangePicker label="Select date" value={dateRange} onChange={setDateRange} />
      </div>

      {loading && <p>Loading dashboard data...</p>}
      {error && <p className={styles.errorText}>{error}</p>}

      {!loading && !error && (
        <div className={styles.chartsGrid}>
          <ChartCard title="App wise error statistics" subtitle="#Based on all conversations">
            <DonutChart data={appErrorStats} height={300} />
          </ChartCard>

          <ChartCard
            title="Error trends by event type"
            subtitle="#Consider optimizing prompt or finetuning"
          >
            <GenericChart
              data={errorTrendData}
              xKey="month"
              yKeys={trendKeys}
              chartType="bar"
              height={350}
              barStacks={barStacks}
              barGap={20}
              barCategoryGap="22%"
              hideLegend={false}
            />
          </ChartCard>
        </div>
      )}

      {!loading && !error && (
        <>
          <ErrorLogTable data={pagedErrorLogs as unknown as ErrorLogEntry[]} />
          <Box className={styles.paginationRow}>
            <TablePagination
              component="div"
              count={errorLogs.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </Box>
        </>
      )}

      {/* Snackbar alert for email notification */}
      <Snackbar
        open={notifyOpen}
        autoHideDuration={4000}
        onClose={handleNotifyClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleNotifyClose} severity={notifySeverity} variant="filled" sx={{ width: '100%' }}>
          {notifyMessage}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default ErrorMonitoring;