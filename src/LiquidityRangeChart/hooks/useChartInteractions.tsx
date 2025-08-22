import { useEffect } from 'react';
import * as d3 from 'd3';
import { PriceDataPoint, LiquidityDataPoint } from '../types';
import { ChartState } from './useChartState';

export function useChartInteractions(
  svgRef: React.RefObject<SVGSVGElement | null>, 
  data: PriceDataPoint[], 
  liquidityData: LiquidityDataPoint[], 
  zoomLevel: number, 
  panY: number, 
  setChartState: React.Dispatch<React.SetStateAction<ChartState>>
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
    
    // Setup wheel event handler for tick-based scrolling
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Calculate scroll based on pixel movement in tick space
      const scrollSensitivity = 2; // Pixels per scroll tick
      const scrollAmount = -event.deltaY * scrollSensitivity; // Negative for natural scroll direction
      
      setChartState((prev) => {
        const newPanY = prev.panY + scrollAmount;
        
        // Calculate bounds based on total height and viewport
        const svgElement = svgRef.current;
        if (!svgElement) return prev;
        
        const viewportHeight = svgElement.clientHeight;
        const totalContentHeight = liquidityData.length * 4 * zoomLevel; // barHeight + spacing
        
        // Bounds: show from top of content to bottom of content
        const minPanY = Math.min(0, viewportHeight - totalContentHeight);
        const maxPanY = 0;
        
        // Constrain to bounds
        const constrainedPanY = Math.max(minPanY, Math.min(maxPanY, newPanY));
        
        return { ...prev, panY: constrainedPanY };
      });
    };

    // Add touch support for mobile
    let touchStartY: number | null = null;
    let lastTouchY: number | null = null;
    
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        touchStartY = event.touches[0].clientY;
        lastTouchY = touchStartY;
        event.preventDefault();
      }
    };
    
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1 && touchStartY !== null) {
        const currentTouchY = event.touches[0].clientY;
        const deltaY = lastTouchY && currentTouchY ? currentTouchY - lastTouchY : 0; // Natural touch direction
        
        // Use same pixel-based scrolling as wheel
        const scrollAmount = deltaY;
        
        setChartState(prev => {
          const newPanY = prev.panY + scrollAmount;
          
          // Apply same bounds as wheel handler
          const svgElement = svgRef.current;
          if (!svgElement) return prev;
          
          const viewportHeight = svgElement.clientHeight;
          const totalContentHeight = liquidityData.length * 4 * zoomLevel;
          
          const minPanY = Math.min(0, viewportHeight - totalContentHeight);
          const maxPanY = 0;
          
          const constrainedPanY = Math.max(minPanY, Math.min(maxPanY, newPanY));
          
          return { ...prev, panY: constrainedPanY };
        });
        
        lastTouchY = currentTouchY;
        event.preventDefault();
      }
    };
    
    const handleTouchEnd = (event: TouchEvent) => {
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