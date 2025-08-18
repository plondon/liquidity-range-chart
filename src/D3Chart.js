import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import PriceRange from './PriceRange';
import PriceDragPoints from './PriceDragPoints';

// Cache for price data lookups
const priceDataCache = new Map();

function findClosestElementBinarySearch(data, target) {
  let left = 0;
  let right = data.length - 1;

  if (!target) {
    return null;
  }

  if (priceDataCache.has(target.toString())) {
    return priceDataCache.get(target.toString());
  }

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (data[mid].price0 === target) {
      priceDataCache.set(target.toString(), data[mid]);
      return data[mid];
    } else if (data[mid].price0 < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // After binary search, left and right are the closest bounds
  const closest = data[right] ?? { price0: Infinity }; // Handle bounds
  const nextClosest = data[left] ?? { price0: Infinity };

  // Return the element with the closest `price0`
  const closestElement =
    Math.abs(closest.price0 - target) <= Math.abs(nextClosest.price0 - target) ? closest : nextClosest;

  priceDataCache.set(target.toString(), closestElement);
  return closestElement;
}

function scaleToInteger(a, precision = 18) {
  const scaleFactor = Math.pow(10, precision);
  return Math.round(a * scaleFactor);
}

const D3Chart = ({ data, liquidityData }) => {
  const svgRef = useRef();
  const [initialViewSet, setInitialViewSet] = useState(false);
  const [dragInProgress, setDragInProgress] = useState(false);
  
  // Default state object
  const defaultState = useRef({
    zoomLevel: 1,
    panY: 0,
    minPrice: null,
    maxPrice: null
  });
  
  // Main state object
  const [chartState, setChartState] = useState({
    zoomLevel: 1,
    panY: 0,
    minPrice: null,
    maxPrice: null
  });
  
  // Destructure for easier access
  const { zoomLevel, panY, minPrice, maxPrice } = chartState;
  
  // Calculate current price from the last entry
  const current = useMemo(() => {
    return data && data.length > 0 ? data[data.length - 1]?.value : null;
  }, [data]);
  
  // Calculate currentTick based on current price
  const currentTick = useMemo(() => {
    if (!current || !liquidityData) return null;
    return findClosestElementBinarySearch(liquidityData, current)?.tick;
  }, [current, liquidityData]);
  
  // Brush extent as [min, max] array
  const brushExtent = useMemo(() => {
    if (minPrice !== null && maxPrice !== null) {
      return [minPrice, maxPrice];
    }
    return null;
  }, [minPrice, maxPrice]);
  
  const setBrushExtent = (extent) => {
    if (extent && extent.length === 2) {
      setChartState(prev => ({
        ...prev,
        minPrice: extent[0],
        maxPrice: extent[1]
      }));
    } else {
      setChartState(prev => ({
        ...prev,
        minPrice: null,
        maxPrice: null
      }));
    }
  };
  
  // Helper functions for updating individual state properties
  const setMinPrice = (price) => setChartState(prev => ({ ...prev, minPrice: price }));
  const setMaxPrice = (price) => setChartState(prev => ({ ...prev, maxPrice: price }));
  const setZoomLevel = (zoom) => setChartState(prev => ({ ...prev, zoomLevel: zoom }));
  const setPanY = (pan) => setChartState(prev => ({ ...prev, panY: pan }));

  // Calculate yScale outside useEffect so it's available for Brush component
  const yScale = useMemo(() => {
    if (!data || !liquidityData) return null;
    
    const allPrices = [
      ...data.map(d => d.value),
      ...liquidityData.map(d => d.price0)
    ];
    const priceExtent = d3.extent(allPrices);
    
    const priceRange = priceExtent[1] - priceExtent[0];
    const zoomedRange = priceRange / zoomLevel;
    const centerPrice = priceExtent[0] + priceRange * 0.5 + panY * priceRange;
    
    return d3.scaleLinear()
      .domain([
        centerPrice - zoomedRange / 2,
        centerPrice + zoomedRange / 2
      ])
      .range([400 - 20 - 50, 0]); // [height, 0] for proper D3 coordinate system
  }, [data, liquidityData, zoomLevel, panY]);

  useEffect(() => {
    if (!data || !liquidityData || !yScale) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("g").remove(); // Only remove D3-created elements, not React elements

    const margin = { top: 20, right: 180, bottom: 50, left: 80 }; // Increased right margin for minimap
    const width = 900 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Convert timestamps to dates for price data
    const priceData = data.map(d => ({
      date: new Date(d.time * 1000),
      value: d.value
    }));

    // Unified price scale encompassing both price data and liquidity data
    const allPrices = [
      ...priceData.map(d => d.value),
      ...liquidityData.map(d => d.price0)
    ];
    const priceExtent = d3.extent(allPrices);

    // Scales for price line chart
    const xScale = d3.scaleTime()
      .domain(d3.extent(priceData, d => d.date))
      .range([-80, width - 40]); // Extend left but stop before liquidity section

    // Line generator for price
    const line = d3.line()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Draw price line with conditional coloring
    if (minPrice !== null && maxPrice !== null) {
      // Draw segments with different colors based on price range
      for (let i = 0; i < priceData.length - 1; i++) {
        const currentPoint = priceData[i];
        const nextPoint = priceData[i + 1];
        
        // Check if current point is within range
        const isInRange = currentPoint.value >= minPrice && currentPoint.value <= maxPrice;
        const color = isInRange ? "#d63384" : "#888888"; // Dark pink or grey
        
        // Draw line segment between current and next point
        g.append("path")
          .datum([currentPoint, nextPoint])
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 2)
          .attr("d", line)
          .attr("class", "price-segment");
      }
    } else {
      // Draw single blue line when no range is selected
      g.append("path")
        .datum(priceData)
        .attr("fill", "none")
        .attr("stroke", "#2196F3")
        .attr("stroke-width", 2)
        .attr("d", line)
        .attr("class", "price-line");
    }

    // Remove X and left Y axes completely

    // Right side liquidity chart - inspired by Uniswap's approach
    const liquidityWidth = margin.right; // Use full margin width
    
    // Use the same unified y scale for liquidity positioning
    const liquidityYScale = yScale;

    // Calculate current visible price range for filtering liquidity data
    const currentPriceRange = priceExtent[1] - priceExtent[0];
    const currentZoomedRange = currentPriceRange / zoomLevel;
    const currentCenterPrice = priceExtent[0] + currentPriceRange * 0.5 + panY * currentPriceRange;
    const visibleMinPrice = currentCenterPrice - currentZoomedRange / 2;
    const visibleMaxPrice = currentCenterPrice + currentZoomedRange / 2;

    // Filter liquidity data to only entries within visible price range
    const visibleLiquidityData = liquidityData.filter(d => 
      d.price0 >= visibleMinPrice && d.price0 <= visibleMaxPrice
    );

    // X scale for liquidity amounts - scale based only on visible entries
    const maxVisibleLiquidity = visibleLiquidityData.length > 0 
      ? d3.max(visibleLiquidityData, d => d.activeLiquidity)
      : d3.max(liquidityData, d => d.activeLiquidity); // Fallback if no visible data

    const liquidityXScale = d3.scaleLinear()
      .domain([0, maxVisibleLiquidity])
      .range([0, liquidityWidth]); // Back to liquidity section width

    // Draw very thin grey horizontal liquidity bars using data join for better performance
    const bars = g.selectAll(".liquidity-bar")
      .data(liquidityData, d => d.price0); // Use price as key for consistent updates
    
    // Remove bars that are no longer needed
    bars.exit()
      .transition()
      .duration(150)
      .style("opacity", 0)
      .remove();
    
    // Add new bars
    const enterBars = bars.enter()
      .append("rect")
      .attr("class", "liquidity-bar")
      .attr("height", 1)
      .attr("opacity", 0.7)
      .attr("x", d => width + 10 + liquidityWidth - liquidityXScale(d.activeLiquidity) - 40)
      .attr("y", d => liquidityYScale(d.price0) - 0.5)
      .attr("width", d => liquidityXScale(d.activeLiquidity));
    
    // Update existing bars with smooth transitions and conditional coloring
    bars.merge(enterBars)
      .transition()
      .duration(100)
      .attr("x", d => width + 10 + liquidityWidth - liquidityXScale(d.activeLiquidity) - 40)
      .attr("y", d => liquidityYScale(d.price0) - 0.5)
      .attr("width", d => liquidityXScale(d.activeLiquidity))
      .attr("fill", d => {
        // Check if bar is within the price range - ensure proper number comparison
        const price = parseFloat(d.price0);
        const min = parseFloat(minPrice);
        const max = parseFloat(maxPrice);
        
        if (minPrice !== null && maxPrice !== null && 
            price >= min && price <= max) {
          return "#d63384"; // Dark pink for bars within range
        }
        return "#888888"; // Default grey
      });

    // No price labels needed

    // Draw price range visualization directly in the main chart
    if (minPrice !== null && maxPrice !== null) {
      // Remove existing range elements
      g.selectAll(".price-range-element").remove();
      
      // Check if lines are too close together (less than 5px apart)
      const minY = yScale(minPrice);
      const maxY = yScale(maxPrice);
      const linesAreTooClose = Math.abs(minY - maxY) < 5;
      
      // Draw transparent pink background between min and max - extend to cover full chart area
      g.append('rect')
        .attr('class', 'price-range-element price-range-bg')
        .attr('x', -80) // Extend left to cover the margin area
        .attr('y', yScale(maxPrice))
        .attr('width', 900) // Cover the entire SVG width
        .attr('height', yScale(minPrice) - yScale(maxPrice))
        .attr('fill', '#ff69b4')
        .attr('fill-opacity', 0.15)
        .attr('stroke', 'none') // Remove any border from background
        .attr('cursor', 'move')
        .call(d3.drag()
          .on('start', function(event) {
            setDragInProgress(true);
            // Store the initial click offset relative to the range center
            const currentRangeCenterY = (yScale(maxPrice) + yScale(minPrice)) / 2;
            this._dragOffsetY = event.y - currentRangeCenterY;
          })
          .on('drag', function(event) {
            // Apply the stored offset to maintain consistent drag feel
            const adjustedY = event.y - this._dragOffsetY;
            const newCenterY = Math.max(0, Math.min(height, adjustedY));
            const draggedPrice = yScale.invert(newCenterY);
            const rangeSize = maxPrice - minPrice;
            
            // Calculate new min/max based on dragged center position
            const newMaxPrice = draggedPrice + rangeSize / 2;
            const newMinPrice = draggedPrice - rangeSize / 2;
            
            // Get data bounds to prevent dragging outside chart
            const allPrices = [
              ...data.map(d => d.value),
              ...liquidityData.map(d => d.price0)
            ];
            const dataMin = Math.min(...allPrices);
            const dataMax = Math.max(...allPrices);
            
            // Only update if range stays within data bounds
            if (newMinPrice >= dataMin && newMaxPrice <= dataMax) {
              // Update background position
              const newMaxY = yScale(newMaxPrice);
              const newMinY = yScale(newMinPrice);
              
              d3.select(this)
                .attr('y', newMaxY)
                .attr('height', newMinY - newMaxY);
              
              // Update min line
              g.select('.min-line')
                .attr('y1', newMinY)
                .attr('y2', newMinY);
                
              // Update max line
              g.select('.max-line')
                .attr('y1', newMaxY)
                .attr('y2', newMaxY);
                
              // Update labels
              g.select('.min-label')
                .attr('x', -68)
                .attr('y', newMinY - 5)
                .text(`Min: ${newMinPrice.toFixed(0)}`);
                
              g.select('.max-label')
                .attr('x', -68)
                .attr('y', newMaxY + 15)
                .text(`Max: ${newMaxPrice.toFixed(0)}`);
                
              // Update liquidity bar colors
              g.selectAll('.liquidity-bar')
                .attr('fill', d => {
                  const price = parseFloat(d.price0);
                  if (price >= newMinPrice && price <= newMaxPrice) {
                    return "#d63384";
                  }
                  return "#888888";
                });
                
              // Update price line segment colors
              g.selectAll('.price-segment')
                .attr('stroke', function() {
                  const datum = d3.select(this).datum();
                  if (datum && datum.length > 0) {
                    const value = datum[0].value;
                    return (value >= newMinPrice && value <= newMaxPrice) ? "#d63384" : "#888888";
                  }
                  return "#888888";
                });
                
              // Update minimap controls to reflect new positions
              g.select('.minimap-range')
                .attr('y', minimapYScale(newMaxPrice))
                .attr('height', minimapYScale(newMinPrice) - minimapYScale(newMaxPrice));
                
              g.select('.max-handle')
                .attr('cy', minimapYScale(newMaxPrice));
                
              g.select('.min-handle')
                .attr('cy', minimapYScale(newMinPrice));
                
              g.select('.center-handle')
                .attr('cy', (minimapYScale(newMaxPrice) + minimapYScale(newMinPrice)) / 2);
            }
          })
          .on('end', function(event) {
            // Apply the same offset calculation for consistency
            const adjustedY = event.y - this._dragOffsetY;
            const newCenterY = Math.max(margin.top, Math.min(400 - margin.bottom, adjustedY));
            const draggedPrice = yScale.invert(newCenterY);
            const rangeSize = maxPrice - minPrice;
            
            // Calculate new min/max based on dragged center position
            const newMaxPrice = draggedPrice + rangeSize / 2;
            const newMinPrice = draggedPrice - rangeSize / 2;
            
            // Get data bounds
            const allPrices = [
              ...data.map(d => d.value),
              ...liquidityData.map(d => d.price0)
            ];
            const dataMin = Math.min(...allPrices);
            const dataMax = Math.max(...allPrices);
            
            // Only update state if range stays within data bounds
            if (newMinPrice >= dataMin && newMaxPrice <= dataMax) {
              setMinPrice(newMinPrice);
              setMaxPrice(newMaxPrice);
            }
            
            setDragInProgress(false);
          })
        );

      // Draw min price line (solid) with drag behavior
      g.append('line')
        .attr('class', 'price-range-element min-line')
        .attr('x1', -80) // Start from left margin
        .attr('x2', 820) // Extend to right edge (900 - 80 = 820)
        .attr('y1', yScale(minPrice))
        .attr('y2', yScale(minPrice))
        .attr('stroke', '#131313')
        .attr('stroke-width', 2)
        .attr('opacity', 0.08)
        .attr('cursor', 'ns-resize')
        .call(d3.drag()
          .on('start', function() {
            setDragInProgress(true);
          })
          .on('drag', function(event) {
            const newY = Math.max(-margin.top, Math.min(height + margin.bottom, event.y));
            const newPrice = yScale.invert(newY);
            
            // Update visual position immediately
            d3.select(this)
              .attr('y1', newY)
              .attr('y2', newY);
            
            // Determine which line represents min and max during drag
            const currentMaxY = yScale(maxPrice);
            let draggedMinPrice = newPrice;
            let draggedMaxPrice = maxPrice;
            
            // Handle visual swapping if lines cross
            if (newY < currentMaxY) {
              // Min line dragged above max line - swap visually
              draggedMinPrice = maxPrice;
              draggedMaxPrice = newPrice;
              
              // Update max line color to min color and vice versa
              g.select('.max-line')
                .attr('stroke', '#131313'); // Same color for both
              d3.select(this)
                .attr('stroke', '#131313'); // Same color for both
            } else {
              // Lines in normal order - restore original colors
              g.select('.max-line')
                .attr('stroke', '#131313'); // Same color for both
              d3.select(this)
                .attr('stroke', '#131313'); // Same color for both
            }
            
            // Update background
            g.select('.price-range-bg')
              .attr('y', yScale(draggedMaxPrice))
              .attr('height', yScale(draggedMinPrice) - yScale(draggedMaxPrice));
            
            // Update labels
            g.select('.min-label')
              .attr('x', -68)
              .attr('y', yScale(draggedMinPrice) - 5)
              .text(`Min: ${draggedMinPrice.toFixed(0)}`);
            g.select('.max-label')
              .attr('x', -68)
              .attr('y', yScale(draggedMaxPrice) + 15)
              .text(`Max: ${draggedMaxPrice.toFixed(0)}`);
            
            // Update liquidity bar colors
            g.selectAll('.liquidity-bar')
              .attr('fill', d => {
                const price = parseFloat(d.price0);
                if (price >= draggedMinPrice && price <= draggedMaxPrice) {
                  return "#d63384";
                }
                return "#888888";
              });
            
            // Update price line segment colors
            g.selectAll('.price-segment')
              .attr('stroke', function() {
                const datum = d3.select(this).datum();
                if (datum && datum.length > 0) {
                  const value = datum[0].value;
                  return (value >= draggedMinPrice && value <= draggedMaxPrice) ? "#d63384" : "#888888";
                }
                return "#888888";
              });
              
            // Update minimap controls for min line drag
            g.select('.minimap-range')
              .attr('y', minimapYScale(draggedMaxPrice))
              .attr('height', minimapYScale(draggedMinPrice) - minimapYScale(draggedMaxPrice));
              
            g.select('.max-handle')
              .attr('cy', minimapYScale(draggedMaxPrice));
              
            g.select('.min-handle')
              .attr('cy', minimapYScale(draggedMinPrice));
              
            g.select('.center-handle')
              .attr('cy', (minimapYScale(draggedMaxPrice) + minimapYScale(draggedMinPrice)) / 2);
          })
          .on('end', function(event) {
            const newY = Math.max(-margin.top, Math.min(height + margin.bottom, event.y));
            const newPrice = yScale.invert(newY);
            
            // Handle final state update with proper min/max ordering
            if (newPrice > maxPrice) {
              // Min dragged above max - swap them in state
              setMinPrice(maxPrice);
              setMaxPrice(newPrice);
            } else {
              // Normal case - just update min
              setMinPrice(newPrice);
            }
            
            setDragInProgress(false);
          })
        );

      // Draw max price line (solid) with drag behavior
      g.append('line')
        .attr('class', 'price-range-element max-line')
        .attr('x1', -80) // Start from left margin
        .attr('x2', 820) // Extend to right edge (900 - 80 = 820)
        .attr('y1', yScale(maxPrice))
        .attr('y2', yScale(maxPrice))
        .attr('stroke', '#131313')
        .attr('stroke-width', 2)
        .attr('opacity', 0.08)
        .attr('cursor', 'ns-resize')
        .call(d3.drag()
          .on('start', function() {
            setDragInProgress(true);
          })
          .on('drag', function(event) {
            const newY = Math.max(-margin.top, Math.min(height + margin.bottom, event.y));
            const newPrice = yScale.invert(newY);
            
            // Update visual position immediately
            d3.select(this)
              .attr('y1', newY)
              .attr('y2', newY);
            
            // Determine which line represents min and max during drag
            const currentMinY = yScale(minPrice);
            let draggedMinPrice = minPrice;
            let draggedMaxPrice = newPrice;
            
            // Handle visual swapping if lines cross
            if (newY > currentMinY) {
              // Max line dragged below min line - swap visually
              draggedMinPrice = newPrice;
              draggedMaxPrice = minPrice;
              
              // Update min line color to max color and vice versa
              g.select('.min-line')
                .attr('stroke', '#131313'); // Same color for both
              d3.select(this)
                .attr('stroke', '#131313'); // Same color for both
            } else {
              // Lines in normal order - restore original colors
              g.select('.min-line')
                .attr('stroke', '#131313'); // Same color for both
              d3.select(this)
                .attr('stroke', '#131313'); // Same color for both
            }
            
            // Update background
            g.select('.price-range-bg')
              .attr('y', yScale(draggedMaxPrice))
              .attr('height', yScale(draggedMinPrice) - yScale(draggedMaxPrice));
            
            // Update labels
            g.select('.min-label')
              .attr('x', -68)
              .attr('y', yScale(draggedMinPrice) - 5)
              .text(`Min: ${draggedMinPrice.toFixed(0)}`);
            g.select('.max-label')
              .attr('x', -68)
              .attr('y', yScale(draggedMaxPrice) + 15)
              .text(`Max: ${draggedMaxPrice.toFixed(0)}`);
            
            // Update liquidity bar colors
            g.selectAll('.liquidity-bar')
              .attr('fill', d => {
                const price = parseFloat(d.price0);
                if (price >= draggedMinPrice && price <= draggedMaxPrice) {
                  return "#d63384";
                }
                return "#888888";
              });
            
            // Update price line segment colors
            g.selectAll('.price-segment')
              .attr('stroke', function() {
                const datum = d3.select(this).datum();
                if (datum && datum.length > 0) {
                  const value = datum[0].value;
                  return (value >= draggedMinPrice && value <= draggedMaxPrice) ? "#d63384" : "#888888";
                }
                return "#888888";
              });
              
            // Update minimap controls for max line drag
            g.select('.minimap-range')
              .attr('y', minimapYScale(draggedMaxPrice))
              .attr('height', minimapYScale(draggedMinPrice) - minimapYScale(draggedMaxPrice));
              
            g.select('.max-handle')
              .attr('cy', minimapYScale(draggedMaxPrice));
              
            g.select('.min-handle')
              .attr('cy', minimapYScale(draggedMinPrice));
              
            g.select('.center-handle')
              .attr('cy', (minimapYScale(draggedMaxPrice) + minimapYScale(draggedMinPrice)) / 2);
          })
          .on('end', function(event) {
            const newY = Math.max(-margin.top, Math.min(height + margin.bottom, event.y));
            const newPrice = yScale.invert(newY);
            
            // Handle final state update with proper min/max ordering
            if (newPrice < minPrice) {
              // Max dragged below min - swap them in state
              setMaxPrice(minPrice);
              setMinPrice(newPrice);
            } else {
              // Normal case - just update max
              setMaxPrice(newPrice);
            }
            
            setDragInProgress(false);
          })
        );
        
      // Add min price label
      g.append('text')
        .attr('class', 'price-range-element min-label')
        .attr('x', -68) // 12px from left border (-80 + 12)
        .attr('y', yScale(minPrice) - 5)
        .attr('font-size', '10px')
        .attr('fill', '#131313')
        .attr('font-weight', 'bold')
        .text(`Min: ${minPrice.toFixed(0)}`);
        
      // Add max price label
      g.append('text')
        .attr('class', 'price-range-element max-label')
        .attr('x', -68) // 12px from left border (-80 + 12)
        .attr('y', yScale(maxPrice) + 15)
        .attr('font-size', '10px')
        .attr('fill', '#131313')
        .attr('font-weight', 'bold')
        .text(`Max: ${maxPrice.toFixed(0)}`);
    }

    // Draw current price line (dotted) if current price exists
    if (current !== null) {
      // Remove existing current price line
      g.selectAll('.current-price-line').remove();
      g.selectAll('.current-price-label').remove();
      
      // Draw dotted line across the entire chart for current price
      g.append('line')
        .attr('class', 'current-price-line')
        .attr('x1', -80) // Start from left margin
        .attr('x2', 820) // Extend to right edge (900 - 80 = 820)
        .attr('y1', yScale(current))
        .attr('y2', yScale(current))
        .attr('stroke', '#666666') // Grey color
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5') // Dotted line pattern
        .attr('opacity', 0.8);
        
      // Add current price label on the left like min/max
      g.append('text')
        .attr('class', 'current-price-label')
        .attr('x', -68) // 12px from left border (-80 + 12)
        .attr('y', yScale(current) - 5)
        .attr('font-size', '10px')
        .attr('fill', '#666666') // Grey color
        .attr('font-weight', 'bold')
        .text(`Current: ${current.toFixed(0)}`);
    }

    // Create minimap controls on the right side
    const minimapWidth = 40;
    const minimapX = width + 160; // Position near the right border
    
    // Get full data range for minimap scale
    const minimapPrices = [...data.map(d => d.value), ...liquidityData.map(d => d.price0)];
    const dataMin = Math.min(...minimapPrices);
    const dataMax = Math.max(...minimapPrices);
    
    // Create scale for full data range (for minimap) - full container height
    const minimapYScale = d3.scaleLinear()
      .domain([dataMin, dataMax])
      .range([400 - margin.bottom, margin.top]);
    
    // Remove liquidity bars from minimap - not needed
    
    // Draw minimap background track (full container height)
    g.append('rect')
      .attr('class', 'minimap-track')
      .attr('x', minimapX)
      .attr('y', -margin.top)
      .attr('width', 8)
      .attr('height', 400) // Full container height
      .attr('fill', '#333333')
      .attr('rx', 4);
    
    // Calculate current viewport bounds based on zoom and pan using full data range
    const fullDataRange = dataMax - dataMin;
    const zoomedRange = fullDataRange / zoomLevel;
    const currentCenter = dataMin + fullDataRange * 0.5 + panY * fullDataRange;
    const viewportMinPrice = currentCenter - zoomedRange / 2;
    const viewportMaxPrice = currentCenter + zoomedRange / 2;
    
    // Draw viewport indicator (shows current visible area)
    const viewportHeight = minimapYScale(viewportMinPrice) - minimapYScale(viewportMaxPrice);
    g.append('rect')
      .attr('class', 'minimap-viewport')
      .attr('x', minimapX - 2)
      .attr('y', minimapYScale(viewportMaxPrice))
      .attr('width', 12)
      .attr('height', viewportHeight)
      .attr('fill', '#ffffff')
      .attr('fill-opacity', 0.2)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.4)
      .attr('rx', 2);
    
    // Draw current range indicator (pink bar) with drag functionality
    const currentRangeHeight = minimapYScale(minPrice) - minimapYScale(maxPrice);
    const minimapRange = g.append('rect')
      .attr('class', 'minimap-range')
      .attr('x', minimapX)
      .attr('y', minimapYScale(maxPrice))
      .attr('width', 8)
      .attr('height', currentRangeHeight)
      .attr('fill', '#ff69b4')
      .attr('rx', 4)
      .attr('cursor', 'move');
    
    // Add drag behavior to the minimap range bar
    minimapRange.call(d3.drag()
      .on('start', function() {
        setDragInProgress(true);
      })
      .on('drag', function(event) {
        const newCenterY = Math.max(margin.top, Math.min(400 - margin.bottom, event.y));
        const newCenterPrice = minimapYScale.invert(newCenterY);
        const rangeSize = maxPrice - minPrice;
        
        // Calculate new min/max based on center position
        let newMaxPrice = newCenterPrice + rangeSize / 2;
        let newMinPrice = newCenterPrice - rangeSize / 2;
        
        // Keep within data bounds
        if (newMaxPrice > dataMax) {
          newMaxPrice = dataMax;
          newMinPrice = dataMax - rangeSize;
        }
        if (newMinPrice < dataMin) {
          newMinPrice = dataMin;
          newMaxPrice = dataMin + rangeSize;
        }
        
        // Update visual positions of handles and range bar
        topHandle.attr('cy', minimapYScale(newMaxPrice));
        bottomHandle.attr('cy', minimapYScale(newMinPrice));
        d3.select(this)
          .attr('y', minimapYScale(newMaxPrice))
          .attr('height', minimapYScale(newMinPrice) - minimapYScale(newMaxPrice));
        
        // Update center handle position
        const newCenterHandleY = (minimapYScale(newMaxPrice) + minimapYScale(newMinPrice)) / 2;
        centerHandle.attr('cy', newCenterHandleY);
        
        // Calculate pan position based on where the range is positioned
        const fullDataRange = dataMax - dataMin;
        const rangeCenterInData = (newMaxPrice + newMinPrice) / 2;
        const dataCenterPosition = (rangeCenterInData - dataMin) / fullDataRange - 0.5;
        
        // Update chart state to follow the minimap range
        setChartState(prev => ({
          ...prev,
          minPrice: newMinPrice,
          maxPrice: newMaxPrice,
          panY: dataCenterPosition
        }));
      })
      .on('end', function() {
        setDragInProgress(false);
      })
    );
    
    // Draw drag handles
    const handleRadius = 8;
    
    // Top handle (max price)
    const topHandle = g.append('circle')
      .attr('class', 'minimap-handle max-handle')
      .attr('cx', minimapX + 4)
      .attr('cy', minimapYScale(maxPrice))
      .attr('r', handleRadius)
      .attr('fill', '#ffffff')
      .attr('stroke', '#ff69b4')
      .attr('stroke-width', 3)
      .attr('cursor', 'ns-resize');
    
    // Bottom handle (min price) 
    const bottomHandle = g.append('circle')
      .attr('class', 'minimap-handle min-handle')
      .attr('cx', minimapX + 4)
      .attr('cy', minimapYScale(minPrice))
      .attr('r', handleRadius)
      .attr('fill', '#ffffff')
      .attr('stroke', '#ff69b4')
      .attr('stroke-width', 3)
      .attr('cursor', 'ns-resize');
    
    // Center handle (for dragging entire range)
    const centerY = (minimapYScale(maxPrice) + minimapYScale(minPrice)) / 2;
    const centerHandle = g.append('circle')
      .attr('class', 'minimap-handle center-handle')
      .attr('cx', minimapX + 4)
      .attr('cy', centerY)
      .attr('r', 6)
      .attr('fill', '#ff69b4')
      .attr('cursor', 'move');
    
    // Add drag behavior to top handle (max price)
    topHandle.call(d3.drag()
      .on('start', function() {
        setDragInProgress(true);
      })
      .on('drag', function(event) {
        const newY = Math.max(margin.top, Math.min(400 - margin.bottom, event.y));
        const newMaxPrice = minimapYScale.invert(newY);
        
        // Ensure max stays above min
        const constrainedMaxPrice = Math.max(newMaxPrice, minPrice);
        
        // Update visual position
        d3.select(this).attr('cy', minimapYScale(constrainedMaxPrice));
        
        // Update range bar
        g.select('.minimap-range')
          .attr('y', minimapYScale(constrainedMaxPrice))
          .attr('height', minimapYScale(minPrice) - minimapYScale(constrainedMaxPrice));
        
        // Update center handle position
        const newCenterY = (minimapYScale(constrainedMaxPrice) + minimapYScale(minPrice)) / 2;
        centerHandle.attr('cy', newCenterY);
        
        // Update main chart price range elements
        g.select('.price-range-bg')
          .attr('y', yScale(constrainedMaxPrice))
          .attr('height', yScale(minPrice) - yScale(constrainedMaxPrice));
          
        g.select('.max-line')
          .attr('y1', yScale(constrainedMaxPrice))
          .attr('y2', yScale(constrainedMaxPrice));
          
        g.select('.max-label')
          .attr('y', yScale(constrainedMaxPrice) + 15)
          .text(`Max: ${constrainedMaxPrice.toFixed(0)}`);
      })
      .on('end', function(event) {
        const newY = Math.max(margin.top, Math.min(400 - margin.bottom, event.y));
        let newMaxPrice = minimapYScale.invert(newY);
        
        // If dragged to top, set to data maximum
        if (newY <= margin.top + 10) {
          newMaxPrice = dataMax;
        }
        
        // Ensure max stays above min
        const constrainedMaxPrice = Math.max(newMaxPrice, minPrice);
        setMaxPrice(constrainedMaxPrice);
        setDragInProgress(false);
      })
    );
    
    // Add drag behavior to bottom handle (min price)
    bottomHandle.call(d3.drag()
      .on('start', function() {
        setDragInProgress(true);
      })
      .on('drag', function(event) {
        const newY = Math.max(margin.top, Math.min(400 - margin.bottom, event.y));
        const newMinPrice = minimapYScale.invert(newY);
        
        // Ensure min stays below max
        const constrainedMinPrice = Math.min(newMinPrice, maxPrice);
        
        // Update visual position
        d3.select(this).attr('cy', minimapYScale(constrainedMinPrice));
        
        // Update range bar
        g.select('.minimap-range')
          .attr('y', minimapYScale(maxPrice))
          .attr('height', minimapYScale(constrainedMinPrice) - minimapYScale(maxPrice));
        
        // Update center handle position
        const newCenterY = (minimapYScale(maxPrice) + minimapYScale(constrainedMinPrice)) / 2;
        centerHandle.attr('cy', newCenterY);
        
        // Update main chart price range elements
        g.select('.price-range-bg')
          .attr('y', yScale(maxPrice))
          .attr('height', yScale(constrainedMinPrice) - yScale(maxPrice));
          
        g.select('.min-line')
          .attr('y1', yScale(constrainedMinPrice))
          .attr('y2', yScale(constrainedMinPrice));
          
        g.select('.min-label')
          .attr('y', yScale(constrainedMinPrice) - 5)
          .text(`Min: ${constrainedMinPrice.toFixed(0)}`);
      })
      .on('end', function(event) {
        const newY = Math.max(margin.top, Math.min(400 - margin.bottom, event.y));
        let newMinPrice = minimapYScale.invert(newY);
        
        // If dragged to bottom, set to data minimum
        if (newY >= 400 - margin.bottom - 10) {
          newMinPrice = dataMin;
        }
        
        // Ensure min stays below max
        const constrainedMinPrice = Math.min(newMinPrice, maxPrice);
        setMinPrice(constrainedMinPrice);
        setDragInProgress(false);
      })
    );
    
    // Add drag behavior to center handle (drag entire range)
    centerHandle.call(d3.drag()
      .on('start', function() {
        setDragInProgress(true);
      })
      .on('drag', function(event) {
        const newCenterY = Math.max(margin.top, Math.min(400 - margin.bottom, event.y));
        const newCenterPrice = minimapYScale.invert(newCenterY);
        const rangeSize = maxPrice - minPrice;
        
        // Calculate new min/max based on center position
        let newMaxPrice = newCenterPrice + rangeSize / 2;
        let newMinPrice = newCenterPrice - rangeSize / 2;
        
        // Keep within data bounds
        if (newMaxPrice > dataMax) {
          newMaxPrice = dataMax;
          newMinPrice = dataMax - rangeSize;
        }
        if (newMinPrice < dataMin) {
          newMinPrice = dataMin;
          newMaxPrice = dataMin + rangeSize;
        }
        
        // Update visual positions
        topHandle.attr('cy', minimapYScale(newMaxPrice));
        bottomHandle.attr('cy', minimapYScale(newMinPrice));
        d3.select(this).attr('cy', (minimapYScale(newMaxPrice) + minimapYScale(newMinPrice)) / 2);
        
        // Update range bar
        g.select('.minimap-range')
          .attr('y', minimapYScale(newMaxPrice))
          .attr('height', minimapYScale(newMinPrice) - minimapYScale(newMaxPrice));
          
        // Update main chart price range elements
        g.select('.price-range-bg')
          .attr('y', yScale(newMaxPrice))
          .attr('height', yScale(newMinPrice) - yScale(newMaxPrice));
          
        g.select('.min-line')
          .attr('y1', yScale(newMinPrice))
          .attr('y2', yScale(newMinPrice));
          
        g.select('.max-line')
          .attr('y1', yScale(newMaxPrice))
          .attr('y2', yScale(newMaxPrice));
          
        g.select('.min-label')
          .attr('y', yScale(newMinPrice) - 5)
          .text(`Min: ${newMinPrice.toFixed(0)}`);
          
        g.select('.max-label')
          .attr('y', yScale(newMaxPrice) + 15)
          .text(`Max: ${newMaxPrice.toFixed(0)}`);
      })
      .on('end', function(event) {
        const newCenterY = Math.max(margin.top, Math.min(400 - margin.bottom, event.y));
        const newCenterPrice = minimapYScale.invert(newCenterY);
        const rangeSize = maxPrice - minPrice;
        
        // Calculate new min/max based on center position
        let newMaxPrice = newCenterPrice + rangeSize / 2;
        let newMinPrice = newCenterPrice - rangeSize / 2;
        
        // Keep within data bounds
        if (newMaxPrice > dataMax) {
          newMaxPrice = dataMax;
          newMinPrice = dataMax - rangeSize;
        }
        if (newMinPrice < dataMin) {
          newMinPrice = dataMin;
          newMaxPrice = dataMin + rangeSize;
        }
        
        setMinPrice(newMinPrice);
        setMaxPrice(newMaxPrice);
        setDragInProgress(false);
      })
    );


    // Setup wheel event handler
    const handleWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Calculate current view bounds
      const priceRange = priceExtent[1] - priceExtent[0];
      const zoomedRange = priceRange / zoomLevel;
      const currentCenter = priceExtent[0] + priceRange * 0.5 + panY * priceRange;
      const currentMin = currentCenter - zoomedRange / 2;
      const currentMax = currentCenter + zoomedRange / 2;
      
      // Natural scroll sensitivity based on current view range
      const scrollSensitivity = zoomedRange / 600; // Faster scrolling for larger ranges
      const rawScrollAmount = event.deltaY * scrollSensitivity;
      
      // Apply scroll (invert deltaY for natural direction)
      const scrollAmount = rawScrollAmount / priceRange; // Normalize to pan range
      
      setChartState(prev => {
        const newPanY = prev.panY - scrollAmount;
        
        // Dynamic bounds based on data and zoom level
        const dataMin = Math.min(...allPrices);
        const dataMax = Math.max(...allPrices);
        const halfZoomedRange = zoomedRange / 2;
        
        // Calculate max pan bounds to keep view within data
        const maxPanUp = (dataMax - halfZoomedRange - (priceExtent[0] + priceRange * 0.5)) / priceRange;
        const maxPanDown = (dataMin + halfZoomedRange - (priceExtent[0] + priceRange * 0.5)) / priceRange;
        
        // Constrain to bounds
        const constrainedPanY = Math.max(maxPanDown, Math.min(maxPanUp, newPanY));
        
        return { ...prev, panY: constrainedPanY };
      });
    };

    // Add wheel event listener
    const svgElement = svgRef.current;
    if (svgElement) {
      svgElement.addEventListener('wheel', handleWheel, { passive: false });
      return () => svgElement.removeEventListener('wheel', handleWheel);
    }

  }, [data, liquidityData, zoomLevel, panY, yScale, current, currentTick, minPrice, maxPrice]);


  // Set reasonable initial view on first load
  useEffect(() => {
    if (!initialViewSet && data && liquidityData && liquidityData.length > 0) {
      const allPrices = [
        ...data.map(d => d.value),
        ...liquidityData.map(d => d.price0)
      ];
      const priceExtent = d3.extent(allPrices);
      const priceRange = priceExtent[1] - priceExtent[0];
      
      // Filter out extreme outliers for initial view - focus on middle 20% of liquidity
      const liquidityPrices = liquidityData.map(d => d.price0).sort((a, b) => a - b);
      const percentile20 = liquidityPrices[Math.floor(liquidityPrices.length * 0.2)];
      const percentile80 = liquidityPrices[Math.floor(liquidityPrices.length * 0.8)];
      
      // Set initial zoom to focus on the 20-80% range of liquidity with tighter view
      const focusRange = percentile80 - percentile20;
      const desiredZoom = Math.min(priceRange / (focusRange * 1), 25); // Show ~1x the focus range, max 25x zoom
      
      // Center the view on the current price (last data point)
      const currentPrice = data[data.length - 1]?.value;
      const originalCenter = priceExtent[0] + priceRange * 0.5;
      const panOffset = (currentPrice - originalCenter) / priceRange;
      
      // Set default brush range - use a symmetrical range around current price
      // Use 10% of the total price range for the brush range (tighter)
      const brushRangeSize = priceRange * 0.1;
      const defaultMinPrice = currentPrice - brushRangeSize / 2;
      const defaultMaxPrice = currentPrice + brushRangeSize / 2;
      
      // Update both current state and default state
      const newDefaultState = {
        zoomLevel: desiredZoom,
        panY: panOffset,
        minPrice: defaultMinPrice,
        maxPrice: defaultMaxPrice
      };
      
      defaultState.current = newDefaultState;
      setChartState(newDefaultState);
      
      setInitialViewSet(true);
    }
  }, [data, liquidityData, initialViewSet]);

  const handleZoomIn = () => {
    const targetZoom = Math.min(zoomLevel * 1.3, 50);
    animateToState(targetZoom, panY, null, null, 300); // Faster for zoom buttons
  };

  const handleZoomOut = () => {
    const targetZoom = Math.max(zoomLevel / 1.3, 0.1);
    animateToState(targetZoom, panY, null, null, 300); // Faster for zoom buttons
  };

  // Smooth animation utility function with optional price range animation
  const animateToState = (targetZoom, targetPan, targetMinPrice = null, targetMaxPrice = null, duration = 400) => {
    const startZoom = zoomLevel;
    const startPan = panY;
    const startMinPrice = minPrice;
    const startMaxPrice = maxPrice;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Modern easeOutQuart for snappy, smooth feel
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      
      // Interpolate zoom and pan values
      const currentZoom = startZoom + (targetZoom - startZoom) * easeProgress;
      const currentPan = startPan + (targetPan - startPan) * easeProgress;
      
      // Interpolate price range if targets provided
      let currentMinPrice = startMinPrice;
      let currentMaxPrice = startMaxPrice;
      
      if (targetMinPrice !== null && targetMaxPrice !== null) {
        if (startMinPrice !== null && startMaxPrice !== null) {
          currentMinPrice = startMinPrice + (targetMinPrice - startMinPrice) * easeProgress;
          currentMaxPrice = startMaxPrice + (targetMaxPrice - startMaxPrice) * easeProgress;
        } else {
          // If no current range, just set the target at the end
          if (progress === 1) {
            currentMinPrice = targetMinPrice;
            currentMaxPrice = targetMaxPrice;
          }
        }
      }
      
      setChartState(prev => ({
        ...prev,
        zoomLevel: currentZoom,
        panY: currentPan,
        minPrice: currentMinPrice,
        maxPrice: currentMaxPrice
      }));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  };

  const handleResetZoom = () => {
    // Animate reset of zoom, pan, and price range
    animateToState(
      defaultState.current.zoomLevel, 
      defaultState.current.panY,
      defaultState.current.minPrice,
      defaultState.current.maxPrice,
      500 // Slightly longer for full reset
    );
  };

  const handleCenterRange = () => {
    if (minPrice === null || maxPrice === null || !data || !liquidityData) return;
    
    // Calculate all prices to get data bounds
    const allPrices = [
      ...data.map(d => d.value),
      ...liquidityData.map(d => d.price0)
    ];
    const priceExtent = d3.extent(allPrices);
    const totalPriceRange = priceExtent[1] - priceExtent[0];
    
    // Calculate range center and size
    const rangeCenter = (minPrice + maxPrice) / 2;
    const rangeSize = maxPrice - minPrice;
    
    // Calculate required pan to center the range
    const originalCenter = priceExtent[0] + totalPriceRange * 0.5;
    const targetPanY = (rangeCenter - originalCenter) / totalPriceRange;
    
    // Calculate required zoom to fit the range (with some padding)
    const paddingFactor = 1.2; // 20% padding around the range
    const visibleRangeNeeded = rangeSize * paddingFactor;
    const currentVisibleRange = totalPriceRange / zoomLevel;
    
    let targetZoomLevel = zoomLevel;
    if (visibleRangeNeeded > currentVisibleRange) {
      // Need to zoom out to fit the range
      targetZoomLevel = totalPriceRange / visibleRangeNeeded;
      targetZoomLevel = Math.max(targetZoomLevel, 0.1); // Don't zoom out too far
    }
    
    // Animate the transition with faster, smoother timing
    animateToState(targetZoomLevel, targetPanY, null, null, 500);
  };

  return (
    <div>
      {/* Controls Panel - Outside Chart */}
      <div style={{ 
        marginBottom: '10px',
        background: '#f9f9f9',
        padding: '12px',
        borderRadius: '4px',
        border: '1px solid #ddd',
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start',
        flexWrap: 'wrap'
      }}>
        {/* Zoom Controls */}
        <div>
          <div style={{ marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
            Zoom: {zoomLevel.toFixed(1)}x
          </div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
            <button onClick={handleZoomIn} style={{ fontSize: '12px', padding: '4px 8px' }}>
              Zoom In (+)
            </button>
            <button onClick={handleZoomOut} style={{ fontSize: '12px', padding: '4px 8px' }}>
              Zoom Out (-)
            </button>
            <button onClick={handleResetZoom} style={{ fontSize: '12px', padding: '4px 8px' }}>
              Reset
            </button>
            <button 
              onClick={handleCenterRange} 
              disabled={minPrice === null || maxPrice === null}
              style={{ 
                fontSize: '12px', 
                padding: '4px 8px',
                opacity: minPrice === null || maxPrice === null ? 0.5 : 1,
                cursor: minPrice === null || maxPrice === null ? 'not-allowed' : 'pointer'
              }}
            >
              Center Range
            </button>
          </div>
          <div style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>
            Scroll to pan
          </div>
        </div>

        {/* Price Range Controls */}
        <div>
          <div style={{ marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
            Price Range
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ fontSize: '11px', minWidth: '30px' }}>Min:</label>
              <input
                type="number"
                value={minPrice || ''}
                onChange={(e) => setMinPrice(e.target.value ? parseFloat(e.target.value) : null)}
                style={{ 
                  fontSize: '11px', 
                  padding: '4px 6px', 
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  width: '90px'
                }}
                step="0.01"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label style={{ fontSize: '11px', minWidth: '30px' }}>Max:</label>
              <input
                type="number"
                value={maxPrice || ''}
                onChange={(e) => setMaxPrice(e.target.value ? parseFloat(e.target.value) : null)}
                style={{ 
                  fontSize: '11px', 
                  padding: '4px 6px', 
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  width: '90px'
                }}
                step="0.01"
              />
            </div>
            <button 
              onClick={() => { setMinPrice(null); setMaxPrice(null); }}
              style={{ 
                fontSize: '11px', 
                padding: '4px 8px', 
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear Range
            </button>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <svg
        ref={svgRef}
        width={900}
        height={400}
        style={{ border: '1px solid #ccc' }}
        >
        </svg>
        
        
      </div>
    </div>
  );
};

export default D3Chart;