import { UpdateSlice } from '../chartUpdateManager';

// Class names for floating indicators
export const FLOATING_INDICATOR_CLASSES = {
  MIN_INDICATOR: 'min-floating-indicator',
  MAX_INDICATOR: 'max-floating-indicator'
} as const;

// Class names for price lines
export const PRICE_LINE_CLASSES = {
  MIN_LINE: 'min-line',
  MAX_LINE: 'max-line'
} as const;

// Class names for drag handles
export const DRAG_HANDLE_CLASSES = {
  MIN_HANDLE: 'min-drag-indicator',
  MAX_HANDLE: 'max-drag-indicator', 
  CENTER_HANDLE: 'center-drag-indicator',
  CENTER_LINES: 'center-drag-line'
} as const;

/**
 * ELI5: This slice updates the small dark grey floating rectangles that appear at your 
 * min and max price levels. These are like visual bookmarks showing exactly where your 
 * price boundaries are. When you drag the price lines, these move with them.
 */
export const FLOATING_INDICATORS_SLICE: UpdateSlice = {
  name: 'floatingIndicators',
  update: (ctx) => {
    const { g, minPrice, maxPrice, yScale } = ctx;
    
    // Update floating indicators (30px x 6px dark grey rectangles)
    g.select(`.${FLOATING_INDICATOR_CLASSES.MIN_INDICATOR}`)
      .attr('y', yScale(minPrice) - 3);
    g.select(`.${FLOATING_INDICATOR_CLASSES.MAX_INDICATOR}`)
      .attr('y', yScale(maxPrice) - 3);
  }
};

/**
 * ELI5: This slice updates invisible horizontal lines that you can drag to change your 
 * price range. You can't see them (opacity = 0) but when you drag where they are,
 * you're actually moving the min/max price boundaries.
 */
export const PRICE_LINES_SLICE: UpdateSlice = {
  name: 'priceLines',
  update: (ctx) => {
    const { g, minPrice, maxPrice, yScale } = ctx;
    
    // Update min/max lines (hidden but still used for dragging)
    g.select(`.${PRICE_LINE_CLASSES.MIN_LINE}`)
      .attr('y1', yScale(minPrice))
      .attr('y2', yScale(minPrice));
      
    g.select(`.${PRICE_LINE_CLASSES.MAX_LINE}`)
      .attr('y1', yScale(maxPrice))
      .attr('y2', yScale(maxPrice));
  }
};

/**
 * ELI5: This slice updates the circular handles and center rectangle on the right side 
 * that you can drag. The circles let you drag individual min/max boundaries, and the 
 * center rectangle lets you move the entire range up or down together.
 */
export const DRAG_HANDLES_SLICE: UpdateSlice = {
  name: 'dragHandles',
  update: (ctx) => {
    const { g, minPrice, maxPrice, yScale } = ctx;
    
    // Update drag indicators - positioned inside the range indicator
    g.select(`.${DRAG_HANDLE_CLASSES.MAX_HANDLE}`)
      .attr('cy', yScale(maxPrice) + 8);
    g.select(`.${DRAG_HANDLE_CLASSES.MIN_HANDLE}`)
      .attr('cy', yScale(minPrice) - 8);
    g.select(`.${DRAG_HANDLE_CLASSES.CENTER_HANDLE}`)
      .attr('y', (yScale(maxPrice) + yScale(minPrice)) / 2 - 3);
    g.selectAll(`.${DRAG_HANDLE_CLASSES.CENTER_LINES}`)
      .attr('y', (yScale(maxPrice) + yScale(minPrice)) / 2 - 1.5);
  }
};