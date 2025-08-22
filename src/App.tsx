import React, { useState } from 'react';
import D3Chart from './LiquidityRangeChart/D3Chart';
import './App.css';
import priceData from './LiquidityRangeChart/data/price';
import liquidityData from './LiquidityRangeChart/data/liquidity';
import { LiquidityDataPoint } from 'LiquidityRangeChart/types';
import D3Chart2 from 'LiquidityRangeChart/D3Chart2';

const App: React.FC = () => {
    const [hoveredTick, setHoveredTick] = useState<LiquidityDataPoint | null>(null);
    const [minPrice, setMinPrice] = useState<number | null>(null);
    const [maxPrice, setMaxPrice] = useState<number | null>(null);

    const handleHoverTick = (tick: LiquidityDataPoint | null) => {
        if (tick) { 
            setHoveredTick(tick);
        } else {
            setHoveredTick(null);
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
            <div style={{ fontSize: '12px' }}>Hovered Tick: {JSON.stringify(hoveredTick, null, 2)}</div>
            <div style={{ fontSize: '12px' }}>Min Price: {minPrice}</div>
            <div style={{ fontSize: '12px' }}>Max Price: {maxPrice}</div>
        </div>
        <D3Chart data={priceData} liquidityData={liquidityData} onHoverTick={handleHoverTick} onMinPrice={handleMinPrice} onMaxPrice={handleMaxPrice} />
        {/* <D3Chart2 data={priceData} onHoverTick={handleHoverTick}  /> */}
      </header>
    </div>
  );
}

export default App;