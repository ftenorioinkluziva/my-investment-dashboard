// components/benchmark/BenchmarkChart.jsx - Versão corrigida
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BenchmarkChart = ({ timeSeriesData, benchmarks, yAxisConfig, isDark, showPortfolio }) => {
  if (timeSeriesData.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center border border-dashed border-gray-300 rounded-lg">
        <p className="text-gray-500">Não há dados disponíveis para exibir no gráfico</p>
      </div>
    );
  }

  // Função customizada para formatação da legenda
  const renderLegend = (props) => {
    const { payload } = props;
    
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-2">
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center">
            <div
              className="w-4 h-4 mr-2"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={timeSeriesData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={isDark ? '#374151' : '#e5e7eb'}
          />
          <XAxis 
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={60}
            interval="preserveEnd"
            stroke={isDark ? '#9CA3AF' : '#4B5563'}
          />
          <YAxis 
            label={{ 
              value: 'Retorno Acumulado (%)', 
              angle: -90, 
              position: 'insideLeft',
              style: { fill: isDark ? '#9CA3AF' : '#4B5563' }
            }}
            domain={[yAxisConfig.min, yAxisConfig.max]}
            ticks={yAxisConfig.ticks}
            tickFormatter={(value) => `${value.toFixed(1)}%`}
            stroke={isDark ? '#9CA3AF' : '#4B5563'}
          />
          <Tooltip 
            formatter={(value, name, props) => {
              // Obter o nome real do benchmark pelo ID
              const benchmark = benchmarks.find(b => b.id === name);
              return [`${Number(value).toFixed(2)}%`, benchmark ? benchmark.name : name];
            }}
            labelFormatter={(label) => `Período: ${label}`}
            contentStyle={{
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
              color: isDark ? '#FFFFFF' : '#000000'
            }}
          />
          <Legend 
            content={renderLegend}
            wrapperStyle={{
              paddingTop: '10px',
              color: isDark ? '#FFFFFF' : '#000000'
            }}
          />
          {benchmarks.map((benchmark) => {
            // Pular o portfólio se estiver oculto
            if (benchmark.isPortfolio && !showPortfolio) {
              return null;
            }
            
            // Verificar se temos dados para este benchmark
            const hasData = timeSeriesData.some(dataPoint => 
              dataPoint[benchmark.id] !== undefined && dataPoint[benchmark.id] !== null
            );
            
            if (!hasData) {
              return null;
            }
            
            return (
              <Line
                key={benchmark.id}
                type="monotone"
                dataKey={benchmark.id}
                name={benchmark.name}
                stroke={benchmark.color}
                dot={false}
                strokeWidth={benchmark.isPortfolio ? 3 : 2}
                activeDot={{ r: 6 }}
                isAnimationActive={true}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BenchmarkChart;