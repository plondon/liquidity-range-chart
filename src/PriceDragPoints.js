import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const PriceDragPoints = ({
  svgRef,
  yScale,
  height,
  minPrice,
  maxPrice,
  currentPrice,
  onMinChange,
  onMaxChange,
  onCenterChange,
  marginLeft = 80,
  marginTop = 20
}) => {
  const dragPointsRef = useRef();

  useEffect(() => {
    if (!svgRef.current || !yScale || !minPrice || !maxPrice || !currentPrice) {
      return;
    }

    const svg = d3.select(svgRef.current);
    
    // Remove existing drag points
    svg.select('.price-drag-points').remove();
    
    // Create group for drag points
    const g = svg.append('g')
      .attr('class', 'price-drag-points')
      .attr('transform', `translate(${marginLeft}, ${marginTop})`);

    // Calculate positions
    const minY = yScale(minPrice);
    const maxY = yScale(maxPrice);
    const centerY = yScale(currentPrice);
    const centerPrice = (minPrice + maxPrice) / 2;
    
    // Drag points configuration
    const dragPointWidth = 20;
    const dragPointHeight = height;
    const handleRadius = 12;
    
    // Create the vertical track/background
    g.append('rect')
      .attr('class', 'drag-track')
      .attr('x', -marginLeft - dragPointWidth / 2)
      .attr('y', 0)
      .attr('width', dragPointWidth)
      .attr('height', dragPointHeight)
      .attr('fill', '#333333')
      .attr('rx', dragPointWidth / 2);
      
    // Create the pink active section between min and max
    g.append('rect')
      .attr('class', 'drag-active-section')
      .attr('x', -marginLeft - dragPointWidth / 2)
      .attr('y', maxY)
      .attr('width', dragPointWidth)
      .attr('height', minY - maxY)
      .attr('fill', '#ff69b4')
      .attr('rx', dragPointWidth / 2);
    
    // Create max handle (top circle)
    const maxHandle = g.append('circle')
      .attr('class', 'drag-handle max-handle')
      .attr('cx', -marginLeft)
      .attr('cy', maxY)
      .attr('r', handleRadius)
      .attr('fill', 'white')
      .attr('stroke', '#ff69b4')
      .attr('stroke-width', 3)
      .attr('cursor', 'ns-resize')
      .call(d3.drag()
        .on('start', function() {
          d3.select(this).attr('stroke-width', 4);
        })
        .on('drag', function(event) {
          const newY = Math.max(0, Math.min(height, event.y));
          const newPrice = yScale.invert(newY);
          
          // Update handle position
          d3.select(this).attr('cy', newY);
          
          // Update active section
          const currentMinY = yScale(minPrice);
          g.select('.drag-active-section')
            .attr('y', newY)
            .attr('height', Math.max(0, currentMinY - newY));
            
          // Call callback
          if (onMaxChange) onMaxChange(newPrice);
        })
        .on('end', function() {
          d3.select(this).attr('stroke-width', 3);
        })
      );
    
    // Create min handle (bottom circle)
    const minHandle = g.append('circle')
      .attr('class', 'drag-handle min-handle')
      .attr('cx', -marginLeft)
      .attr('cy', minY)
      .attr('r', handleRadius)
      .attr('fill', 'white')
      .attr('stroke', '#ff69b4')
      .attr('stroke-width', 3)
      .attr('cursor', 'ns-resize')
      .call(d3.drag()
        .on('start', function() {
          d3.select(this).attr('stroke-width', 4);
        })
        .on('drag', function(event) {
          const newY = Math.max(0, Math.min(height, event.y));
          const newPrice = yScale.invert(newY);
          
          // Update handle position
          d3.select(this).attr('cy', newY);
          
          // Update active section
          const currentMaxY = yScale(maxPrice);
          g.select('.drag-active-section')
            .attr('height', Math.max(0, newY - currentMaxY));
            
          // Call callback
          if (onMinChange) onMinChange(newPrice);
        })
        .on('end', function() {
          d3.select(this).attr('stroke-width', 3);
        })
      );
    
    // Create center handle (middle circle with label)
    const centerHandle = g.append('g')
      .attr('class', 'center-handle-group')
      .attr('cursor', 'ns-resize')
      .call(d3.drag()
        .on('start', function() {
          d3.select(this).select('circle').attr('stroke-width', 4);
        })
        .on('drag', function(event) {
          const newY = Math.max(0, Math.min(height, event.y));
          const newCenterPrice = yScale.invert(newY);
          const rangeSize = maxPrice - minPrice;
          
          const newMaxPrice = newCenterPrice + rangeSize / 2;
          const newMinPrice = newCenterPrice - rangeSize / 2;
          
          // Update center handle position
          d3.select(this).attr('transform', `translate(0, ${newY - centerY})`);
          
          // Update other handles
          maxHandle.attr('cy', yScale(newMaxPrice));
          minHandle.attr('cy', yScale(newMinPrice));
          
          // Update active section
          g.select('.drag-active-section')
            .attr('y', yScale(newMaxPrice))
            .attr('height', yScale(newMinPrice) - yScale(newMaxPrice));
          
          // Call callbacks
          if (onCenterChange) onCenterChange(newMinPrice, newMaxPrice);
        })
        .on('end', function() {
          d3.select(this).select('circle').attr('stroke-width', 3);
        })
      );
      
    centerHandle.append('circle')
      .attr('cx', -marginLeft)
      .attr('cy', centerY)
      .attr('r', handleRadius)
      .attr('fill', 'white')
      .attr('stroke', '#ff69b4')
      .attr('stroke-width', 3);
      
    // Add center label
    centerHandle.append('rect')
      .attr('x', -marginLeft - 15)
      .attr('y', centerY - 6)
      .attr('width', 30)
      .attr('height', 12)
      .attr('fill', 'white')
      .attr('rx', 6);
      
    centerHandle.append('text')
      .attr('x', -marginLeft)
      .attr('y', centerY + 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ff69b4')
      .text('CTR');

  }, [svgRef, yScale, height, minPrice, maxPrice, currentPrice, onMinChange, onMaxChange, onCenterChange, marginLeft, marginTop]);

  return null;
};

export default PriceDragPoints;