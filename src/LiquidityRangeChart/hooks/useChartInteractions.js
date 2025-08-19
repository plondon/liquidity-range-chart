import { useEffect } from 'react';
import * as d3 from 'd3';

export function useChartInteractions(
  svgRef, 
  data, 
  liquidityData, 
  zoomLevel, 
  panY, 
  setChartState
) {
  useEffect(() => {
    if (!data || !liquidityData) return;
    
    const svgElement = svgRef.current;
    if (!svgElement) return;
    
    // Calculate price extent for bounds checking
    const allPrices = [
      ...data.map(d => d.value),
      ...liquidityData.map(d => d.price0)
    ];
    const priceExtent = d3.extent(allPrices);
    
    // Setup wheel event handler
    const handleWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Calculate current view bounds
      const priceRange = priceExtent[1] - priceExtent[0];
      const zoomedRange = priceRange / zoomLevel;
      const currentCenter = priceExtent[0] + priceRange * 0.5 + panY * priceRange;
      
      // Natural scroll sensitivity based on current view range
      const scrollSensitivity = zoomedRange / 600; // Faster scrolling for larger ranges
      const rawScrollAmount = event.deltaY * scrollSensitivity;
      
      // Apply scroll (invert deltaY for natural direction)
      const scrollAmount = rawScrollAmount / priceRange; // Normalize to pan range
      
      setChartState(prev => {
        const newPanY = prev.panY - scrollAmount;
        
        // Dynamic bounds based on data and zoom level
        const dataMin = Math.min(...allPrices);
        const dataMax = Math.max(...allPrices);
        const halfZoomedRange = zoomedRange / 2;
        
        // Calculate max pan bounds to keep view within data
        const maxPanUp = (dataMax - halfZoomedRange - (priceExtent[0] + priceRange * 0.5)) / priceRange;
        const maxPanDown = (dataMin + halfZoomedRange - (priceExtent[0] + priceRange * 0.5)) / priceRange;
        
        // Constrain to bounds
        const constrainedPanY = Math.max(maxPanDown, Math.min(maxPanUp, newPanY));
        
        return { ...prev, panY: constrainedPanY };
      });
    };

    // Add touch support for mobile
    let touchStartY = null;
    let lastTouchY = null;
    
    const handleTouchStart = (event) => {
      if (event.touches.length === 1) {
        touchStartY = event.touches[0].clientY;
        lastTouchY = touchStartY;
        event.preventDefault();
      }
    };
    
    const handleTouchMove = (event) => {
      if (event.touches.length === 1 && touchStartY !== null) {
        const currentTouchY = event.touches[0].clientY;
        const deltaY = lastTouchY - currentTouchY; // Inverted for natural scrolling
        
        // Convert touch movement to pan
        const priceRange = priceExtent[1] - priceExtent[0];
        const zoomedRange = priceRange / zoomLevel;
        const touchSensitivity = zoomedRange / 400; // Scale based on current zoom
        const scrollAmount = deltaY * touchSensitivity / priceRange;
        
        setChartState(prev => {
          const newPanY = prev.panY + scrollAmount;
          
          // Apply bounds like in wheel handler
          const halfZoomedRange = zoomedRange / 2;
          const dataMin = Math.min(...allPrices);
          const dataMax = Math.max(...allPrices);
          const maxPanUp = (dataMax - halfZoomedRange - (priceExtent[0] + priceRange * 0.5)) / priceRange;
          const maxPanDown = (dataMin + halfZoomedRange - (priceExtent[0] + priceRange * 0.5)) / priceRange;
          const constrainedPanY = Math.max(maxPanDown, Math.min(maxPanUp, newPanY));
          
          return { ...prev, panY: constrainedPanY };
        });
        
        lastTouchY = currentTouchY;
        event.preventDefault();
      }
    };
    
    const handleTouchEnd = (event) => {
      touchStartY = null;
      lastTouchY = null;
      event.preventDefault();
    };
    
    // Add event listeners
    svgElement.addEventListener('wheel', handleWheel, { passive: false });
    svgElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    svgElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    svgElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return () => {
      svgElement.removeEventListener('wheel', handleWheel);
      svgElement.removeEventListener('touchstart', handleTouchStart);
      svgElement.removeEventListener('touchmove', handleTouchMove);
      svgElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [data, liquidityData, zoomLevel, panY, setChartState, svgRef]);
}