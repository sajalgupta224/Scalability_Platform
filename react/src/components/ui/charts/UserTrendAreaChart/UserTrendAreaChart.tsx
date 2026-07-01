import React from 'react';
import GenericChart from '../../GenericChart/GenericChart';
import type { UserTrendDataPoint } from '../../../../types/monitoring.types';

interface UserTrendAreaChartProps {
  data: UserTrendDataPoint[];
  height?: number;
}

const UserTrendAreaChart: React.FC<UserTrendAreaChartProps> = ({
  data,
  height = 300,
}) => {
  return (
    <GenericChart
      data={data}
      xKey="month"
      yKeys={['users']}
      chartType="area"
      height={height}
      colors={['#3B82F6']}
      xAxisLabel=""
      yAxisLabel="Active users"
      hideLegend={true}
      chartProps={{
        margin: { top: 20, right: 20, bottom: 40, left: 40 },
      }}
    />
  );
};

export default UserTrendAreaChart;