import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    console.log("Testando conexão com o banco de dados");
    // Tente uma operação simples
    const count = await prisma.asset.count();
    console.log(`Conexão bem-sucedida. Total de ativos: ${count}`);
    return NextResponse.json({ status: "OK", assets: count });
  } catch (error) {
    console.error("Erro na conexão com o banco:", error);
    // Verifique se o erro é uma instância de Error
    if (error instanceof Error) {
      return NextResponse.json({ status: "ERROR", message: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ status: "ERROR", message: "An unknown error occurred" }, { status: 500 });
    }

  }
}