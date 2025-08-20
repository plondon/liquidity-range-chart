import React, { useState } from 'react';
import D3Chart from './LiquidityRangeChart/D3Chart';
import './App.css';
import priceData from './LiquidityRangeChart/data/price';
import liquidityData from './LiquidityRangeChart/data/liquidity';
import { LiquidityDataPoint } from 'LiquidityRangeChart/types';

const App: React.FC = () => {
    const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);

    const handleHoverTick = (tick: LiquidityDataPoint | null) => {
        if (tick) {
            setHoveredPrice(tick.price0);
        } else {
            setHoveredPrice(null);
        }
    }
    
  return (
    <div className="App">
      <header className="App-header">
        <h1>Liquidity Range Chart</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px' }}>Hovered Price: {hoveredPrice}</span>
        </div>
        <D3Chart data={priceData} liquidityData={liquidityData} onHoverTick={handleHoverTick} />
      </header>
    </div>
  );
}

export default App;