import { UpdateSlice } from '../chartUpdateManager';

// Class names for price labels
export const LABEL_CLASSES = {
  MIN_LABEL: 'min-label',
  MAX_LABEL: 'max-label'
} as const;

/**
 * ELI5: This slice updates the text labels that show your actual min and max prices.
 * These are the "Min: 2500" and "Max: 3000" text that appears on the left side of 
 * the chart. When you drag the price boundaries, these numbers automatically update.
 */
export const LABELS_SLICE: UpdateSlice = {
  name: 'labels',
  update: (ctx) => {
    const { g, minPrice, maxPrice, priceToY, margin } = ctx;
    
    // Update price labels with current values
    g.select(`.${LABEL_CLASSES.MIN_LABEL}`)
      .attr('x', -margin.left + 12) // 12px from left border
      .attr('y', priceToY(minPrice) - 5)
      .text(`Min: ${minPrice.toFixed(0)}`);
    g.select(`.${LABEL_CLASSES.MAX_LABEL}`)
      .attr('x', -margin.left + 12) // 12px from left border  
      .attr('y', priceToY(maxPrice) + 15)
      .text(`Max: ${maxPrice.toFixed(0)}`);
  }
};