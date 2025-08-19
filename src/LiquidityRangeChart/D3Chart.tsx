import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { findClosestElementBinarySearch } from './utils/dataUtils';
import { useResponsiveDimensions } from './hooks/useResponsiveDimensions';
import { useChartState } from './hooks/useChartState';
import { useInitialView } from './hooks/useInitialView';
import { useChartInteractions } from './hooks/useChartInteractions';
import { PriceDataPoint, LiquidityDataPoint } from './types';
import { CHART_COLORS, CHART_DIMENSIONS, BREAKPOINTS, CHART_BEHAVIOR, ANIMATION, TYPOGRAPHY } from './constants';
import { 
  calculateAllPrices, 
  getPriceExtent, 
  getColorForPrice, 
  validateChartData, 
  getResponsiveDimensions,
  isPriceExtentValid 
} from './utils';
import { useDragBehavior } from '../hooks/chart/useDragBehavior';

const D3Chart = ({ data, liquidityData }: { data: PriceDataPoint[], liquidityData: LiquidityDataPoint[] }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Use custom hooks
  const dimensions = useResponsiveDimensions();
  const {
    zoomLevel,
    panY,
    minPrice,
    maxPrice,
    defaultState,
    setChartState,
    setMinPrice,
    setMaxPrice,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleCenterRange
  } = useChartState();
  
  // Drag behavior hook
  const dragBehavior = useDragBehavior();
  
  // Initialize hooks
  useInitialView(data, liquidityData, setChartState, defaultState);
  useChartInteractions(svgRef, data, liquidityData, zoomLevel, panY, setChartState);
  
  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    data: LiquidityDataPoint | null;
    lineEndX: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    data: null,
    lineEndX: 0
  });
  
  // Calculate current price from the last entry
  const current = useMemo(() => {
    return data && data.length > 0 ? data[data.length - 1]?.value : null;
  }, [data]);
  
  // Calculate currentTick based on current price
  const currentTick = useMemo(() => {
    if (!current || !liquidityData) return null;
    return findClosestElementBinarySearch(liquidityData, current)?.tick;
  }, [current, liquidityData]);
  

  // Calculate yScale outside useEffect so it's available for Brush component
  const yScale = useMemo(() => {
    const allPrices = [
      ...calculateAllPrices(data),
      ...liquidityData.map(d => d.price0)
    ];
    const priceExtent = d3.extent(allPrices);
    
    if (!isPriceExtentValid(priceExtent)) return null;
    
    const priceRange = priceExtent[1] - priceExtent[0];
    const zoomedRange = priceRange / zoomLevel;
    const centerPrice = priceExtent[0] + priceRange * 0.5 + panY * priceRange;
    
    return d3.scaleLinear()
      .domain([
        centerPrice - zoomedRange / 2,
        centerPrice + zoomedRange / 2
      ])
      .range([dimensions.height - CHART_DIMENSIONS.MARGIN_TOP - CHART_DIMENSIONS.MARGIN_BOTTOM, 0]);
  }, [data, liquidityData, zoomLevel, panY, dimensions]);

  useEffect(() => {
    if (!data || !liquidityData || !yScale) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("g").remove(); // Only remove D3-created elements, not React elements

    const isMobile = window.innerWidth <= BREAKPOINTS.MOBILE;
    const margin = { 
      top: isMobile ? 20 : CHART_DIMENSIONS.MARGIN_TOP, 
      right: isMobile ? 120 : 180, // Keep original right margin for minimap positioning
      bottom: isMobile ? 50 : CHART_DIMENSIONS.MARGIN_BOTTOM, 
      left: isMobile ? 60 : 80 // Keep original left margin
    };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Convert timestamps to dates for price data
    const priceData = data.map(d => ({
      date: new Date(d.time * 1000),
      value: d.value
    }));

    // Unified price scale encompassing both price data and liquidity data
    const allPrices = [
      ...calculateAllPrices(priceData),
      ...liquidityData.map(d => d.price0)
    ];
    const priceExtent = d3.extent(allPrices);

    // Scales for price line chart
    const dateExtent = d3.extent(priceData, d => d.date);
    const xScale = d3.scaleTime()
      .domain(dateExtent[0] && dateExtent[1] ? dateExtent : [new Date(), new Date()])
      .range([-margin.left, width - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET]);

    // Line generator for price
    const line = d3.line<{ date: Date; value: number }>()
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
        const color = getColorForPrice(currentPoint.value, minPrice, maxPrice);
        
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
        .attr("stroke", CHART_COLORS.PRIMARY_BLUE)
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
    const currentPriceRange = priceExtent?.[1] ? priceExtent?.[1] - priceExtent?.[0] : 0;
    const currentZoomedRange = currentPriceRange / zoomLevel;
    const currentCenterPrice = priceExtent?.[0] ? priceExtent?.[0] + currentPriceRange * 0.5 + panY * currentPriceRange : 0;
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
      .domain([0, maxVisibleLiquidity || 0])
      .range([0, liquidityWidth]); // Back to liquidity section width

    // Draw very thin grey horizontal liquidity bars using data join for better performance
    const bars = g.selectAll<SVGRectElement, LiquidityDataPoint>(".liquidity-bar")
      .data(liquidityData, d => d.price0); // Use price as key for consistent updates
    
    // Remove bars that are no longer needed
    bars.exit()
      .transition()
      .duration(ANIMATION.TOOLTIP_FADE_DURATION)
      .style("opacity", 0)
      .remove();
    
    // Add new bars
    const enterBars = bars.enter()
      .append("rect")
      .attr("class", "liquidity-bar")
      .attr("height", 1)
      .attr("opacity", 0.7)
      .attr("x", d => width + CHART_DIMENSIONS.LIQUIDITY_BARS_SPACING + liquidityWidth - liquidityXScale(d.activeLiquidity) - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr("y", d => liquidityYScale(d.price0) - 0.5)
      .attr("width", d => liquidityXScale(d.activeLiquidity));
    
    // Update existing bars with smooth transitions and conditional coloring
    bars.merge(enterBars)
      .transition()
      .duration(100)
      .attr("x", d => width + CHART_DIMENSIONS.LIQUIDITY_BARS_SPACING + liquidityWidth - liquidityXScale(d.activeLiquidity) - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr("y", d => liquidityYScale(d.price0) - 0.5)
      .attr("width", d => liquidityXScale(d.activeLiquidity))
      .attr("fill", d => getColorForPrice(d.price0, minPrice, maxPrice))
      .attr("cursor", "pointer");
    
    // Add invisible overlay for better hover detection across the entire liquidity area
    const liquidityOverlay = g.append("rect")
      .attr("class", "liquidity-overlay")
      .attr("x", width + CHART_DIMENSIONS.LIQUIDITY_BARS_SPACING)
      .attr("y", 0)
      .attr("width", liquidityWidth + CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr("height", height)
      .attr("fill", "transparent")
      .attr("cursor", "pointer");
    
    // Add event listeners to the overlay for continuous hover detection
    liquidityOverlay
      .on("mouseenter", function(event) {
        // Find closest liquidity data point
        const mouseY = d3.pointer(event, this)[1];
        const hoveredPrice = liquidityYScale.invert(mouseY);
        
        // Find the closest data point
        let closestData = liquidityData[0];
        let minDistance = Math.abs(closestData.price0 - hoveredPrice);
        
        liquidityData.forEach(d => {
          const distance = Math.abs(d.price0 - hoveredPrice);
          if (distance < minDistance) {
            minDistance = distance;
            closestData = d;
          }
        });
        
        // Use actual mouse position for tooltip, not data point position
        const tooltipMouseY = d3.pointer(event, this)[1] + margin.top; // Actual hover Y position
        const liquidityBarsEndX = width + CHART_DIMENSIONS.LIQUIDITY_BARS_SPACING + liquidityWidth - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET;
        
        // Fixed position: 30px from right edge of chart
        const fixedTooltipX = dimensions.width - CHART_DIMENSIONS.TOOLTIP_RIGHT_MARGIN;
        
        setTooltip({
          visible: true,
          x: fixedTooltipX,
          y: tooltipMouseY, // Use mouse position, not data position
          data: closestData,
          lineEndX: liquidityBarsEndX
        });
      })
      .on("mousemove", function(event) {
        // Update tooltip position as mouse moves
        const mouseY = d3.pointer(event, this)[1];
        const hoveredPrice = liquidityYScale.invert(mouseY);
        
        // Find the closest data point
        let closestData = liquidityData[0];
        let minDistance = Math.abs(closestData.price0 - hoveredPrice);
        
        liquidityData.forEach(d => {
          const distance = Math.abs(d.price0 - hoveredPrice);
          if (distance < minDistance) {
            minDistance = distance;
            closestData = d;
          }
        });
        
        // Use actual mouse position for tooltip, not data point position
        const tooltipMouseY = d3.pointer(event, this)[1] + margin.top; // Actual hover Y position
        const liquidityBarsEndX = width + CHART_DIMENSIONS.LIQUIDITY_BARS_SPACING + liquidityWidth - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET;
        
        // Fixed position: 30px from right edge of chart
        const fixedTooltipX = dimensions.width - CHART_DIMENSIONS.TOOLTIP_RIGHT_MARGIN;
        
        setTooltip({
          visible: true,
          x: fixedTooltipX,
          y: tooltipMouseY, // Use mouse position, not data position
          data: closestData,
          lineEndX: liquidityBarsEndX
        });
      })
      .on("mouseleave", function() {
        // Hide tooltip
        setTooltip(prev => ({ ...prev, visible: false }));
      });

    // No price labels needed

    // Draw price range visualization directly in the main chart
    if (minPrice !== null && maxPrice !== null) {
      // Remove existing range elements
      g.selectAll(".price-range-element").remove();
      
      
      // Draw visual pink background that extends over liquidity area (no interactions)
      g.append('rect')
        .attr('class', 'price-range-element price-range-visual-bg')
        .attr('x', -margin.left) // Extend left to cover the margin area
        .attr('y', yScale(maxPrice))
        .attr('width', dimensions.width) // Cover the entire SVG width
        .attr('height', yScale(minPrice) - yScale(maxPrice))
        .attr('fill', CHART_COLORS.RANGE_OVERLAY_PINK)
        .attr('fill-opacity', 0.15)
        .attr('stroke', 'none')
        .style('pointer-events', 'none'); // No interactions on this visual layer
      
      // Draw interactive pink background only over main chart area (for dragging)
      g.append('rect')
        .attr('class', 'price-range-element price-range-bg')
        .attr('x', -margin.left) // Extend left to cover the margin area
        .attr('y', yScale(maxPrice))
        .attr('width', width + margin.left + 10) // Stop before liquidity area
        .attr('height', yScale(minPrice) - yScale(maxPrice))
        .attr('fill', 'transparent') // Invisible, just for interactions
        .attr('stroke', 'none')
        .attr('cursor', 'move')
        .call(d3.drag<SVGRectElement, unknown>()
          .on('start', function(event) {
            // Store the initial click offset relative to the range center
            const currentRangeCenterY = (yScale(maxPrice) + yScale(minPrice)) / 2;
            (this as any)._dragOffsetY = event.y - currentRangeCenterY;
          })
          .on('drag', function(event) {
            // Apply the stored offset to maintain consistent drag feel
            const adjustedY = event.y - (this as any)._dragOffsetY;
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
                  const price = (d as LiquidityDataPoint).price0;
                  if (price >= newMinPrice && price <= newMaxPrice) {
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
                    return getColorForPrice(value, newMinPrice, newMaxPrice);
                  }
                  return CHART_COLORS.OUT_RANGE_GREY;
                });
                
              // Update current price dot color
              if (current !== null) {
                const isCurrentInRange = current >= newMinPrice && current <= newMaxPrice;
                const currentDotColor = getColorForPrice(current, newMinPrice, newMaxPrice);
                g.select('.current-price-dot').attr('fill', currentDotColor);
              }
                
              // Update visual background position
              g.select('.price-range-visual-bg')
                .attr('y', yScale(newMaxPrice))
                .attr('height', yScale(newMinPrice) - yScale(newMaxPrice));
            }
          })
          .on('end', function(event) {
            // Apply the same offset calculation for consistency
            const adjustedY = event.y - (this as any)._dragOffsetY;
            const newCenterY = Math.max(margin.top, Math.min(dimensions.height - margin.bottom, adjustedY));
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
          })
        );

      // Draw min price line (solid) with drag behavior
      g.append('line')
        .attr('class', 'price-range-element min-line')
        .attr('x1', -margin.left) // Start from left margin
        .attr('x2', dimensions.width - margin.left) // Extend to right edge
        .attr('y1', yScale(minPrice))
        .attr('y2', yScale(minPrice))
        .attr('stroke', CHART_COLORS.BOUNDARY_LINE)
        .attr('stroke-width', 2)
        .attr('opacity', 0.08)
        .attr('cursor', 'ns-resize')
        .call(d3.drag<SVGLineElement, unknown>  ()
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
                .attr('stroke', CHART_COLORS.BOUNDARY_LINE); // Same color for both
              d3.select(this)
                .attr('stroke', CHART_COLORS.BOUNDARY_LINE); // Same color for both
            } else {
              // Lines in normal order - restore original colors
              g.select('.max-line')
                .attr('stroke', CHART_COLORS.BOUNDARY_LINE); // Same color for both
              d3.select(this)
                .attr('stroke', CHART_COLORS.BOUNDARY_LINE); // Same color for both
            }
            
            // Update background
            g.select('.price-range-bg')
              .attr('y', yScale(draggedMaxPrice))
              .attr('height', yScale(draggedMinPrice) - yScale(draggedMaxPrice));
            
            // Update visual background
            g.select('.price-range-visual-bg')
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
                const price = (d as LiquidityDataPoint).price0;
                if (price >= draggedMinPrice && price <= draggedMaxPrice) {
                  return CHART_COLORS.IN_RANGE_PINK;
                }
                return "#888888";
              });
            
            // Update price line segment colors
            g.selectAll('.price-segment')
              .attr('stroke', function() {
                const datum = d3.select(this).datum() as Array<{date: Date, value: number}>;
                if (datum && datum.length > 0) {
                  const value = datum[0].value;
                  return getColorForPrice(value, draggedMinPrice, draggedMaxPrice);
                }
                return "#888888";
              });
              
            // Update current price dot color
            if (current !== null) {
              const isCurrentInRange = current >= draggedMinPrice && current <= draggedMaxPrice;
              const currentDotColor = isCurrentInRange ? "#d63384" : "#888888";
              g.select('.current-price-dot').attr('fill', currentDotColor);
            }
              
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
          })
        );

      // Draw max price line (solid) with drag behavior
      g.append('line')
        .attr('class', 'price-range-element max-line')
        .attr('x1', -margin.left) // Start from left margin
        .attr('x2', dimensions.width - margin.left) // Extend to right edge
        .attr('y1', yScale(maxPrice))
        .attr('y2', yScale(maxPrice))
        .attr('stroke', CHART_COLORS.BOUNDARY_LINE)
        .attr('stroke-width', 2)
        .attr('opacity', 0.08)
        .attr('cursor', 'ns-resize')
        .call(d3.drag<SVGLineElement, unknown>  ()
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
                .attr('stroke', CHART_COLORS.BOUNDARY_LINE); // Same color for both
              d3.select(this)
                .attr('stroke', CHART_COLORS.BOUNDARY_LINE); // Same color for both
            } else {
              // Lines in normal order - restore original colors
              g.select('.min-line')
                .attr('stroke', CHART_COLORS.BOUNDARY_LINE); // Same color for both
              d3.select(this)
                .attr('stroke', CHART_COLORS.BOUNDARY_LINE); // Same color for both
            }
            
            // Update background
            g.select('.price-range-bg')
              .attr('y', yScale(draggedMaxPrice))
              .attr('height', yScale(draggedMinPrice) - yScale(draggedMaxPrice));
            
            // Update visual background
            g.select('.price-range-visual-bg')
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
                const price = (d as LiquidityDataPoint).price0;
                if (price >= draggedMinPrice && price <= draggedMaxPrice) {
                  return CHART_COLORS.IN_RANGE_PINK;
                }
                return "#888888";
              });
            
            // Update price line segment colors
            g.selectAll('.price-segment')
              .attr('stroke', function() {
                const datum = d3.select(this).datum() as Array<{date: Date, value: number}>;
                if (datum && datum.length > 0) {
                  const value = datum[0].value;
                  return getColorForPrice(value, draggedMinPrice, draggedMaxPrice);
                }
                return "#888888";
              });
              
            // Update current price dot color
            if (current !== null) {
              const isCurrentInRange = current >= draggedMinPrice && current <= draggedMaxPrice;
              const currentDotColor = isCurrentInRange ? "#d63384" : "#888888";
              g.select('.current-price-dot').attr('fill', currentDotColor);
            }
              
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
          })
        );
        
      // Add min price label
      g.append('text')
        .attr('class', 'price-range-element min-label')
        .attr('x', -margin.left + 12) // 12px from left border
        .attr('y', yScale(minPrice) - 5)
        .attr('font-size', '10px')
        .attr('fill', CHART_COLORS.BOUNDARY_LINE)
        .attr('font-weight', 'bold')
        .text(`Min: ${minPrice?.toFixed(0)}`);
        
      // Add max price label
      g.append('text')
        .attr('class', 'price-range-element max-label')
        .attr('x', -margin.left + 12) // 12px from left border
        .attr('y', yScale(maxPrice) + 15)
        .attr('font-size', '10px')
        .attr('fill', CHART_COLORS.BOUNDARY_LINE)
        .attr('font-weight', 'bold')
        .text(`Max: ${maxPrice.toFixed(0)}`);
    }

    // Draw current price line (dotted) if current price exists
    if (current !== null) {
      // Remove existing current price line
      g.selectAll('.current-price-line').remove();
      g.selectAll('.current-price-label').remove();
      g.selectAll('.current-price-dot').remove();
      
      // Draw dotted line across the entire chart for current price
      g.append('line')
        .attr('class', 'current-price-line')
        .attr('x1', -margin.left) // Start from left margin
        .attr('x2', dimensions.width - margin.left) // Extend to right edge
        .attr('y1', yScale(current))
        .attr('y2', yScale(current))
        .attr('stroke', CHART_COLORS.CURRENT_PRICE_GREY)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5') // Dotted line pattern
        .attr('opacity', 0.8);
        
      // Add current price label on the left like min/max
      g.append('text')
        .attr('class', 'current-price-label')
        .attr('x', -margin.left + 12) // 12px from left border
        .attr('y', yScale(current) - 5)
        .attr('font-size', '10px')
        .attr('fill', CHART_COLORS.CURRENT_PRICE_GREY)
        .attr('font-weight', 'bold')
        .text(`Current: ${current.toFixed(0)}`);
        
      // Draw a circle at the last data point (current price)
      const lastDataPoint = priceData[priceData.length - 1];
      if (lastDataPoint) {
        // Determine color based on whether current price is in range
        let dotColor;
        if (minPrice !== null && maxPrice !== null) {
          // Check if current price is within the selected range
          const isInRange = current >= minPrice && current <= maxPrice;
          dotColor = getColorForPrice(current, minPrice, maxPrice);
        } else {
          dotColor = CHART_COLORS.PRIMARY_BLUE;
        }
        
        // Check if dot already exists and update it, otherwise create new one
        let currentDot: d3.Selection<any, unknown, null, undefined> = g.select('.current-price-dot');
        if (currentDot.empty()) {
          currentDot = g.append('circle')
            .attr('class', 'current-price-dot')
            .attr('cx', xScale(lastDataPoint.date))
            .attr('cy', yScale(lastDataPoint.value))
            .attr('r', 4)
            .attr('opacity', 1);
        }
        
        // Update the dot color
        currentDot.attr('fill', dotColor);
      }
    }

    // Create minimap controls on the right side
    const minimapWidth = CHART_DIMENSIONS.MINIMAP_WIDTH;
    const minimapX = width + 160; // Position near the right border
    
    // Get full data range for minimap scale
    const minimapPrices = [...calculateAllPrices(data), ...liquidityData.map(d => d.price0)];
    const dataMin = Math.min(...minimapPrices);
    const dataMax = Math.max(...minimapPrices);
    
    // Create scale for full data range (for minimap) - full container height
    const minimapYScale = d3.scaleLinear()
      .domain([dataMin, dataMax])
      .range([dimensions.height - margin.bottom, margin.top]);
    
    // Remove liquidity bars from minimap - not needed
    
    // Draw minimap background track (full container height)
    g.append('rect')
      .attr('class', 'minimap-track')
      .attr('x', minimapX)
      .attr('y', -margin.top)
      .attr('width', 8)
      .attr('height', dimensions.height) // Full container height
      .attr('fill', CHART_COLORS.TOOLTIP_BACKGROUND)
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
      .attr('fill', CHART_COLORS.HANDLE_FILL)
      .attr('fill-opacity', 0.2)
      .attr('stroke', CHART_COLORS.HANDLE_STROKE)
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.4)
      .attr('rx', 2);
    
    // Draw current range indicator (pink bar) with drag functionality
    const currentRangeHeight = minimapYScale(minPrice || 0) - minimapYScale(maxPrice || 0);
    const minimapRange = g.append('rect')
      .attr('class', 'minimap-range')
      .attr('x', minimapX)
      .attr('y', minimapYScale(maxPrice || 0))
      .attr('width', 8)
      .attr('height', currentRangeHeight)
      .attr('fill', CHART_COLORS.RANGE_OVERLAY_PINK)
      .attr('rx', 4)
      .attr('cursor', 'move');
    
    // Add drag behavior to the minimap range bar
    minimapRange.call(d3.drag<SVGRectElement, unknown>()
      .on('drag', function(event) {
        const newCenterY = Math.max(margin.top, Math.min(dimensions.height - margin.bottom, event.y));
        const newCenterPrice = minimapYScale.invert(newCenterY);
        const rangeSize = maxPrice && minPrice ? maxPrice - minPrice : 0;
        
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
    );
    
    // Draw drag handles
    const handleRadius = 8;
    
    // Top handle (max price)
    const topHandle = g.append('circle')
      .attr('class', 'minimap-handle max-handle')
      .attr('cx', minimapX + 4)
      .attr('cy', minimapYScale(maxPrice || 0))
      .attr('r', handleRadius)
      .attr('fill', CHART_COLORS.HANDLE_FILL)
      .attr('stroke', CHART_COLORS.RANGE_OVERLAY_PINK)
      .attr('stroke-width', 3)
      .attr('cursor', 'ns-resize');
    
    // Bottom handle (min price) 
    const bottomHandle = g.append('circle')
      .attr('class', 'minimap-handle min-handle')
      .attr('cx', minimapX + 4)
      .attr('cy', minimapYScale(minPrice || 0))
      .attr('r', handleRadius)
      .attr('fill', CHART_COLORS.HANDLE_FILL)
      .attr('stroke', CHART_COLORS.RANGE_OVERLAY_PINK)
      .attr('stroke-width', 3)
      .attr('cursor', 'ns-resize');
    
    // Center handle (for dragging entire range)
    const centerY = (minimapYScale(maxPrice || 0) + minimapYScale(minPrice || 0)) / 2;
    const centerHandle = g.append('circle')
      .attr('class', 'minimap-handle center-handle')
      .attr('cx', minimapX + 4)
      .attr('cy', centerY)
      .attr('r', 6)
      .attr('fill', CHART_COLORS.RANGE_OVERLAY_PINK)
      .attr('cursor', 'move');
    
    // Add drag behavior to top handle (max price)
    topHandle.call(d3.drag<SVGCircleElement, unknown>()
      .on('drag', function(event) {
        const newY = Math.max(margin.top, Math.min(dimensions.height - margin.bottom, event.y));
        const newMaxPrice = minimapYScale.invert(newY);
        
        // Ensure max stays above min
        const constrainedMaxPrice = Math.max(newMaxPrice, minPrice || 0);
        
        // Update visual position
        d3.select(this).attr('cy', minimapYScale(constrainedMaxPrice));
        
        // Update range bar
        g.select('.minimap-range')
          .attr('y', minimapYScale(constrainedMaxPrice))
          .attr('height', minimapYScale(minPrice || 0) - minimapYScale(constrainedMaxPrice));
        
        // Update center handle position
        const newCenterY = (minimapYScale(constrainedMaxPrice) + minimapYScale(minPrice || 0)) / 2;
        centerHandle.attr('cy', newCenterY);
        
        // Update main chart price range elements
        g.select('.price-range-bg')
          .attr('y', yScale(constrainedMaxPrice))
          .attr('height', yScale(minPrice || 0) - yScale(constrainedMaxPrice));
        
        // Update visual background
        g.select('.price-range-visual-bg')
          .attr('y', yScale(constrainedMaxPrice))
          .attr('height', yScale(minPrice || 0) - yScale(constrainedMaxPrice));
          
        g.select('.max-line')
          .attr('y1', yScale(constrainedMaxPrice))
          .attr('y2', yScale(constrainedMaxPrice));
          
        g.select('.max-label')
          .attr('y', yScale(constrainedMaxPrice) + 15)
          .text(`Max: ${constrainedMaxPrice.toFixed(0)}`);
      })
      .on('end', function(event) {
        const newY = Math.max(margin.top, Math.min(dimensions.height - margin.bottom, event.y));
        let newMaxPrice = minimapYScale.invert(newY);
        
        // If dragged to top, set to data maximum
        if (newY <= margin.top + 10) {
          newMaxPrice = dataMax;
        }
        
        // Ensure max stays above min
        const constrainedMaxPrice = Math.max(newMaxPrice, minPrice || 0);
        setMaxPrice(constrainedMaxPrice);
      })
    );
    
    // Add drag behavior to bottom handle (min price)
    bottomHandle.call(d3.drag<SVGCircleElement, unknown>()
      .on('drag', function(event) {
        const newY = Math.max(margin.top, Math.min(dimensions.height - margin.bottom, event.y));
        const newMinPrice = minimapYScale.invert(newY);
        
        // Ensure min stays below max
        const constrainedMinPrice = Math.min(newMinPrice, maxPrice || 0);
        
        // Update visual position
        d3.select(this).attr('cy', minimapYScale(constrainedMinPrice));
        
        // Update range bar
        g.select('.minimap-range')
          .attr('y', minimapYScale(maxPrice || 0))
          .attr('height', minimapYScale(constrainedMinPrice) - minimapYScale(maxPrice || 0));
        
        // Update center handle position
        const newCenterY = (minimapYScale(maxPrice || 0) + minimapYScale(constrainedMinPrice)) / 2;
        centerHandle.attr('cy', newCenterY);
        
        // Update main chart price range elements
        g.select('.price-range-bg')
          .attr('y', yScale(maxPrice || 0))
          .attr('height', yScale(constrainedMinPrice) - yScale(maxPrice || 0));
        
        // Update visual background
        g.select('.price-range-visual-bg')
          .attr('y', yScale(maxPrice || 0))
          .attr('height', yScale(constrainedMinPrice) - yScale(maxPrice || 0));
          
        g.select('.min-line')
          .attr('y1', yScale(constrainedMinPrice))
          .attr('y2', yScale(constrainedMinPrice));
          
        g.select('.min-label')
          .attr('y', yScale(constrainedMinPrice) - 5)
          .text(`Min: ${constrainedMinPrice.toFixed(0)}`);
      })
      .on('end', function(event) {
        const newY = Math.max(margin.top, Math.min(dimensions.height - margin.bottom, event.y));
        let newMinPrice = minimapYScale.invert(newY);
        
        // If dragged to bottom, set to data minimum
        if (newY >= dimensions.height - margin.bottom - 10) {
          newMinPrice = dataMin;
        }
        
        // Ensure min stays below max
        const constrainedMinPrice = Math.min(newMinPrice, maxPrice || 0);
        setMinPrice(constrainedMinPrice);
      })
    );
    
    // Add drag behavior to center handle (drag entire range)
    centerHandle.call(d3.drag<SVGCircleElement, unknown>()
      .on('drag', function(event) {
        const newCenterY = Math.max(margin.top, Math.min(dimensions.height - margin.bottom, event.y));
        const newCenterPrice = minimapYScale.invert(newCenterY);
        const rangeSize = maxPrice && minPrice ? maxPrice - minPrice : 0;
        
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
        
        // Update visual background
        g.select('.price-range-visual-bg')
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
        const newCenterY = Math.max(margin.top, Math.min(dimensions.height - margin.bottom, event.y));
        const newCenterPrice = minimapYScale.invert(newCenterY);
        const rangeSize = maxPrice && minPrice ? maxPrice - minPrice : 0;
        
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
      })
    );



  }, [data, liquidityData, zoomLevel, panY, yScale, current, currentTick, minPrice, maxPrice, dimensions]);

  return (
    <div ref={containerRef} style={{ 
      width: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      margin: '0 auto'
    }}>
      {/* Controls Panel - Outside Chart */}
      <div style={{ 
        marginBottom: '10px',
        background: CHART_COLORS.BACKGROUND_GREY,
        padding: dimensions.width <= 768 ? '8px' : '12px',
        borderRadius: '4px',
        border: `1px solid ${CHART_COLORS.BORDER_GREY}`,
        display: 'flex',
        gap: dimensions.width <= 768 ? '8px' : '20px',
        alignItems: 'flex-start',
        justifyContent: 'center',
        flexWrap: 'wrap',
        fontSize: dimensions.width <= 768 ? '10px' : '12px',
        width: 'fit-content',
        maxWidth: '100%',
        margin: '0 auto 10px auto'
      }}>
        {/* Zoom Controls */}
        <div>
          <div style={{ marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
            Zoom: {zoomLevel.toFixed(1)}x
          </div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <button onClick={handleZoomIn} style={{ 
              fontSize: dimensions.width <= 768 ? '10px' : '12px', 
              padding: dimensions.width <= 768 ? '6px 10px' : '4px 8px',
              minHeight: dimensions.width <= 768 ? '32px' : 'auto'
            }}>
              Zoom In (+)
            </button>
            <button onClick={handleZoomOut} style={{ 
              fontSize: dimensions.width <= 768 ? '10px' : '12px', 
              padding: dimensions.width <= 768 ? '6px 10px' : '4px 8px',
              minHeight: dimensions.width <= 768 ? '32px' : 'auto'
            }}>
              Zoom Out (-)
            </button>
            <button onClick={handleResetZoom} style={{ 
              fontSize: dimensions.width <= 768 ? '10px' : '12px', 
              padding: dimensions.width <= 768 ? '6px 10px' : '4px 8px',
              minHeight: dimensions.width <= 768 ? '32px' : 'auto'
            }}>
              Reset
            </button>
            <button 
              onClick={() => handleCenterRange(data, liquidityData)} 
              disabled={minPrice === null || maxPrice === null}
              style={{ 
                fontSize: dimensions.width <= 768 ? '10px' : '12px', 
                padding: dimensions.width <= 768 ? '6px 10px' : '4px 8px',
                minHeight: dimensions.width <= 768 ? '32px' : 'auto',
                opacity: minPrice === null || maxPrice === null ? 0.5 : 1,
                cursor: minPrice === null || maxPrice === null ? 'not-allowed' : 'pointer'
              }}
            >
              {dimensions.width <= 768 ? 'Center' : 'Center Range'}
            </button>
          </div>
          <div style={{ fontSize: TYPOGRAPHY.LABEL_FONT_SIZE + 'px', color: CHART_COLORS.TEXT_GREY, textAlign: 'center' }}>
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
                  fontSize: dimensions.width <= 768 ? '10px' : '11px', 
                  padding: dimensions.width <= 768 ? '6px 8px' : '4px 6px', 
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  width: dimensions.width <= 768 ? '70px' : '90px',
                  minHeight: dimensions.width <= 768 ? '32px' : 'auto'
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
                  fontSize: dimensions.width <= 768 ? '10px' : '11px', 
                  padding: dimensions.width <= 768 ? '6px 8px' : '4px 6px', 
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  width: dimensions.width <= 768 ? '70px' : '90px',
                  minHeight: dimensions.width <= 768 ? '32px' : 'auto'
                }}
                step="0.01"
              />
            </div>
            <button 
              onClick={() => { setMinPrice(null); setMaxPrice(null); }}
              style={{ 
                fontSize: dimensions.width <= 768 ? '10px' : '11px', 
                padding: dimensions.width <= 768 ? '6px 10px' : '4px 8px', 
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                minHeight: dimensions.width <= 768 ? '32px' : 'auto'
              }}
            >
              Clear Range
            </button>
          </div>
        </div>
      </div>

      <div style={{ 
        position: 'relative',
        width: 'fit-content',
        maxWidth: '100%',
        overflow: 'hidden',
        margin: '0 auto'
      }}>
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{ 
            border: '1px solid #ccc',
            display: 'block',
            maxWidth: '100%',
            touchAction: 'manipulation' // Optimizes for touch interactions
          }}
        >
        </svg>
        
        {/* Liquidity Tooltip */}
        {tooltip.visible && tooltip.data && (
          <>            
            {/* Tooltip */}
            <div
              style={{
                position: 'absolute',
                right: 130, // Move another 100px to the left (30 + 100 = 130)
                top: tooltip.y - 18,
                background: 'rgba(255, 255, 255, 0.95)',
                border: `1px solid ${CHART_COLORS.BORDER_GREY}`,
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                pointerEvents: 'none',
                zIndex: 1000,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                minWidth: '120px',
                textAlign: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  borderRadius: '50%', 
                  background: `linear-gradient(135deg, ${CHART_COLORS.GRADIENT_START} 0%, ${CHART_COLORS.GRADIENT_END} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                  Ξ
                </div>
                <span>ETH</span>
                <span style={{ color: CHART_COLORS.TEXT_GREY }}>
                  ${(tooltip.data.amount0Locked || 0).toFixed(1)}K
                </span>
                <span style={{ color: CHART_COLORS.TEXT_GREY }}>100%</span>
              </div>
            </div>
            
            {/* Connecting line from tooltip's right edge to liquidity bars */}
            <div
              style={{
                position: 'absolute',
                right: 30,
                top: tooltip.y - 1,
                width: `${tooltip.lineEndX - (dimensions.width - 210)}px`, // From tooltip to liquidity bars (adjusted for 20px shift)
                height: '2px',
                background: '#666',
                pointerEvents: 'none',
                zIndex: 999
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default D3Chart;