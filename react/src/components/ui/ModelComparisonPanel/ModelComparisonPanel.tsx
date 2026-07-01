import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Divider } from '@mui/material';
import ModelMetricsCard from '../ModelMetricsCard/ModelMetricsCard';
import GenericChart from '../GenericChart/GenericChart';
import Loader from '../../common/Loader/Loader';
import styles from './ModelComparisonPanel.module.scss';
import type { ModelComparisonData, ModelMetrics } from '../../../types/models.types';

interface ModelComparisonPanelProps {
  data: ModelComparisonData[];
  isLoading?: boolean;
  /**
   * Example rows shape:
   * [
   *   { name: 'Answer relevance', 'Llama 3.0': 0.7, 'Gemini 2.5 Flash': 0.55 },
   *   { name: 'Context relevance', 'Llama 3.0': 0.72, 'Gemini 2.5 Flash': 0.75 },
   * ]
   */
  metricVsScoreData?: Array<Record<string, number | string>>;
  // New optional props supplied by Experimentation when using /api/mc/all-metrics
  csatScores?: any[];
  totalConversations?: number | null;
  recommendedModel?: string | null;
}

const ModelComparisonPanel: React.FC<ModelComparisonPanelProps> = ({
  data,
  isLoading = false,
  metricVsScoreData = [],
  csatScores,
  totalConversations: totalConversationsProp,
  recommendedModel: recommendedModelProp,
}) => {
  const [activeChartTab, setActiveChartTab] = useState(0);

  // CSAT scores by model (derived from csatScores prop or data prop)
  const [csatByModel, setCsatByModel] = useState<Record<string, number>>({});

  // KPI values derived from props
  const totalConversations = totalConversationsProp ?? null;
  const successRatePercent = useMemo(() => {
    // Derive overall success rate from the recommended model or average across all models
    const safeData = Array.isArray(data) ? data : [];
    if (safeData.length === 0) return null;
    // If we have a recommended model, use its success rate
    if (recommendedModelProp) {
      const recommended = safeData.find((d) => d.modelName === recommendedModelProp);
      if (recommended?.metrics?.successRate != null) return recommended.metrics.successRate;
    }
    // Otherwise average across all models
    const rates = safeData.map((d) => d.metrics?.successRate ?? 0);
    const avg = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    return Number(avg.toFixed(2));
  }, [data, recommendedModelProp]);

  // Map incoming csatScores prop into csatByModel when it changes
  useEffect(() => {
    if (Array.isArray(csatScores) && csatScores.length > 0) {
      const map = Object.fromEntries(
        csatScores.map((r: any) => [
          String(r.model ?? r.MODEL ?? r.model_name ?? ''),
          Number(r.csat_pct ?? r.csat_score ?? r.csat_pct ?? 0),
        ])
      );
      setCsatByModel(map);
    } else if (Array.isArray(data) && data.length > 0) {
      // Fallback: derive CSAT from model_comparison data (csat_score field passed via metrics)
      const map = Object.fromEntries(
        data.map((d) => [d.modelName, d.metrics?.successRate ?? 0])
      );
      setCsatByModel(map);
    }
  }, [csatScores, data]);

  /** Recommended model = highest CSAT among the incoming `data` models */
  const computedRecommendedModelName = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    let bestName: string | undefined;
    let bestScore = -Infinity;
    for (const d of safeData) {
      const score = Number(csatByModel[d.modelName]);
      if (Number.isFinite(score) && score > bestScore) {
        bestScore = score;
        bestName = d.modelName;
      }
    }
    return bestName;
  }, [data, csatByModel]);

  const recommendedModelName = recommendedModelProp ?? computedRecommendedModelName;

  const recommendedModel = useMemo(() => {
    if (!recommendedModelName) return undefined;
    const safeData = Array.isArray(data) ? data : [];
    return safeData.find((d) => d.modelName === recommendedModelName);
  }, [data, recommendedModelName]);

  /** CSAT chart rows: one series "CSAT" across models */
  const csatChartData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    const rows: Array<Record<string, number | string>> = [];
    for (const d of safeData) {
      const score = Number(csatByModel[d.modelName] ?? 0);
      rows.push({ name: d.modelName, CSAT: score });
    }
    return rows;
  }, [data, csatByModel]);

  const csatXKey = 'name';
  const csatYKeys = ['CSAT'];

  // Axis keys for GenericChart
  const xKey = 'name';
  const yKeys = useMemo(
    () =>
      Array.from(
        new Set(
          (metricVsScoreData ?? []).flatMap((row) => Object.keys(row)).filter((k) => k !== xKey)
        )
      ),
    [metricVsScoreData]
  );

  const chartTabs: string[] = ['Metric vs Score per model', 'CSAT by model'];
  const colors: string[] = ['#F2A900', '#D38DBB', '#1E88E5', '#43A047', '#8E24AA', '#FB8C00'];

  /** Loading & empty states */
  if (isLoading) {
    return (
      <Box className={styles.loaderWrapper}>
        <Loader />
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box className={styles.emptyState}>
        <Typography variant="body2">
          Click "Model Comparison" in chat to load real-time model metrics
        </Typography>
      </Box>
    );
  }

  /** Build metrics prop for the card from API values */
  const metricsForCard: ModelMetrics = {
    ...((recommendedModel?.metrics ?? {}) as ModelMetrics),
    totalConversations: totalConversations ?? undefined,
    successRate: successRatePercent ?? undefined,
  };

  /** Render */
  return (
    <Box className={styles.panelContainer}>
      {/* === Model Metrics (only highest CSAT) === */}

      <div className={styles.modelsSection}>
        {recommendedModel ? (
          <div>
            {recommendedModel.response && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {recommendedModel.response}
              </Typography>
            )}

            <ModelMetricsCard
              modelName={recommendedModel.modelName}
              response={recommendedModel.response}
              metrics={metricsForCard}
            />
          </div>
        ) : data[0] ? (
          // Fallback: render first model if CSAT not ready
          <div>
            <div className={styles.modelHeader}>
              <Typography variant="body1" fontWeight={600} className={styles.modelName}>
                {data[0].modelName}
              </Typography>
              <Typography variant="caption" color="text.secondary" className={styles.csatValue}>
                {csatByModel[data[0].modelName] !== undefined
                  ? `CSAT: ${Number(csatByModel[data[0].modelName]).toFixed(2)}`
                  : ''}
              </Typography>
            </div>

            {data[0].response && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {data[0].response}
              </Typography>
            )}

            <ModelMetricsCard
              modelName={data[0].modelName}
              response={data[0].response}
              metrics={{
                ...(data[0].metrics as ModelMetrics),
                totalConversations: totalConversations ?? undefined,
                successRate: successRatePercent ?? undefined,
              }}
            />
          </div>
        ) : null}
      </div>

      <Divider className={styles.sectionDivider} />

      {/* === Chart Section with Tabs === */}
      <Box className={styles.chartWrapper}>
        <Typography variant="subtitle1" className={styles.sectionTitle}>
          Model comparison
        </Typography>

        {/* Tabs */}
        <Box className={styles.chartTabs}>
          {chartTabs.map((tab: string, index: number) => (
            <button
              key={`chart-tab-${index}`}
              className={`${styles.tabButton} ${activeChartTab === index ? styles.active : ''}`}
              onClick={() => setActiveChartTab(index)}
            >
              {tab}
            </button>
          ))}
        </Box>

        {/* Tab content: Metric vs Score */}
        {activeChartTab === 0 && (
          <Box className={styles.chartArea}>
            <Typography variant="subtitle2" gutterBottom>
              Metric vs Score per model
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              #Based on all the responses
            </Typography>

            <GenericChart
              data={metricVsScoreData}
              chartType="bar"
              stacked={false}
              height={420}
              colors={colors}
              xAxisLabel="Evaluation metric"
              yAxisLabel="Score"
              axisLabelStyle={{ fontSize: 13, fill: '#666', fontWeight: 500 }}
              hideLegend
              chartProps={{ barCategoryGap: '40%', barGap: 2 }}
              xKey={xKey}
              yKeys={yKeys}
            />

            {/* <Box className={styles.modelLegend}>
              <Typography variant="caption" className={styles.legendTitle}>
                Models
              </Typography>
              <Box className={styles.legendItems}>
                {yKeys.map((modelName) => (
                  <div key={`legend-${modelName}`} className={styles.legendItem}>
                    {modelName}
                  </div>
                ))}
              </Box>
            </Box> */}
          </Box>
        )}

        {/* Tab content: CSAT by model */}
        {activeChartTab === 1 && (
          <Box className={styles.chartArea}>
            <Typography variant="subtitle2" gutterBottom>
              CSAT by model
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              #Average normalized coherence × 100 (rounded to 2 decimals)
            </Typography>

            <GenericChart
              data={csatChartData}
              chartType="bar"
              stacked={false}
              height={420}
              colors={['#1E88E5']}
              xAxisLabel="Model"
              yAxisLabel="CSAT"
              axisLabelStyle={{ fontSize: 13, fill: '#666', fontWeight: 500 }}
              hideLegend
              chartProps={{ barCategoryGap: '40%', barGap: 2 }}
              xKey={csatXKey}
              yKeys={csatYKeys}
            />

            <Box className={styles.modelLegend}>
              <Typography variant="caption" className={styles.legendTitle}>
                Series
              </Typography>
              <Box className={styles.legendItems}>
                <div className={styles.legendItem}>CSAT</div>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* Footer */}

      <Box className={styles.footer}>
        <Typography variant="caption" color="text.secondary">
          Experiment conducted on : {new Date().toLocaleString()}
        </Typography>
      </Box>
    </Box>
  );
};

export default ModelComparisonPanel;
