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
      .range([dimensions.height, 0]);
  }, [data, liquidityData, zoomLevel, panY, dimensions]);

  useEffect(() => {
    if (!data || !liquidityData || !yScale) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("g").remove(); // Only remove D3-created elements, not React elements

    const isMobile = window.innerWidth <= BREAKPOINTS.MOBILE;
    const margin = { 
      top: 0, 
      right: isMobile ? 120 : 180,
      bottom: 0, 
      left: isMobile ? 60 : 80
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
      .attr("x", d => width + margin.right - liquidityXScale(d.activeLiquidity) - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr("y", d => liquidityYScale(d.price0) - 0.5)
      .attr("width", d => liquidityXScale(d.activeLiquidity));
    
    // Update existing bars with smooth transitions and conditional coloring
    bars.merge(enterBars)
      .transition()
      .duration(100)
      .attr("x", d => width + margin.right - liquidityXScale(d.activeLiquidity) - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
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

    // Draw vertical line in the 16px space on the right side
    g.append('rect')
      .attr('class', 'right-side-line')
      .attr('x', width + margin.right - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr('y', -margin.top)
      .attr('width', CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr('height', dimensions.height)
      .attr('fill', CHART_COLORS.BORDER_GREY)
      .attr('rx', 4)
      .attr('ry', 4);

    // Draw price range visualization directly in the main chart
    if (minPrice !== null && maxPrice !== null) {
      // Remove existing range elements
      g.selectAll(".price-range-element").remove();
      
      // Draw dynamic range indicator line inside the border grey line
      g.append('rect')
        .attr('class', 'price-range-element range-indicator-line')
        .attr('x', width + margin.right - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
        .attr('y', yScale(maxPrice))
        .attr('width', CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
        .attr('height', yScale(minPrice) - yScale(maxPrice))
        .attr('fill', CHART_COLORS.RANGE_OVERLAY_PINK)
        .attr('rx', 8)
        .attr('ry', 8);
      
      // Add max price drag indicator (top circle) - positioned inside the range indicator
      g.append('circle')
        .attr('class', 'price-range-element max-drag-indicator')
        .attr('cx', width + margin.right - (CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET / 2))
        .attr('cy', yScale(maxPrice) + 8)
        .attr('r', 6)
        .attr('fill', 'white')
        .attr('stroke', 'rgba(0,0,0,0.1)')
        .attr('stroke-width', 1)
        .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
        .attr('cursor', 'ns-resize')
        .call(d3.drag<SVGCircleElement, unknown>()
          .on('drag', function(event) {
            const newY = Math.max(-margin.top, Math.min(height + margin.bottom, event.y));
            const newMaxPrice = yScale.invert(newY);
            
            // Ensure max stays above min
            const constrainedMaxPrice = Math.max(newMaxPrice, minPrice || 0);
            
            // Update visual position
            d3.select(this).attr('cy', yScale(constrainedMaxPrice) + 8);
            
            // Update all related elements with the same logic as existing max line drag
            const draggedMinPrice = minPrice;
            const draggedMaxPrice = constrainedMaxPrice;
            
            // Update range bar
            g.select('.price-range-bg')
              .attr('y', yScale(draggedMaxPrice))
              .attr('height', yScale(draggedMinPrice || 0) - yScale(draggedMaxPrice));
            
            // Update visual background
            g.select('.price-range-visual-bg')
              .attr('y', yScale(draggedMaxPrice))
              .attr('height', yScale(draggedMinPrice || 0) - yScale(draggedMaxPrice));
            
            // Update range indicator line
            g.select('.range-indicator-line')
              .attr('y', yScale(draggedMaxPrice))
              .attr('height', yScale(draggedMinPrice || 0) - yScale(draggedMaxPrice));
              
            g.select('.max-line')
              .attr('y1', yScale(draggedMaxPrice))
              .attr('y2', yScale(draggedMaxPrice));
              
            g.select('.max-label')
              .attr('y', yScale(draggedMaxPrice) + 15)
              .text(`Max: ${draggedMaxPrice.toFixed(0)}`);
              
            // Update liquidity bar colors and price line colors
            g.selectAll('.liquidity-bar')
              .attr('fill', d => {
                const price = (d as any).price0;
                if (price >= (draggedMinPrice || 0) && price <= draggedMaxPrice) {
                  return CHART_COLORS.IN_RANGE_PINK;
                }
                return CHART_COLORS.OUT_RANGE_GREY;
              });
              
            g.selectAll('.price-segment')
              .attr('stroke', function() {
                const datum = d3.select(this).datum() as Array<{date: Date, value: number}>;
                if (datum && datum.length > 0) {
                  const value = datum[0].value;
                  return getColorForPrice(value, draggedMinPrice || 0, draggedMaxPrice);
                }
                return CHART_COLORS.OUT_RANGE_GREY;
              });
              
            if (current !== null) {
              const currentDotColor = getColorForPrice(current, draggedMinPrice || 0, draggedMaxPrice);
              g.select('.current-price-dot').attr('fill', currentDotColor);
            }
          })
          .on('end', function(event) {
            const newY = Math.max(-margin.top, Math.min(height + margin.bottom, event.y));
            const newMaxPrice = yScale.invert(newY);
            const constrainedMaxPrice = Math.max(newMaxPrice, minPrice || 0);
            setMaxPrice(constrainedMaxPrice);
          })
        );
      
      // Add min price drag indicator (bottom circle) - positioned inside the range indicator
      g.append('circle')
        .attr('class', 'price-range-element min-drag-indicator')
        .attr('cx', width + margin.right - (CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET / 2))
        .attr('cy', yScale(minPrice) - 8)
        .attr('r', 6)
        .attr('fill', 'white')
        .attr('stroke', 'rgba(0,0,0,0.1)')
        .attr('stroke-width', 1)
        .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
        .attr('cursor', 'ns-resize')
        .call(d3.drag<SVGCircleElement, unknown>()
          .on('drag', function(event) {
            const newY = Math.max(-margin.top, Math.min(height + margin.bottom, event.y));
            const newMinPrice = yScale.invert(newY);
            
            // Ensure min stays below max
            const constrainedMinPrice = Math.min(newMinPrice, maxPrice || 0);
            
            // Update visual position
            d3.select(this).attr('cy', yScale(constrainedMinPrice) - 8);
            
            // Update all related elements with the same logic as existing min line drag
            const draggedMinPrice = constrainedMinPrice;
            const draggedMaxPrice = maxPrice;
            
            // Update range bar
            g.select('.price-range-bg')
              .attr('y', yScale(draggedMaxPrice || 0))
              .attr('height', yScale(draggedMinPrice) - yScale(draggedMaxPrice || 0));
            
            // Update visual background
            g.select('.price-range-visual-bg')
              .attr('y', yScale(draggedMaxPrice || 0))
              .attr('height', yScale(draggedMinPrice) - yScale(draggedMaxPrice || 0));
            
            // Update range indicator line
            g.select('.range-indicator-line')
              .attr('y', yScale(draggedMaxPrice || 0))
              .attr('height', yScale(draggedMinPrice) - yScale(draggedMaxPrice || 0));
              
            g.select('.min-line')
              .attr('y1', yScale(draggedMinPrice))
              .attr('y2', yScale(draggedMinPrice));
              
            g.select('.min-label')
              .attr('y', yScale(draggedMinPrice) - 5)
              .text(`Min: ${draggedMinPrice.toFixed(0)}`);
              
            // Update liquidity bar colors and price line colors
            g.selectAll('.liquidity-bar')
              .attr('fill', d => {
                const price = (d as any).price0;
                if (price >= draggedMinPrice && price <= (draggedMaxPrice || 0)) {
                  return CHART_COLORS.IN_RANGE_PINK;
                }
                return CHART_COLORS.OUT_RANGE_GREY;
              });
              
            g.selectAll('.price-segment')
              .attr('stroke', function() {
                const datum = d3.select(this).datum() as Array<{date: Date, value: number}>;
                if (datum && datum.length > 0) {
                  const value = datum[0].value;
                  return getColorForPrice(value, draggedMinPrice, draggedMaxPrice || 0);
                }
                return CHART_COLORS.OUT_RANGE_GREY;
              });
              
            if (current !== null) {
              const currentDotColor = getColorForPrice(current, draggedMinPrice, draggedMaxPrice || 0);
              g.select('.current-price-dot').attr('fill', currentDotColor);
            }
            
            // Update the max drag indicator to stay in sync
            g.select('.max-drag-indicator')
              .attr('cy', yScale(draggedMaxPrice || 0) + 8);
          })
          .on('end', function(event) {
            const newY = Math.max(-margin.top, Math.min(height + margin.bottom, event.y));
            const newMinPrice = yScale.invert(newY);
            const constrainedMinPrice = Math.min(newMinPrice, maxPrice || 0);
            setMinPrice(constrainedMinPrice);
          })
        );
      
      // Add center drag indicator for moving entire range
      const centerY = (yScale(maxPrice) + yScale(minPrice)) / 2;
      g.append('rect')
        .attr('class', 'price-range-element center-drag-indicator')
        .attr('x', width + margin.right - (CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET / 2) - 6) // Center the 12px width
        .attr('y', centerY - 3) // Center the 6px height
        .attr('width', 12)
        .attr('height', 6)
        .attr('fill', 'white')
        .attr('stroke', 'rgba(0,0,0,0.1)')
        .attr('stroke-width', 1)
        .attr('rx', 2)
        .attr('ry', 2)
        .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
        .attr('cursor', 'move')
        .call(d3.drag<SVGRectElement, unknown>()
          .on('start', function(event) {
            // Store the initial offset relative to the range center
            const currentRangeCenterY = (yScale(maxPrice) + yScale(minPrice)) / 2;
            (this as any)._dragOffsetY = event.y - currentRangeCenterY;
          })
          .on('drag', function(event) {
            // Apply the stored offset to maintain consistent drag feel
            const adjustedY = event.y - (this as any)._dragOffsetY;
            const newCenterY = Math.max(-margin.top, Math.min(height + margin.bottom, adjustedY));
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
              // Update center indicator position
              d3.select(this).attr('y', newCenterY - 3); // Center the 6px height
              
              // Update range background position
              const newMaxY = yScale(newMaxPrice);
              const newMinY = yScale(newMinPrice);
              
              g.select('.price-range-bg')
                .attr('y', newMaxY)
                .attr('height', newMinY - newMaxY);
              
              // Update visual background
              g.select('.price-range-visual-bg')
                .attr('y', newMaxY)
                .attr('height', newMinY - newMaxY);
              
              // Update range indicator line
              g.select('.range-indicator-line')
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
              
              // Update drag indicators - positioned inside the range indicator
              g.select('.max-drag-indicator')
                .attr('cy', yScale(newMaxPrice) + 8);
              g.select('.min-drag-indicator')
                .attr('cy', yScale(newMinPrice) - 8);
              g.select('.center-drag-indicator')
                .attr('y', (yScale(newMaxPrice) + yScale(newMinPrice)) / 2 - 3);
              g.selectAll('.center-drag-line')
                .attr('y', (yScale(newMaxPrice) + yScale(newMinPrice)) / 2 - 1.5);
            }
          })
          .on('end', function(event) {
            // Apply the same offset calculation for consistency
            const adjustedY = event.y - (this as any)._dragOffsetY;
            const newCenterY = Math.max(-margin.top, Math.min(height + margin.bottom, adjustedY));
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
      
      // Add 3 grey lines inside the center drag indicator
      const centerIndicatorX = width + margin.right - (CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET / 2);
      for (let i = 0; i < 3; i++) {
        g.append('rect')
          .attr('class', 'price-range-element center-drag-line')
          .attr('x', centerIndicatorX - 1.75 + (i * 1.25)) // Space the 3 lines evenly within 12px width
          .attr('y', centerY - 1.5) // Center the 3px height within 6px indicator
          .attr('width', 0.5)
          .attr('height', 3)
          .attr('fill', 'rgba(0,0,0,0.3)')
          .style('pointer-events', 'none'); // Don't interfere with drag events
      }
      
      
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
            document.body.classList.add('dragging-range');
            document.body.style.setProperty('cursor', 'move', 'important');
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
                
              // Update range indicator line
              g.select('.range-indicator-line')
                .attr('y', yScale(newMaxPrice))
                .attr('height', yScale(newMinPrice) - yScale(newMaxPrice));
                
              // Update drag indicators - positioned inside the range indicator
              g.select('.max-drag-indicator')
                .attr('cy', yScale(newMaxPrice) + 8);
              g.select('.min-drag-indicator')
                .attr('cy', yScale(newMinPrice) - 8);
              g.select('.center-drag-indicator')
                .attr('y', (yScale(newMaxPrice) + yScale(newMinPrice)) / 2 - 3);
              g.selectAll('.center-drag-line')
                .attr('y', (yScale(newMaxPrice) + yScale(newMinPrice)) / 2 - 1.5);
            }
          })
          .on('end', function(event) {
            document.body.classList.remove('dragging-range');
            document.body.style.removeProperty('cursor');
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
            
            // Update range indicator line
            g.select('.range-indicator-line')
              .attr('y', yScale(draggedMaxPrice))
              .attr('height', yScale(draggedMinPrice) - yScale(draggedMaxPrice));
            
            // Update drag indicators - positioned inside the range indicator
            g.select('.max-drag-indicator')
              .attr('cy', yScale(draggedMaxPrice) + 8);
            g.select('.min-drag-indicator')
              .attr('cy', yScale(draggedMinPrice) - 8);
            g.select('.center-drag-indicator')
              .attr('y', (yScale(draggedMaxPrice) + yScale(draggedMinPrice)) / 2 - 3);
            g.selectAll('.center-drag-line')
              .attr('y', (yScale(draggedMaxPrice) + yScale(draggedMinPrice)) / 2 - 1.5);
            
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
            
            // Update range indicator line
            g.select('.range-indicator-line')
              .attr('y', yScale(draggedMaxPrice))
              .attr('height', yScale(draggedMinPrice) - yScale(draggedMaxPrice));
            
            // Update drag indicators - positioned inside the range indicator
            g.select('.max-drag-indicator')
              .attr('cy', yScale(draggedMaxPrice) + 8);
            g.select('.min-drag-indicator')
              .attr('cy', yScale(draggedMinPrice) - 8);
            g.select('.center-drag-indicator')
              .attr('y', (yScale(draggedMaxPrice) + yScale(draggedMinPrice)) / 2 - 3);
            g.selectAll('.center-drag-line')
              .attr('y', (yScale(draggedMaxPrice) + yScale(draggedMinPrice)) / 2 - 1.5);
            
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




    // Add areas above and below current range for creating new ranges (drawn last to be on top)
    if (minPrice !== null && maxPrice !== null) {
      // Area above current range (for dragging above max price)
      g.append('rect')
        .attr('class', 'price-range-element above-range-area')
        .attr('x', -margin.left)
        .attr('y', 0)
        .attr('width', width + margin.left + 10)
        .attr('height', yScale(maxPrice))
        .attr('fill', 'transparent')
        .attr('cursor', 'crosshair')
        .style('pointer-events', 'all')
        .call(d3.drag<SVGRectElement, unknown>()
          .on('start', function(event) {
            (this as any)._startY = event.y;
            d3.select(this).attr('cursor', 'move');
            document.body.classList.add('dragging-range');
            document.body.style.setProperty('cursor', 'move', 'important');
          })
          .on('drag', function(event) {
            const startY = (this as any)._startY;
            const currentY = event.y;
            const startPrice = yScale.invert(startY);
            const currentPrice = yScale.invert(currentY);
            
            // Determine new min/max based on drag direction
            const newMinPrice = Math.min(startPrice, currentPrice);
            const newMaxPrice = Math.max(startPrice, currentPrice);
            
            // Get data bounds
            const allPrices = [
              ...data.map(d => d.value),
              ...liquidityData.map(d => d.price0)
            ];
            const dataMin = Math.min(...allPrices);
            const dataMax = Math.max(...allPrices);
            
            // Constrain to data bounds
            const constrainedMinPrice = Math.max(newMinPrice, dataMin);
            const constrainedMaxPrice = Math.min(newMaxPrice, dataMax);
            
            // Only update if we have a valid range
            if (constrainedMaxPrice > constrainedMinPrice) {
              // Update range background position and size
              g.select('.price-range-bg')
                .attr('y', yScale(constrainedMaxPrice))
                .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice));
              
              // Update visual background
              g.select('.price-range-visual-bg')
                .attr('y', yScale(constrainedMaxPrice))
                .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice));
              
              // Update range indicator line
              g.select('.range-indicator-line')
                .attr('y', yScale(constrainedMaxPrice))
                .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice));
              
              // Update drag indicators - positioned inside the range indicator
              g.select('.max-drag-indicator')
                .attr('cy', yScale(constrainedMaxPrice) + 8);
              g.select('.min-drag-indicator')
                .attr('cy', yScale(constrainedMinPrice) - 8);
              g.select('.center-drag-indicator')
                .attr('y', (yScale(constrainedMaxPrice) + yScale(constrainedMinPrice)) / 2 - 3);
              g.selectAll('.center-drag-line')
                .attr('y', (yScale(constrainedMaxPrice) + yScale(constrainedMinPrice)) / 2 - 1.5);
              
              // Update min line
              g.select('.min-line')
                .attr('y1', yScale(constrainedMinPrice))
                .attr('y2', yScale(constrainedMinPrice));
                
              // Update max line
              g.select('.max-line')
                .attr('y1', yScale(constrainedMaxPrice))
                .attr('y2', yScale(constrainedMaxPrice));
                
              // Update labels
              g.select('.min-label')
                .attr('y', yScale(constrainedMinPrice) - 5)
                .text(`Min: ${constrainedMinPrice.toFixed(0)}`);
                
              g.select('.max-label')
                .attr('y', yScale(constrainedMaxPrice) + 15)
                .text(`Max: ${constrainedMaxPrice.toFixed(0)}`);
                
              // Update liquidity bar colors
              g.selectAll('.liquidity-bar')
                .attr('fill', d => {
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
          })
          .on('end', function(event) {
            d3.select(this).attr('cursor', 'crosshair');
            document.body.classList.remove('dragging-range');
            document.body.style.removeProperty('cursor');
            const startY = (this as any)._startY;
            const endY = event.y;
            const startPrice = yScale.invert(startY);
            const endPrice = yScale.invert(endY);
            
            // Determine new min/max based on drag direction
            const newMinPrice = Math.min(startPrice, endPrice);
            const newMaxPrice = Math.max(startPrice, endPrice);
            
            // Get data bounds
            const allPrices = [
              ...data.map(d => d.value),
              ...liquidityData.map(d => d.price0)
            ];
            const dataMin = Math.min(...allPrices);
            const dataMax = Math.max(...allPrices);
            
            // Constrain to data bounds
            const constrainedMinPrice = Math.max(newMinPrice, dataMin);
            const constrainedMaxPrice = Math.min(newMaxPrice, dataMax);
            
            // Only update state if we have a valid range
            if (constrainedMaxPrice > constrainedMinPrice) {
              setMinPrice(constrainedMinPrice);
              setMaxPrice(constrainedMaxPrice);
            }
          })
        );
      
      // Area below current range (for dragging below min price)
      g.append('rect')
        .attr('class', 'price-range-element below-range-area')
        .attr('x', -margin.left)
        .attr('y', yScale(minPrice))
        .attr('width', width + margin.left + 10)
        .attr('height', height - yScale(minPrice))
        .attr('fill', 'transparent')
        .attr('cursor', 'crosshair')
        .style('pointer-events', 'all')
        .call(d3.drag<SVGRectElement, unknown>()
          .on('start', function(event) {
            (this as any)._startY = event.y;
            d3.select(this).attr('cursor', 'move');
            document.body.classList.add('dragging-range');
            document.body.style.setProperty('cursor', 'move', 'important');
          })
          .on('drag', function(event) {
            const startY = (this as any)._startY;
            const currentY = event.y;
            const startPrice = yScale.invert(startY);
            const currentPrice = yScale.invert(currentY);
            
            // Determine new min/max based on drag direction
            const newMinPrice = Math.min(startPrice, currentPrice);
            const newMaxPrice = Math.max(startPrice, currentPrice);
            
            // Get data bounds
            const allPrices = [
              ...data.map(d => d.value),
              ...liquidityData.map(d => d.price0)
            ];
            const dataMin = Math.min(...allPrices);
            const dataMax = Math.max(...allPrices);
            
            // Constrain to data bounds
            const constrainedMinPrice = Math.max(newMinPrice, dataMin);
            const constrainedMaxPrice = Math.min(newMaxPrice, dataMax);
            
            // Only update if we have a valid range
            if (constrainedMaxPrice > constrainedMinPrice) {
              // Update range background position and size
              g.select('.price-range-bg')
                .attr('y', yScale(constrainedMaxPrice))
                .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice));
              
              // Update visual background
              g.select('.price-range-visual-bg')
                .attr('y', yScale(constrainedMaxPrice))
                .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice));
              
              // Update range indicator line
              g.select('.range-indicator-line')
                .attr('y', yScale(constrainedMaxPrice))
                .attr('height', yScale(constrainedMinPrice) - yScale(constrainedMaxPrice));
              
              // Update drag indicators - positioned inside the range indicator
              g.select('.max-drag-indicator')
                .attr('cy', yScale(constrainedMaxPrice) + 8);
              g.select('.min-drag-indicator')
                .attr('cy', yScale(constrainedMinPrice) - 8);
              g.select('.center-drag-indicator')
                .attr('y', (yScale(constrainedMaxPrice) + yScale(constrainedMinPrice)) / 2 - 3);
              g.selectAll('.center-drag-line')
                .attr('y', (yScale(constrainedMaxPrice) + yScale(constrainedMinPrice)) / 2 - 1.5);
              
              // Update min line
              g.select('.min-line')
                .attr('y1', yScale(constrainedMinPrice))
                .attr('y2', yScale(constrainedMinPrice));
                
              // Update max line
              g.select('.max-line')
                .attr('y1', yScale(constrainedMaxPrice))
                .attr('y2', yScale(constrainedMaxPrice));
                
              // Update labels
              g.select('.min-label')
                .attr('y', yScale(constrainedMinPrice) - 5)
                .text(`Min: ${constrainedMinPrice.toFixed(0)}`);
                
              g.select('.max-label')
                .attr('y', yScale(constrainedMaxPrice) + 15)
                .text(`Max: ${constrainedMaxPrice.toFixed(0)}`);
                
              // Update liquidity bar colors
              g.selectAll('.liquidity-bar')
                .attr('fill', d => {
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
          })
          .on('end', function(event) {
            d3.select(this).attr('cursor', 'crosshair');
            document.body.classList.remove('dragging-range');
            document.body.style.removeProperty('cursor');
            const startY = (this as any)._startY;
            const endY = event.y;
            const startPrice = yScale.invert(startY);
            const endPrice = yScale.invert(endY);
            
            // Determine new min/max based on drag direction
            const newMinPrice = Math.min(startPrice, endPrice);
            const newMaxPrice = Math.max(startPrice, endPrice);
            
            // Get data bounds
            const allPrices = [
              ...data.map(d => d.value),
              ...liquidityData.map(d => d.price0)
            ];
            const dataMin = Math.min(...allPrices);
            const dataMax = Math.max(...allPrices);
            
            // Constrain to data bounds
            const constrainedMinPrice = Math.max(newMinPrice, dataMin);
            const constrainedMaxPrice = Math.min(newMaxPrice, dataMax);
            
            // Only update state if we have a valid range
            if (constrainedMaxPrice > constrainedMinPrice) {
              setMinPrice(constrainedMinPrice);
              setMaxPrice(constrainedMaxPrice);
            }
          })
        );
    }

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
                right: 16,
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