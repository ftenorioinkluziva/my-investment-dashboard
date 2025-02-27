// app/api/yahoo/historical/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  console.log("Endpoint /api/yahoo/historical chamado");
  const { searchParams } = new URL(request.url);
  console.log("Parâmetros da URL:", searchParams);
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

    console.log(`Ativo ${symbol} encontrado. Tipo: ${asset.type}`);

    // Calcular data de início com base no período
    const now = new Date();
    const yearsToSubtract = period === '1Y' ? 1 : period === '3Y' ? 3 : 5;
    const startDate = new Date();
    startDate.setFullYear(now.getFullYear() - yearsToSubtract);
    
    console.log(`Buscando preços desde ${startDate.toISOString()}`);

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

    console.log(`Encontrados ${prices.length} registros de preços para ${symbol}`);

    if (prices.length === 0) {
      console.log(`Nenhum preço encontrado para ${symbol} no período especificado`);
      return NextResponse.json({ data: [] });
    }

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
    // Retornar detalhes do erro para facilitar diagnóstico
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : null;
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch historical data',
        message: errorMessage,
        stack: errorStack 
      },
      { status: 500 }
    );
  }
}