// components/benchmark/PeriodSelector.jsx
import React from 'react';
import DateRangePicker from './DateRangePicker';

const PeriodSelector = ({ selectedPeriod, isDark, onSelectPeriod, onSelectCustomPeriod }) => {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelectPeriod('1Y')}
        className={`px-4 py-2 rounded-md transition-colors ${
          selectedPeriod === '1Y'
            ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
            : isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
        }`}
      >
        1 Ano
      </button>
      <button
        onClick={() => onSelectPeriod('3Y')}
        className={`px-4 py-2 rounded-md transition-colors ${
          selectedPeriod === '3Y'
            ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
            : isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
        }`}
      >
        3 Anos
      </button>
      <button
        onClick={() => onSelectPeriod('5Y')}
        className={`px-4 py-2 rounded-md transition-colors ${
          selectedPeriod === '5Y'
            ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
            : isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
        }`}
      >
        5 Anos
      </button>
      <DateRangePicker 
        onApply={onSelectCustomPeriod}
        isDark={isDark}
      />
    </div>
  );
};

export default PeriodSelector;