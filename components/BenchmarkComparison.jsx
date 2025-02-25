"use client";

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Moon, Sun } from 'lucide-react';
import { fetchHistoricalData, fetchCDIData,fetchUSDData } from '../services/api';

const BenchmarkComparison = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [yAxisConfig, setYAxisConfig] = useState({ min: 0, max: 15, ticks: [] });
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const benchmarks = [
    { id: 'BOVA11', name: 'BOVA11 (Ibovespa)', color: isDark ? '#60A5FA' : '#2196F3' },
    { id: 'XFIX11', name: 'XFIX11 (IFIX)', color: isDark ? '#F87171' : '#F44336' },
    { id: 'IB5M11', name: 'IB5M11 (IMAB5+)', color: isDark ? '#34D399' : '#4CAF50' },
    { id: 'B5P211', name: 'B5P211 (IMAB5)', color: isDark ? '#FBBF24' : '#FFC107' },
    { id: 'FIXA11', name: 'FIXA11 (Pré)', color: isDark ? '#FB923C' : '#FF9800' },
    { id: 'CDI', name: 'CDI', color: isDark ? '#94A3B8' : '#607D8B' },
    { id: 'USD', name: 'USD/BRL (Dólar)', color: isDark ? '#D1D5DB' : '#333333' }
  ];

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Definir o período para busca dos dados
      const now = new Date();
      // Para 1 ano, 3 anos ou 5 anos, dependendo do selectedPeriod
      const yearsToSubtract = selectedPeriod === '1Y' ? 1 : selectedPeriod === '3Y' ? 3 : 5;
      const startDate = new Date();
      startDate.setFullYear(now.getFullYear() - yearsToSubtract);
      
      const startTimestamp = startDate.getTime();
      const endTimestamp = now.getTime();
      
      // Buscar dados dos benchmarks (exceto CDI e USD)
      const stockPromises = benchmarks
        .filter(benchmark => benchmark.id !== 'CDI' && benchmark.id !== 'USD')
        .map(async (benchmark) => {
          try {
            const data = await fetchHistoricalData(benchmark.id);
            return {
              id: benchmark.id,
              data: data.data
            };
          } catch (error) {
            console.error(`Error fetching data for ${benchmark.id}:`, error);
            return null;
          }
        });
      
      // Buscar dados do CDI
      let cdiData = null;
      try {
        const cdiResult = await fetchCDIData();
        if (cdiResult) {
          cdiData = {
            id: 'CDI',
            data: processCDIData(cdiResult, startTimestamp, endTimestamp)
          };
        }
      } catch (error) {
        console.error('Error fetching CDI data:', error);
      }
      
      // Buscar dados do Dólar
      let usdData = null;
      try {
        const usdResult = await fetchUSDData(startTimestamp, endTimestamp);
        if (usdResult && usdResult.chart && usdResult.chart.result && usdResult.chart.result.length > 0) {
          usdData = {
            id: 'USD',
            data: processUSDData(usdResult)
          };
        }
      } catch (error) {
        console.error('Error fetching USD data:', error);
      }
      
      // Combinar todos os resultados
      const stockResults = (await Promise.all(stockPromises)).filter(result => result !== null);
      const allResults = [...stockResults];
      
      if (cdiData) {
        allResults.push(cdiData);
      }
      
      if (usdData) {
        allResults.push(usdData);
      }
      
      if (allResults.length > 0) {
        const processedData = processHistoricalData(allResults);
        setTimeSeriesData(processedData);
        setYAxisConfig(calculateYAxisConfig(processedData));
      } else {
        console.error('No valid data returned from API');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função modificada para processar os dados do CDI dentro de um intervalo específico
  const processCDIData = (cdiData, startTimestamp, endTimestamp) => {
    console.log(`Processing CDI data from ${new Date(startTimestamp)} to ${new Date(endTimestamp)}`);
    
    const filteredData = cdiData.filter(item => {
      const dateParts = item.data.split('/');
      const itemDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
      const timestamp = itemDate.getTime();
      return timestamp >= startTimestamp && timestamp <= endTimestamp;
    });
    
    return filteredData.map(item => {
      const dateParts = item.data.split('/');
      const date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
      
      return {
        close: parseFloat(item.valor),
        unixTime: date.getTime()
      };
    });
  };

  const processUSDData = (yahooData) => {
    try {
      const result = yahooData.chart.result[0];
      const timestamps = result.timestamp || [];
      const closePrices = result.indicators.quote[0].close || [];
      
      // Converter timestamp para milissegundos e extrair preços de fechamento
      const processedData = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closePrices[i] !== null && closePrices[i] !== undefined) {
          processedData.push({
            close: closePrices[i],
            unixTime: timestamps[i] * 1000 // Converter de segundos para milissegundos
          });
        }
      }
      
      console.log(`Processed ${processedData.length} USD data points`);
      return processedData;
    } catch (error) {
      console.error('Error processing USD data:', error);
      return [];
    }
  };

  const processHistoricalData = (results) => {
    if (!results || results.length === 0) {
      console.warn('No data to process');
      return [];
    }
  
    // Ordenar todos os dados por data
    results.forEach(result => {
      if (result && result.data && Array.isArray(result.data)) {
        result.data.sort((a, b) => a.unixTime - b.unixTime);
      }
    });
  
    // Obter todas as datas únicas de todos os ativos
    const allDates = new Set();
    results.forEach(result => {
      if (result && result.data && Array.isArray(result.data)) {
        result.data.forEach(item => {
          if (item && item.unixTime) {
            allDates.add(item.unixTime);
          }
        });
      }
    });
  
    // Converter para array e ordenar
    const sortedDates = Array.from(allDates).sort();
    
    // Para cada ativo, encontre o preço inicial (mais antigo)
    const initialPrices = {};
    results.forEach(result => {
      if (result && result.id && result.data && result.data.length > 0) {
        // Usar o primeiro preço como preço inicial
        initialPrices[result.id] = result.data[0].close;
        console.log(`Initial price for ${result.id}: ${initialPrices[result.id]}`);
      }
    });
  
    // Criar pontos de dados para cada data
    const dataPoints = sortedDates.map(date => {
      const dataPoint = {
        date: new Date(date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      };
  
      // Para cada benchmark, calcular o retorno percentual em relação ao preço inicial
      results.forEach(result => {
        if (result && result.id && result.data && initialPrices[result.id]) {
          // Encontrar o preço para esta data
          const priceData = result.data.find(item => item.unixTime === date);
          
          if (priceData && priceData.close) {
            const initialPrice = initialPrices[result.id];
            const returnPercentage = ((priceData.close - initialPrice) / initialPrice) * 100;
            
            // Armazenar o retorno como string com 2 casas decimais
            dataPoint[result.id] = returnPercentage.toFixed(2);
          }
        }
      });
  
      return dataPoint;
    });
  
    // Log para verificação
    console.log(`Created ${dataPoints.length} data points for the chart`);
    if (dataPoints.length > 0) {
      console.log('First data point:', dataPoints[0]);
      console.log('Last data point:', dataPoints[dataPoints.length - 1]);
    }
  
    return dataPoints;
  };

  const calculateYAxisConfig = (data) => {
    const allValues = data.flatMap(entry => 
      Object.entries(entry)
        .filter(([key]) => key !== 'date')
        .map(([_, value]) => Number(value))
    );
    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...allValues);
    const margin = (maxValue - minValue) * 0.1;
    const min = Math.floor(minValue - margin);
    const max = Math.ceil(maxValue + margin);
    const step = Math.ceil((max - min) / 8);
    const ticks = Array.from(
      { length: Math.floor((max - min) / step) + 1 },
      (_, i) => min + (i * step)
    );

    return { min, max, ticks };
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl p-4">
        <div className={`rounded-lg shadow-lg p-6 ${isDark ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <p>Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-6xl p-4 ${isDark ? 'dark' : ''}`}>
      <div className={`rounded-lg shadow-lg ${isDark ? 'bg-gray-800 text-white' : 'bg-white'}`}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Evolução dos Benchmarks</h2>
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-full ${
                isDark 
                  ? 'bg-gray-700 hover:bg-gray-600' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setSelectedPeriod('1Y')}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedPeriod === '1Y'
                  ? isDark 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-600 text-white'
                  : isDark 
                    ? 'bg-gray-700 hover:bg-gray-600' 
                    : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              1 Ano
            </button>
            <button
              onClick={() => setSelectedPeriod('3Y')}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedPeriod === '3Y'
                  ? isDark 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-600 text-white'
                  : isDark 
                    ? 'bg-gray-700 hover:bg-gray-600' 
                    : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              3 Anos
            </button>
            <button
              onClick={() => setSelectedPeriod('5Y')}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedPeriod === '5Y'
                  ? isDark 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-600 text-white'
                  : isDark 
                    ? 'bg-gray-700 hover:bg-gray-600' 
                    : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              5 Anos
            </button>
          </div>

          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeriesData}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={isDark ? '#374151' : '#e5e7eb'}
                />
                <XAxis 
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval="preserveStartEnd"
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
                  formatter={(value) => `${Number(value).toFixed(2)}%`}
                  labelFormatter={(label) => `Período: ${label}`}
                  contentStyle={{
                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                    color: isDark ? '#FFFFFF' : '#000000'
                  }}
                />
                <Legend 
                  wrapperStyle={{
                    color: isDark ? '#FFFFFF' : '#000000'
                  }}
                />
{benchmarks.map((benchmark) => {
  // Verificar se temos dados para este benchmark
  const hasData = timeSeriesData.some(dataPoint => 
    dataPoint[benchmark.id] !== undefined && dataPoint[benchmark.id] !== null
  );
  
  if (!hasData) {
    console.warn(`No data points found for ${benchmark.id} to display in chart`);
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
      strokeWidth={2}
    />
  );
})}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2">Benchmark</th>
                  <th className="text-right py-2">Retorno {selectedPeriod === '1Y' ? '1 Ano' : selectedPeriod === '3Y' ? '3 Anos' : '5 Anos'}</th>
                  <th className="text-right py-2">vs. BOVA11</th>
                  <th className="text-right py-2">vs. XFIX11</th>
                </tr>
              </thead>
              <tbody>
              {benchmarks.map((benchmark, index) => {
  const finalData = timeSeriesData.length > 0 ? timeSeriesData[timeSeriesData.length - 1] : {};
  const benchmarkReturn = finalData && finalData[benchmark.id] ? Number(finalData[benchmark.id]) : 0;
  
  return (
    <tr key={benchmark.id} className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      <td className="py-2">
        <div className="flex items-center">
          <div 
            className="w-3 h-3 rounded-full mr-2" 
            style={{ backgroundColor: benchmark.color }}
          />
          {benchmark.name}
        </div>
      </td>
      <td className="text-right py-2">{benchmarkReturn.toFixed(2)}%</td>
      {/* Outras colunas */}
    </tr>
  );
})}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BenchmarkComparison;