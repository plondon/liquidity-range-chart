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
      
      // Set initial zoom based on the selected range (±10% of current price)
      const currentPriceValue = liquidityData[currentTickIndex]?.price0 || currentPrice;
      const defaultMinPrice = currentPriceValue * 0.9; // 10% below current price
      const defaultMaxPrice = currentPriceValue * 1.1; // 10% above current price
      
      // Find the ticks that correspond to our selected range - same logic as Center Range
      const minPriceTick = liquidityData.reduce((prev, curr) => 
        Math.abs(curr.price0 - defaultMinPrice) < Math.abs(prev.price0 - defaultMinPrice) ? curr : prev
      );
      const maxPriceTick = liquidityData.reduce((prev, curr) => 
        Math.abs(curr.price0 - defaultMaxPrice) < Math.abs(prev.price0 - defaultMaxPrice) ? curr : prev
      );
      
      const minTickIndex = liquidityData.findIndex(d => d.tick === minPriceTick.tick);
      const maxTickIndex = liquidityData.findIndex(d => d.tick === maxPriceTick.tick);
      const rangeCenterIndex = (minTickIndex + maxTickIndex) / 2;
      const rangeSpanInTicks = Math.abs(maxTickIndex - minTickIndex);
      
      // Calculate zoom level to fit the selected range in viewport with padding
      const viewportHeight = 400;
      const barHeight = 4;
      const ticksVisibleInViewport = viewportHeight / barHeight; // ~100 ticks
      const paddingFactor = 2.5; // Show 150% more than the range for context
      const requiredTicks = rangeSpanInTicks * paddingFactor;
      
      // Calculate zoom using same logic as Center Range
      const desiredZoom = Math.max(ticksVisibleInViewport / requiredTicks, 0.01);
      
      // Calculate panY to center the selected range in the viewport
      const rangeCenterY = (liquidityData.length - 1 - rangeCenterIndex) * barHeight * desiredZoom;
      const centerPanY = (viewportHeight / 2) - rangeCenterY;
      
      // Use the same defaultMinPrice and defaultMaxPrice calculated above for zoom
      
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