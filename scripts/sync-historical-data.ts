import { PrismaClient, AssetType } from '@prisma/client'
import { fetchHistoricalData, fetchCDIData, fetchUSDData } from '../services/api'

const prisma = new PrismaClient()

// Definindo interfaces para os dados
interface PriceData {
  close: number;
  unixTime: number;
  volume?: number;
}

interface CDIResponseItem {
  data: string;
  valor: string;
}

interface YahooResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: number[];
        }>;
      };
    }>;
  };
}

// Lista de ativos para sincronizar
const assets = [
  { id: 'BOVA11', name: 'BOVA11 (Ibovespa)', type: 'ETF' as AssetType },
  { id: 'XFIX11', name: 'XFIX11 (IFIX)', type: 'ETF' as AssetType },
  { id: 'IB5M11', name: 'IB5M11 (IMAB5+)', type: 'ETF' as AssetType },
  { id: 'B5P211', name: 'B5P211 (IMAB5)', type: 'ETF' as AssetType },
  { id: 'FIXA11', name: 'FIXA11 (Pré)', type: 'ETF' as AssetType },
  { id: 'CDI', name: 'CDI', type: 'CDI' as AssetType },
  { id: 'USD', name: 'USD/BRL (Dólar)', type: 'CURRENCY' as AssetType },
]

async function syncHistoricalData(): Promise<void> {
  try {
    console.log('Starting historical data sync...')
    
    // Criar ativos no banco
    for (const asset of assets) {
      await prisma.asset.upsert({
        where: { id: asset.id },
        update: { name: asset.name, type: asset.type },
        create: { 
          id: asset.id, 
          name: asset.name, 
          type: asset.type
        }
      })
      console.log(`Asset ${asset.id} processed`)
    }

    // Data de início para dados históricos (5 anos atrás)

    // Data de início para dados históricos (5 anos atrás)
    const startTimestamp = Math.floor(Date.now() / 1000) - 5 * 365 * 24 * 60 * 60
    // Data de fim para dados históricos (hoje)
    const endTimestamp = Math.floor(Date.now() / 1000)
    

    // Para cada ativo, buscar dados históricos
    for (const asset of assets) {
       if (asset.id === 'CDI') {
        // Tratar CDI
        try {
          const cdiData = await fetchCDIData()
          const processedData = processCDIData(cdiData, startTimestamp, endTimestamp)
          
          // Inserir no banco
          await insertPrices(asset.id, processedData)
        } catch (error) {
          console.error(`Error syncing CDI data:`, error)
        }
      } else if (asset.id === 'USD') {
        // Tratar USD
        try {
          const usdData = await fetchUSDData(startTimestamp, endTimestamp)
          if (usdData?.chart?.result?.[0]) {
            const processedData = processUSDData(usdData)
            
            // Inserir no banco
            await insertPrices(asset.id, processedData)
          }
        } catch (error) {
          console.error(`Error syncing USD data:`, error)
        }
      } else {
        // Tratar outros ativos
        try {
          const data = await fetchHistoricalData(asset.id)
          if (data?.data) {
            // Inserir no banco
            await insertPrices(asset.id, data.data)
          }
        } catch (error) {
          console.error(`Error syncing ${asset.id} data:`, error)
        }
      }
    }

    console.log('Historical data sync completed')
  } catch (error) {
    console.error('Error in historical data sync:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Função auxiliar para inserir preços no banco
async function insertPrices(assetId: string, priceData: PriceData[]): Promise<void> {
  // Verificar se há dados para inserir
  if (!priceData || !Array.isArray(priceData) || priceData.length === 0) {
    console.warn(`No price data to insert for ${assetId}`)
    return
  }

  console.log(`Inserting ${priceData.length} prices for ${assetId}...`)
  
  // Inserir em blocos para evitar limitações do banco
  const batchSize = 1000
  for (let i = 0; i < priceData.length; i += batchSize) {
    const batch = priceData.slice(i, i + batchSize)
    
    try {
      await prisma.assetPrice.createMany({
        data: batch.map(item => ({
          assetId,
          date: new Date(item.unixTime),
          price: item.close,
          // Adicione volume se disponível
          ...(item.volume && { volume: item.volume })
        })),
        skipDuplicates: true
      })
    } catch (error) {
      console.error(`Error inserting price batch for ${assetId}:`, error)
    }
  }
  
  console.log(`Finished inserting prices for ${assetId}`)
}

// Função para processar dados do CDI
function processCDIData(cdiData: CDIResponseItem[], startTimestamp: number, endTimestamp: number): PriceData[] {
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
  const processedData: PriceData[] = [];
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
}

// Função para processar dados do USD
function processUSDData(yahooData: YahooResponse): PriceData[] {
  try {
    const result = yahooData.chart.result[0];
    const timestamps = result.timestamp || [];
    const closePrices = result.indicators.quote[0].close || [];
    
    // Converter timestamp para milissegundos e extrair preços de fechamento
    const processedData: PriceData[] = [];
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
}

// Executar o script
syncHistoricalData()