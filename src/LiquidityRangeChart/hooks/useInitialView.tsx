import { useState, useEffect, RefObject } from 'react';
import * as d3 from 'd3';
import { LiquidityDataPoint, PriceDataPoint } from 'LiquidityRangeChart/types';
import { ChartState } from './useChartState';

export function useInitialView(data: PriceDataPoint[], liquidityData: LiquidityDataPoint[], setChartState: (state: ChartState) => void, defaultState: RefObject<ChartState>) {
  const [initialViewSet, setInitialViewSet] = useState(false);
  
  useEffect(() => {
    if (!initialViewSet && data && liquidityData && liquidityData.length > 0) {
      const allPrices = [
        ...data.map(d => d.value),
        ...liquidityData.map(d => d.price0)
      ];
      const priceExtent = d3.extent(allPrices);
      const priceRange = priceExtent?.[1] && priceExtent?.[0] ? priceExtent[1] - priceExtent[0] : 0;
      
      // Filter out extreme outliers for initial view - focus on middle 20% of liquidity
      const liquidityPrices = liquidityData.map(d => d.price0).sort((a, b) => a - b);
      const percentile20 = liquidityPrices[Math.floor(liquidityPrices.length * 0.2)];
      const percentile80 = liquidityPrices[Math.floor(liquidityPrices.length * 0.8)];
      
      // Set initial zoom to focus on the 20-80% range of liquidity with tighter view
      const focusRange = percentile80 - percentile20;
      const desiredZoom = Math.min(priceRange / (focusRange * 1), 25); // Show ~1x the focus range, max 25x zoom
      
      // Center the view on the current price (last data point)
      const currentPrice = data[data.length - 1]?.value;
      const originalCenter = priceExtent?.[0] && priceExtent?.[0] ? priceExtent[0] + priceRange * 0.5 : 0;
      const panOffset = (currentPrice - originalCenter) / priceRange;
      
      // Set default brush range - use a symmetrical range around current price
      // Use 10% of the total price range for the brush range (tighter)
      const brushRangeSize = priceRange * 0.1;
      const defaultMinPrice = currentPrice - brushRangeSize / 2;
      const defaultMaxPrice = currentPrice + brushRangeSize / 2;
      
      // Update both current state and default state
      const newDefaultState = {
        zoomLevel: desiredZoom,
        panY: panOffset,
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