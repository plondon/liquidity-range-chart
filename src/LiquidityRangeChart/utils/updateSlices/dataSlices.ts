import * as d3 from 'd3';
import { UpdateSlice, DrawContext } from '../chartUpdateManager';
import { LiquidityDataPoint } from '../../types';
import { CHART_COLORS } from '../../constants';
import { getOpacityForPrice } from 'LiquidityRangeChart/utils';

// Class names for data visualization elements
export const DATA_ELEMENT_CLASSES = {
  LIQUIDITY_BAR: 'liquidity-bar',
  PRICE_SEGMENT: 'price-segment',
  CURRENT_PRICE_DOT: 'current-price-dot'
} as const;

/**
 * ELI5: This slice updates the colors of the horizontal liquidity bars on the right side.
 * When a price level is inside your selected range, its liquidity bar turns pink. 
 * When it's outside your range, it turns grey. This shows which liquidity is "active."
 */
export const LIQUIDITY_BARS_SLICE: UpdateSlice = {
  name: 'liquidityBars',
  update: (ctx) => {
    const { g, minPrice, maxPrice, getColorForPrice } = ctx;
    
    // Update liquidity bar colors based on price range
    g.selectAll(`.${DATA_ELEMENT_CLASSES.LIQUIDITY_BAR}`)
      .attr('fill', (d: any) => {
        const price = (d as LiquidityDataPoint).price0;
        return getColorForPrice(price, minPrice, maxPrice);
      })
      .attr('opacity', (d: any) => {
        const price = (d as LiquidityDataPoint).price0;
        return getOpacityForPrice(price, minPrice, maxPrice);
      });
  }
};

/**
 * ELI5: This slice draws and updates the colors of the price line segments (the zigzag price chart).
 * Parts of the price line that fall within your selected range turn pink, while parts 
 * outside your range turn grey. This shows which price movements are "in range."
 */
export const PRICE_SEGMENTS_SLICE: UpdateSlice = {
  name: 'priceSegments',
  draw: (ctx: DrawContext) => {
    const { g, minPrice, maxPrice, getColorForPrice, priceData, line } = ctx;
    
    // Draw price line with conditional coloring
    if (minPrice !== null && maxPrice !== null) {
      // Draw segments with different colors based on price range
      for (let i = 0; i < priceData.length - 1; i++) {
        const currentPoint = priceData[i];
        const nextPoint = priceData[i + 1];
        
        // Check if current point is within range
        const color = getColorForPrice(currentPoint.value, minPrice, maxPrice);
        
        // Draw line segment between current and next point
        g.append("path")
          .datum([currentPoint, nextPoint])
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("d", line)
          .attr("class", DATA_ELEMENT_CLASSES.PRICE_SEGMENT);
      }
    } else {
      // Draw single blue line when no range is selected
      g.append("path")
        .datum(priceData)
        .attr("fill", "none")
        .attr("stroke", CHART_COLORS.OUT_RANGE_GREY)
        .attr("stroke-width", 2)
        .attr("d", line)
        .attr("class", "price-line");
    }
  },
  update: (ctx) => {
    const { g, minPrice, maxPrice, getColorForPrice } = ctx;
    
    // Update price line segment colors based on range
    g.selectAll(`.${DATA_ELEMENT_CLASSES.PRICE_SEGMENT}`)
      .attr('stroke', function() {
        const datum = d3.select(this).datum() as Array<{date: Date, value: number}>;
        if (datum && datum.length > 0) {
          const value = datum[0].value;
          return getColorForPrice(value, minPrice, maxPrice);
        }
        return CHART_COLORS.OUT_RANGE_GREY;
      });
  }
};

/**
 * ELI5: This slice updates the color of the dot at the end of the price line (current price).
 * If the current price is within your selected range, the dot is pink. If it's outside 
 * your range, the dot is grey. This shows if "right now" is in your target range.
 */
export const CURRENT_PRICE_SLICE: UpdateSlice = {
  name: 'currentPrice',
  update: (ctx) => {
    const { g, minPrice, maxPrice, current, getColorForPrice } = ctx;
    
    // Update current price dot color based on whether it's in range
    if (current !== null && current !== undefined) {
      const currentDotColor = getColorForPrice(current, minPrice, maxPrice);
      g.select(`.${DATA_ELEMENT_CLASSES.CURRENT_PRICE_DOT}`).attr('fill', currentDotColor);
    }
  }
};