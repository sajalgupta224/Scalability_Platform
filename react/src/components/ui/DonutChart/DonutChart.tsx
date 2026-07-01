
import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import styles from './DonutChart.module.scss';
import type { DonutChartData } from '../../../types/charts.types';

interface DonutChartProps {
  data: DonutChartData[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}

const DonutChart: React.FC<DonutChartProps> = ({
  data,
  height = 300,
  innerRadius = 70,
  outerRadius = 110,
}) => {
  // ✅ Define color palette
  const COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'];

  // ✅ Add colors and total for percentage calculation
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  const dataWithColors = data.map((entry, index) => ({
    ...entry,
    color: COLORS[index % COLORS.length],
    total: totalValue,
  }));

  // ✅ Custom label to show percentage
  const renderCustomLabel = (entry: any) => {
    const percent = ((entry.value / entry.total) * 100).toFixed(0);
    return `${percent}%`;
  };

  // ✅ Custom legend
  const renderLegend = () => (
    <div className={styles.legendContainer}>
      {dataWithColors.map((entry, index) => (
        <div key={`legend-${index}`} className={styles.legendItem}>
          <span
            className={styles.legendColor}
            style={{ backgroundColor: entry.color }}
          />
          <span className={styles.legendText}>{entry.name}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.donutChartContainer}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={dataWithColors}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            label={renderCustomLabel}
            labelLine={false}
          >
            {dataWithColors.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value} errors`, 'Count']}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {renderLegend()}
    </div>
  );
};

export default DonutChart;
