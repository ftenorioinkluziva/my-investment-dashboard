// components/benchmark/BenchmarkComparison.jsx
"use client";
import React, { useState, useEffect } from 'react';
import PeriodSelector from './PeriodSelector';
import BenchmarkChart from './BenchmarkChart';
import BenchmarkTable from './BenchmarkTable';
import PortfolioComposition from './PortfolioComposition';
import ThemeToggle from './ThemeToggle';
import { processHistoricalData, calculateYAxisConfig, calculatePortfolioReturn } from './utils';

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
      const dataWithPortfolio = showPortfolio ? calculatePortfolioReturn(processedData, portfolio.allocation) : processedData;
      
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

  // Busca retornos para exibição na tabela
  const fetchBenchmarkReturns = async () => {
    try {
      let url = '/api/benchmark/returns?';
      
      if (isCustomPeriod && customDateRange.startDate && customDateRange.endDate) {
        url += `startDate=${new Date(customDateRange.startDate).toISOString()}&endDate=${new Date(customDateRange.endDate).toISOString()}`;
      } else {
        const now = new Date();
        const startDate = new Date();
        const yearsToSubtract = selectedPeriod === '1Y' ? 1 : selectedPeriod === '3Y' ? 3 : 5;
        startDate.setFullYear(now.getFullYear() - yearsToSubtract);
        
        url += `startDate=${startDate.toISOString()}&endDate=${now.toISOString()}`;
      }
      
      const symbolList = [...benchmarks.map(b => b.id), 'PORTFOLIO'].join(',');
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

  // Handler para alternar o portfólio
  const handleTogglePortfolio = () => {
    setShowPortfolio(!showPortfolio);
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

  // Preparar datasets para componentes filhos
  const allBenchmarks = [
    ...benchmarks, 
    { 
      id: 'PORTFOLIO', 
      name: 'Tenas Risk Parity', 
      color: isDark ? '#EC4899' : '#E91E63', 
      isPortfolio: true 
    }
  ];

  // Informações sobre período para exibição
  const periodDisplayInfo = isCustomPeriod
    ? `${new Date(customDateRange.startDate).toLocaleDateString('pt-BR')} - ${new Date(customDateRange.endDate).toLocaleDateString('pt-BR')}`
    : selectedPeriod === '1Y' ? '1 Ano' : selectedPeriod === '3Y' ? '3 Anos' : '5 Anos';

  return (
    <div className={`w-full max-w-6xl p-4 ${isDark ? 'dark' : ''}`}>
      <div className={`rounded-lg shadow-lg p-6 ${isDark ? 'bg-gray-800 text-white' : 'bg-white'}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Evolução dos Benchmarks</h2>
          <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
        </div>
        
        <div className="flex flex-wrap justify-between mb-6">
          <PeriodSelector 
            selectedPeriod={selectedPeriod}
            isDark={isDark}
            onSelectPeriod={handlePeriodSelect}
            onSelectCustomPeriod={handleCustomPeriodSelect}
          />
          
          <div className="mt-2 sm:mt-0">
            <button
              onClick={handleTogglePortfolio}
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

        <BenchmarkChart 
          timeSeriesData={timeSeriesData}
          benchmarks={allBenchmarks}
          yAxisConfig={yAxisConfig}
          isDark={isDark}
          showPortfolio={showPortfolio}
        />

        <div className="mt-6">
          <PortfolioComposition 
            portfolio={portfolio}
            benchmarks={benchmarks}
            isDark={isDark}
          />
          
          <BenchmarkTable 
            benchmarks={allBenchmarks}
            benchmarkReturns={benchmarkReturns}
            periodDisplayInfo={periodDisplayInfo}
            isDark={isDark}
            showPortfolio={showPortfolio}
          />
        </div>
      </div>
    </div>
  );
};

export default BenchmarkComparison;