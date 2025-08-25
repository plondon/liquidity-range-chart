import React from 'react';

const TIME_OPTIONS = [
  { label: '1 Day', weeks: 1/7 },
  { label: '3 Days', weeks: 3/7 },
  { label: '1 Week', weeks: 1 },
  { label: '2 Weeks', weeks: 2 },
  { label: '1 Month', weeks: 4 },
  { label: '3 Months', weeks: 12 },
  { label: '6 Months', weeks: 24 },
];

interface TimeSelectorProps {
  selectedTimeWeeks: number;
  onTimeChange: (weeks: number) => void;
  disabled?: boolean;
  isMobile?: boolean;
}

const TimeSelector: React.FC<TimeSelectorProps> = ({ 
  selectedTimeWeeks, 
  onTimeChange, 
  disabled = false,
  isMobile = false 
}) => {
  return (
    <div>
      <div style={{ 
        marginBottom: '4px', 
        fontSize: '12px', 
        fontWeight: 'bold',
        color: disabled ? '#999' : 'inherit'
      }}>
        Confidence Band Horizon
      </div>
      <select
        value={selectedTimeWeeks}
        onChange={(e) => onTimeChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{
          fontSize: isMobile ? '10px' : '11px',
          padding: isMobile ? '6px 8px' : '4px 6px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          width: isMobile ? '100px' : '120px',
          minHeight: isMobile ? '32px' : 'auto',
          backgroundColor: disabled ? '#f5f5f5' : 'white',
          color: disabled ? '#999' : 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      >
        {TIME_OPTIONS.map((option) => (
          <option key={option.weeks} value={option.weeks}>
            {option.label}
          </option>
        ))}
      </select>
      <div style={{ 
        fontSize: '10px', 
        color: '#666', 
        marginTop: '2px',
        textAlign: 'center'
      }}>
        95% confidence bands
      </div>
    </div>
  );
};

export default TimeSelector;