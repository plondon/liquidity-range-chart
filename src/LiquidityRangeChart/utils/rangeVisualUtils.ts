import * as d3 from 'd3';
import { CHART_COLORS, CHART_DIMENSIONS } from '../constants';
import { LiquidityDataPoint } from '../types';

export function updateRangeVisuals(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  constrainedMinPrice: number, 
  constrainedMaxPrice: number,
  yScale: d3.ScaleLinear<number, number>,
  margin: { top: number; right: number; bottom: number; left: number },
  dimensions: { width: number; height: number },
  width: number,
  getColorForPrice: (price: number, minPrice: number | null, maxPrice: number | null) => string,
  current: number | null
) {
  // Create or update range elements
  if (g.select('.price-range-bg').empty()) {
    // Create all range elements if they don't exist
    g.selectAll(".price-range-element").remove();
    
    // Visual pink background
    g.append('rect')
      .attr('class', 'price-range-element price-range-visual-bg')
      .attr('x', -margin.left)
      .attr('y', yScale(constrainedMaxPrice))
      .attr('width', dimensions.width)
      .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice))
      .attr('fill', CHART_COLORS.RANGE_OVERLAY_PINK)
      .attr('fill-opacity', 0.15)
      .style('pointer-events', 'none');
    
    // Interactive background
    g.append('rect')
      .attr('class', 'price-range-element price-range-bg')
      .attr('x', -margin.left)
      .attr('y', yScale(constrainedMaxPrice))
      .attr('width', width + margin.left + 10)
      .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice))
      .attr('fill', 'transparent')
      .style('pointer-events', 'none');
    
    // Range indicator line (pink bar on the right)
    g.append('rect')
      .attr('class', 'price-range-element range-indicator-line')
      .attr('x', width + margin.right - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr('y', yScale(constrainedMaxPrice))
      .attr('width', CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice))
      .attr('fill', CHART_COLORS.RANGE_OVERLAY_PINK)
      .attr('rx', 8)
      .attr('ry', 8);
    
    // Min/Max lines
    g.append('line')
      .attr('class', 'price-range-element min-line')
      .attr('x1', -margin.left)
      .attr('x2', dimensions.width - margin.left)
      .attr('y1', yScale(constrainedMinPrice))
      .attr('y2', yScale(constrainedMinPrice))
      .attr('stroke', CHART_COLORS.BOUNDARY_LINE)
      .attr('stroke-width', 2)
      .attr('opacity', 0);
      
    g.append('line')
      .attr('class', 'price-range-element max-line')
      .attr('x1', -margin.left)
      .attr('x2', dimensions.width - margin.left)
      .attr('y1', yScale(constrainedMaxPrice))
      .attr('y2', yScale(constrainedMaxPrice))
      .attr('stroke', CHART_COLORS.BOUNDARY_LINE)
      .attr('stroke-width', 2)
      .attr('opacity', 0);
    
    // Labels
    g.append('text')
      .attr('class', 'price-range-element min-label')
      .attr('x', -margin.left + 12)
      .attr('y', yScale(constrainedMinPrice) - 5)
      .attr('font-size', '10px')
      .attr('fill', CHART_COLORS.BOUNDARY_LINE)
      .attr('font-weight', 'bold')
      .text(`Min: ${constrainedMinPrice.toFixed(0)}`);
      
    g.append('text')
      .attr('class', 'price-range-element max-label')
      .attr('x', -margin.left + 12)
      .attr('y', yScale(constrainedMaxPrice) + 15)
      .attr('font-size', '10px')
      .attr('fill', CHART_COLORS.BOUNDARY_LINE)
      .attr('font-weight', 'bold')
      .text(`Max: ${constrainedMaxPrice.toFixed(0)}`);
    
    // Floating indicators
    g.append('rect')
      .attr('class', 'price-range-element min-floating-indicator')
      .attr('x', (width - margin.left) / 2 - 15)
      .attr('y', yScale(constrainedMinPrice) - 3)
      .attr('width', 30)
      .attr('height', 6)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', '#444444')
      .style('pointer-events', 'none');
      
    g.append('rect')
      .attr('class', 'price-range-element max-floating-indicator')
      .attr('x', (width - margin.left) / 2 - 15)
      .attr('y', yScale(constrainedMaxPrice) - 3)
      .attr('width', 30)
      .attr('height', 6)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', '#444444')
      .style('pointer-events', 'none');
  } else {
    // Update existing range elements
    g.select('.price-range-bg')
      .attr('y', yScale(constrainedMaxPrice))
      .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice));
    
    g.select('.price-range-visual-bg')
      .attr('y', yScale(constrainedMaxPrice))
      .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice));
    
    // Update range indicator line
    g.select('.range-indicator-line')
      .attr('y', yScale(constrainedMaxPrice))
      .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice));
    
    g.select('.min-line')
      .attr('y1', yScale(constrainedMinPrice))
      .attr('y2', yScale(constrainedMinPrice));
      
    g.select('.max-line')
      .attr('y1', yScale(constrainedMaxPrice))
      .attr('y2', yScale(constrainedMaxPrice));
    
    g.select('.min-label')
      .attr('y', yScale(constrainedMinPrice) - 5)
      .text(`Min: ${constrainedMinPrice.toFixed(0)}`);
      
    g.select('.max-label')
      .attr('y', yScale(constrainedMaxPrice) + 15)
      .text(`Max: ${constrainedMaxPrice.toFixed(0)}`);
      
    // Update floating indicators
    g.select('.min-floating-indicator')
      .attr('y', yScale(constrainedMinPrice) - 3);
    g.select('.max-floating-indicator')
      .attr('y', yScale(constrainedMaxPrice) - 3);
  }
  
  // Update drag indicators if they exist (for above/below range areas)
  g.select('.max-drag-indicator')
    .attr('cy', yScale(constrainedMaxPrice) + 8);
  g.select('.min-drag-indicator')
    .attr('cy', yScale(constrainedMinPrice) - 8);
  g.select('.center-drag-indicator')
    .attr('y', (yScale(constrainedMaxPrice) + yScale(constrainedMinPrice)) / 2 - 3);
  g.selectAll('.center-drag-line')
    .attr('y', (yScale(constrainedMaxPrice) + yScale(constrainedMinPrice)) / 2 - 1.5);
  
  // Update liquidity bar colors
  g.selectAll('.liquidity-bar')
    .attr('fill', (d: any) => {
      const price = (d as LiquidityDataPoint).price0;
      if (price >= constrainedMinPrice && price <= constrainedMaxPrice) {
        return CHART_COLORS.IN_RANGE_PINK;
      }
      return CHART_COLORS.OUT_RANGE_GREY;
    });
    
  // Update price line segment colors
  g.selectAll('.price-segment')
    .attr('stroke', function() {
      const datum = d3.select(this).datum() as Array<{date: Date, value: number}>;
      if (datum && datum.length > 0) {
        const value = datum[0].value;
        return getColorForPrice(value, constrainedMinPrice, constrainedMaxPrice);
      }
      return CHART_COLORS.OUT_RANGE_GREY;
    });
    
  // Update current price dot color
  if (current !== null) {
    const currentDotColor = getColorForPrice(current, constrainedMinPrice, constrainedMaxPrice);
    g.select('.current-price-dot').attr('fill', currentDotColor);
  }
}