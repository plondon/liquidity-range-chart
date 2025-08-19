import { useState, useRef } from 'react';
import { createAnimateToState } from '../utils/animationUtils';

export function useChartState() {
  // Default state object
  const defaultState = useRef({
    zoomLevel: 1,
    panY: 0,
    minPrice: null,
    maxPrice: null
  });
  
  // Main state object
  const [chartState, setChartState] = useState({
    zoomLevel: 1,
    panY: 0,
    minPrice: null,
    maxPrice: null
  });
  
  // Destructure for easier access
  const { zoomLevel, panY, minPrice, maxPrice } = chartState;
  
  // Helper functions for updating individual state properties
  const setMinPrice = (price) => setChartState(prev => ({ ...prev, minPrice: price }));
  const setMaxPrice = (price) => setChartState(prev => ({ ...prev, maxPrice: price }));
  
  // Create the animation function with current chart state
  const animateToState = createAnimateToState(setChartState);

  const handleZoomIn = () => {
    const targetZoom = Math.min(zoomLevel * 1.3, 50);
    animateToState(zoomLevel, panY, minPrice, maxPrice, targetZoom, panY, null, null, 300);
  };

  const handleZoomOut = () => {
    const targetZoom = Math.max(zoomLevel / 1.3, 0.1);
    animateToState(zoomLevel, panY, minPrice, maxPrice, targetZoom, panY, null, null, 300);
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

  const handleCenterRange = (data, liquidityData) => {
    if (minPrice === null || maxPrice === null || !data || !liquidityData) return;
    
    // Calculate all prices to get data bounds
    const allPrices = [
      ...data.map(d => d.value),
      ...liquidityData.map(d => d.price0)
    ];
    const priceExtent = [Math.min(...allPrices), Math.max(...allPrices)];
    const totalPriceRange = priceExtent[1] - priceExtent[0];
    
    // Calculate range center and size
    const rangeCenter = (minPrice + maxPrice) / 2;
    const rangeSize = maxPrice - minPrice;
    
    // Calculate required pan to center the range
    const originalCenter = priceExtent[0] + totalPriceRange * 0.5;
    const targetPanY = (rangeCenter - originalCenter) / totalPriceRange;
    
    // Calculate required zoom to fit the range (with some padding)
    const paddingFactor = 1.2; // 20% padding around the range
    const visibleRangeNeeded = rangeSize * paddingFactor;
    const currentVisibleRange = totalPriceRange / zoomLevel;
    
    let targetZoomLevel = zoomLevel;
    if (visibleRangeNeeded > currentVisibleRange) {
      // Need to zoom out to fit the range
      targetZoomLevel = totalPriceRange / visibleRangeNeeded;
      targetZoomLevel = Math.max(targetZoomLevel, 0.1); // Don't zoom out too far
    }
    
    // Animate the transition with faster, smoother timing
    animateToState(zoomLevel, panY, minPrice, maxPrice, targetZoomLevel, targetPanY, null, null, 500);
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
    setMinPrice,
    setMaxPrice,
    
    // Actions
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleCenterRange,
    animateToState
  };
}