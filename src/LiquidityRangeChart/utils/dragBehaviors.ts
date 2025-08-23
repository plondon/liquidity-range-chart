import * as d3 from 'd3';
import { chartUpdateManager } from './chartUpdateManager';
import { ChartState } from '../hooks/useChartState';
import { CHART_COLORS } from '../constants';

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

      // Update visual position to snap to nearest tick for lines
      const snapY = priceToY(newPrice);
      const element = d3.select(this);
      
      // Handle both line elements (with y1/y2) and circle elements (with cy)
      if (element.attr('y1') !== null) {
        element.attr('y1', snapY).attr('y2', snapY);
      } else if (element.attr('cy') !== null) {
        element.attr('cy', snapY);
      }
      
      // Determine which line represents min and max during drag
      const otherY = priceToY(otherPrice);
      let draggedMinPrice: number;
      let draggedMaxPrice: number;
      
      // Handle visual swapping if lines cross
      const isMinLine = lineType === 'min';
      const linesCrossed = isMinLine ? (newY < otherY) : (newY > otherY);
      
      if (linesCrossed) {
        // Lines crossed - swap visually
        draggedMinPrice = isMinLine ? otherPrice : newPrice;
        draggedMaxPrice = isMinLine ? newPrice : otherPrice;
        
        // Update other line color (both lines use same color anyway)
        const otherLineClass = isMinLine ? '.max-line' : '.min-line';
        g.select(otherLineClass).attr('stroke', CHART_COLORS.BOUNDARY_LINE);
      } else {
        // Lines in normal order
        draggedMinPrice = isMinLine ? newPrice : otherPrice;
        draggedMaxPrice = isMinLine ? otherPrice : newPrice;
        
        // Restore original colors
        const otherLineClass = isMinLine ? '.max-line' : '.min-line';
        g.select(otherLineClass).attr('stroke', CHART_COLORS.BOUNDARY_LINE);
      }
      
      // Update all related elements
      chartUpdateManager.updateAll({
        g,
        minPrice: draggedMinPrice,
        maxPrice: draggedMaxPrice,
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
      
      // Handle final state update with proper min/max ordering
      const isMinLine = lineType === 'min';
      const linesCrossed = isMinLine ? (newPrice > otherPrice) : (newPrice < otherPrice);
      
      if (linesCrossed) {
        // Lines crossed - swap them in state
        if (isMinLine) {
          setChartState(prev => ({ ...prev, minPrice: otherPrice, maxPrice: newPrice }));
        } else {
          setChartState(prev => ({ ...prev, minPrice: newPrice, maxPrice: otherPrice }));
        }
      } else {
        // Normal case - just update this line's price
        if (isMinLine) {
          setChartState(prev => ({ ...prev, minPrice: newPrice }));
        } else {
          setChartState(prev => ({ ...prev, maxPrice: newPrice }));
        }
      }
    });
}