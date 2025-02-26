"use client";

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Moon, Sun } from 'lucide-react';
import { fetchHistoricalData, fetchCDIData, fetchUSDData } from '../services/api';

const BenchmarkComparison = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [yAxisConfig, setYAxisConfig] = useState({ min: -30, max: 30, ticks: [] });
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [benchmarkReturns, setBenchmarkReturns] = useState({});
  const [showPortfolio, setShowPortfolio] = useState(true);

  // Portfólio Tenas Risk Parity
  const portfolio = {
    name: "Tenas Risk Parity",
    allocation: {
      'BOVA11': 0.05,  // 5%
      'XFIX11': 0.14,  // 14%
      'IB5M11': 0.08,  // 8%
      'CDI': 0.12,     // 12%
      'B5P211': 0.20,  // 20% (IMAB5)
      'USD': 0.06,     // 6%
      'FIXA11': 0.35   // 35%
    }
  };

  const benchmarks = [
    { id: 'BOVA11', name: 'BOVA11 (Ibovespa)', color: isDark ? '#60A5FA' : '#2196F3' },
    { id: 'XFIX11', name: 'XFIX11 (IFIX)', color: isDark ? '#F87171' : '#F44336' },
    { id: 'IB5M11', name: 'IB5M11 (IMAB5+)', color: isDark ? '#34D399' : '#4CAF50' },
    { id: 'B5P211', name: 'B5P211 (IMAB5)', color: isDark ? '#FBBF24' : '#FFC107' },
    { id: 'FIXA11', name: 'FIXA11 (Pré)', color: isDark ? '#FB923C' : '#FF9800' },
    { id: 'CDI', name: 'CDI', color: isDark ? '#94A3B8' : '#607D8B' },
    { id: 'USD', name: 'USD/BRL (Dólar)', color: isDark ? '#D1D5DB' : '#333333' },
    { id: 'PORTFOLIO', name: 'Tenas Risk Parity', color: isDark ? '#EC4899' : '#E91E63', isPortfolio: true }
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
            return {
              id: benchmark.id,
              data: []
            };
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
        cdiData = {
          id: 'CDI',
          data: []
        };
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
        usdData = {
          id: 'USD',
          data: []
        };
      }
      
      // Combinar todos os resultados
      const stockResults = await Promise.all(stockPromises);
      const allResults = [...stockResults.filter(result => result.data && result.data.length > 0)];
      
      if (cdiData && cdiData.data && cdiData.data.length > 0) {
        allResults.push(cdiData);
      }
      
      if (usdData && usdData.data && usdData.data.length > 0) {
        allResults.push(usdData);
      }
      
      if (allResults.length > 0) {
        let processedData = processHistoricalData(allResults);
        
        // Adicionar cálculo do portfólio aos dados
        processedData = addPortfolioToData(processedData);
        
        setTimeSeriesData(processedData);
        
        // Calcular e definir configurações do eixo Y
        const yConfig = calculateYAxisConfig(processedData);
        setYAxisConfig(yConfig);
        
        // Calcular retornos para a tabela
        if (processedData.length > 0) {
          const lastDataPoint = processedData[processedData.length - 1];
          const returns = {};
          
          benchmarks.forEach(benchmark => {
            const value = lastDataPoint[benchmark.id];
            returns[benchmark.id] = value !== undefined ? parseFloat(value) : null;
          });
          
          setBenchmarkReturns(returns);
        }
      } else {
        console.error('No valid data returned from API');
        setTimeSeriesData([]);
        setBenchmarkReturns({});
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para processar os dados do CDI
  const processCDIData = (cdiData, startTimestamp, endTimestamp) => {
    // Filtramos apenas os dados dentro do período selecionado
    const filteredData = cdiData.filter(item => {
      const dateParts = item.data.split('/');
      const itemDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
      const timestamp = itemDate.getTime();
      return timestamp >= startTimestamp && timestamp <= endTimestamp;
    });
    
    // Se não houver dados filtrados, retorna array vazio
    if (filteredData.length === 0) return [];
    
    // Agora vamos calcular o CDI acumulado
    // Como os valores já são percentuais diários, precisamos calcular o acumulado
    // Para simular um investimento que segue o CDI
    const processedData = [];
    let accumulatedCDI = 1.0; // Valor inicial (100%)
    
    filteredData.forEach(item => {
      const dateParts = item.data.split('/');
      const date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
      const value = parseFloat(item.valor.replace(',', '.'));
      
      // Acumular o CDI (multiplicar pelo fator diário)
      accumulatedCDI *= (1 + value / 100);
      
      processedData.push({
        close: accumulatedCDI,
        unixTime: date.getTime()
      });
    });
    
    return processedData;
  };

  // Função para processar os dados do USD
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
      
      return processedData;
    } catch (error) {
      console.error('Error processing USD data:', error);
      return [];
    }
  };

  // Função para processar os dados históricos
  const processHistoricalData = (results) => {
    if (!results || results.length === 0) {
      console.warn('No data to process');
      return [];
    }
  
    // Filtrar resultados vazios
    const validResults = results.filter(result => 
      result && result.data && Array.isArray(result.data) && result.data.length > 0
    );
    
    if (validResults.length === 0) {
      console.warn('No valid data after filtering');
      return [];
    }
  
    // Ordenar todos os dados por data
    validResults.forEach(result => {
      result.data.sort((a, b) => a.unixTime - b.unixTime);
    });
  
    // Obter todas as datas únicas de todos os ativos
    const allDates = new Set();
    validResults.forEach(result => {
      result.data.forEach(item => {
        if (item && item.unixTime) {
          allDates.add(item.unixTime);
        }
      });
    });
  
    // Converter para array e ordenar
    const sortedDates = Array.from(allDates).sort((a, b) => a - b);
    
    // Para cada ativo, encontre o preço inicial (mais antigo)
    const initialPrices = {};
    validResults.forEach(result => {
      if (result.data.length > 0) {
        // Usar o primeiro preço como preço inicial
        initialPrices[result.id] = result.data[0].close;
        console.log(`Initial price for ${result.id}: ${initialPrices[result.id]}`);
      }
    });
  
    // Criar pontos de dados para cada data
    const dataPoints = sortedDates.map(date => {
      const dataPoint = {
        date: new Date(date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        timestamp: date
      };
  
      // Para cada benchmark, calcular o retorno percentual em relação ao preço inicial
      validResults.forEach(result => {
        if (initialPrices[result.id]) {
          // Encontrar o preço mais próximo para esta data
          const closestDataPoint = findClosestDataPoint(result.data, date);
          
          if (closestDataPoint) {
            const initialPrice = initialPrices[result.id];
            
            // Tratamento especial para CDI, que já está como valor acumulado
            if (result.id === 'CDI') {
              // O close do CDI já é um fator acumulado, então calculamos diretamente
              const returnPercentage = (closestDataPoint.close - 1) * 100;
              dataPoint[result.id] = returnPercentage;
            } else {
              // Para outros ativos, calculamos o retorno percentual normal
              const returnPercentage = ((closestDataPoint.close - initialPrice) / initialPrice) * 100;
              dataPoint[result.id] = returnPercentage;
            }
          }
        }
      });
  
      return dataPoint;
    });
  
    // Filtrar pontos de dados incompletos
    const filteredDataPoints = dataPoints.filter(point => {
      // Verificar se o ponto tem pelo menos um benchmark além da data
      return Object.keys(point).some(key => key !== 'date' && key !== 'timestamp');
    });
    
    // Log para verificação
    console.log(`Created ${filteredDataPoints.length} data points for the chart`);
    
    return filteredDataPoints;
  };

  // Função para encontrar o ponto de dados mais próximo para uma data
  const findClosestDataPoint = (data, targetDate) => {
    if (!data || data.length === 0) return null;
    
    let closestPoint = data[0];
    let closestDistance = Math.abs(data[0].unixTime - targetDate);
    
    for (let i = 1; i < data.length; i++) {
      const distance = Math.abs(data[i].unixTime - targetDate);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = data[i];
      }
    }
    
    // Se a diferença for maior que 7 dias, considere que não temos dados próximos o suficiente
    if (closestDistance > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    
    return closestPoint;
  };

  // Função para calcular a configuração do eixo Y
  const calculateYAxisConfig = (data) => {
    if (!data || data.length === 0) {
      return { min: -30, max: 30, ticks: [-30, -20, -10, 0, 10, 20, 30] };
    }
    
    // Extrair todos os valores numéricos
    const allValues = [];
    data.forEach(entry => {
      Object.entries(entry).forEach(([key, value]) => {
        if (key !== 'date' && key !== 'timestamp' && value !== undefined && value !== null) {
          allValues.push(Number(value));
        }
      });
    });
    
    if (allValues.length === 0) {
      return { min: -30, max: 30, ticks: [-30, -20, -10, 0, 10, 20, 30] };
    }
    
    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...allValues);
    
    // Adicionar margem
    const margin = Math.max(5, (maxValue - minValue) * 0.1);
    const min = Math.floor((minValue - margin) / 10) * 10; // Arredondar para baixo para múltiplo de 10
    const max = Math.ceil((maxValue + margin) / 10) * 10;  // Arredondar para cima para múltiplo de 10
    
    // Criar ticks para o eixo Y
    const step = (max - min) / 6; // Usar 7 ticks (incluindo min e max)
    const ticks = [];
    for (let i = 0; i <= 6; i++) {
      ticks.push(min + (i * step));
    }
    
    return { min, max, ticks };
  };

  // Função para calcular o retorno do portfólio
  const calculatePortfolioReturn = (data) => {
    // Para cada ponto de dados, calcular o retorno ponderado do portfólio
    return data.map(dataPoint => {
      const portfolioDataPoint = { ...dataPoint };
      
      // Verificar se temos dados suficientes para calcular o valor do portfólio
      const hasAllComponents = Object.keys(portfolio.allocation).every(assetId => 
        dataPoint[assetId] !== undefined
      );
      
      if (hasAllComponents) {
        // Calcular o retorno ponderado do portfólio
        let portfolioReturn = 0;
        
        Object.entries(portfolio.allocation).forEach(([assetId, weight]) => {
          const assetReturn = dataPoint[assetId] || 0;
          portfolioReturn += assetReturn * weight;
        });
        
        // Adicionar o retorno do portfólio aos dados
        portfolioDataPoint['PORTFOLIO'] = portfolioReturn;
      }
      
      return portfolioDataPoint;
    });
  };

  // Função que adiciona o portfólio aos dados
  const addPortfolioToData = (data) => {
    if (!showPortfolio) return data;
    return calculatePortfolioReturn(data);
  };

  // Efeito para buscar dados quando o período mudar
  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  // Efeito para ajustar tema escuro com base nas preferências do sistema
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
  }, []);

  // Componente de carregamento
  if (isLoading) {
    return (
      <div className="w-full max-w-6xl p-4">
        <div className={`rounded-lg shadow-lg p-6 ${isDark ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <div className="flex items-center justify-center h-64">
            <p className="text-lg">Carregando dados dos investimentos...</p>
          </div>
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
              aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="flex flex-wrap justify-between mb-6">
            <div className="flex gap-2">
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
            
            <div className="mt-2 sm:mt-0">
              <button
                onClick={() => setShowPortfolio(!showPortfolio)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  showPortfolio
                    ? isDark 
                      ? 'bg-pink-600 text-white' 
                      : 'bg-pink-600 text-white'
                    : isDark 
                      ? 'bg-gray-700 hover:bg-gray-600' 
                      : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {showPortfolio ? 'Ocultar Tenas Risk Parity' : 'Mostrar Tenas Risk Parity'}
              </button>
            </div>
          </div>

          {timeSeriesData.length > 0 ? (
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
                    formatter={(value) => [`${Number(value).toFixed(2)}%`, '']}
                    labelFormatter={(label) => `Período: ${label}`}
                    contentStyle={{
                      backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                      border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                      color: isDark ? '#FFFFFF' : '#000000'
                    }}
                  />
                  <Legend 
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
          ) : (
            <div className="h-96 flex items-center justify-center border border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500">Não há dados disponíveis para exibir no gráfico</p>
            </div>
          )}

          <div className="mt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Composição do Tenas Risk Parity</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(portfolio.allocation).map(([assetId, weight]) => {
                  const benchmark = benchmarks.find(b => b.id === assetId);
                  return (
                    <div key={assetId} className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: benchmark?.color || '#ccc' }}
                        />
                        <span className="text-sm font-medium">{benchmark?.name || assetId}: {(weight * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2">Benchmark</th>
                  <th className="text-right py-2">Retorno {selectedPeriod === '1Y' ? '1 Ano' : selectedPeriod === '3Y' ? '3 Anos' : '5 Anos'}</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((benchmark, index) => {
                  // Se for o portfólio e estiver oculto, não mostrar na tabela
                  if (benchmark.isPortfolio && !showPortfolio) {
                    return null;
                  }
                  
                  const returnValue = benchmarkReturns[benchmark.id];
                  const hasReturn = returnValue !== undefined && returnValue !== null;
                  
                
                  
                  const isPortfolio = benchmark.isPortfolio;
                  
                  return (
                    <tr 
                      key={benchmark.id} 
                      className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} ${isPortfolio ? (isDark ? 'bg-gray-700/30' : 'bg-pink-50') : ''}`}
                    >
                      <td className="py-2">
                        <div className="flex items-center">
                          <div 
                            className={`w-3 h-3 rounded-full mr-2 ${isPortfolio ? 'animate-pulse' : ''}`}
                            style={{ backgroundColor: benchmark.color }}
                          />
                          <span className={isPortfolio ? 'font-bold' : ''}>
                            {benchmark.name}
                            {isPortfolio && ' 🔥'}
                          </span>
                        </div>
                      </td>
                      <td className={`text-right py-2 ${isPortfolio ? 'font-bold' : ''}`}>
                        {hasReturn ? `${returnValue.toFixed(2)}%` : '-'}
                      </td>
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