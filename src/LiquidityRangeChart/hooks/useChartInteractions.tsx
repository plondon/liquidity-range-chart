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
    
    // Setup wheel event handler for tick-based scrolling and pinch zoom
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Check if this is a pinch gesture (Ctrl+wheel or trackpad pinch)
      if (event.ctrlKey || Math.abs(event.deltaY) > 50) {
        // Handle pinch-to-zoom
        const rect = svgElement.getBoundingClientRect();
        const centerY = event.clientY - rect.top;
        
        // Calculate zoom based on wheel delta
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1; // Zoom out/in
        
        setChartState(prev => {
          const newZoomLevel = Math.max(0.01, Math.min(50, prev.zoomLevel * zoomFactor));
          
          // Adjust panY to keep mouse position fixed during zoom
          const zoomRatio = newZoomLevel / prev.zoomLevel;
          const newPanY = centerY - (centerY - prev.panY) * zoomRatio;
          
          // Apply bounds to panY
          const viewportHeight = svgElement.clientHeight;
          const totalContentHeight = liquidityData.length * 4 * newZoomLevel;
          const minPanY = Math.min(0, viewportHeight - totalContentHeight);
          const maxPanY = 0;
          const constrainedPanY = Math.max(minPanY, Math.min(maxPanY, newPanY));
          
          return { ...prev, zoomLevel: newZoomLevel, panY: constrainedPanY };
        });
      } else {
        // Handle normal scrolling
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
      }
    };

    // Add touch support for mobile
    let touchStartY: number | null = null;
    let lastTouchY: number | null = null;
    
    // Add pinch gesture detection variables
    let initialPinchDistance: number | null = null;
    let lastPinchDistance: number | null = null;
    let isPinching = false;
    
    // Helper to calculate distance between two touches
    const getTouchDistance = (touches: TouchList): number => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        // Two fingers - start pinch
        isPinching = true;
        initialPinchDistance = getTouchDistance(event.touches);
        lastPinchDistance = initialPinchDistance;
        event.preventDefault();
      } else if (event.touches.length === 1 && !isPinching) {
        // Single finger - pan
        touchStartY = event.touches[0].clientY;
        lastTouchY = touchStartY;
        event.preventDefault();
      }
    };
    
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && isPinching) {
        // Handle pinch zoom
        const currentDistance = getTouchDistance(event.touches);
        const scale = currentDistance / (lastPinchDistance || currentDistance);
        
        // Calculate center point between fingers for zoom focus
        const svgElement = svgRef.current;
        if (!svgElement) return;
        
        const rect = svgElement.getBoundingClientRect();
        const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
        const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
        
        setChartState(prev => {
          // Apply zoom with bounds
          const newZoomLevel = Math.max(0.01, Math.min(50, prev.zoomLevel * scale));
          
          // Adjust panY to keep pinch center fixed (same logic as zoom buttons)
          const zoomRatio = newZoomLevel / prev.zoomLevel;
          const newPanY = centerY - (centerY - prev.panY) * zoomRatio;
          
          // Apply bounds to panY
          const viewportHeight = svgElement.clientHeight;
          const totalContentHeight = liquidityData.length * 4 * newZoomLevel;
          const minPanY = Math.min(0, viewportHeight - totalContentHeight);
          const maxPanY = 0;
          const constrainedPanY = Math.max(minPanY, Math.min(maxPanY, newPanY));
          
          return { ...prev, zoomLevel: newZoomLevel, panY: constrainedPanY };
        });
        
        lastPinchDistance = currentDistance;
        event.preventDefault();
      } else if (event.touches.length === 1 && !isPinching && touchStartY !== null) {
        // Single finger pan (existing logic)
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
      if (event.touches.length < 2) {
        // Reset pinch state when fewer than 2 fingers
        isPinching = false;
        initialPinchDistance = null;
        lastPinchDistance = null;
      }
      
      if (event.touches.length === 0) {
        // Reset all touch state when no fingers
        touchStartY = null;
        lastTouchY = null;
      }
      
      event.preventDefault();
    };
    
    // Add desktop trackpad/touchpad pinch support
    const handleGestureStart = (event: any) => {
      event.preventDefault();
    };
    
    const handleGestureChange = (event: any) => {
      event.preventDefault();
      
      // Get the center of the gesture for zoom focus
      const rect = svgElement.getBoundingClientRect();
      const centerY = (event.clientY - rect.top) || (rect.height / 2);
      
      // Calculate zoom based on gesture scale
      const scale = event.scale;
      
      setChartState(prev => {
        // Calculate new zoom level
        const baseZoom = prev.zoomLevel;
        const newZoomLevel = Math.max(0.01, Math.min(50, baseZoom * scale));
        
        // Adjust panY to keep gesture center fixed
        const zoomRatio = newZoomLevel / baseZoom;
        const newPanY = centerY - (centerY - prev.panY) * zoomRatio;
        
        // Apply bounds to panY
        const viewportHeight = svgElement.clientHeight;
        const totalContentHeight = liquidityData.length * 4 * newZoomLevel;
        const minPanY = Math.min(0, viewportHeight - totalContentHeight);
        const maxPanY = 0;
        const constrainedPanY = Math.max(minPanY, Math.min(maxPanY, newPanY));
        
        return { ...prev, zoomLevel: newZoomLevel, panY: constrainedPanY };
      });
    };
    
    const handleGestureEnd = (event: any) => {
      event.preventDefault();
    };

    // Add event listeners
    svgElement.addEventListener('wheel', handleWheel, { passive: false });
    svgElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    svgElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    svgElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Desktop trackpad/touchpad gesture events
    svgElement.addEventListener('gesturestart', handleGestureStart, { passive: false });
    svgElement.addEventListener('gesturechange', handleGestureChange, { passive: false });
    svgElement.addEventListener('gestureend', handleGestureEnd, { passive: false });
    
    return () => {
      svgElement.removeEventListener('wheel', handleWheel);
      svgElement.removeEventListener('touchstart', handleTouchStart);
      svgElement.removeEventListener('touchmove', handleTouchMove);
      svgElement.removeEventListener('touchend', handleTouchEnd);
      svgElement.removeEventListener('gesturestart', handleGestureStart);
      svgElement.removeEventListener('gesturechange', handleGestureChange);
      svgElement.removeEventListener('gestureend', handleGestureEnd);
    };
  }, [data, liquidityData, zoomLevel, panY, setChartState, svgRef]);
}