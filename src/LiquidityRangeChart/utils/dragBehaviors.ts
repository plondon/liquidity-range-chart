import * as d3 from 'd3';
import { chartUpdateManager } from './chartUpdateManager';
import { ChartState } from '../hooks/useChartState';
import { CHART_COLORS, CHART_DIMENSIONS } from '../constants';

interface DragBehaviorOptions {
  lineType: 'min' | 'max';
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  priceToY: (price: number) => number;
  yToPrice: (y: number) => number;
  margin: { top: number; right: number; bottom: number; left: number };
  height: number;
  dimensions: { width: number; height: number };
  getThisPrice: () => number | null;
  getOtherPrice: () => number | null;
  setChartState: React.Dispatch<React.SetStateAction<ChartState>>;
  current: number | null;
  getColorForPrice: (value: number, minPrice: number | null, maxPrice: number | null) => string;
  getOpacityForPrice: (value: number, minPrice: number | null, maxPrice: number | null) => number;
}

export function createSharedPriceDragBehavior<T extends Element>(
  options: DragBehaviorOptions
): d3.DragBehavior<T, unknown, unknown> {
  const {
    lineType,
    g,
    priceToY,
    yToPrice,
    margin,
    height,
    dimensions,
    getThisPrice,
    getOtherPrice,
    setChartState,
    current,
    getColorForPrice,
    getOpacityForPrice
  } = options;

  return d3.drag<T, unknown>()
    .on('drag', function(event) {
      const newY = Math.max(-margin.top, Math.min(height + margin.bottom, event.y));
      const newPrice = yToPrice(newY);
      
      const thisPrice = getThisPrice();
      const otherPrice = getOtherPrice();
      if (thisPrice === null || otherPrice === null) return;

      const otherY = priceToY(otherPrice);
      const isMinLine = lineType === 'min';
      
      // Calculate the actual pixel distance between lines
      const actualDistance = Math.abs(newY - otherY);
      
      // Determine if we're in normal or swapped configuration
      const linesCrossed = isMinLine ? (newY < otherY) : (newY > otherY);
      
      let finalMinPrice: number;
      let finalMaxPrice: number;
      let visualSnapY = priceToY(newPrice);
      
      // Apply minimum height constraint logic
      if (actualDistance < CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT) {
        // We're within the minimum threshold - need to constrain
        if (linesCrossed) {
          // Lines would cross - check if continuing drag creates sufficient space after swap
          const swappedMinPrice = isMinLine ? otherPrice : newPrice;
          const swappedMaxPrice = isMinLine ? newPrice : otherPrice;
          const swappedDistance = Math.abs(priceToY(swappedMaxPrice) - priceToY(swappedMinPrice));
          
          if (swappedDistance >= CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT) {
            // Resume normal behavior after swap - sufficient space
            finalMinPrice = swappedMinPrice;
            finalMaxPrice = swappedMaxPrice;
          } else {
            // Still too close even after swap - maintain minimum height
            const constrainedY = isMinLine 
              ? otherY + CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT 
              : otherY - CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT;
            const constrainedPrice = yToPrice(constrainedY);
            
            finalMinPrice = isMinLine ? constrainedPrice : otherPrice;
            finalMaxPrice = isMinLine ? otherPrice : constrainedPrice;
            visualSnapY = constrainedY;
          }
        } else {
          // Lines haven't crossed - constrain to minimum height
          const constrainedY = isMinLine 
            ? otherY + CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT 
            : otherY - CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT;
          const constrainedPrice = yToPrice(constrainedY);
          
          finalMinPrice = isMinLine ? constrainedPrice : otherPrice;
          finalMaxPrice = isMinLine ? otherPrice : constrainedPrice;
          visualSnapY = constrainedY;
        }
      } else {
        // Normal behavior - distance is sufficient
        if (linesCrossed) {
          finalMinPrice = isMinLine ? otherPrice : newPrice;
          finalMaxPrice = isMinLine ? newPrice : otherPrice;
        } else {
          finalMinPrice = isMinLine ? newPrice : otherPrice;
          finalMaxPrice = isMinLine ? otherPrice : newPrice;
        }
      }

      // Update visual position of the dragged element
      const element = d3.select(this);
      
      // Handle both line elements (with y1/y2) and circle elements (with cy)
      if (element.attr('y1') !== null) {
        element.attr('y1', visualSnapY).attr('y2', visualSnapY);
      } else if (element.attr('cy') !== null) {
        element.attr('cy', visualSnapY);
      }
      
      // Update other line color for visual feedback
      const otherLineClass = isMinLine ? '.max-line' : '.min-line';
      g.select(otherLineClass).attr('stroke', CHART_COLORS.BOUNDARY_LINE);
      
      // Update all related elements
      chartUpdateManager.updateAll({
        g,
        minPrice: finalMinPrice,
        maxPrice: finalMaxPrice,
        priceToY,
        width: dimensions.width - margin.left - margin.right,
        margin,
        dimensions,
        current,
        getColorForPrice,
        getOpacityForPrice
      });
    })
    .on('end', function(event) {
      const newY = Math.max(-margin.top, Math.min(height + margin.bottom, event.y));
      const newPrice = yToPrice(newY);
      
      const thisPrice = getThisPrice();
      const otherPrice = getOtherPrice();
      if (thisPrice === null || otherPrice === null) return;

      const otherY = priceToY(otherPrice);
      const isMinLine = lineType === 'min';
      
      // Calculate the actual pixel distance between lines
      const actualDistance = Math.abs(newY - otherY);
      
      // Determine if we're in normal or swapped configuration
      const linesCrossed = isMinLine ? (newPrice > otherPrice) : (newPrice < otherPrice);
      
      let finalMinPrice: number;
      let finalMaxPrice: number;
      
      // Apply minimum height constraint logic on drag end
      if (actualDistance < CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT) {
        // We're ending in the threshold zone - need to constrain
        if (linesCrossed) {
          // Lines would cross - check if swap creates sufficient space
          const swappedMinPrice = isMinLine ? otherPrice : newPrice;
          const swappedMaxPrice = isMinLine ? newPrice : otherPrice;
          const swappedDistance = Math.abs(priceToY(swappedMaxPrice) - priceToY(swappedMinPrice));
          
          if (swappedDistance >= CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT) {
            // Swap is valid - sufficient space after swap
            finalMinPrice = swappedMinPrice;
            finalMaxPrice = swappedMaxPrice;
          } else {
            // Swap still doesn't create enough space - constrain to minimum
            const constrainedY = isMinLine 
              ? otherY + CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT 
              : otherY - CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT;
            const constrainedPrice = yToPrice(constrainedY);
            
            finalMinPrice = isMinLine ? constrainedPrice : otherPrice;
            finalMaxPrice = isMinLine ? otherPrice : constrainedPrice;
          }
        } else {
          // Lines haven't crossed - constrain to minimum height
          const constrainedY = isMinLine 
            ? otherY + CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT 
            : otherY - CHART_DIMENSIONS.RANGE_INDICATOR_MIN_HEIGHT;
          const constrainedPrice = yToPrice(constrainedY);
          
          finalMinPrice = isMinLine ? constrainedPrice : otherPrice;
          finalMaxPrice = isMinLine ? otherPrice : constrainedPrice;
        }
      } else {
        // Normal behavior - distance is sufficient
        if (linesCrossed) {
          finalMinPrice = isMinLine ? otherPrice : newPrice;
          finalMaxPrice = isMinLine ? newPrice : otherPrice;
        } else {
          finalMinPrice = isMinLine ? newPrice : otherPrice;
          finalMaxPrice = isMinLine ? otherPrice : newPrice;
        }
      }
      
      // Update final state
      setChartState(prev => ({ 
        ...prev, 
        minPrice: finalMinPrice, 
        maxPrice: finalMaxPrice 
      }));
    });
}