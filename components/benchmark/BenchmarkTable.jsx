// components/benchmark/BenchmarkTable.jsx
import React from 'react';

const BenchmarkTable = ({ benchmarks, benchmarkReturns, periodDisplayInfo, isDark, showPortfolio }) => {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="text-left py-2">Benchmark</th>
          <th className="text-right py-2">
            Retorno {periodDisplayInfo}
          </th>
        </tr>
      </thead>
      <tbody>
        {benchmarks.map((benchmark) => {
          // Se for o portfólio e estiver oculto, não mostrar na tabela
          if (benchmark.isPortfolio && !showPortfolio) {
            return null;
          }
          
          const returnValue = benchmarkReturns[benchmark.id];
          const hasReturn = returnValue !== undefined && returnValue !== null;
          
          const isPortfolio = benchmark.isPortfolio;
          
          return (
            <tr 
              key={benchmark.id} 
              className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} ${isPortfolio ? (isDark ? 'bg-gray-700/30' : 'bg-pink-50') : ''}`}
            >
              <td className="py-2">
                <div className="flex items-center">
                  <div 
                    className={`w-3 h-3 rounded-full mr-2 ${isPortfolio ? 'animate-pulse' : ''}`}
                    style={{ backgroundColor: benchmark.color }}
                  />
                  <span className={isPortfolio ? 'font-bold' : ''}>
                    {benchmark.name}
                    {isPortfolio && ' 🔥'}
                  </span>
                </div>
              </td>
              <td className={`text-right py-2 ${isPortfolio ? 'font-bold' : ''}`}>
                {hasReturn ? `${returnValue.toFixed(2)}%` : '-'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default BenchmarkTable;