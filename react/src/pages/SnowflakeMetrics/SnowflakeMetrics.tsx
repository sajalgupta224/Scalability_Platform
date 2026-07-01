import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./SnowflakeMetrics.module.scss";
import PageHeader from "../../components/ui/PageHeader/PageHeader";
import MetricCard from "../../components/ui/MetricCard/MetricCard";
import ChartCard from "../../components/ui/ChartCard/ChartCard";
import GenericChart from "../../components/ui/GenericChart/GenericChart";
import Dropdown from "../../components/ui/Dropdown/Dropdown";

import MonetizationOnOutlined from "@mui/icons-material/MonetizationOnOutlined";
import QueryStatsOutlined from "@mui/icons-material/QueryStatsOutlined";
import StorageOutlined from "@mui/icons-material/StorageOutlined";
import WarehouseOutlined from "@mui/icons-material/WarehouseOutlined";

import type {
  MetricsTabKey,
  WarehouseCreditRow,
  DailyMeteringRow,
  CortexAIRow,
  CortexAgentRow,
  QueryPerformanceRow,
  QueryTrendRow,
  CostliestQueryRow,
  DatabaseStorageRow,
  TableStorageRow,
  WarehouseLoadRow,
  WarehouseEventRow,
  WarehouseStatusRow,
  UserActivityRow,
  SfMetricsResponse,
  QueryRecommendation,
} from "../../types/snowflakeMetrics.types";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

const TABS: { key: MetricsTabKey; label: string }[] = [
  { key: "credits", label: "Credit & Cost" },
  { key: "queries", label: "Query Performance" },
  { key: "storage", label: "Storage" },
  { key: "warehouse", label: "Warehouse" },
];

const DAYS_OPTIONS = [
  { label: "7 Days", value: "7" },
  { label: "14 Days", value: "14" },
  { label: "30 Days", value: "30" },
  { label: "60 Days", value: "60" },
  { label: "90 Days", value: "90" },
];

const CHART_COLORS = ["#1976d2", "#43a047", "#fb8c00", "#e53935", "#8e24aa", "#00acc1"];

/* ─── Which filters apply to which tabs ─── */
const TAB_NEEDS_WAREHOUSE: Record<MetricsTabKey, boolean> = {
  credits: true,
  queries: true,
  storage: false,
  warehouse: true,
};

const TAB_NEEDS_DATABASE: Record<MetricsTabKey, boolean> = {
  credits: false,
  queries: true,
  storage: true,
  warehouse: false,
};

/* ─── Helpers ─── */
async function fetchMetric<T>(
  endpoint: string,
  days: number,
  warehouse?: string,
  database?: string,
): Promise<T[]> {
  const params = new URLSearchParams({ days: String(days) });
  if (warehouse) params.set("warehouse", warehouse);
  if (database) params.set("database", database);
  const res = await fetch(`${BASE}/api/sf-metrics/${endpoint}?${params}`);
  const json: SfMetricsResponse<T[]> = await res.json();
  if (!json.success) throw new Error(json.message || "Request failed");
  return json.data || [];
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return "0";
  return Number(n).toFixed(decimals);
}

function fmtK(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

async function fetchCostliest(
  days: number,
  sort: "asc" | "desc",
  user: string,
  limit = 50,
  warehouse?: string,
  database?: string,
): Promise<CostliestQueryRow[]> {
  const params = new URLSearchParams({
    days: String(days),
    sort,
    limit: String(limit),
  });
  if (user) params.set("user", user);
  if (warehouse) params.set("warehouse", warehouse);
  if (database) params.set("database", database);
  const res = await fetch(`${BASE}/api/sf-metrics/costliest-queries?${params}`);
  const json: SfMetricsResponse<CostliestQueryRow[]> = await res.json();
  if (!json.success) throw new Error(json.message || "Request failed");
  return json.data || [];
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
const SnowflakeMetrics: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MetricsTabKey>("credits");
  const [days, setDays] = useState("7");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ─── Filter state ─── */
  const [warehouse, setWarehouse] = useState("W_IN_CAPG_AI_SCALABILITY_SOL_XS");
  const [database, setDatabase] = useState("D_IN_CAPG_POC_AI_SCALABILITY");
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: string }[]>([]);
  const [databaseOptions, setDatabaseOptions] = useState<{ label: string; value: string }[]>([]);

  /* ─── State per tab ─── */
  // Credits
  const [whCredit, setWhCredit] = useState<WarehouseCreditRow[]>([]);
  const [dailyMeter, setDailyMeter] = useState<DailyMeteringRow[]>([]);
  const [cortexAI, setCortexAI] = useState<CortexAIRow[]>([]);
  const [cortexAgent, setCortexAgent] = useState<CortexAgentRow[]>([]);
  // Queries
  const [queryPerf, setQueryPerf] = useState<QueryPerformanceRow[]>([]);
  const [queryTrend, setQueryTrend] = useState<QueryTrendRow[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivityRow[]>([]);
  const [costliestQueries, setCostliestQueries] = useState<CostliestQueryRow[]>([]);
  const [costSort, setCostSort] = useState<"desc" | "asc">("desc");
  const [costUserFilter, setCostUserFilter] = useState("");

  // Refs to read latest sort/filter in loadTab without adding to its dependency array
  const costSortRef = useRef(costSort);
  const costUserRef = useRef(costUserFilter);
  costSortRef.current = costSort;
  costUserRef.current = costUserFilter;

  // Storage
  const [dbStorage, setDbStorage] = useState<DatabaseStorageRow[]>([]);
  const [tblStorage, setTblStorage] = useState<TableStorageRow[]>([]);
  // Warehouse
  const [whLoad, setWhLoad] = useState<WarehouseLoadRow[]>([]);
  const [whEvents, setWhEvents] = useState<WarehouseEventRow[]>([]);
  const [whStatus, setWhStatus] = useState<WarehouseStatusRow[]>([]);

  // Query Optimization Recommendations
  const [recommendations, setRecommendations] = useState<QueryRecommendation[]>([]);
  const [recSummary, setRecSummary] = useState("");
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [recQueriesAnalyzed, setRecQueriesAnalyzed] = useState(0);

  // Client-side tab data cache: skip refetch if tab was loaded recently with same filters
  const TAB_CACHE_TTL = 2 * 60 * 1000; // 2 min
  const tabCache = useRef<Record<string, { ts: number; key: string }>>({});

  /* ─── Load filter options on mount ─── */
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [whRes, dbRes] = await Promise.all([
          fetch(`${BASE}/api/sf-metrics/warehouses`).then((r) => r.json()),
          fetch(`${BASE}/api/sf-metrics/databases`).then((r) => r.json()),
        ]);
        if (whRes.success && whRes.data) {
          setWarehouseOptions([
            { label: "All Warehouses", value: "" },
            ...whRes.data.map((r: { WAREHOUSE_NAME: string }) => ({
              label: r.WAREHOUSE_NAME,
              value: r.WAREHOUSE_NAME,
            })),
          ]);
        }
        if (dbRes.success && dbRes.data) {
          setDatabaseOptions([
            { label: "All Databases", value: "" },
            ...dbRes.data.map((r: { DATABASE_NAME: string }) => ({
              label: r.DATABASE_NAME,
              value: r.DATABASE_NAME,
            })),
          ]);
        }
      } catch (e) {
        console.error("[load-filter-options]", e);
      }
    };
    loadOptions();
  }, []);

  /* ─── Fetch logic ─── */
  const loadTab = useCallback(
    async (tab: MetricsTabKey) => {
      // Client-side cache: skip refetch if this tab was loaded with the same filters recently
      const cacheKey = `${tab}:${days}:${warehouse}:${database}`;
      const cached = tabCache.current[tab];
      if (cached && cached.key === cacheKey && Date.now() - cached.ts < TAB_CACHE_TTL) {
        return; // data is still in React state, no need to refetch
      }

      setLoading(true);
      setError(null);
      const d = Number(days);
      const wh = warehouse || undefined;
      const db = database || undefined;
      try {
        switch (tab) {
          case "credits": {
            const [a, b, c, e] = await Promise.all([
              fetchMetric<WarehouseCreditRow>("warehouse-credit-usage", d, wh),
              fetchMetric<DailyMeteringRow>("daily-metering", d),
              fetchMetric<CortexAIRow>("cortex-ai-credits", d),
              fetchMetric<CortexAgentRow>("cortex-agent-credits", d, undefined, db),
            ]);
            setWhCredit(a); setDailyMeter(b); setCortexAI(c); setCortexAgent(e);
            break;
          }
          case "queries": {
            const [a, b, e, f] = await Promise.all([
              fetchMetric<QueryPerformanceRow>("query-performance", d, wh, db),
              fetchMetric<QueryTrendRow>("query-trend", d, wh, db),
              fetchMetric<UserActivityRow>("user-activity", d, wh, db),
              fetchCostliest(d, costSortRef.current, costUserRef.current, 50, wh, db),
            ]);
            setQueryPerf(a); setQueryTrend(b); setUserActivity(e);
            setCostliestQueries(f);
            break;
          }
          case "storage": {
            const [a, b] = await Promise.all([
              fetchMetric<DatabaseStorageRow>("database-storage", d, undefined, db),
              fetchMetric<TableStorageRow>("table-storage", d, undefined, db),
            ]);
            setDbStorage(a); setTblStorage(b);
            break;
          }
          case "warehouse": {
            const [a, b, c] = await Promise.all([
              fetchMetric<WarehouseLoadRow>("warehouse-load", d, wh),
              fetchMetric<WarehouseEventRow>("warehouse-events", d, wh),
              fetchMetric<WarehouseStatusRow>("warehouse-status", d),
            ]);
            setWhLoad(a); setWhEvents(b); setWhStatus(c);
            break;
          }
        }
        // Mark tab as cached with current filters
        tabCache.current[tab] = { ts: Date.now(), key: cacheKey };
      } catch (e: any) {
        setError(e?.message || "Failed to load metrics");
      } finally {
        setLoading(false);
      }
    },
    [days, warehouse, database],
  );

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, loadTab]);

  /* Reload just costliest queries when sort/filter changes (without full tab reload) */
  const reloadCostliest = useCallback(
    async (sort: "asc" | "desc", user: string) => {
      try {
        const wh = warehouse || undefined;
        const db = database || undefined;
        const data = await fetchCostliest(Number(days), sort, user, 50, wh, db);
        setCostliestQueries(data);
      } catch (e: any) {
        console.error("[costliest-queries]", e?.message);
      }
    },
    [days, warehouse, database],
  );

  /* Unique users from costliest queries for filter dropdown */
  const costUserOptions = [
    { label: "All Users", value: "" },
    ...Array.from(new Set(costliestQueries.map((r) => r.USER_NAME).filter(Boolean))).map(
      (u) => ({ label: u, value: u }),
    ),
  ];

  /* ─── Fetch Query Optimization Recommendations ─── */
  const fetchRecommendations = useCallback(async () => {
    setRecLoading(true);
    setRecError(null);
    try {
      const res = await fetch(`${BASE}/api/sf-metrics/query-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(days), database: database || "" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to get recommendations");
      setRecommendations(json.data?.recommendations || []);
      setRecSummary(json.data?.summary || "");
      setRecQueriesAnalyzed(json.data?.queriesAnalyzed || 0);
    } catch (e: any) {
      setRecError(e?.message || "Failed to fetch recommendations");
    } finally {
      setRecLoading(false);
    }
  }, [days, database]);

  /* ─── Aggregation helpers ─── */
  const totalCredits = whCredit.reduce((s, r) => s + (r.CREDITS_USED ?? 0), 0);
  const totalBilled = dailyMeter.reduce((s, r) => s + (r.CREDITS_BILLED ?? 0), 0);
  const perf = queryPerf[0];

  /* ═══════════════════════════════════════════════════════════════
     Tab Renderers
     ═══════════════════════════════════════════════════════════════ */

  const renderCredits = () => {
    // Aggregate daily metering by date for chart
    const dailyByDate = Object.values(
      dailyMeter.reduce<Record<string, { date: string; used: number; billed: number }>>((m, r) => {
        const d = r.USAGE_DATE;
        if (!m[d]) m[d] = { date: d, used: 0, billed: 0 };
        m[d].used += r.CREDITS_USED ?? 0;
        m[d].billed += r.CREDITS_BILLED ?? 0;
        return m;
      }, {}),
    ).sort((a, b) => a.date.localeCompare(b.date));

    // Warehouse credit by date
    const whByDate = Object.values(
      whCredit.reduce<Record<string, { date: string; credits: number; cloud: number }>>((m, r) => {
        const d = r.USAGE_DATE;
        if (!m[d]) m[d] = { date: d, credits: 0, cloud: 0 };
        m[d].credits += r.CREDITS_USED ?? 0;
        m[d].cloud += r.CREDITS_CLOUD ?? 0;
        return m;
      }, {}),
    ).sort((a, b) => a.date.localeCompare(b.date));

    return (
      <>
        <div className={styles.metricsGrid}>
          <MetricCard
            icon={<MonetizationOnOutlined />}
            iconBgColor="#e3f2fd"
            iconColor="#1976d2"
            value={fmt(totalCredits, 1)}
            label="Total Warehouse Credits"
          />
          <MetricCard
            icon={<MonetizationOnOutlined />}
            iconBgColor="#e8f5e9"
            iconColor="#43a047"
            value={fmt(totalBilled, 1)}
            label="Total Billed Credits"
          />
          <MetricCard
            icon={<MonetizationOnOutlined />}
            iconBgColor="#fff3e0"
            iconColor="#fb8c00"
            value={fmt(cortexAI.reduce((s, r) => s + (r.CREDITS ?? 0), 0), 2)}
            label="Cortex AI Credits"
          />
          <MetricCard
            icon={<MonetizationOnOutlined />}
            iconBgColor="#fce4ec"
            iconColor="#e53935"
            value={fmt(cortexAgent.reduce((s, r) => s + (r.TOKEN_CREDITS ?? 0), 0), 2)}
            label="Cortex Agent Credits"
          />
        </div>
        <div className={styles.chartsGrid}>
          <ChartCard title="Warehouse Credits Over Time" subtitle="Daily compute + cloud credits">
            <GenericChart
              data={whByDate}
              xKey="date"
              yKeys={["credits", "cloud"]}
              chartType="area"
              colors={[CHART_COLORS[0], CHART_COLORS[1]]}
              height={300}
              xAxisAngle={-45}
            />
          </ChartCard>
          <ChartCard title="Daily Metering" subtitle="Used vs Billed credits">
            <GenericChart
              data={dailyByDate}
              xKey="date"
              yKeys={["used", "billed"]}
              chartType="line"
              colors={[CHART_COLORS[2], CHART_COLORS[4]]}
              height={300}
              xAxisAngle={-45}
            />
          </ChartCard>
        </div>
        {cortexAI.length > 0 && (
          <div className={styles.chartsGridFull}>
            <ChartCard title="Cortex AI Function Usage" subtitle="Credits by function & model">
              {renderTable(
                ["Function", "Model", "Date", "Credits"],
                cortexAI.slice(0, 50).map((r) => [
                  r.FUNCTION_NAME, r.MODEL_NAME ?? "-", r.USAGE_DATE,
                  fmt(r.CREDITS, 4),
                ]),
              )}
            </ChartCard>
          </div>
        )}
        {cortexAgent.length > 0 && (
          <div className={styles.chartsGridFull}>
            <ChartCard title="Cortex Agent Usage" subtitle="Agent activity for this database">
              {renderTable(
                ["Agent", "User", "Date", "Tokens", "Token Credits"],
                cortexAgent.slice(0, 50).map((r) => [
                  r.AGENT_NAME, r.USER_NAME ?? "-", r.USAGE_DATE,
                  fmtK(r.TOKENS), fmt(r.TOKEN_CREDITS, 4),
                ]),
              )}
            </ChartCard>
          </div>
        )}
      </>
    );
  };

  const renderQueries = () => {
    const trend = [...queryTrend].sort((a, b) => a.QUERY_DATE.localeCompare(b.QUERY_DATE));
    return (
      <>
        {perf && (
          <div className={styles.metricsGrid}>
            <MetricCard
              icon={<QueryStatsOutlined />}
              iconBgColor="#e3f2fd"
              iconColor="#1976d2"
              value={fmtK(perf.TOTAL_QUERIES)}
              label="Total Queries"
            />
            <MetricCard
              icon={<QueryStatsOutlined />}
              iconBgColor="#e8f5e9"
              iconColor="#43a047"
              value={`${fmt(perf.AVG_DURATION_SEC)}s`}
              label="Avg Duration"
            />
            <MetricCard
              icon={<QueryStatsOutlined />}
              iconBgColor="#fff3e0"
              iconColor="#fb8c00"
              value={`${fmt(perf.P95_DURATION_SEC)}s`}
              label="P95 Duration"
            />
            <MetricCard
              icon={<QueryStatsOutlined />}
              iconBgColor="#fce4ec"
              iconColor="#e53935"
              value={fmtK(perf.FAILED_QUERIES)}
              label="Failed Queries"
            />
          </div>
        )}
        <div className={styles.chartsGrid}>
          <ChartCard title="Query Volume Trend" subtitle="Queries per day">
            <GenericChart
              data={trend}
              xKey="QUERY_DATE"
              yKeys={["TOTAL_QUERIES"]}
              chartType="bar"
              colors={[CHART_COLORS[0]]}
              height={300}
              xAxisAngle={-45}
            />
          </ChartCard>
          <ChartCard title="Avg Duration & Failed" subtitle="Seconds / count per day">
            <GenericChart
              data={trend}
              xKey="QUERY_DATE"
              yKeys={["AVG_DURATION_SEC", "FAILED_QUERIES"]}
              chartType="line"
              colors={[CHART_COLORS[1], CHART_COLORS[3]]}
              height={300}
              xAxisAngle={-45}
            />
          </ChartCard>
        </div>
        {userActivity.length > 0 && (
          <div className={styles.chartsGridFull}>
            <ChartCard title="Top Users by Activity" subtitle="Query count, credits & failures per user">
              {renderTable(
                ["User", "Queries", "Cloud Credits", "Avg Duration (ms)", "Failed"],
                userActivity.slice(0, 20).map((r) => [
                  r.USER_NAME,
                  fmtK(r.QUERY_COUNT),
                  fmt(r.TOTAL_CLOUD_CREDITS, 4),
                  fmt(r.AVG_ELAPSED_MS, 0),
                  String(r.FAILED_QUERIES ?? 0),
                ]),
              )}
            </ChartCard>
          </div>
        )}

        {/* Costliest Queries */}
        <div className={styles.chartsGridFull}>
          <ChartCard
            title="Costliest Queries"
            subtitle="Individual queries ranked by cloud service credits"
          >
            <div className={styles.filtersRow} style={{ marginBottom: 12 }}>
              <Dropdown
                label="Sort by Cost"
                options={[
                  { label: "Highest First", value: "desc" },
                  { label: "Lowest First", value: "asc" },
                ]}
                value={costSort}
                onChange={(v) => {
                  const s = v as "asc" | "desc";
                  setCostSort(s);
                  reloadCostliest(s, costUserFilter);
                }}
              />
              <Dropdown
                label="Filter by User"
                options={costUserOptions}
                value={costUserFilter}
                onChange={(v) => {
                  setCostUserFilter(v);
                  reloadCostliest(costSort, v);
                }}
              />
            </div>
            {renderTable(
              ["Query ID", "Query Text", "User", "Warehouse", "Type", "Start Time", "Duration (s)", "Credits", "Status"],
              costliestQueries.map((r) => [
                r.QUERY_ID?.slice(0, 12) + "...",
                (r.QUERY_TEXT || "").slice(0, 80) + (r.QUERY_TEXT?.length > 80 ? "..." : ""),
                r.USER_NAME ?? "-",
                r.WAREHOUSE_NAME ?? "-",
                r.QUERY_TYPE ?? "-",
                r.START_TIME ?? "-",
                fmt(r.DURATION_SEC, 2),
                fmt(r.CLOUD_CREDITS, 6),
                r.EXECUTION_STATUS ?? "-",
              ]),
            )}
          </ChartCard>
        </div>

        {/* Query Optimization Recommendations */}
        <div className={styles.chartsGridFull}>
          <ChartCard title="Query Optimization Recommendations" subtitle="AI-powered analysis of your costliest queries">
            <div className={styles.recommendationsPanel}>
              {!recLoading && recommendations.length === 0 && !recError && (
                <div className={styles.recPrompt}>
                  <p>Analyze your top costliest queries and get actionable recommendations to reduce cost and improve efficiency.</p>
                  <button className={styles.recButton} onClick={fetchRecommendations}>
                    Get Optimization Recommendations
                  </button>
                </div>
              )}
              {recLoading && (
                <div className={styles.recLoading}>
                  <div className={styles.spinner} />
                  <p>Analyzing your top queries with AI... This may take a moment.</p>
                </div>
              )}
              {recError && (
                <div className={styles.recError}>
                  <p>{recError}</p>
                  <button className={styles.recButton} onClick={fetchRecommendations}>Retry</button>
                </div>
              )}
              {!recLoading && recommendations.length > 0 && (
                <>
                  <div className={styles.recSummary}>
                    <strong>Summary:</strong> {recSummary}
                    <span className={styles.recMeta}> ({recQueriesAnalyzed} queries analyzed)</span>
                  </div>
                  <div className={styles.recGrid}>
                    {recommendations.map((rec, i) => (
                      <div key={i} className={`${styles.recCard} ${styles[`recImpact_${rec.impact}`]}`}>
                        <div className={styles.recCardHeader}>
                          <span className={styles.recCategory}>{rec.category}</span>
                          <span className={`${styles.recImpactBadge} ${styles[`badge_${rec.impact}`]}`}>
                            {rec.impact}
                          </span>
                        </div>
                        <h4 className={styles.recTitle}>{rec.title}</h4>
                        <p className={styles.recDescription}>{rec.description}</p>
                      </div>
                    ))}
                  </div>
                  <button className={styles.recRefreshButton} onClick={fetchRecommendations}>
                    Refresh Recommendations
                  </button>
                </>
              )}
            </div>
          </ChartCard>
        </div>
      </>
    );
  };

  const renderStorage = () => {
    const dbByDate = [...dbStorage].sort((a, b) => a.USAGE_DATE.localeCompare(b.USAGE_DATE));
    // Latest date aggregation for metric cards
    const latestDate = dbByDate.length > 0 ? dbByDate[dbByDate.length - 1].USAGE_DATE : null;
    const latestRows = latestDate ? dbByDate.filter((r) => r.USAGE_DATE === latestDate) : [];
    const totalDbGB = latestRows.reduce((s, r) => s + (r.AVG_DB_GB ?? 0), 0);
    const totalFailsafeGB = latestRows.reduce((s, r) => s + (r.AVG_FAILSAFE_GB ?? 0), 0);

    return (
      <>
        <div className={styles.metricsGrid}>
          <MetricCard
            icon={<StorageOutlined />}
            iconBgColor="#e3f2fd"
            iconColor="#1976d2"
            value={`${fmt(totalDbGB, 2)} GB`}
            label="Total Database Size"
          />
          <MetricCard
            icon={<StorageOutlined />}
            iconBgColor="#fce4ec"
            iconColor="#e53935"
            value={`${fmt(totalFailsafeGB, 2)} GB`}
            label="Total Failsafe Storage"
          />
          <MetricCard
            icon={<StorageOutlined />}
            iconBgColor="#e8f5e9"
            iconColor="#43a047"
            value={fmtK(tblStorage.length)}
            label="Tables Tracked"
          />
        </div>
        <div className={styles.chartsGrid}>
          <ChartCard title="Database Storage" subtitle="GB over time">
            <GenericChart
              data={dbByDate}
              xKey="USAGE_DATE"
              yKeys={["AVG_DB_GB", "AVG_FAILSAFE_GB"]}
              chartType="area"
              colors={[CHART_COLORS[0], CHART_COLORS[3]]}
              height={300}
              xAxisAngle={-45}
            />
          </ChartCard>
        </div>
        {tblStorage.length > 0 && (
          <div className={styles.chartsGridFull}>
            <ChartCard title="Top Tables by Storage" subtitle="Active MB (top 50)">
              <GenericChart
                data={tblStorage.slice(0, 20)}
                xKey="TABLE_NAME"
                yKeys={["ACTIVE_MB", "TIME_TRAVEL_MB", "FAILSAFE_MB"]}
                chartType="bar"
                stacked
                colors={[CHART_COLORS[0], CHART_COLORS[2], CHART_COLORS[3]]}
                height={350}
                xAxisAngle={-45}
              />
            </ChartCard>
          </div>
        )}
      </>
    );
  };

  const renderWarehouse = () => {
    const load = [...whLoad].sort((a, b) => a.TIME_SLOT.localeCompare(b.TIME_SLOT)).slice(-100);
    // Count events by type
    const eventCounts = Object.values(
      whEvents.reduce<Record<string, { event: string; count: number }>>((m, r) => {
        const e = r.EVENT_NAME ?? "UNKNOWN";
        if (!m[e]) m[e] = { event: e, count: 0 };
        m[e].count += 1;
        return m;
      }, {}),
    );

    // Warehouse status aggregations (SHOW WAREHOUSES returns lowercase keys)
    const totalWarehouses = whStatus.length;
    const activeCount = whStatus.filter((r) => r.state === "STARTED").length;
    const suspendedCount = whStatus.filter((r) => r.state === "SUSPENDED").length;
    const totalRunning = whStatus.reduce((s, r) => s + (r.running ?? 0), 0);

    return (
      <>
        <div className={styles.metricsGrid}>
          <MetricCard
            icon={<WarehouseOutlined />}
            iconBgColor="#e3f2fd"
            iconColor="#1976d2"
            value={String(totalWarehouses)}
            label="Total Warehouses"
          />
          <MetricCard
            icon={<WarehouseOutlined />}
            iconBgColor="#e8f5e9"
            iconColor="#43a047"
            value={String(activeCount)}
            label="Active (Started)"
          />
          <MetricCard
            icon={<WarehouseOutlined />}
            iconBgColor="#fff3e0"
            iconColor="#fb8c00"
            value={String(suspendedCount)}
            label="Suspended"
          />
          <MetricCard
            icon={<WarehouseOutlined />}
            iconBgColor="#fce4ec"
            iconColor="#e53935"
            value={String(totalRunning)}
            label="Running Queries"
          />
        </div>
        {whStatus.length > 0 && (
          <div className={styles.chartsGridFull}>
            <ChartCard title="Warehouse Status" subtitle="Live status from SHOW WAREHOUSES">
              {renderTable(
                ["Name", "State", "Size", "Running", "Queued", "Auto Suspend (s)", "Auto Resume", "Clusters", "Scaling Policy"],
                whStatus.map((r) => [
                  r.name,
                  r.state,
                  r.size,
                  String(r.running ?? 0),
                  String(r.queued ?? 0),
                  String(r.auto_suspend ?? "-"),
                  r.auto_resume ?? "-",
                  `${r.started_clusters ?? 0}/${r.min_cluster_count ?? 0}-${r.max_cluster_count ?? 0}`,
                  r.scaling_policy ?? "-",
                ]),
              )}
            </ChartCard>
          </div>
        )}
        <div className={styles.chartsGrid}>
          <ChartCard title="Warehouse Load" subtitle="Running / Queued / Blocked">
            <GenericChart
              data={load}
              xKey="TIME_SLOT"
              yKeys={["AVG_RUNNING", "AVG_QUEUED_LOAD", "AVG_BLOCKED"]}
              chartType="area"
              colors={[CHART_COLORS[0], CHART_COLORS[2], CHART_COLORS[3]]}
              height={300}
              xAxisAngle={-45}
            />
          </ChartCard>
          <ChartCard title="Warehouse Events" subtitle="Suspend / Resume / Resize counts">
            <GenericChart
              data={eventCounts}
              xKey="event"
              yKeys={["count"]}
              chartType="bar"
              colors={[CHART_COLORS[1]]}
              height={300}
              xAxisInterval={0}
            />
          </ChartCard>
        </div>
        {whEvents.length > 0 && (
          <div className={styles.chartsGridFull}>
            <ChartCard title="Recent Warehouse Events" subtitle="Latest events">
              {renderTable(
                ["Warehouse", "Time", "Event", "Reason", "Cluster"],
                whEvents.slice(0, 50).map((r) => [
                  r.WAREHOUSE_NAME, r.EVENT_TIME, r.EVENT_NAME,
                  r.EVENT_REASON ?? "-", String(r.CLUSTER_NUMBER ?? "-"),
                ]),
              )}
            </ChartCard>
          </div>
        )}
      </>
    );
  };


  /* ─── Reusable table renderer ─── */
  const renderTable = (headers: string[], rows: string[][]) => (
    <div className={styles.tableWrapper}>
      <table>
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className={styles.emptyState}>No data available</td></tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  /* ─── Tab content map ─── */
  const tabContent: Record<MetricsTabKey, () => React.ReactNode> = {
    credits: renderCredits,
    queries: renderQueries,
    storage: renderStorage,
    warehouse: renderWarehouse,
  };

  /* ═══ Render ═══ */
  return (
    <div className={styles.snowflakeMetrics}>
      <PageHeader
        title="Account Insights & Performance Metrics"
        subtitle="Real-Time Usage Tracking & Performance Insights"
      />

      {/* Tab Bar */}
      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filtersRow}>
        <Dropdown
          label="Time Range"
          options={DAYS_OPTIONS}
          value={days}
          onChange={(v) => setDays(v)}
        />
        {TAB_NEEDS_WAREHOUSE[activeTab] && warehouseOptions.length > 0 && (
          <Dropdown
            label="Warehouse"
            options={warehouseOptions}
            value={warehouse}
            onChange={(v) => setWarehouse(v)}
          />
        )}
        {TAB_NEEDS_DATABASE[activeTab] && databaseOptions.length > 0 && (
          <Dropdown
            label="Database"
            options={databaseOptions}
            value={database}
            onChange={(v) => setDatabase(v)}
          />
        )}
      </div>

      {/* Content */}
      {loading && <div className={styles.loading}>Loading metrics...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!loading && !error && tabContent[activeTab]()}
    </div>
  );
};

export default SnowflakeMetrics;
