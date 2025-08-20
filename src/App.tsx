import React from 'react';
import D3Chart from './LiquidityRangeChart/D3Chart';
import './App.css';
import priceData from './LiquidityRangeChart/data/price';
import liquidityData from './LiquidityRangeChart/data/liquidity';

const App: React.FC = () => {
  return (
    <div className="App">
      <header className="App-header">
        <h1>TradingView Chart MVP</h1>
        <D3Chart data={priceData} liquidityData={liquidityData} />
      </header>
    </div>
  );
}

export default App;