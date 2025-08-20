import { UpdateSlice } from '../chartUpdateManager';

// Class names for background elements
export const BACKGROUND_CLASSES = {
  INTERACTIVE_BG: 'price-range-bg',
  VISUAL_BG: 'price-range-visual-bg', 
  RANGE_INDICATOR: 'range-indicator-line'
} as const;

/**
 * ELI5: This slice updates all the colored background areas that show your selected price range.
 * Think of it like highlighting text - it shows which price area you've selected by coloring
 * the background pink. It includes the main chart background and the pink bar on the right side.
 */
export const BACKGROUND_SLICE: UpdateSlice = {
  name: 'backgrounds',
  update: (ctx) => {
    const { g, minPrice, maxPrice, yScale } = ctx;
    
    // Update interactive background (invisible, used for drag interactions)
    g.select(`.${BACKGROUND_CLASSES.INTERACTIVE_BG}`)
      .attr('y', yScale(maxPrice))
      .attr('height', yScale(minPrice) - yScale(maxPrice));
    
    // Update visual background (pink overlay showing selected range)
    g.select(`.${BACKGROUND_CLASSES.VISUAL_BG}`)
      .attr('y', yScale(maxPrice))
      .attr('height', yScale(minPrice) - yScale(maxPrice));
    
    // Update range indicator line (pink bar on the right side)
    g.select(`.${BACKGROUND_CLASSES.RANGE_INDICATOR}`)
      .attr('y', yScale(maxPrice))
      .attr('height', yScale(minPrice) - yScale(maxPrice));
  }
};