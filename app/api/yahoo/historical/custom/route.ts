// app/api/historical/custom/route.js
import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  if (!symbol) {
    return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Both startDate and endDate parameters are required' }, { status: 400 });
  }

  try {
    // Converter as strings de data para objetos Date
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Verificar se as datas são válidas
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Verificar se o ativo existe
    const asset = await prisma.asset.findUnique({
      where: { id: symbol }
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Buscar preços do banco para o período especificado
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
      }
    });

    // Converter para o formato esperado pelo frontend
    return NextResponse.json({
      data: prices.map(price => ({
        close: price.price,
        unixTime: price.date.getTime(),
        volume: price.volume || undefined
      }))
    });
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch historical data' },
      { status: 500 }
    );
  }
}