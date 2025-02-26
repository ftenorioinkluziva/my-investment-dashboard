"use client";

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Moon, Sun } from 'lucide-react';
import DateRangePicker from './DateRangePicker';

const BenchmarkComparison = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('1Y');
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [yAxisConfig, setYAxisConfig] = useState({ min: -30, max: 30, ticks: [] });
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [benchmarkReturns, setBenchmarkReturns] = useState({});
  const [showPortfolio, setShowPortfolio] = useState(true);

  const [isCustomPeriod, setIsCustomPeriod] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({ startDate: null, endDate: null });

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
      console.log("Iniciando fetchData");
      setIsLoading(true);
      
      // Definir o período para busca dos dados
      let startDate, endDate;
      
      if (isCustomPeriod && customDateRange.startDate && customDateRange.endDate) {
        // Usar período personalizado
        startDate = new Date(customDateRange.startDate);
        endDate = new Date(customDateRange.endDate);
      } else {
        // Usar período predefinido (1, 3 ou 5 anos)
        const now = new Date();
        const yearsToSubtract = selectedPeriod === '1Y' ? 1 : selectedPeriod === '3Y' ? 3 : 5;
        startDate = new Date();
        startDate.setFullYear(now.getFullYear() - yearsToSubtract);
        endDate = now;
      }
      
      const startTimestamp = startDate.getTime();
      const endTimestamp = endDate.getTime();
      
      console.log(`Período selecionado: ${startDate.toISOString()} até ${endDate.toISOString()}`);
      
      // Teste de conexão da API
      try {
        const pingResponse = await fetch('/api/ping');
        const pingData = await pingResponse.json();
        console.log('API connection test:', pingData);
      } catch (pingError) {
        console.error('API ping test failed:', pingError);
      }
      
      // Buscar dados dos benchmarks
      const stockPromises = benchmarks
        .filter(benchmark => !benchmark.isPortfolio) // Excluir o portfólio, que é calculado depois
        .map(async (benchmark) => {
          try {
            console.log(`Buscando dados para ${benchmark.id}`);
            let response;
            
            if (isCustomPeriod) {
              response = await fetch(`/api/yahoo/historical/custom?symbol=${benchmark.id}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
            } else {
              response = await fetch(`/api/yahoo/historical?symbol=${benchmark.id}&period=${selectedPeriod}`);
            }
            
            if (!response.ok) {
              const errorData = await response.json();
              console.error(`API error for ${benchmark.id}:`, errorData);
              throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            
            const data = await response.json();
            console.log(`Recebidos ${data.data?.length || 0} pontos para ${benchmark.id}`);
            
            // Se não houver dados, retornar um array vazio
            if (!data.data || data.data.length === 0) {
              console.warn(`Nenhum ponto de dados para ${benchmark.id}. Pulando...`);
              return {
                id: benchmark.id,
                data: []
              };
            }
            
            // Ajustar os dados para começar da data selecionada
            let adjustedData = data.data;
            if (!isCustomPeriod && selectedPeriod !== '5Y') {
              // Filtrar dados para garantir que só temos dados a partir da data de início
              adjustedData = data.data.filter(point => new Date(point.unixTime) >= startDate);
              console.log(`Filtrados ${adjustedData.length} pontos para ${benchmark.id} após ${startDate.toISOString()}`);
            }
            
            return {
              id: benchmark.id,
              data: adjustedData
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
      
      // Esperar todas as requisições terminarem
      const stockResults = await Promise.all(stockPromises);
      console.log("Todos os dados recebidos, resultados:", stockResults.map(r => `${r.id}: ${r.data.length} pontos`));
      
      // Verificar se temos dados suficientes
      const hasData = stockResults.some(result => result.data && result.data.length > 0);
      if (!hasData) {
        console.warn("Nenhum dado válido recebido das APIs");
        setTimeSeriesData([]);
        setBenchmarkReturns({});
        setIsLoading(false);
        return;
      }
      
      // Processar dados históricos
      const processedData = processHistoricalData(stockResults);
      console.log(`Dados processados: ${processedData.length} pontos`);
      
      if (processedData.length === 0) {
        console.warn("Não foi possível processar os dados para exibição no gráfico");
        setTimeSeriesData([]);
        setBenchmarkReturns({});
        setIsLoading(false);
        return;
      }
      
      // Adicionar portfólio se necessário
      const dataWithPortfolio = showPortfolio ? calculatePortfolioReturn(processedData) : processedData;
      
      // Calcular configuração do eixo Y
      const calculatedYAxisConfig = calculateYAxisConfig(dataWithPortfolio);
      
      // Calcular retornos para exibição na tabela
      const calculatedReturns = calculateBenchmarkReturns(dataWithPortfolio);
      
      // Atualizar estado
      setTimeSeriesData(dataWithPortfolio);
      setYAxisConfig(calculatedYAxisConfig);
      setBenchmarkReturns(calculatedReturns);
    } catch (error) {
      console.error('Erro detalhado ao buscar dados:', error);
      console.error(error.stack);
      setTimeSeriesData([]);
      setBenchmarkReturns({});
    } finally {
      setIsLoading(false);
      console.log("Loading finalizado");
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
  
    // Determinar a data de início (a mais recente entre todos os "primeiros pontos")
    let startTimestamp = 0;
    validResults.forEach(result => {
      if (result.data.length > 0) {
        // Encontrar a primeira data válida para este ativo
        const firstValidPoint = result.data[0];
        if (firstValidPoint && firstValidPoint.unixTime) {
          // Atualizar startTimestamp se for a mais recente entre os primeiros pontos
          if (startTimestamp === 0 || firstValidPoint.unixTime > startTimestamp) {
            startTimestamp = firstValidPoint.unixTime;
          }
        }
      }
    });
    
    console.log(`Data de início comum para todos os ativos: ${new Date(startTimestamp).toISOString()}`);
    
    // Filtrar dados para apenas os pontos após a data de início
    validResults.forEach(result => {
      result.data = result.data.filter(point => point.unixTime >= startTimestamp);
    });
    
    // Obter todas as datas únicas de todos os ativos após a data de início
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
    
    if (sortedDates.length === 0) {
      console.warn('No dates available after filtering');
      return [];
    }
    
    // Para cada ativo, encontre o preço inicial (primeiro ponto após a data de início)
    const initialPrices = {};
    validResults.forEach(result => {
      if (result.data.length > 0) {
        // O primeiro ponto já é garantido ser após a data de início comum
        initialPrices[result.id] = result.data[0].close;
        console.log(`Initial price for ${result.id}: ${initialPrices[result.id]} at ${new Date(result.data[0].unixTime).toISOString()}`);
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
  
  // Função para calcular os retornos para exibição na tabela
  const calculateBenchmarkReturns = (data) => {
    if (!data || data.length === 0) {
      return {};
    }
    
    // Pegar o último ponto de dados (mais recente)
    const lastDataPoint = data[data.length - 1];
    
    // Extrair os retornos de cada benchmark
    const returns = {};
    benchmarks.forEach(benchmark => {
      if (lastDataPoint[benchmark.id] !== undefined) {
        returns[benchmark.id] = lastDataPoint[benchmark.id];
      }
    });
    
    return returns;
  };

  // Handler para quando um período personalizado é selecionado
  const handleCustomPeriodSelect = (startDate, endDate) => {
    setCustomDateRange({ startDate, endDate });
    setIsCustomPeriod(true);
    // Desmarcar os botões de período predefinido
    setSelectedPeriod('custom');
  };

  // Atualizar os handlers para botões de período
  const handlePeriodSelect = (period) => {
    setSelectedPeriod(period);
    setIsCustomPeriod(false);
  };

  // Executa quando o componente monta e quando o período ou outras configurações mudam
  useEffect(() => {
    console.log('Executando fetchData no useEffect...');
    if (!isCustomPeriod || (isCustomPeriod && customDateRange.startDate && customDateRange.endDate)) {
      fetchData();
    }
  }, [selectedPeriod, isCustomPeriod, customDateRange, showPortfolio]);
  
  // Efeito para atualizar o gráfico quando mudar o tema escuro (cores)
  useEffect(() => {
    if (timeSeriesData.length > 0) {
      // Apenas atualize o gráfico reorganizando os dados (sem buscar novamente)
      const updatedData = [...timeSeriesData];
      setTimeSeriesData([]);
      setTimeout(() => setTimeSeriesData(updatedData), 10);
    }
  }, [isDark]);

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
                onClick={() => handlePeriodSelect('1Y')}
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
                onClick={() => handlePeriodSelect('3Y')}
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
                onClick={() => handlePeriodSelect('5Y')}
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