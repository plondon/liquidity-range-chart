import { useState, useEffect } from 'react';
import { calculateInitialDimensions, calculateResizeDimensions } from '../utils/dimensionUtils';

export function useResponsiveDimensions() {
  const [dimensions, setDimensions] = useState(calculateInitialDimensions);
  
  useEffect(() => {
    const handleResize = () => {
      const { width, height } = calculateResizeDimensions();
      
      setDimensions(prev => {
        // Only update if dimensions actually changed to avoid unnecessary re-renders
        if (prev.width !== width || prev.height !== height) {
          return { width, height };
        }
        return prev;
      });
    };

    // Use a timeout to ensure DOM is ready and multiple calls for better reliability
    const timeoutId = setTimeout(handleResize, 100);
    const intervalId = setInterval(handleResize, 500); // Check periodically initially
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 300); // Handle mobile orientation changes
    });
    
    // Stop the interval after a few seconds
    setTimeout(() => clearInterval(intervalId), 3000);
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return dimensions;
}