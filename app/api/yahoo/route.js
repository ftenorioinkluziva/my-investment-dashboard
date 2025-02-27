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
    // Verificar se a resposta é bem-sucedida
    if (!response.ok) {
      throw new Error(`Yahoo API responded with status: ${response.status}`);
    }
    
    // Obter dados da resposta
    const data = await response.json();
    
    // Verificar se os dados foram retornados corretamente  
    if (!data || !data.chart || !data.chart.result || !data.chart.result[0] || !data.chart.result[0].indicators || !data.chart.result[0].indicators.quote || !data.chart.result[0].indicators.quote[0] || !data.chart.result[0].indicators.quote[0].close) {
      throw new Error('Invalid data returned from Yahoo Finance');
    }
    
    // Converter os dados para o formato desejado com data legível
    const formattedData = data.chart.result[0].indicators.quote[0].close.map((close, index) => {
      const timestamp = data.chart.result[0].timestamp[index];
      const date = new Date(timestamp * 1000).toISOString();  // Converter timestamp UNIX para formato ISO
      return {
        date: date,
        close: close,
      };
    });

    console.log(formattedData);

    // Retornar os dados filtrados para o cliente
    return Response.json(formattedData, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching data from Yahoo Finance:', error);
    return Response.json(
      { error: 'Failed to fetch data from Yahoo Finance' },
      { status: 500 }
    );
  }
}
