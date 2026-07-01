import React from 'react';
import GenericChart from '../../GenericChart/GenericChart';
import type { TokenTrendDataPoint } from '../../../../types/monitoring.types';
import { formatNumber } from '../../../../utils/chartFormatters';

interface TokenTrendLineChartProps {
  data: TokenTrendDataPoint[];
  height?: number;
}

const TokenTrendLineChart: React.FC<TokenTrendLineChartProps> = ({ data, height = 360 }) => {
  return (
    <GenericChart
      data={data}
      xKey="month"
      yKeys={['tokens']}
      chartType="line"
      height={height}
      colors={['#8B5CF6']}
      xAxisLabel=""
      yAxisLabel="Token used"
      hideLegend={true}
      showPoints={true}
      pointRadius={4}
      yAxisFormatter={formatNumber}
      chartProps={{
        margin: { top: 10, right: 20, bottom: 40, left: 40 },
      }}
    />
  );
};

export default TokenTrendLineChart;
