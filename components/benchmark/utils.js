// components/benchmark/utils.js

/**
 * Processa dados históricos para exibição no gráfico
 * @param {Array} results - Resultados da API para cada ativo
 * @returns {Array} Dados processados para o gráfico
 */
export const processHistoricalData = (results) => {
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
        // Para CDI, calcular o valor acumulado corretamente
       
        let accumulatedValue = 1.0; // Começamos com 1 (100%)

        assetData.forEach((point, index) => {
          if (index === 0) {
            // Primeiro ponto é a base (0% de retorno)
            accumulatedReturns[assetId].push({
              timestamp: point.unixTime,
              value: 0
            });
          } else {
            // Calcular valor acumulado (o "point.close" já é o valor acumulado do CDI)
            const dailyRate = point.close / 100; // Convertendo para decimal
            accumulatedValue *= (1 + dailyRate); // Convertendo para percentual
            
            // Calcular retorno percentual desde o início
            const percentReturn = (accumulatedValue - 1) * 100;
            
            accumulatedReturns[assetId].push({
              timestamp: point.unixTime,
              value: percentReturn
            });
          }
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
  
  /**
   * Encontra o ponto de retorno mais próximo de uma data
   * @param {Array} returns - Array de pontos de retorno
   * @param {number} targetDate - Data alvo (timestamp)
   * @returns {Object|null} Ponto mais próximo ou null
   */
  export const findClosestReturnPoint = (returns, targetDate) => {
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
  
  /**
   * Calcula a configuração do eixo Y com base nos dados
   * @param {Array} data - Dados do gráfico
   * @returns {Object} Configuração do eixo Y
   */
  export const calculateYAxisConfig = (data) => {
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
  
  /**
   * Calcula o retorno do portfólio com base nos dados de benchmarks
   * @param {Array} data - Dados de benchmarks
   * @param {Object} allocation - Alocação percentual do portfólio
   * @returns {Array} Dados incluindo o portfólio
   */
  export const calculatePortfolioReturn = (data, allocation) => {
    return data.map(dataPoint => {
      const portfolioDataPoint = { ...dataPoint };
      
      const hasAllComponents = Object.keys(allocation).every(assetId => 
        dataPoint[assetId] !== undefined
      );
      
      if (hasAllComponents) {
        let portfolioReturn = 0;
        
        Object.entries(allocation).forEach(([assetId, weight]) => {
          const assetReturn = dataPoint[assetId] || 0;
          portfolioReturn += assetReturn * weight;
        });
        
        portfolioDataPoint['PORTFOLIO'] = portfolioReturn;
      }
      
      return portfolioDataPoint;
    });
  };