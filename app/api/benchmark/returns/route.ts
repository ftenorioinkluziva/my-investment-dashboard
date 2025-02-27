// app/api/benchmark/returns/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AssetType } from '@prisma/client';

// Interface para tipagem forte
interface AssetResult {
  id: string;
  name?: string;
  type?: AssetType;
  error?: string;
  return: number | null;
  firstDate?: Date;
  lastDate?: Date;
  firstPrice?: number;
  lastPrice?: number;
  warning?: string;
  components?: string[];
  weights?: Record<string, number>;
  availableWeight?: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  //const period = searchParams.get('period') || '1Y'; // Default to 1 year
  const symbols = searchParams.get('symbols')?.split(',') || [];

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'Either startDate and endDate OR period must be provided' },
      { status: 400 }
    );
  }

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: 'At least one symbol must be provided' },
      { status: 400 }
    );
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Get the results for each symbol
    const results = await Promise.all(
      symbols.map(async (symbol): Promise<AssetResult | null> => {
        try {
          // Ignore PORTFOLIO symbol - will be calculated separately
          if (symbol === 'PORTFOLIO') {
            return null;
          }

          // Verify asset exists
          const asset = await prisma.asset.findUnique({
            where: { id: symbol }
          });

          if (!asset) {
            return {
              id: symbol,
              error: 'Asset not found',
              return: null
            };
          }

          // Buscar todos os preços no período para cálculo do retorno acumulado
          const prices = await prisma.assetPrice.findMany({
            where: {
              assetId: symbol,
              date: {
                gte: start,
                lte: end
              }
            },
            orderBy: {
              date: 'asc'
            },
            select: {
              price: true,
              date: true
            }
          });

          if (prices.length === 0) {
            return {
              id: symbol,
              error: 'No price data available in selected period',
              return: null
            };
          }

          if (prices.length === 1) {
            return {
              id: symbol,
              error: 'Need at least two data points to calculate return',
              return: null,
              firstDate: prices[0].date,
              lastDate: prices[0].date,
              firstPrice: prices[0].price,
              lastPrice: prices[0].price
            };
          }

          // Calcular retorno acumulado com tratamento especial para CDI
          let returnValue: number;
          
          if (symbol === 'CDI') {
            // CORRIGIDO: Para o CDI, somamos todos os valores diários para obter o retorno acumulado
            // Os valores já estão em percentual diário, então precisamos acumulá-los corretamente
            returnValue = calculateCDIAccumulatedReturn(prices);
          } else {
            // Para outros ativos, calculamos o retorno acumulado usando a fórmula padrão
            returnValue = calculateAccumulatedReturn(prices);
          }

          return {
            id: symbol,
            name: asset.name,
            type: asset.type,
            return: returnValue,
            firstDate: prices[0].date,
            lastDate: prices[prices.length - 1].date,
            firstPrice: prices[0].price,
            lastPrice: prices[prices.length - 1].price
          };
        } catch (error) {
          console.error(`Error processing ${symbol}:`, error);
          return {
            id: symbol,
            error: 'Failed to process asset data',
            return: null
          };
        }
      })
    );

    // Filter out null values (from PORTFOLIO placeholder)
    const validResults = results.filter((result): result is AssetResult => result !== null);


    console.log('Results:', validResults);
    
    // Calculate portfolio return if requested
    if (symbols.includes('PORTFOLIO')) {
      // Portfolio allocation
      const portfolio: Record<string, number> = {
        'BOVA11': 0.05,  // 5%
        'XFIX11': 0.14,  // 14%
        'IB5M11': 0.08,  // 8%
        'CDI': 0.12,     // 12%
        'B5P211': 0.20,  // 20% (IMAB5)
        'USD': 0.06,     // 6%
        'FIXA11': 0.35   // 35%
      };

      // Get all returns from individual assets
      const assetReturns = new Map<string, number>();

    validResults.forEach(result => {
      if (result.return !== null) {
        result.return = validateReturnValue(result.return);
      }
    });

      // Calculate weighted portfolio return
      const portfolioReturn = calculateWeightedPortfolioReturn(assetReturns, portfolio);
      const missingComponents: string[] = [];
      let totalWeightApplied = 0;

      Object.entries(portfolio).forEach(([assetId, weight]) => {
        if (assetReturns.has(assetId)) {
          totalWeightApplied += weight;
        } else {
          missingComponents.push(assetId);
        }
      });

      // Add portfolio to results
      if (missingComponents.length === 0) {
        validResults.push({
          id: 'PORTFOLIO',
          name: 'Tenas Risk Parity',
          type: 'ETF', // Usando um tipo válido do enum AssetType
          return: portfolioReturn,
          components: Object.keys(portfolio),
          weights: portfolio
        });
      } else if (totalWeightApplied > 0) {
        // Partial portfolio calculation (normalize by available weight)
        const normalizedReturn = portfolioReturn / totalWeightApplied * 100;
        validResults.push({
          id: 'PORTFOLIO',
          name: 'Tenas Risk Parity (Partial)',
          type: 'ETF', // Usando um tipo válido do enum AssetType
          return: normalizedReturn,
          warning: `Missing components: ${missingComponents.join(', ')}`,
          availableWeight: totalWeightApplied,
          components: Object.keys(portfolio).filter(id => !missingComponents.includes(id)),
          weights: portfolio
        });
      } else {
        validResults.push({
          id: 'PORTFOLIO',
          name: 'Tenas Risk Parity',
          type: 'ETF', // Usando um tipo válido do enum AssetType
          error: `Missing all components: ${missingComponents.join(', ')}`,
          return: null
        });
      }
    }

    return NextResponse.json({
      startDate: start,
      endDate: end,
      results: validResults
    });
  } catch (error) {
    console.error('Error calculating benchmark returns:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : null;
    
    return NextResponse.json(
      { 
        error: 'Failed to calculate benchmark returns',
        message: errorMessage,
        stack: process.env.NODE_ENV !== 'production' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

function calculateAccumulatedReturn(prices: { price: number; date: Date }[]): number {
    if (!prices || prices.length < 2) {
      return 0;
    }
    
    // Ordenar preços por data em ordem crescente (do mais antigo para o mais recente)
    const sortedPrices = prices.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    let cumulativeReturn = 0;
    
    for (let i = 1; i < sortedPrices.length; i++) {
      const previousPrice = sortedPrices[i - 1].price;
      const currentPrice = sortedPrices[i].price;
      
      // Calcular retorno diário
      const dailyReturn = ((currentPrice / previousPrice) - 1) * 100;
      
      // Acumular retornos
      cumulativeReturn += dailyReturn;
    }
    
    return cumulativeReturn;
  }

// NOVA FUNÇÃO: Cálculo específico para o CDI
function calculateCDIAccumulatedReturn(prices: { price: number; date: Date }[]): number {
  if (!prices || prices.length === 0) {
    return 0;
  }
  
  // Para o CDI, os valores diários são taxas percentuais
  // Precisamos acumular usando juros compostos: (1 + r1) * (1 + r2) * ... * (1 + rn) - 1
  let accumulatedValue = 1.0; // Começamos com 1 (100%)
  
  prices.forEach(price => {
    // O valor do CDI está em percentual (ex: 0.05 para 0.05%)
    // Convertemos para decimal para cálculo (ex: 0.0005 para 0.05%)
    const dailyRate = price.price / 100;
    accumulatedValue *= (1 + dailyRate);
  });
  
  // Converter para percentual e retornar
  return (accumulatedValue - 1) * 100;
  }

function calculateWeightedPortfolioReturn(assetReturns: Map<string, number>, portfolio: Record<string, number>): number {
    let portfolioReturn = 0;
    let totalWeightApplied = 0;
  
    Object.entries(portfolio).forEach(([assetId, weight]) => {
      if (assetReturns.has(assetId)) {
        const assetReturn = assetReturns.get(assetId);
        if (assetReturn !== undefined) {
          portfolioReturn += assetReturn * weight;
          totalWeightApplied += weight;
        }
      }
    });
  
    // Se não conseguimos aplicar todo o peso, normalizamos o retorno
    if (totalWeightApplied > 0 && totalWeightApplied < 1) {
      // Normalizar o retorno para considerar apenas os ativos presentes
      portfolioReturn = portfolioReturn / totalWeightApplied;
    }
  
    return portfolioReturn;
  }

/**
 * Verifica se um valor de retorno é válido e dentro de limites razoáveis
 * @param value O valor de retorno a ser validado
 * @param maxLimit Limite máximo aceitável (padrão: 300%)
 * @returns O valor validado ou null se for inválido
 */
function validateReturnValue(value: number | null, maxLimit: number = 300): number | null {
  if (value === null) return null;
  
  // Verificar se é um número e está dentro de limites razoáveis
  if (isNaN(value) || !isFinite(value) || Math.abs(value) > maxLimit) {
    console.warn(`Valor de retorno anormal detectado: ${value}. Será tratado como nulo.`);
    return null;
  }
  
  return value;
}  