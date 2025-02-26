import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  console.log("Endpoint /api/yahoo/historical chamado");
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const period = searchParams.get('period') || '3Y';
  console.log(`Parâmetros recebidos: symbol=${symbol}, period=${period}`);
  
  if (!symbol) {
    return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
  }

  try {
    // Verificar se o ativo existe
    const asset = await prisma.asset.findUnique({
      where: { id: symbol }
    });

    if (!asset) {
      console.log(`Ativo ${symbol} não encontrado no banco de dados`);
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Calcular data de início com base no período
    const now = new Date();
    const yearsToSubtract = period === '1Y' ? 1 : period === '3Y' ? 3 : 5;
    const startDate = new Date();
    startDate.setFullYear(now.getFullYear() - yearsToSubtract);

    // Buscar preços do banco
    const prices = await prisma.assetPrice.findMany({
      where: {
        assetId: symbol,
        date: {
          gte: startDate
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