export async function GET(request) {
    // Obter parâmetros da URL
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval');
    const period1 = searchParams.get('period1');
    const period2 = searchParams.get('period2');
    
    // Validar parâmetros obrigatórios
    if (!symbol || !interval || !period1 || !period2) {
      return Response.json(
        { error: 'Missing required parameters: symbol, interval, period1, period2' },
        { status: 400 }
      );
    }
    
    try {
      // Construir URL do Yahoo Finance
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&period1=${period1}&period2=${period2}&events=div,splits&includePrePost=true`;
      
      // Fazer a requisição para o Yahoo Finance
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Yahoo API responded with status: ${response.status}`);
      }
      
      // Obter dados da resposta
      const data = await response.json();
      
      // Retornar os dados para o cliente
      return Response.json(data);
    } catch (error) {
      console.error('Error fetching data from Yahoo Finance:', error);
      return Response.json(
        { error: 'Failed to fetch data from Yahoo Finance' },
        { status: 500 }
      );
    }
  }