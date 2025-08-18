import React, { useEffect } from 'react';
import * as d3 from 'd3';

const PriceRange = ({ 
  svgRef, 
  yScale, 
  width, 
  minPrice, 
  maxPrice,
  marginLeft = 80,
  marginTop = 20 
}) => {
  useEffect(() => {
    if (!svgRef.current || !yScale || minPrice === null || maxPrice === null) {
      // Remove existing range elements if no valid range
      d3.select(svgRef.current)
        .select('.price-range-group')
        .remove();
      return;
    }

    const svg = d3.select(svgRef.current);
    
    // Remove existing range elements
    svg.select('.price-range-group').remove();
    
    // Create group for price range elements
    const g = svg.append('g')
      .attr('class', 'price-range-group')
      .attr('transform', `translate(${marginLeft}, ${marginTop})`);

    // Draw transparent pink background between min and max
    g.append('rect')
      .attr('class', 'price-range-background')
      .attr('x', 0)
      .attr('y', yScale(maxPrice))
      .attr('width', width)
      .attr('height', yScale(minPrice) - yScale(maxPrice))
      .attr('fill', '#ff69b4')
      .attr('fill-opacity', 0.15);

    // Draw min price line (solid)
    g.append('line')
      .attr('class', 'price-range-line-min')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yScale(minPrice))
      .attr('y2', yScale(minPrice))
      .attr('stroke', '#ff6b6b')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9);

    // Draw max price line (solid)
    g.append('line')
      .attr('class', 'price-range-line-max')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yScale(maxPrice))
      .attr('y2', yScale(maxPrice))
      .attr('stroke', '#4ecdc4')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9);
      
    // Add min price label
    g.append('text')
      .attr('class', 'price-range-label-min')
      .attr('x', 5)
      .attr('y', yScale(minPrice) - 5)
      .attr('font-size', '10px')
      .attr('fill', '#ff6b6b')
      .attr('font-weight', 'bold')
      .text(`Min: ${minPrice.toFixed(0)}`);
      
    // Add max price label
    g.append('text')
      .attr('class', 'price-range-label-max')
      .attr('x', 5)
      .attr('y', yScale(maxPrice) + 15)
      .attr('font-size', '10px')
      .attr('fill', '#4ecdc4')
      .attr('font-weight', 'bold')
      .text(`Max: ${maxPrice.toFixed(0)}`);

  }, [svgRef, yScale, width, minPrice, maxPrice, marginLeft, marginTop]);

  return null; // This component doesn't render anything directly
};

export default PriceRange;