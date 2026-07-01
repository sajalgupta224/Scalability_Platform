import { forwardRef } from 'react';
import GenericChart from '../GenericChart/GenericChart';
import styles from './DataVisualizationTab.module.scss';

interface TooltipField {
  field: string;
  title?: string;
  type?: string;
}

interface DataVisualizationTabProps {
  chartConfig?: {
    data?: Array<Record<string, any>>;
    xKey?: string;
    yKey?: string;
    xType?: string;
    yType?: string;
    xTitle?: string;
    yTitle?: string;
    tooltipFields?: TooltipField[];
    chartType?: string;
    title?: string;
    width?: number;
    height?: number;
  };
}

const DataVisualizationTab = forwardRef<HTMLDivElement, DataVisualizationTabProps>(({ chartConfig }, ref) => {
  if (!chartConfig || !chartConfig.data || chartConfig.data.length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.noData}>No data to visualize</p>
      </div>
    );
  }

  const { data, xKey, yKey, xTitle, yTitle, tooltipFields, chartType = 'bar', title } = chartConfig;
  const columns = data[0] ? Object.keys(data[0]) : [];
  const xDataKey = xKey || columns[0] || 'x';
  const yDataKey = yKey || columns[1] || 'y';
  const xAxisLabel = xTitle || xDataKey;
  const yAxisLabel = yTitle || yDataKey;

  const chartHeight = chartConfig.height || 400;

  // Create custom tooltip component if tooltip fields are provided
  const CustomTooltip = tooltipFields && tooltipFields.length > 0 ? ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '10px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {tooltipFields.map((field, index) => {
            const value = data[field.field];
            const label = field.title || field.field;
            return (
              <div key={index} style={{ marginBottom: index < tooltipFields.length - 1 ? '4px' : '0' }}>
                <strong>{label}:</strong> {value}
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  } : undefined;

  // Ensure x-axis values are properly formatted as strings
  const processedData = data.map(item => {
    const xValue = item[xDataKey];
    return {
      ...item,
      [xDataKey]: typeof xValue === 'string' ? xValue : String(xValue)
    };
  });

  return (
    <div className={styles.container} ref={ref}>
      {title && <h3 className={styles.title}>{title}</h3>}
      <div className={styles.chartWrapper}>
        <GenericChart
          data={processedData}
          xKey={xDataKey}
          yKeys={[yDataKey]}
          chartType={chartType as 'line' | 'bar' | 'area'}
          height={chartHeight}
          colors={['#F4A300']}
          xAxisLabel={xAxisLabel}
          yAxisLabel={yAxisLabel}
          hideLegend={true}
          showPoints={chartType === 'line'}
          pointRadius={4}
          customTooltip={CustomTooltip}
        />
      </div>
    </div>
  );
});

DataVisualizationTab.displayName = 'DataVisualizationTab';

export default DataVisualizationTab;
