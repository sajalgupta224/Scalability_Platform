import React from 'react';
import GenericChart from '../../GenericChart/GenericChart';
import type { CSATDataPoint } from '../../../../types/monitoring.types';

interface CSATBarChartProps {
  data: CSATDataPoint[];
  height?: number;
  yAxisLabel?: string;
}

const CSATBarChart: React.FC<CSATBarChartProps> = ({
  data,
  height = 300,
  yAxisLabel = 'CSAT (%)',
}) => {
  return (
    <GenericChart
      data={data}
      xKey="date"
      yKeys={['score']}
      chartType="bar"
      height={height}
      colors={['#F59E0B']}
      xAxisLabel="Month"
      yAxisLabel={yAxisLabel}
      hideLegend={true}
      showDataLabels={true}
      yAxisFormatter={(value) => `${(value ).toFixed(0)}%`}
      chartProps={{
        margin: { top: 20, right: 20, bottom: 40, left: 40 },
      }}
    />
  );
};

export default CSATBarChart;
