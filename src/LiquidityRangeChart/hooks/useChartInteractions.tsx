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
      
      // Check if this is a zoom gesture (Ctrl+wheel)
      if (event.ctrlKey) {
        // Handle pinch-to-zoom with more natural scaling
        const rect = svgElement.getBoundingClientRect();
        const centerY = event.clientY - rect.top;
        
        // Calculate zoom based on wheel delta - more responsive and natural feel
        const deltaScale = event.deltaY * 0.002; // Convert delta to scale change (positive for natural direction)
        const zoomFactor = Math.max(0.5, Math.min(2.0, 1 + deltaScale)); // Clamp between 0.5x and 2x per gesture
        
        setChartState(prev => {
          const newZoomLevel = Math.max(0.01, Math.min(25, prev.zoomLevel * zoomFactor));
          
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
    let initialZoomLevel: number | null = null;
    let lastPinchTime: number | null = null;
    let lastFrameTime: number | null = null;
    
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
        initialZoomLevel = zoomLevel; // Store initial zoom level for scale-based calculation
        lastPinchTime = performance.now();
        lastFrameTime = lastPinchTime;
        event.preventDefault();
      } else if (event.touches.length === 1 && !isPinching) {
        // Single finger - pan
        touchStartY = event.touches[0].clientY;
        lastTouchY = touchStartY;
        event.preventDefault();
      }
    };
    
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && isPinching && initialPinchDistance && initialZoomLevel && lastPinchDistance && lastFrameTime) {
        // Handle pinch zoom - velocity-based scaling that responds to gesture speed
        const currentDistance = getTouchDistance(event.touches);
        const currentTime = performance.now();
        const deltaTime = currentTime - lastFrameTime;
        
        // Calculate velocity of pinch gesture - use raw distance change between frames
        const distanceChange = Math.abs(currentDistance - lastPinchDistance);
        
        // Base scale from gesture
        const totalScale = currentDistance / initialPinchDistance;
        
        // Apply aggressive velocity boost based on finger movement speed
        let velocityBoost = 1;
        if (distanceChange > 2) {
          velocityBoost = Math.min(distanceChange * 2, 20); // Up to 20x boost for fast movements
        }
        
        // Apply the boost more aggressively
        let baseScale: number;
        if (totalScale > 1) {
          // Zooming in
          const scaleAmount = (totalScale - 1) * velocityBoost;
          baseScale = 1 + scaleAmount;
        } else {
          // Zooming out  
          const scaleAmount = (1 - totalScale) * velocityBoost;
          baseScale = 1 - scaleAmount;
        }
        
        // Calculate center point between fingers for zoom focus
        const svgElement = svgRef.current;
        if (!svgElement) return;
        
        const rect = svgElement.getBoundingClientRect();
        const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
        
        setChartState(prev => {
          // Apply zoom with bounds - velocity-responsive scaling
          const newZoomLevel = Math.max(0.01, Math.min(25, (initialZoomLevel || prev.zoomLevel) * baseScale));
          
          // Adjust panY to keep pinch center fixed during zoom
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
        
        // Update tracking variables
        lastPinchDistance = currentDistance;
        lastFrameTime = currentTime;
        
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
        initialZoomLevel = null;
        lastPinchTime = null;
        lastFrameTime = null;
      }
      
      if (event.touches.length === 0) {
        // Reset all touch state when no fingers
        touchStartY = null;
        lastTouchY = null;
      }
      
      event.preventDefault();
    };
    
    // Add desktop trackpad/touchpad pinch support
    let gestureStartZoomLevel: number | null = null;
    let lastGestureScale: number = 1;
    let lastGestureTime: number | null = null;
    
    const handleGestureStart = (event: any) => {
      gestureStartZoomLevel = zoomLevel; // Store initial zoom level
      lastGestureScale = 1;
      lastGestureTime = performance.now();
      event.preventDefault();
    };
    
    const handleGestureChange = (event: any) => {
      event.preventDefault();
      
      if (!gestureStartZoomLevel || !lastGestureTime) return;
      
      // Calculate velocity of trackpad gesture
      const currentTime = performance.now();
      const deltaTime = currentTime - lastGestureTime;
      const currentScale = event.scale;
      
      // Calculate scale velocity (rate of scale change)
      const scaleChange = Math.abs(currentScale - lastGestureScale);
      const scaleVelocity = deltaTime > 0 ? scaleChange / deltaTime : 0;
      
      // Get the center of the gesture for zoom focus
      const rect = svgElement.getBoundingClientRect();
      const centerY = (event.clientY - rect.top) || (rect.height / 2);
      
      // Apply velocity-based sensitivity to trackpad gesture - much more aggressive
      const velocityMultiplier = 1 + Math.min(scaleVelocity * 20000, 30); // Extremely aggressive for fast trackpad gestures
      const baseScale = currentScale > 1 ? 
        1 + (currentScale - 1) * velocityMultiplier : // Zoom in
        1 - (1 - currentScale) * velocityMultiplier;   // Zoom out
      
      setChartState(prev => {
        // Apply zoom with velocity-responsive scaling
        const newZoomLevel = Math.max(0.01, Math.min(25, (gestureStartZoomLevel || prev.zoomLevel) * baseScale));
        
        // Adjust panY to keep gesture center fixed
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
      
      // Update tracking variables
      lastGestureScale = currentScale;
      lastGestureTime = currentTime;
    };
    
    const handleGestureEnd = (event: any) => {
      gestureStartZoomLevel = null; // Reset gesture state
      lastGestureScale = 1;
      lastGestureTime = null;
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