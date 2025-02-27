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
            // Para o CDI, usamos o valor diretamente, pois já representa um retorno acumulado
            returnValue = prices[prices.length - 1].price;
          } else {
            // Para outros ativos, calculamos o retorno acumulado correto
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
          assetReturns.set(result.id, result.return);
        }
      });

      // Calculate weighted portfolio return
      let portfolioReturn = 0;
      const missingComponents: string[] = [];
      let totalWeightApplied = 0;

      Object.entries(portfolio).forEach(([assetId, weight]) => {
        if (assetReturns.has(assetId)) {
          const assetReturn = assetReturns.get(assetId);
          if (assetReturn !== undefined) {
            portfolioReturn += assetReturn * weight;
            totalWeightApplied += weight;
          }
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

// Função auxiliar para calcular o retorno acumulado
function calculateAccumulatedReturn(prices: { price: number; date: Date }[]): number {
  if (!prices || prices.length < 2) {
    return 0;
  }
  
  let accumulatedReturn = 0;
  
  for (let i = 1; i < prices.length; i++) {
    const previousPrice = prices[i - 1].price;
    const currentPrice = prices[i].price;
    const dailyReturn = (currentPrice / previousPrice) - 1;
    
    // Acumular retorno (1 + dailyReturn1) * (1 + dailyReturn2) * ... - 1
    if (i === 1) {
      accumulatedReturn = dailyReturn;
    } else {
      accumulatedReturn = (1 + accumulatedReturn) * (1 + dailyReturn) - 1;
    }
  }
  
  return accumulatedReturn * 100; // Converter para percentual
}