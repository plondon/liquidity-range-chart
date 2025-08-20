import { CHART_DIMENSIONS } from 'LiquidityRangeChart/constants';
import { UpdateSlice } from '../chartUpdateManager';

// Class names for price lines
export const TRANSPARENT_PRICE_LINE_CLASSES = {
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

// Class names for solid price lines
export const SOLID_PRICE_LINE_CLASSES = {
  MIN_LINE: 'min-solid-line',
  MAX_LINE: 'max-solid-line'
} as const;

/**
 * ELI5: This slice updates invisible horizontal lines that you can drag to change your 
 * price range. You can't see them (opacity = 0) but when you drag where they are,
 * you're actually moving the min/max price boundaries.
 */
export const TRANSPARENT_PRICE_LINES_SLICE: UpdateSlice = {
  name: 'priceLines',
  update: (ctx) => {
    const { g, minPrice, maxPrice, yScale } = ctx;
    
    // Update min/max lines (hidden but still used for dragging)
    g.select(`.${TRANSPARENT_PRICE_LINE_CLASSES.MIN_LINE}`)
      .attr('y1', yScale(minPrice))
      .attr('y2', yScale(minPrice));
      
    g.select(`.${TRANSPARENT_PRICE_LINE_CLASSES.MAX_LINE}`)
      .attr('y1', yScale(maxPrice))
      .attr('y2', yScale(maxPrice));
  }
};

export const SOLID_PRICE_LINES_SLICE: UpdateSlice = {
  name: 'solidPriceLines',
  update: (ctx) => {
    const { g, minPrice, maxPrice, yScale } = ctx;

    // Update min/max lines (solid)
  g.select(`.${SOLID_PRICE_LINE_CLASSES.MIN_LINE}`)
    .attr('y1', yScale(minPrice) + CHART_DIMENSIONS.SOLID_MIN_MAX_LINE_HEIGHT / 2)
    .attr('y2', yScale(minPrice) + CHART_DIMENSIONS.SOLID_MIN_MAX_LINE_HEIGHT / 2);

  g.select(`.${SOLID_PRICE_LINE_CLASSES.MAX_LINE}`)
      .attr('y1', yScale(maxPrice) - CHART_DIMENSIONS.SOLID_MIN_MAX_LINE_HEIGHT / 2)
      .attr('y2', yScale(maxPrice) - CHART_DIMENSIONS.SOLID_MIN_MAX_LINE_HEIGHT / 2);
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