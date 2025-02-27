/**
 * Calcula o retorno acumulado a partir de uma série de preços
 * @param prices Array de preços com data e valor
 * @param isCompounded Indica se deve usar cálculo de juros compostos (para CDI) ou soma simples
 * @returns Retorno acumulado em percentual
 */
export function calculateReturn(
    prices: Array<{ price: number; date: Date | number }>, 
    isCompounded = false
  ): number {
    if (!prices || prices.length < 2) return 0;
    
    // Ordenar preços por data (garantindo que funcionará com Date ou timestamp)
    const sortedPrices = [...prices].sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date.getTime() : Number(a.date);
      const dateB = b.date instanceof Date ? b.date.getTime() : Number(b.date);
      return dateA - dateB;
    });
    
    if (isCompounded) {
      // Método de juros compostos (melhor para CDI e cálculos financeiros precisos)
      let accumulatedValue = 1.0;
      for (const price of sortedPrices) {
        const rate = price.price / 100;
        accumulatedValue *= (1 + rate);
      }
      return (accumulatedValue - 1) * 100;
    } else {
      // Método simples (soma de retornos diários)
      let cumulativeReturn = 0;
      for (let i = 1; i < sortedPrices.length; i++) {
        const dailyReturn = ((sortedPrices[i].price / sortedPrices[i-1].price) - 1) * 100;
        cumulativeReturn += dailyReturn;
      }
      return cumulativeReturn;
    }
  }
  
  /**
   * Verifica se um valor de retorno é válido e dentro de limites razoáveis
   * @param value O valor de retorno a ser validado
   * @param maxLimit Limite máximo aceitável (padrão: 300%)
   * @returns O valor validado ou null se for inválido
   */
  export function validateReturnValue(value: number | null, maxLimit: number = 300): number | null {
    if (value === null) return null;
    
    // Verificar se é um número e está dentro de limites razoáveis
    if (isNaN(value) || !isFinite(value) || Math.abs(value) > maxLimit) {
      console.warn(`Valor de retorno anormal detectado: ${value}. Será tratado como nulo.`);
      return null;
    }
    
    return value;
  }