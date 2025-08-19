import { useCallback } from 'react';
import * as d3 from 'd3';
import { CHART_BEHAVIOR } from '../../LiquidityRangeChart/constants';

// Reusable drag behavior hook to eliminate repeated drag logic
export const useDragBehavior = () => {
  
  const createRangeDrag = useCallback((yScale: d3.ScaleLinear<number, number>, setMinPrice: React.Dispatch<React.SetStateAction<number | null>>, setMaxPrice: React.Dispatch<React.SetStateAction<number | null>>, priceExtent: [number, number]) => {
    return d3.drag()
      .on('drag', function(event) {
        if (!yScale || !priceExtent) return;
        
        const dy = event.dy;
        const priceChange = yScale.invert(0) - yScale.invert(dy);
        
        setMinPrice(prevMin => {
          if (prevMin === null) return null;
          const newMin = Math.max(priceExtent[0], Math.min(priceExtent[1], prevMin + priceChange));
          return newMin;
        });
        
        setMaxPrice(prevMax => {
          if (prevMax === null) return null;
          const newMax = Math.max(priceExtent[0], Math.min(priceExtent[1], prevMax + priceChange));
          return newMax;
        });
      });
  }, []);

  const createMinPriceDrag = useCallback((yScale: d3.ScaleLinear<number, number>, setMinPrice: React.Dispatch<React.SetStateAction<number | null>>, setMaxPrice: React.Dispatch<React.SetStateAction<number | null>>, priceExtent: [number, number]) => {
    return d3.drag()
      .on('drag', function(event) {
        if (!yScale || !priceExtent) return;
        
        const newY = Math.max(0, Math.min(yScale.range()[0], event.y));
        const newPrice = Math.max(priceExtent[0], Math.min(priceExtent[1], yScale.invert(newY)));
        
        setMinPrice(newPrice);
        
        // Handle line crossing logic
        setMaxPrice(prevMax => {
          if (prevMax !== null && newPrice > prevMax) {
            setMinPrice(prevMax);
            return newPrice;
          }
          return prevMax;
        });
      });
  }, []);

  const createMaxPriceDrag = useCallback((yScale: d3.ScaleLinear<number, number>, setMinPrice: React.Dispatch<React.SetStateAction<number | null>>, setMaxPrice: React.Dispatch<React.SetStateAction<number | null>>, priceExtent: [number, number]) => {
    return d3.drag()
      .on('drag', function(event) {
        if (!yScale || !priceExtent) return;
        
        const newY = Math.max(0, Math.min(yScale.range()[0], event.y));
        const newPrice = Math.max(priceExtent[0], Math.min(priceExtent[1], yScale.invert(newY)));
        
        setMaxPrice(newPrice);
        
        // Handle line crossing logic
        setMinPrice(prevMin => {
          if (prevMin !== null && newPrice < prevMin) {
            setMaxPrice(prevMin);
            return newPrice;
          }
          return prevMin;
        });
      });
  }, []);

  const createMinimapDrag = useCallback((minimapScale: d3.ScaleLinear<number, number>, setZoomLevel: React.Dispatch<React.SetStateAction<number>>, setPanY: React.Dispatch<React.SetStateAction<number>>) => {
    return d3.drag()
      .on('drag', function(event) {
        if (!minimapScale) return;
        
        const dy = event.dy;
        const panChange = dy / (minimapScale.range()[0] * CHART_BEHAVIOR.PAN_STEP);
        
        setPanY(prevPanY => {
          const newPanY = Math.max(CHART_BEHAVIOR.MIN_PAN, 
                           Math.min(CHART_BEHAVIOR.MAX_PAN, prevPanY + panChange));
          return newPanY;
        });
      });
  }, []);

  const createMinimapHandleDrag = useCallback((minimapScale: d3.ScaleLinear<number, number>, handleType: 'min' | 'max', setZoomLevel: React.Dispatch<React.SetStateAction<number>>, setPanY: React.Dispatch<React.SetStateAction<number>>, setMinPrice: React.Dispatch<React.SetStateAction<number | null>>, setMaxPrice: React.Dispatch<React.SetStateAction<number | null>>) => {
    return d3.drag()
      .on('drag', function(event) {
        if (!minimapScale) return;
        
        const newY = Math.max(0, Math.min(minimapScale.range()[0], event.y));
        const newPrice = minimapScale.invert(newY);
        
        if (handleType === 'min') {
          setMinPrice(newPrice);
        } else if (handleType === 'max') {
          setMaxPrice(newPrice);
        }
      });
  }, []);

  return {
    createRangeDrag,
    createMinPriceDrag,
    createMaxPriceDrag,
    createMinimapDrag,
    createMinimapHandleDrag
  };
};