//import { login } from './auth';

//const API_URL = 'https://svc.aebroadcast.com.br/stock/v1';
//let authToken = null;

/* async function getToken() {
  if (!authToken) {
    authToken = await login();
  }
  return authToken;
} */

  export async function fetchHistoricalData(symbol, period = '5Y') {
    try {
      // Buscar somente do banco de dados
      const response = await fetch(`/api/yahoo/historical?symbol=${symbol}&period=${period}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Fetched ${symbol} data from database`);
      return data;
    } catch (error) {
      console.error('Error fetching historical data:', error);
      throw error;
    }
  }
// Função para buscar dados históricos com intervalo personalizado
export async function fetchCustomHistoricalData(symbol, startDate, endDate) {
  try {
    // Formatar as datas para ISO string para enviar como parâmetros
    const formattedStartDate = startDate instanceof Date 
      ? startDate.toISOString() 
      : new Date(startDate).toISOString();
    
    const formattedEndDate = endDate instanceof Date 
      ? endDate.toISOString() 
      : new Date(endDate).toISOString();

    // Verificar se as datas são válidas
    if (isNaN(new Date(formattedStartDate).getTime()) || isNaN(new Date(formattedEndDate).getTime())) {
      throw new Error('Invalid date format');
    }
    
    // Fazer requisição para a API local
    const response = await fetch(`/api/yahoo/historical/custom?symbol=${symbol}&startDate=${formattedStartDate}&endDate=${formattedEndDate}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Fetched custom data for ${symbol} from ${formattedStartDate} to ${formattedEndDate}`);
    return data;
  } catch (error) {
    console.error(`Error fetching custom historical data for ${symbol}:`, error);
    throw error;
  }
}

/* // Função original, renomeada
async function fetchHistoricalDataFromAPI(symbol, resolution = 'D') {
  const token = await getToken();
  const now = Date.now();
  const threeYearsAgo = now - (5 * 365 * 24 * 60 * 60 * 1000);

  const payload = {
    symbol,
    resolution,
    begin: threeYearsAgo,
    end: now
  };

  try {
    const response = await fetch(`${API_URL}/historical/symbol`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expirado, limpa o token e tenta novamente
        authToken = null;
        return fetchHistoricalDataFromAPI(symbol, resolution);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching historical data from API:', error);
    throw error;
  }
} */

// Funções para CDI e USD que também usam apenas o banco de dados
export async function fetchCDIData() {
  try {
    const response = await fetch('/api/yahoo/historical?symbol=CDI&period=5Y');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data; // Retorna diretamente os dados
  } catch (error) {
    console.error('Error fetching CDI data:', error);
    throw error;
  }
}

export async function fetchUSDData(startTimestamp, endTimestamp) {
  try {
    
    // Buscar do banco de dados
    const response = await fetch(`/api/yahoo/historical/custom?symbol=USD&startDate=${new Date(startTimestamp).toISOString()}&endDate=${new Date(endTimestamp).toISOString()}`);
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Formatar para o componente esperar o mesmo formato de retorno
    return {
      chart: {
        result: [{
          timestamp: data.data.map(item => Math.floor(item.unixTime/1000)),
          indicators: {
            quote: [{
              close: data.data.map(item => item.close)
            }]
          }
        }]
      }
    };
  } catch (error) {
    console.error('Error fetching USD/BRL data:', error);
    throw error;
  }
}