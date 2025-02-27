"use client";
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Moon, Sun } from 'lucide-react';

const BenchmarkComparison = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [yAxisConfig, setYAxisConfig] = useState({ min: -30, max: 30, ticks: [] });
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [benchmarkReturns, setBenchmarkReturns] = useState({});
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [customDateRange, setCustomDateRange] = useState({ startDate: null, endDate: null });
  const [isCustomPeriod, setIsCustomPeriod] = useState(false);

  // Portfólio Tenas Risk Parity
  const portfolio = {
    name: "Tenas Risk Parity",
    allocation: {
      'BOVA11': 0.05,  // 5%
      'XFIX11': 0.14,  // 14%
      'IB5M11': 0.08,  // 8%
      'CDI': 0.12,     // 12%
      'B5P211': 0.20,  // 20% (IMAB5)
      'USDBRL=X': 0.06,     // 6%
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
    { id: 'USDBRL=X', name: 'USD/BRL (Dólar)', color: isDark ? '#D1D5DB' : '#333333' },
    //{ id: 'PORTFOLIO', name: 'Tenas Risk Parity', color: isDark ? '#EC4899' : '#E91E63', isPortfolio: true }
  ];

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Definir período para busca dos dados
      let startDate, endDate;
      
      if (isCustomPeriod && customDateRange.startDate && customDateRange.endDate) {
        // Usar período personalizado
        startDate = new Date(customDateRange.startDate);
        endDate = new Date(customDateRange.endDate);
      } else {
        // Calcular o período com base na seleção
        endDate = new Date();
        startDate = new Date();
        const yearsToSubtract = selectedPeriod === '1Y' ? 1 : selectedPeriod === '3Y' ? 3 : 5;
        startDate.setFullYear(endDate.getFullYear() - yearsToSubtract);
      }
      
      // Buscar dados para cada benchmark
      const stockPromises = benchmarks
        .filter(benchmark => !benchmark.isPortfolio)
        .map(async (benchmark) => {
          try {
            let response;
            
            if (isCustomPeriod) {
              response = await fetch(`/api/yahoo/historical/custom?symbol=${benchmark.id}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
            } else {
              response = await fetch(`/api/yahoo/historical?symbol=${benchmark.id}&period=${selectedPeriod}`);
            }
            
            if (!response.ok) {
              throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            return {
              id: benchmark.id,
              data: data.data || []
            };
          } catch (error) {
            console.error(`Error fetching data for ${benchmark.id}:`, error);
            return {
              id: benchmark.id,
              data: [],
              error: error.message
            };
          }
        });
      
      const stockResults = await Promise.all(stockPromises);
      
      // Verificar se temos dados
      const hasData = stockResults.some(result => result.data && result.data.length > 0);
      if (!hasData) {
        setTimeSeriesData([]);
        setBenchmarkReturns({});
        setIsLoading(false);
        return;
      }
      
      // Processar dados históricos
      const processedData = processHistoricalData(stockResults);
      
      // Adicionar portfólio se necessário
      const dataWithPortfolio = showPortfolio ? calculatePortfolioReturn(processedData) : processedData;
      
      // Calcular configuração do eixo Y
      const calculatedYAxisConfig = calculateYAxisConfig(dataWithPortfolio);
      
      // Atualizar estado
      setTimeSeriesData(dataWithPortfolio);
      setYAxisConfig(calculatedYAxisConfig);
      
      // Buscar retornos para a tabela
      fetchBenchmarkReturns();
      
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setTimeSeriesData([]);
      setBenchmarkReturns({});
    } finally {
      setIsLoading(false);
    }
  };

  const processHistoricalData = (results) => {
    if (!results || results.length === 0) return [];
    
    // Filtrar resultados válidos
    const validResults = results.filter(result => 
      result && result.data && Array.isArray(result.data) && result.data.length > 0
    );
    
    if (validResults.length === 0) return [];
    
  // Ordenar cada conjunto de dados por timestamp
    validResults.forEach(result => {
      result.data.sort((a, b) => a.unixTime - b.unixTime);
    });
      


    
    // Encontrar data de início comum
    let startTimestamp = 0;
    validResults.forEach(result => {
      if (result.data.length > 0) {
        const firstPoint = result.data[0];
        if (firstPoint && firstPoint.unixTime) {
          if (startTimestamp === 0 || firstPoint.unixTime > startTimestamp) {
            startTimestamp = firstPoint.unixTime;
          }
        }
      }
    });
    
    // Filtrar dados após a data de início
    validResults.forEach(result => {
      result.data = result.data.filter(point => point.unixTime >= startTimestamp);
    });
    
    // Obter todas as datas únicas
    const allDates = new Set();
    validResults.forEach(result => {
      result.data.forEach(item => {
        if (item && item.unixTime) {
          allDates.add(item.unixTime);
        }
      });
    });
    
    // Ordenar datas
    const sortedDates = Array.from(allDates).sort((a, b) => a - b);
    
    if (sortedDates.length === 0) return [];
    
    // Calcular retornos acumulados para cada ativo
    const accumulatedReturns = {};
    
    validResults.forEach(result => {
      const assetId = result.id;
      const assetData = result.data;
      
      // Inicializar acumulador para esse ativo
      accumulatedReturns[assetId] = [];
      
      if (assetData.length < 2) return;
      
      // Tratamento especial para CDI
      if (assetId === 'CDI') {
        // Para CDI, usamos os valores diretamente
        let cumulativeReturn = 0;


        
        assetData.forEach((point) => {
          accumulatedReturns[assetId].push({
            timestamp: point.unixTime,
            value: point.close
          });
        });
      } else {
        // Para outros ativos, calculamos o retorno acumulado
        let cumulativeReturn = 0;
        
        assetData.forEach((point, index) => {
          if (index === 0) {
            // Primeiro ponto é a base (0% de retorno)
            accumulatedReturns[assetId].push({
              timestamp: point.unixTime,
              value: 0
            });
          } else {
            // Calcular retorno diário
          // Calcular retorno diário
          const previousPoint = assetData[index - 1];
          const dailyReturn = ((point.close / previousPoint.close) - 1) * 100;
            
          // Acumular retorno
          cumulativeReturn += dailyReturn;

          // Adicionar ponto com retorno acumulado
          accumulatedReturns[assetId].push({
            timestamp: point.unixTime,
            value: cumulativeReturn
          });
          }
        });
      }
    });
    
    // Criar pontos de dados formatados para o gráfico
    const dataPoints = sortedDates.map(date => {
      const dataPoint = {
        date: new Date(date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        timestamp: date
      };
      
      // Adicionar valores acumulados para cada ativo nesta data
      Object.keys(accumulatedReturns).forEach(assetId => {
        const assetReturns = accumulatedReturns[assetId];
        const closestPoint = findClosestReturnPoint(assetReturns, date);
        
        if (closestPoint) {
          dataPoint[assetId] = closestPoint.value;
        }
      });
      
      return dataPoint;
    });
    
    return dataPoints.filter(point => 
      Object.keys(point).some(key => key !== 'date' && key !== 'timestamp')
    );
  };
  
  // Função auxiliar para encontrar o ponto de retorno mais próximo de uma data
  const findClosestReturnPoint = (returns, targetDate) => {
    if (!returns || returns.length === 0) return null;
    
    let closestPoint = returns[0];
    let closestDistance = Math.abs(returns[0].timestamp - targetDate);
    
    for (let i = 1; i < returns.length; i++) {
      const distance = Math.abs(returns[i].timestamp - targetDate);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = returns[i];
      }
    }
    
    // Limite de 7 dias para considerar válido
    if (closestDistance > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    
    return closestPoint;
  };



  // Configuração do eixo Y
  const calculateYAxisConfig = (data) => {
    if (!data || data.length === 0) {
      return { min: -30, max: 30, ticks: [-30, -20, -10, 0, 10, 20, 30] };
    }
    
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
    
    const margin = Math.max(5, (maxValue - minValue) * 0.1);
    const min = Math.floor((minValue - margin) / 10) * 10;
    const max = Math.ceil((maxValue + margin) / 10) * 10;
    
    const step = (max - min) / 6;
    const ticks = [];
    for (let i = 0; i <= 6; i++) {
      ticks.push(min + (i * step));
    }
    
    return { min, max, ticks };
  };

  // Cálculo do retorno do portfólio
  const calculatePortfolioReturn = (data) => {
    return data.map(dataPoint => {
      const portfolioDataPoint = { ...dataPoint };
      
      const hasAllComponents = Object.keys(portfolio.allocation).every(assetId => 
        dataPoint[assetId] !== undefined
      );
      
      if (hasAllComponents) {
        let portfolioReturn = 0;
        
        Object.entries(portfolio.allocation).forEach(([assetId, weight]) => {
          const assetReturn = dataPoint[assetId] || 0;
          portfolioReturn += assetReturn * weight;
        });
        
        portfolioDataPoint['PORTFOLIO'] = portfolioReturn;
      }
      
      return portfolioDataPoint;
    });
  };

  // Busca retornos para exibição na tabela
  const fetchBenchmarkReturns = async () => {
    try {
      let url = '/api/benchmark/returns?';
      
      if (isCustomPeriod && customDateRange.startDate && customDateRange.endDate) {
        url += `startDate=${new Date(customDateRange.startDate).toISOString()}&endDate=${new Date(customDateRange.endDate).toISOString()}`;
      } else {
        url += `period=${selectedPeriod}`;
      }
      
      const symbolList = benchmarks.map(b => b.id).join(',');
      url += `&symbols=${symbolList}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      const returns = {};
      if (data.results && data.results.length > 0) {
        data.results.forEach(result => {
          if (result.return !== null) {
            returns[result.id] = result.return;
          }
        });
      }
      
      setBenchmarkReturns(returns);
    } catch (error) {
      console.error('Erro ao buscar retornos:', error);
      setBenchmarkReturns({});
    }
  };

  // Handler para seleção de período
  const handlePeriodSelect = (period) => {
    setSelectedPeriod(period);
    setIsCustomPeriod(false);
  };

  // Handler para período personalizado
  const handleCustomPeriodSelect = (startDate, endDate) => {
    setCustomDateRange({ startDate, endDate });
    setIsCustomPeriod(true);
    setSelectedPeriod('custom');
  };

  // Efeito para buscar dados quando o período muda
  useEffect(() => {
    if (!isCustomPeriod || (isCustomPeriod && customDateRange.startDate && customDateRange.endDate)) {
      fetchData();
    }
  }, [selectedPeriod, isCustomPeriod, customDateRange, showPortfolio]);
  
  // Efeito para verificar tema escuro do sistema
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
  }, []);

  // Componente de DateRangePicker simplificado
  const DateRangePicker = ({ onApply, isDark }) => {
    const [localStartDate, setLocalStartDate] = useState('');
    const [localEndDate, setLocalEndDate] = useState('');
    const [showPicker, setShowPicker] = useState(false);
    
    const handleApply = () => {
      if (localStartDate && localEndDate) {
        onApply(localStartDate, localEndDate);
        setShowPicker(false);
      }
    };
  
    return (
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className={`px-4 py-2 rounded-md transition-colors ${
            isDark 
              ? 'bg-gray-700 hover:bg-gray-600 text-white' 
              : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
          }`}
        >
          Período personalizado
        </button>
        
        {showPicker && (
          <div 
            className={`absolute mt-2 p-4 rounded-md shadow-lg z-10 ${
              isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
            }`}
            style={{ width: '300px', right: 0 }}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data inicial</label>
                <input
                  type="date"
                  value={localStartDate}
                  onChange={(e) => setLocalStartDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md ${
                    isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Data final</label>
                <input
                  type="date"
                  value={localEndDate}
                  onChange={(e) => setLocalEndDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-md ${
                    isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                />
              </div>
              
              <div className="flex justify-between">
                <button
                  onClick={() => setShowPicker(false)}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  Cancelar
                </button>
                
                <button
                  onClick={handleApply}
                  disabled={!localStartDate || !localEndDate}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    !localStartDate || !localEndDate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-500 hover:bg-blue-400 text-white'
                  }`}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

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
      <div className={`rounded-lg shadow-lg p-6 ${isDark ? 'bg-gray-800 text-white' : 'bg-white'}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Evolução dos Benchmarks</h2>
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-2 rounded-full ${
              isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
            }`}
            aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
        
        <div className="flex flex-wrap justify-between mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handlePeriodSelect('1Y')}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedPeriod === '1Y'
                  ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                  : isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              1 Ano
            </button>
            <button
              onClick={() => handlePeriodSelect('3Y')}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedPeriod === '3Y'
                  ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                  : isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              3 Anos
            </button>
            <button
              onClick={() => handlePeriodSelect('5Y')}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedPeriod === '5Y'
                  ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                  : isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              5 Anos
            </button>
            <DateRangePicker 
              onApply={handleCustomPeriodSelect}
              isDark={isDark}
            />
          </div>
          
          <div className="mt-2 sm:mt-0">
            <button
              onClick={() => setShowPortfolio(!showPortfolio)}
              className={`px-4 py-2 rounded-md transition-colors ${
                showPortfolio
                  ? isDark ? 'bg-pink-600 text-white' : 'bg-pink-600 text-white'
                  : isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
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
                <th className="text-right py-2">
                  Retorno {
                    isCustomPeriod 
                      ? `${new Date(customDateRange.startDate).toLocaleDateString('pt-BR')} - ${new Date(customDateRange.endDate).toLocaleDateString('pt-BR')}` 
                      : selectedPeriod === '1Y' ? '1 Ano' : selectedPeriod === '3Y' ? '3 Anos' : '5 Anos'
                  }
                </th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((benchmark) => {
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
  );
};

export default BenchmarkComparison;