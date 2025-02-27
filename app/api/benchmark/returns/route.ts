// app/api/benchmark/returns/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AssetType } from '@prisma/client';

// Interface de resultado para tipagem forte
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
  const period = searchParams.get('period') || '1Y'; // Default to 1 year
  const symbols = searchParams.get('symbols')?.split(',') || [];

  if ((!startDate || !endDate) && !period) {
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
    let start: Date;
    let end: Date = new Date();

    // Determine the date range based on parameters
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Calculate start date based on period
      start = new Date();
      const yearsToSubtract = period === '1Y' ? 1 : period === '3Y' ? 3 : 5;
      start.setFullYear(start.getFullYear() - yearsToSubtract);
    }

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

          // Get the first price after the start date
          const firstPrice = await prisma.assetPrice.findFirst({
            where: {
              assetId: symbol,
              date: {
                gte: start
              }
            },
            orderBy: {
              date: 'asc'
            }
          });

          if (!firstPrice) {
            return {
              id: symbol,
              error: 'No price data available at start date',
              return: null
            };
          }

          // Get the last price before the end date
          const lastPrice = await prisma.assetPrice.findFirst({
            where: {
              assetId: symbol,
              date: {
                lte: end
              }
            },
            orderBy: {
              date: 'desc'
            }
          });

          if (!lastPrice) {
            return {
              id: symbol,
              error: 'No price data available at end date',
              return: null
            };
          }

          // Calculate return percentage - with special handling for CDI
          let returnValue: number;
          if (symbol === 'CDI') {
            // Para o CDI, usamos o valor diretamente, pois já representa um retorno acumulado
            returnValue = lastPrice.price;
          } else {
            // Para outros ativos, calculamos o retorno percentual normal
            returnValue = ((lastPrice.price - firstPrice.price) / firstPrice.price) * 100;
          }

          return {
            id: symbol,
            name: asset.name,
            type: asset.type,
            return: returnValue,
            firstDate: firstPrice.date,
            lastDate: lastPrice.date,
            firstPrice: firstPrice.price,
            lastPrice: lastPrice.price
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