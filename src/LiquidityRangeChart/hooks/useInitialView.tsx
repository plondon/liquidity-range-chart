import { useState, useEffect, RefObject } from 'react';
import * as d3 from 'd3';
import { LiquidityDataPoint, PriceDataPoint } from 'LiquidityRangeChart/types';
import { ChartState } from './useChartState';

export function useInitialView(data: PriceDataPoint[], liquidityData: LiquidityDataPoint[], setChartState: (state: ChartState) => void, defaultState: RefObject<ChartState>) {
  const [initialViewSet, setInitialViewSet] = useState(false);
  
  useEffect(() => {
    if (!initialViewSet && data && liquidityData && liquidityData.length > 0) {
      // Find current price tick index in the liquidity data
      const currentPrice = data[data.length - 1]?.value || 0;
      const currentTickIndex = liquidityData.findIndex(d => 
        Math.abs(d.price0 - currentPrice) === Math.min(...liquidityData.map(item => Math.abs(item.price0 - currentPrice)))
      );
      
      // Set initial zoom based on showing a meaningful price range around current price
      const priceValues = data.map(d => d.value);
      const minDataPrice = Math.min(...priceValues);
      const maxDataPrice = Math.max(...priceValues);
      const totalPriceRange = maxDataPrice - minDataPrice;
      
      // Show 100% of the total price range initially for a complete overview
      const desiredViewRange = totalPriceRange * 1.0;
      
      // Find how many ticks span this price range around current price
      const targetMinPrice = currentPrice - desiredViewRange / 2;
      const targetMaxPrice = currentPrice + desiredViewRange / 2;
      
      // Find ticks in this price range
      const ticksInRange = liquidityData.filter(d => 
        d.price0 >= targetMinPrice && d.price0 <= targetMaxPrice
      );
      
      // Calculate zoom to fit this many ticks in viewport (zoom OUT to show more)
      const viewportHeight = 400; // pixels
      const barHeight = 4; // pixels per tick
      const ticksVisibleInViewport = viewportHeight / barHeight; // ~100 ticks fit in viewport
      
      // Use same logic as Center Range - zoom out to fit the range
      // Add extra zoom-out factor to ensure everything is visible
      const requiredTicks = ticksInRange.length * 1.5; // Add 50% more space
      const calculatedZoom = ticksVisibleInViewport / requiredTicks;
      
      // Ensure we're zoomed out enough (max zoom of 0.5 for initial view)
      const desiredZoom = Math.min(calculatedZoom, 0.5);
      
      // Calculate panY to center the current price in the viewport  
      const totalContentHeight = liquidityData.length * barHeight * desiredZoom;
      const currentTickY = (liquidityData.length - 1 - currentTickIndex) * barHeight * desiredZoom;
      const centerPanY = (viewportHeight / 2) - currentTickY;
      
      // Set default brush range around current price
      // Find ticks within a reasonable range around current price
      const currentPriceValue = liquidityData[currentTickIndex]?.price0 || currentPrice;
      const rangeSize = Math.abs(liquidityData[0]?.price0 - liquidityData[liquidityData.length - 1]?.price0) * 0.05; // 5% of total range
      const defaultMinPrice = currentPriceValue - rangeSize / 2;
      const defaultMaxPrice = currentPriceValue + rangeSize / 2;
      
      // Update both current state and default state
      const newDefaultState = {
        zoomLevel: desiredZoom,
        panY: centerPanY,
        minPrice: defaultMinPrice,
        maxPrice: defaultMaxPrice
      };
      
      defaultState.current = newDefaultState;
      setChartState(newDefaultState);
      
      setInitialViewSet(true);
    }
  }, [data, liquidityData, initialViewSet, setChartState, defaultState]);
  
  return initialViewSet;
}