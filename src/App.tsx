import React, { useState } from 'react';
import D3Chart from './LiquidityRangeChart/D3Chart';
import './App.css';
import priceData from './LiquidityRangeChart/data/price';
import liquidityData from './LiquidityRangeChart/data/liquidity';
import { LiquidityDataPoint } from 'LiquidityRangeChart/types';

const App: React.FC = () => {
    const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);
    const [minPrice, setMinPrice] = useState<number | null>(null);
    const [maxPrice, setMaxPrice] = useState<number | null>(null);

    const handleHoverTick = (tick: LiquidityDataPoint | null) => {
        if (tick) {
            setHoveredPrice(tick.price0);
        } else {
            setHoveredPrice(null);
        }
    }

    const handleMinPrice = (price: number) => {
        setMinPrice(price);
    }

    const handleMaxPrice = (price: number) => {
        setMaxPrice(price);
    }
    
  return (
    <div className="App">
      <header className="App-header">
        <h1>Liquidity Range Chart</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexDirection: 'column' }}>
            <div style={{ fontSize: '12px' }}>Hovered Price: {hoveredPrice}</div>
            <div style={{ fontSize: '12px' }}>Min Price: {minPrice}</div>
            <div style={{ fontSize: '12px' }}>Max Price: {maxPrice}</div>
        </div>
        <D3Chart data={priceData} liquidityData={liquidityData} onHoverTick={handleHoverTick} onMinPrice={handleMinPrice} onMaxPrice={handleMaxPrice} />
      </header>
    </div>
  );
}

export default App;