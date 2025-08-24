import { useState, useRef } from 'react';
import { createAnimateToState } from '../utils/animationUtils';
import { PriceDataPoint, LiquidityDataPoint } from '../types';
import { CHART_BEHAVIOR } from '../constants';

export type ChartState = {
  zoomLevel: number;
  panY: number;
  minPrice: number | null;
  maxPrice: number | null;
};

export function useChartState() {
  // Default state object
  const defaultState = useRef({
    zoomLevel: 1,
    panY: 0,
    minPrice: null,
    maxPrice: null
  });
  
  // Main state object
  const [chartState, setChartState] = useState<ChartState>({
    zoomLevel: 1,
    panY: 0,
    minPrice: null,
    maxPrice: null
  });
  
  // Destructure for easier access
  const { zoomLevel, panY, minPrice, maxPrice } = chartState;
  
  // Create the animation function with current chart state
  const animateToState = createAnimateToState(setChartState);

  const handleZoomIn = () => {
    const targetZoom = Math.min(zoomLevel * 1.3, 50);
    const viewportHeight = 400; // Chart viewport height
    const centerY = viewportHeight / 2;
    
    // Calculate new panY to keep center fixed during zoom
    const zoomRatio = targetZoom / zoomLevel;
    const targetPanY = centerY - (centerY - panY) * zoomRatio;
    
    animateToState(zoomLevel, panY, minPrice, maxPrice, targetZoom, targetPanY, null, null, 300);
  };

  const handleZoomOut = () => {
    const targetZoom = Math.max(zoomLevel / 1.3, CHART_BEHAVIOR.MIN_ZOOM);
    const viewportHeight = 400; // Chart viewport height
    const centerY = viewportHeight / 2;
    
    // Calculate new panY to keep center fixed during zoom
    const zoomRatio = targetZoom / zoomLevel;
    const targetPanY = centerY - (centerY - panY) * zoomRatio;
    
    animateToState(zoomLevel, panY, minPrice, maxPrice, targetZoom, targetPanY, null, null, 300);
  };

  const handleResetZoom = () => {
    animateToState(
      zoomLevel, 
      panY,
      minPrice,
      maxPrice,
      defaultState.current.zoomLevel, 
      defaultState.current.panY,
      defaultState.current.minPrice,
      defaultState.current.maxPrice,
      500
    );
  };

  const handleCenterRange = (data: PriceDataPoint[], liquidityData: LiquidityDataPoint[]) => {
    if (minPrice === null || maxPrice === null || !liquidityData) return;
    
    // Find the ticks that correspond to minPrice and maxPrice
    const minPriceTick = liquidityData.reduce((prev, curr) => 
      Math.abs(curr.price0 - minPrice) < Math.abs(prev.price0 - minPrice) ? curr : prev
    );
    const maxPriceTick = liquidityData.reduce((prev, curr) => 
      Math.abs(curr.price0 - maxPrice) < Math.abs(prev.price0 - maxPrice) ? curr : prev
    );
    
    // Calculate the range in tick space
    const minTickIndex = liquidityData.findIndex(d => d.tick === minPriceTick.tick);
    const maxTickIndex = liquidityData.findIndex(d => d.tick === maxPriceTick.tick);
    const rangeCenterIndex = (minTickIndex + maxTickIndex) / 2;
    const rangeSpanInTicks = Math.abs(maxTickIndex - minTickIndex);
    
    // Calculate zoom level to fit the range in viewport with padding
    const viewportHeight = 400;
    const barHeight = 4;
    const ticksVisibleInViewport = viewportHeight / barHeight; // ~100 ticks
    const paddingFactor = 2.5; // Show 150% more than the range for context
    const requiredTicks = rangeSpanInTicks * paddingFactor;
    
    // Calculate zoom: if we need to show more ticks than viewport can handle at 1x,
    // we need to zoom OUT (zoom < 1). The formula should be:
    // ticksVisible = ticksVisibleInViewport / zoomLevel
    // So: zoomLevel = ticksVisibleInViewport / ticksVisible
    const targetZoom = Math.max(ticksVisibleInViewport / requiredTicks, CHART_BEHAVIOR.MIN_ZOOM);
    
    // Calculate panY to center the range with the new zoom level
    const rangeCenterY = (liquidityData.length - 1 - rangeCenterIndex) * barHeight * targetZoom;
    const targetPanY = (viewportHeight / 2) - rangeCenterY;
    
    // Zoom out to show the entire range
    animateToState(zoomLevel, panY, minPrice, maxPrice, targetZoom, targetPanY, null, null, 500);
  };
  
  return {
    // State values
    zoomLevel,
    panY,
    minPrice,
    maxPrice,
    defaultState,
    
    // State setters
    setChartState,
    
    // Actions
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleCenterRange,
    animateToState
  };
}