
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Dropdown from '../../components/ui/Dropdown/Dropdown';
import DateRangePicker from '../../components/ui/DateRangePicker/DateRangePicker';
import GenericChart from '../../components/ui/GenericChart/GenericChart';
import DonutChart from '../../components/ui/DonutChart/DonutChart';
import type { DateRange } from '../../types/ui.types';
import styles from './CostCalculator.module.scss';

const url = import.meta.env.VITE_API_BASE_URL as string;

type TrendPoint = { bucket: string; credits: number; costUsd: number };
type DistributionItem = { serviceName: string; creditsTotal: number; costUsdTotal: number };

const ALL_VALUE = 'ALL';
const TOP_N = 7; // how many slices to show before grouping into "Others"

// Currency conversion rates (base: USD)
const CURRENCY_RATES = {
  USD: { rate: 1, symbol: '$', label: '$ US Dollar' },
  EUR: { rate: 0.92, symbol: '€', label: '€ Euro' },
  GBP: { rate: 0.79, symbol: '£', label: '£ British Pound' },
  INR: { rate: 83.12, symbol: '₹', label: '₹ Indian Rupee' },
  JPY: { rate: 149.5, symbol: '¥', label: '¥ Japanese Yen' },
};

type CurrencyCode = keyof typeof CURRENCY_RATES;

const CostCalculator: React.FC = () => {
  const [services, setServices] = useState<string[]>([]);
  const [serviceName, setServiceName] = useState<string>(ALL_VALUE);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');

  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(dayjs().subtract(7, 'day').format('YYYY-MM-DD')),
    to: new Date(dayjs().format('YYYY-MM-DD')),
  });

  const [totalCost, setTotalCost] = useState<number>(0);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [distribution, setDistribution] = useState<DistributionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // NEW: alert state (non-blocking UX)
  const [showRangeAlert, setShowRangeAlert] = useState<boolean>(false);

  // Currency conversion helper
  const convertCurrency = useCallback(
    (amountInUsd: number): number => {
      return amountInUsd * CURRENCY_RATES[currency].rate;
    },
    [currency]
  );

  const getCurrencySymbol = (): string => {
    return CURRENCY_RATES[currency].symbol;
  };

  // Services list (owner-filtered on server); prepend ALL option
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${url}/api/services`);
        const data: unknown = await r.json();
        let list: string[] = [];
        if (Array.isArray(data)) {
          list = data as string[];
        } else if (
          typeof data === 'object' &&
          data !== null &&
          'services' in data &&
          Array.isArray((data as any).services)
        ) {
          list = (data as any).services as string[];
        }
        const withAll = [ALL_VALUE, ...list];
        setServices(withAll);
        if (serviceName === '') {
          setServiceName(ALL_VALUE);
        }
      } catch (err) {
        console.error('Failed to load services', err);
        setServices([ALL_VALUE]);
        setServiceName(ALL_VALUE);
      }
    })();
  }, [serviceName]);

  // NEW: Watch date range and toggle alert if > 15 days (inclusive)
  useEffect(() => {
    const from = dayjs(dateRange.from);
    const to = dayjs(dateRange.to);
    const days = to.diff(from, 'day') + 1; // inclusive count
    setShowRangeAlert(days > 15);
  }, [dateRange]);

  // Load trend/total/distribution when filters change
  useEffect(() => {
    if (serviceName === '') {
      return;
    }

    setLoading(true);

    const startDate = dayjs(dateRange.from).format('YYYY-MM-DD');
    const endDate = dayjs(dateRange.to).format('YYYY-MM-DD');

    const qsTrend = new URLSearchParams({
      serviceName,
      startDate,
      endDate,
      viewBy: 'daily',
    }).toString();
    const qsTotal = new URLSearchParams({ serviceName, startDate, endDate }).toString();
    const qsDist = new URLSearchParams({ startDate, endDate }).toString();

    const trendUrl = `${url}/api/spcs/cost-trend?${qsTrend}`;
    const totalUrl = `${url}/api/spcs/total-cost?${qsTotal}`;
    const distUrl = `${url}/api/spcs/distribution?${qsDist}`;

    Promise.all([
      fetch(trendUrl).then((r) => r.json() as Promise<unknown>),
      fetch(totalUrl).then((r) => r.json() as Promise<unknown>),
      fetch(distUrl).then((r) => r.json() as Promise<unknown>),
    ])
      .then(([trendRes, totalRes, distRes]) => {
        // Trend
        let trendArr: TrendPoint[] = [];
        if (Array.isArray(trendRes)) {
          trendArr = trendRes as TrendPoint[];
        } else if (
          typeof trendRes === 'object' &&
          trendRes !== null &&
          'data' in trendRes &&
          Array.isArray((trendRes as any).data)
        ) {
          trendArr = (trendRes as any).data as TrendPoint[];
        }
        setTrend(trendArr);

        // Total
        let totalCostValue = 0;
        if (
          typeof totalRes === 'object' &&
          totalRes !== null &&
          'costUsdTotal' in totalRes &&
          typeof (totalRes as any).costUsdTotal === 'number'
        ) {
          totalCostValue = (totalRes as any).costUsdTotal;
        }
        setTotalCost(totalCostValue);

        // Distribution
        let distArr: DistributionItem[] = [];
        if (Array.isArray(distRes)) {
          distArr = distRes as DistributionItem[];
        } else if (
          typeof distRes === 'object' &&
          distRes !== null &&
          'data' in distRes &&
          Array.isArray((distRes as any).data)
        ) {
          distArr = (distRes as any).data as DistributionItem[];
        }
        setDistribution(distArr);
      })
      .catch((err) => {
        console.error('Cost API error - using dummy data:', err);
        // Use dummy data when API is down
        setTrend([]);
        setTotalCost(0);
        setDistribution([]);
      })
      .finally(() => setLoading(false));
  }, [serviceName, dateRange]);

  // Top-N + Others grouping for donut - formatted for DonutChart component
  const donutData = useMemo(() => {
    if (distribution.length === 0) {
      return [];
    }
    const sorted = [...distribution].sort((a, b) => b.costUsdTotal - a.costUsdTotal);
    const top = sorted.slice(0, TOP_N).map((d) => ({ name: d.serviceName, value: d.costUsdTotal }));
    if (sorted.length > TOP_N) {
      const othersSum = sorted.slice(TOP_N).reduce((acc, d) => acc + d.costUsdTotal, 0);
      top.push({ name: 'Others', value: othersSum });
    }
    return top;
  }, [distribution]);

  // Line chart data formatted for GenericChart with currency conversion
  const lineChartData = useMemo(() => {
    return trend.map((point) => ({
      // Normalize to date-only for display
      date: dayjs(point.bucket).format('YYYY-MM-DD'),
      cost: convertCurrency(point.costUsd),
    }));
  }, [trend, convertCurrency]);

  // Donut chart data with currency conversion
  const donutDataConverted = useMemo(() => {
    return donutData.map((item) => ({
      ...item,
      value: convertCurrency(item.value),
    }));
  }, [donutData, convertCurrency]);

  // Dropdown options
  const applicationOptions = services.map((s) => ({
    label: s === ALL_VALUE ? 'All Applications' : s,
    value: s,
  }));

  const currencyOptions = Object.entries(CURRENCY_RATES).map(([code, info]) => ({
    label: info.label,
    value: code,
  }));

  return (
    <div className={styles.costCalculator}>
      <h1 className={styles.title}>Cost Monitoring</h1>

      {/* Filters row - 3 columns */}
      <div className={styles.filtersRow}>
        <div className={styles.filterItem}>
          <Dropdown
            label="Select application name"
            options={applicationOptions}
            value={serviceName}
            onChange={setServiceName}
          />
        </div>

        <div className={styles.filterItem}>
          <Dropdown
            label="Select currency"
            options={currencyOptions}
            value={currency}
            onChange={(value) => setCurrency(value as CurrencyCode)}
          />
        </div>

        <div className={styles.filterItem}>
          <DateRangePicker label="Select date range" value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* NEW: inline alert banner */}
      {showRangeAlert && (
        <div className={styles.alertBanner}>
          For better visibility, please select a date range of 15 days or less.
        </div>
      )}

      {/* Content row - Total Cost + Charts */}
      <div className={styles.contentRow}>
        {/* Left side - Total Cost Card + Donut Chart */}
        <div className={styles.leftColumn}>
          {/* Total Cost Card with Icon */}
          <div className={styles.costCard}>
            <div className={styles.costCardContent}>
              <div className={styles.iconWrapper}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"
                    fill="#4caf50"
                  />
                </svg>
              </div>
              <div className={styles.costInfo}>
                <div className={styles.costAmount}>
                  {getCurrencySymbol()} {convertCurrency(totalCost).toFixed(2)}
                </div>
                <div className={styles.costLabel}>
                  Total Estimated cost in {getCurrencySymbol()}
                </div>
              </div>
            </div>
          </div>

          {/* Donut Chart Card */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Cost distribution per application</h3>
              {/* <p className={styles.chartSubtitle}>#Helping text</p> */}
            </div>
            <div className={styles.chartContent}>
              {donutData.length === 0 ? (
                <div className={styles.noData}>
                  <p>No cost distribution data for the selected date range.</p>
                </div>
              ) : (
                <DonutChart
                  data={donutDataConverted}
                  height={280}
                  innerRadius={60}
                  outerRadius={90}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right side - Line Chart */}
        <div className={styles.rightColumn}>
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Cost distribution per application</h3>
              {/* <p className={styles.chartSubtitle}>#Helping text</p> */}
            </div>
            <div className={styles.lineChartContent}>
              {lineChartData.length === 0 ? (
                <div className={styles.noData}>
                  <p>No trend data for the selected filters.</p>
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%' }}>
                  <GenericChart
                    data={lineChartData}
                    xKey="date"
                    yKeys={['cost']}
                    chartType="line"
                    height={500}
                    colors={['#4e8cff']}
                    xAxisLabel="Date"
                    yAxisLabel={`Total Cost (${getCurrencySymbol()})`}
                    showPoints={false}
                    hideLegend={true}
                    yAxisFormatter={(value: number) => `${getCurrencySymbol()}${value.toFixed(0)}`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading && <div className={styles.loading}>Loading…</div>}
    </div>
  );
};

export default CostCalculator;
