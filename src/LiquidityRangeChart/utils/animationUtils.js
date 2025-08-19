// Smooth animation utility function with optional price range animation
export function createAnimateToState(setChartState) {
  return function animateToState(
    zoomLevel, 
    panY, 
    minPrice, 
    maxPrice, 
    targetZoom, 
    targetPan, 
    targetMinPrice = null, 
    targetMaxPrice = null, 
    duration = 400
  ) {
    const startZoom = zoomLevel;
    const startPan = panY;
    const startMinPrice = minPrice;
    const startMaxPrice = maxPrice;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Modern easeOutQuart for snappy, smooth feel
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      
      // Interpolate zoom and pan values
      const currentZoom = startZoom + (targetZoom - startZoom) * easeProgress;
      const currentPan = startPan + (targetPan - startPan) * easeProgress;
      
      // Interpolate price range if targets provided
      let currentMinPrice = startMinPrice;
      let currentMaxPrice = startMaxPrice;
      
      if (targetMinPrice !== null && targetMaxPrice !== null) {
        if (startMinPrice !== null && startMaxPrice !== null) {
          currentMinPrice = startMinPrice + (targetMinPrice - startMinPrice) * easeProgress;
          currentMaxPrice = startMaxPrice + (targetMaxPrice - startMaxPrice) * easeProgress;
        } else {
          // If no current range, just set the target at the end
          if (progress === 1) {
            currentMinPrice = targetMinPrice;
            currentMaxPrice = targetMaxPrice;
          }
        }
      }
      
      setChartState(prev => ({
        ...prev,
        zoomLevel: currentZoom,
        panY: currentPan,
        minPrice: currentMinPrice,
        maxPrice: currentMaxPrice
      }));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  };
}