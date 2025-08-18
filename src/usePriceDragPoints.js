import { useEffect } from 'react';
import * as d3 from 'd3';

const usePriceDragPoints = ({
  svgGroup,
  yScale,
  height,
  minPrice,
  maxPrice,
  onMinChange,
  onMaxChange,
  onCenterChange
}) => {
  useEffect(() => {
    if (!svgGroup || !yScale || minPrice === null || maxPrice === null) {
      // Remove drag points if no valid data
      if (svgGroup) {
        svgGroup.selectAll('.price-drag-points').remove();
      }
      return;
    }

    // Remove existing drag points
    svgGroup.selectAll('.price-drag-points').remove();
    
    const dragPointsGroup = svgGroup.append('g').attr('class', 'price-drag-points');
    
    // Configuration
    const dragPointWidth = 20;
    const handleRadius = 12;
    const leftOffset = -75; // Position on far left
    
    // Calculate positions
    const minY = yScale(minPrice);
    const maxY = yScale(maxPrice);
    const centerY = (minY + maxY) / 2;
    
    // Create the vertical track/background
    dragPointsGroup.append('rect')
      .attr('class', 'drag-track')
      .attr('x', leftOffset - dragPointWidth / 2)
      .attr('y', 0)
      .attr('width', dragPointWidth)
      .attr('height', height)
      .attr('fill', '#333333')
      .attr('rx', dragPointWidth / 2);
      
    // Create the pink active section between min and max
    dragPointsGroup.append('rect')
      .attr('class', 'drag-active-section')
      .attr('x', leftOffset - dragPointWidth / 2)
      .attr('y', maxY)
      .attr('width', dragPointWidth)
      .attr('height', minY - maxY)
      .attr('fill', '#ff69b4')
      .attr('rx', dragPointWidth / 2);
    
    // Create max handle (top circle)
    const maxHandle = dragPointsGroup.append('circle')
      .attr('class', 'drag-handle max-handle')
      .attr('cx', leftOffset)
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
          
          // Handle swapping if needed
          if (newPrice < minPrice) {
            onMinChange(newPrice);
            onMaxChange(minPrice);
          } else {
            onMaxChange(newPrice);
          }
        })
        .on('end', function() {
          d3.select(this).attr('stroke-width', 3);
        })
      );
    
    // Create min handle (bottom circle)
    const minHandle = dragPointsGroup.append('circle')
      .attr('class', 'drag-handle min-handle')
      .attr('cx', leftOffset)
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
          
          // Handle swapping if needed
          if (newPrice > maxPrice) {
            onMinChange(maxPrice);
            onMaxPrice(newPrice);
          } else {
            onMinChange(newPrice);
          }
        })
        .on('end', function() {
          d3.select(this).attr('stroke-width', 3);
        })
      );
    
    // Create center handle (middle circle with label)
    const centerHandleGroup = dragPointsGroup.append('g')
      .attr('class', 'center-handle-group')
      .attr('cursor', 'ns-resize')
      .call(d3.drag()
        .on('start', function() {
          d3.select(this).select('circle').attr('stroke-width', 4);
        })
        .on('drag', function(event) {
          const newCenterY = Math.max(handleRadius, Math.min(height - handleRadius, event.y));
          const newCenterPrice = yScale.invert(newCenterY);
          const rangeSize = maxPrice - minPrice;
          
          const newMaxPrice = newCenterPrice + rangeSize / 2;
          const newMinPrice = newCenterPrice - rangeSize / 2;
          
          if (onCenterChange) {
            onCenterChange(newMinPrice, newMaxPrice);
          }
        })
        .on('end', function() {
          d3.select(this).select('circle').attr('stroke-width', 3);
        })
      );
      
    centerHandleGroup.append('circle')
      .attr('cx', leftOffset)
      .attr('cy', centerY)
      .attr('r', handleRadius)
      .attr('fill', 'white')
      .attr('stroke', '#ff69b4')
      .attr('stroke-width', 3);
      
    // Add center label background
    centerHandleGroup.append('rect')
      .attr('x', leftOffset - 15)
      .attr('y', centerY - 6)
      .attr('width', 30)
      .attr('height', 12)
      .attr('fill', 'white')
      .attr('stroke', '#ff69b4')
      .attr('stroke-width', 1)
      .attr('rx', 6);
      
    // Add center label text
    centerHandleGroup.append('text')
      .attr('x', leftOffset)
      .attr('y', centerY + 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ff69b4')
      .text('CTR');

  }, [svgGroup, yScale, height, minPrice, maxPrice, onMinChange, onMaxChange, onCenterChange]);
};

export default usePriceDragPoints;