// components/DateRangePicker.jsx
import React, { useState } from 'react';

const DateRangePicker = ({ onApply, isDark }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  
  const handleApply = () => {
    if (startDate && endDate) {
      onApply(startDate, endDate);
      setShowPicker(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={`px-4 py-2 rounded-md transition-colors ${
          isDark 
            ? 'bg-gray-700 hover:bg-gray-600 text-white' 
            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
        }`}
      >
        Período personalizado
      </button>
      
      {showPicker && (
        <div 
          className={`absolute mt-2 p-4 rounded-md shadow-lg z-10 ${
            isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
          }`}
          style={{ width: '300px', right: 0 }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data inicial</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-md ${
                  isDark 
                    ? 'bg-gray-700 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Data final</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-md ${
                  isDark 
                    ? 'bg-gray-700 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}
              />
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setShowPicker(false)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  isDark 
                    ? 'bg-gray-600 hover:bg-gray-500' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Cancelar
              </button>
              
              <button
                onClick={handleApply}
                disabled={!startDate || !endDate}
                className={`px-4 py-2 rounded-md transition-colors ${
                  !startDate || !endDate
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                } ${
                  isDark 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                    : 'bg-blue-500 hover:bg-blue-400 text-white'
                }`}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;