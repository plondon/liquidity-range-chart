import React, { useState } from 'react';
import D3Chart from './LiquidityRangeChart/D3Chart';
import PairSelector from './LiquidityRangeChart/components/PairSelector';
import './App.css';
import { LiquidityDataPoint } from 'LiquidityRangeChart/types';
import type { PairId } from './LiquidityRangeChart/components/PairSelector';

import ethUsdcPriceData from './LiquidityRangeChart/data/eth-usdc/price';
import ethUsdcLiquidityData from './LiquidityRangeChart/data/eth-usdc/liquidity';

import uniUsdcPriceData from './LiquidityRangeChart/data/uni-usdc/price';
import uniUsdcLiquidityData from './LiquidityRangeChart/data/uni-usdc/liquidity';
import usdcUsdtPriceData from './LiquidityRangeChart/data/usdc-usdt/price';
import usdcUsdtLiquidityData from './LiquidityRangeChart/data/usdc-usdt/liquidity';
import wbtcUsdcPriceData from './LiquidityRangeChart/data/wbtc-usdc/price';
import wbtcUsdcLiquidityData from './LiquidityRangeChart/data/wbtc-usdc/liquidity';

const PAIR_DATA = {
  'eth-usdc': {
    priceData: ethUsdcPriceData,
    liquidityData: ethUsdcLiquidityData
  },
  'uni-usdc': {
    priceData: uniUsdcPriceData,
    liquidityData: uniUsdcLiquidityData
  },
  'usdc-usdt': {
    priceData: usdcUsdtPriceData,
    liquidityData: usdcUsdtLiquidityData
  },
  'wbtc-usdc': {
    priceData: wbtcUsdcPriceData,
    liquidityData: wbtcUsdcLiquidityData
  } 
} as const;

const App: React.FC = () => {
    const [hoveredTick, setHoveredTick] = useState<LiquidityDataPoint | null>(null);
    const [minPrice, setMinPrice] = useState<number | null>(null);
    const [maxPrice, setMaxPrice] = useState<number | null>(null);
    const [selectedPair, setSelectedPair] = useState<PairId>('eth-usdc');

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

    const handlePairChange = (pairId: PairId) => {
        setSelectedPair(pairId);
        setMinPrice(null);
        setMaxPrice(null);
    };

    const currentData = PAIR_DATA[selectedPair];

  return (
    <div className="App">
      <header className="App-header">
        <h1>Liquidity Range Chart</h1>
        
        <PairSelector 
          selectedPair={selectedPair}
          onPairChange={handlePairChange}
        />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexDirection: 'column' }}>
            <div style={{ fontSize: '12px' }}>Hovered Tick: {JSON.stringify(hoveredTick, null, 2)}</div>
            <div style={{ fontSize: '12px' }}>Min Price: {minPrice}</div>
            <div style={{ fontSize: '12px' }}>Max Price: {maxPrice}</div>
        </div>
        
        <D3Chart 
          key={selectedPair}
          data={currentData.priceData} 
          liquidityData={currentData.liquidityData} 
          onHoverTick={handleHoverTick} 
          onMinPrice={handleMinPrice} 
          onMaxPrice={handleMaxPrice} 
        />
      </header>
    </div>
  );
}

export default App;