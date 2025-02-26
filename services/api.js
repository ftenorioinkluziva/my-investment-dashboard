import { login } from './auth';

const API_URL = 'https://svc.aebroadcast.com.br/stock/v1';
let authToken = null;

async function getToken() {
  if (!authToken) {
    authToken = await login();
  }
  return authToken;
}

export async function fetchHistoricalData(symbol, resolution = 'D', period = '5Y') {
  try {
    // Primeiro, tente obter os dados do banco local
    const localResponse = await fetch(`/api/historical?symbol=${symbol}&period=${period}`);
    
    if (localResponse.ok) {
      const data = await localResponse.json();
      if (data && data.data && data.data.length > 0) {
        console.log(`Fetched ${symbol} data from local database`);
        return data;
      }
    }
    
    // Se não conseguir do banco local, busque da API externa
    console.log(`Fetching ${symbol} data from external API`);
    return fetchHistoricalDataFromAPI(symbol, resolution);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    // Se falhar, tente a API externa
    return fetchHistoricalDataFromAPI(symbol, resolution);
  }
}

// Função original, renomeada
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
    //console.log('Historical data for', symbol, ':', data);
    return data;
  } catch (error) {
    console.error('Error fetching historical data from API:', error);
    throw error;
  }
}

export async function fetchCDIData() {
  try {
    const response = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching CDI data:', error);
    throw error;
  }
}

export async function fetchUSDData(startTimestamp, endTimestamp) {
  try {
    // Converter timestamps para segundos (formato esperado pelo Yahoo Finance)
    const period1 = Math.floor(startTimestamp / 1000);
    const period2 = Math.floor(endTimestamp / 1000);
    
    // Fazer requisição para nossa API local em vez do Yahoo Finance diretamente
    //const url = `/api/yahoo?symbol=USDBRL=X&interval=1d&period1=${period1}&period2=${period2}`;
    const url = `http://localhost:3000/api/yahoo?symbol=USDBRL=X&interval=1d&period1=${period1}&period2=${period2}`;
//    const url = `http://localhost:3000/api/yahoo?symbol=USDBRL=X&interval=1d&period1=1577847600&period2=1740532985`;

    console.log('Fetching USD data from URL:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching USD/BRL data:', error);
    throw error;
  }
}