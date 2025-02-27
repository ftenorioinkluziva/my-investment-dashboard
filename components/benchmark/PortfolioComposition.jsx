// components/benchmark/PortfolioComposition.jsx
import React from 'react';

const PortfolioComposition = ({ portfolio, benchmarks, isDark }) => {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold mb-2">Composição do Tenas Risk Parity</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Object.entries(portfolio.allocation).map(([assetId, weight]) => {
          const benchmark = benchmarks.find(b => b.id === assetId);
          return (
            <div key={assetId} className={`p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <div className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: benchmark?.color || '#ccc' }}
                />
                <span className="text-sm font-medium">
                  {benchmark?.name || assetId}: {(weight * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PortfolioComposition;