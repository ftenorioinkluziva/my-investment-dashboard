// app/api/benchmark/returns/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
      symbols.map(async (symbol) => {
        try {
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

          let returnValue: number;

          // Special handling for CDI, which is already in percentage terms
          if (symbol === 'CDI') {
            // Para o CDI, usamos o valor diretamente, pois já representa um retorno acumulado
            returnValue = lastPrice.price;
          } else {
            // Calculate return percentage for other assets
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

    // Calculate portfolio return if requested
    if (symbols.includes('PORTFOLIO')) {
      // Portfolio allocation
      const portfolio = {
        'BOVA11': 0.05,  // 5%
        'XFIX11': 0.14,  // 14%
        'IB5M11': 0.08,  // 8%
        'CDI': 0.12,     // 12%
        'B5P211': 0.20,  // 20% (IMAB5)
        'USD': 0.06,     // 6%
        'FIXA11': 0.35   // 35%
      };

      // Get all returns from individual assets
      const assetReturns = new Map();
      results.forEach(result => {
        if (result.id !== 'PORTFOLIO' && result.return !== null) {
          assetReturns.set(result.id, result.return);
        }
      });

      // Calculate weighted portfolio return
      let portfolioReturn = 0;
      let missingComponents = [];

      Object.entries(portfolio).forEach(([assetId, weight]) => {
        if (assetReturns.has(assetId)) {
          portfolioReturn += assetReturns.get(assetId) * weight;
        } else {
          missingComponents.push(assetId);
        }
      });

      // Add portfolio to results
      if (missingComponents.length === 0) {
        results.push({
          id: 'PORTFOLIO',
          name: 'Tenas Risk Parity',
          type: 'ETF',
          return: portfolioReturn,
          components: Object.keys(portfolio)
        });
      } else {
        results.push({
          id: 'PORTFOLIO',
          error: `Missing components: ${missingComponents.join(', ')}`,
          return: null
        });
      }
    }

    return NextResponse.json({
      startDate: start,
      endDate: end,
      results: results
    });
  } catch (error) {
    console.error('Error calculating benchmark returns:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to calculate benchmark returns',
        message: errorMessage
      },
      { status: 500 }
    );
  }
}