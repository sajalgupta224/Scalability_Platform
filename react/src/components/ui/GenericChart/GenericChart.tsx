import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type { BarStackConfig } from '../../../types/charts.types';

interface GenericChartProps {
  data: any[];
  xKey: string;
  yKeys: string[];
  chartType?: 'line' | 'stackedLine' | 'bar' | 'area';
  stacked?: boolean;
  height?: number;
  colors?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  axisLabelStyle?: {
    fontSize?: number;
    fill?: string;
    fontWeight?: number | string;
  };
  hideLegend?: boolean;
  chartProps?: any;
  showDataLabels?: boolean;
  customTooltip?: React.ComponentType<any>;
  yAxisFormatter?: (value: number) => string;
  showPoints?: boolean;
  pointRadius?: number;
  barStacks?: BarStackConfig[];
  barGap?: number;
  barCategoryGap?: string | number;
  hideGrid?: boolean;
  xAxisInterval?: number | 'preserveStart' | 'preserveEnd' | 'preserveStartEnd';
  xAxisAngle?: number;
}

const GenericChart: React.FC<GenericChartProps> = ({
  data,
  xKey,
  yKeys,
  chartType = 'line',
  stacked = false,
  height = 400,
  colors = [],
  xAxisLabel = '',
  yAxisLabel = '',
  axisLabelStyle = { fontSize: 14, fill: '#333', fontWeight: 'bold' },
  hideLegend = false,
  chartProps,
  showDataLabels = false,
  customTooltip,
  yAxisFormatter,
  showPoints = true,
  pointRadius = 4,
  barStacks,
  barGap = 20,
  barCategoryGap = '22%',
  hideGrid = false,
  xAxisInterval,
  xAxisAngle,
}) => {
  const getColor = (index: number) =>
    colors[index] || `#${Math.floor(Math.random() * 16777215).toString(16)}`;

  const CustomizedAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const words = payload.value.split(' ');
    const maxCharsPerLine = 10;

    const lines = [];
    let currentLine = '';

    words.forEach((word: any) => {
      if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);

    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} textAnchor="middle" fill="#666" fontSize={12}>
          {lines.map((line, index) => (
            <tspan x={0} dy={index === 0 ? 16 : 14} key={index}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  };

  const CustomLabel = (props: any) => {
    const { x, y, width, value } = props;
    const displayValue = yAxisFormatter ? yAxisFormatter(value) : value;
    return (
      <text
        x={x + width / 2}
        y={y - 5}
        fill="#666"
        textAnchor="middle"
        fontSize={12}
        fontWeight="500"
      >
        {displayValue}
      </text>
    );
  };

  // Bar Chart
  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
          barGap={barGap}
          barCategoryGap={barCategoryGap}
          {...chartProps}
        >
          {!hideGrid && <CartesianGrid stroke="#eee" strokeDasharray="3 3" />}
          <XAxis
            dataKey={xKey}
            tick={xAxisAngle != null ? { fontSize: 12 } : <CustomizedAxisTick />}
            interval={xAxisInterval ?? 'preserveStartEnd'}
            angle={xAxisAngle ?? 0}
            textAnchor={xAxisAngle != null && xAxisAngle < 0 ? 'end' : 'middle'}
            height={xAxisAngle != null ? 80 : 60}
            label={
              xAxisLabel
                ? {
                    value: xAxisLabel,
                    position: 'insideBottom',
                    offset: -30,
                    ...axisLabelStyle,
                  }
                : undefined
            }
          />
          <YAxis
            domain={[0, 'auto']}
            tick={{ fontSize: 12 }}
            tickFormatter={yAxisFormatter}
            label={
              yAxisLabel
                ? {
                    value: yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    dy: 5, // move label down a bit so it aligns vertically inside the chart
                    ...axisLabelStyle,
                  }
                : undefined
            }
          />
          <Tooltip content={customTooltip as any} />
          {!hideLegend && <Legend verticalAlign="bottom" height={1} />}

          {barStacks
            ? barStacks.map((bar) => (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  stackId={bar.stackId}
                  fill={bar.fill}
                  name={bar.name}
                  label={showDataLabels ? <CustomLabel /> : undefined}
                />
              ))
            : 
              yKeys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={getColor(idx)}
                  {...(stacked ? { stackId: 'a' } : {})}
                  barSize={30}
                  label={showDataLabels ? <CustomLabel /> : undefined}
                />
              ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Area Chart
  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
          {...chartProps}
        >
          <defs>
            {yKeys.map((key, idx) => (
              <linearGradient
                key={`gradient-${key}`}
                id={`gradient-${key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={getColor(idx)} stopOpacity={0.8} />
                <stop offset="95%" stopColor={getColor(idx)} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>
          {!hideGrid && <CartesianGrid stroke="#eee" />}
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            interval={xAxisInterval ?? 'preserveStartEnd'}
            angle={xAxisAngle ?? 0}
            textAnchor={xAxisAngle != null && xAxisAngle < 0 ? 'end' : 'middle'}
            height={xAxisAngle != null ? 80 : 40}
            label={
              xAxisLabel
                ? {
                    value: xAxisLabel,
                    position: 'insideBottom',
                    offset: -10,
                    ...axisLabelStyle,
                  }
                : undefined
            }
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={yAxisFormatter}
            label={
              yAxisLabel
                ? {
                    value: yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    dy: 5,
                    ...axisLabelStyle,
                  }
                : undefined
            }
          />
          <Tooltip content={customTooltip as any} />
          {!hideLegend && <Legend verticalAlign="bottom" height={36} />}
          {yKeys.map((key, idx) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={getColor(idx)}
              fill={`url(#gradient-${key})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Line Chart (default)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 20, right: 20, bottom: 40, left: 40 }} {...chartProps}>
        {!hideGrid && <CartesianGrid stroke="#eee" strokeDasharray="3 3" />}
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12 }}
          interval={xAxisInterval ?? 'preserveStartEnd'}
          angle={xAxisAngle ?? -45}
          textAnchor="end"
          height={80}
          label={
            xAxisLabel
              ? {
                  value: xAxisLabel,
                  position: 'insideBottom',
                  offset: -10,
                  ...axisLabelStyle,
                }
              : undefined
          }
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={yAxisFormatter}
          label={
            yAxisLabel
              ? {
                  value: yAxisLabel,
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  dy: 5,
                  ...axisLabelStyle,
                }
              : undefined
          }
        />
        <Tooltip content={customTooltip as any} />
        {!hideLegend && <Legend verticalAlign="bottom" height={36} />}
        {yKeys.map((key, idx) => (
          <Line
            key={key}
            type={chartType === 'stackedLine' ? 'basis' : 'monotone'}
            dataKey={key}
            stroke={getColor(idx)}
            strokeWidth={2}
            dot={showPoints ? { r: pointRadius } : false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default GenericChart;
