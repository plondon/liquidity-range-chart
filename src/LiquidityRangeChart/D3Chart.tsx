import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { findClosestElementBinarySearch, formatPrice } from './utils/dataUtils';
import { useResponsiveDimensions } from './hooks/useResponsiveDimensions';
import { useChartState } from './hooks/useChartState';
import { useInitialView } from './hooks/useInitialView';
import { useChartInteractions } from './hooks/useChartInteractions';
import { PriceDataPoint, LiquidityDataPoint } from './types';
import { CHART_COLORS, CHART_DIMENSIONS, BREAKPOINTS, CHART_BEHAVIOR, ANIMATION, TYPOGRAPHY } from './constants';
import { 
  calculateAllPrices, 
  getColorForPrice, 
  getOpacityForPrice, 
  isPriceExtentValid 
} from './utils';
import { 
  chartUpdateManager, 
  initializeUpdateSlices,
  BACKGROUND_CLASSES,
  TRANSPARENT_PRICE_LINE_CLASSES,
  DRAG_HANDLE_CLASSES,
  LABEL_CLASSES,
  DATA_ELEMENT_CLASSES
} from './utils/updateSlices';
import { SOLID_PRICE_LINE_CLASSES } from './utils/updateSlices/indicatorSlices';
import { createSharedPriceDragBehavior } from './utils/dragBehaviors';

const D3Chart = ({ data, liquidityData, onHoverTick, onMinPrice, onMaxPrice }: { data: PriceDataPoint[], liquidityData: LiquidityDataPoint[], onHoverTick: (tick: LiquidityDataPoint | null) => void, onMinPrice: (price: number) => void, onMaxPrice: (price: number) => void }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Initialize update slices on first render
  React.useLayoutEffect(() => {
    initializeUpdateSlices();
  }, []);
  
  // Use custom hooks
  const dimensions = useResponsiveDimensions();
  const {
    zoomLevel,
    panY,
    minPrice,
    maxPrice,
    defaultState,
    setChartState,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleCenterRange
  } = useChartState();

  useEffect(() => {
    if (minPrice !== null) {
      onMinPrice(minPrice);
    }
  }, [minPrice]);

  useEffect(() => {
    if (maxPrice !== null) {
      onMaxPrice(maxPrice);
    }
  }, [maxPrice]);
  
  // Initialize hooks
  useInitialView(data, liquidityData, setChartState, defaultState);
  // Disabled pan/zoom for native scrolling approach
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


  // Drag tooltips for showing min/max during range creation
  const [dragTooltips, setDragTooltips] = useState<{
    visible: boolean;
    minTooltip: {
      x: number;
      y: number;
      data: LiquidityDataPoint | null;
      lineEndX: number;
    } | null;
    maxTooltip: {
      x: number;
      y: number;
      data: LiquidityDataPoint | null;
      lineEndX: number;
    } | null;
  }>({
    visible: false,
    minTooltip: null,
    maxTooltip: null
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

  // Helper function to find closest liquidity data point
  const findClosestLiquidityData = (price: number): LiquidityDataPoint | null => {
    if (!liquidityData || liquidityData.length === 0) return null;
    
    let closestData = liquidityData[0];
    let minDistance = Math.abs(closestData.price0 - price);
    
    liquidityData.forEach(d => {
      const distance = Math.abs(d.price0 - price);
      if (distance < minDistance) {
        minDistance = distance;
        closestData = d;
      }
    });
    
    return closestData;
  };


  // Calculate full height needed for all liquidity bars (like D3Chart2)
  const barHeight = 3;
  const barSpacing = 1;
  const totalHeight = liquidityData.length * (barHeight + barSpacing);

  // Create tick-based scale for exact positioning of liquidity bars
  const baseTickScale = useMemo(() => {
    return d3.scaleBand()
      .domain(liquidityData.map((d: LiquidityDataPoint) => d.tick.toString()))
      .range([totalHeight * zoomLevel, 0]) // Use zoomed total height, highest price at top, lowest at bottom  
      .paddingInner(0.05); // Small padding between bars
  }, [liquidityData, totalHeight, zoomLevel]);

  // Create a wrapper that applies panY offset but preserves scale methods
  const tickScale = useMemo(() => {
    const scale = (tick: string) => {
      const baseY = baseTickScale(tick);
      return baseY !== undefined ? baseY + panY : 0;
    };
    
    // Add the scale methods
    scale.domain = () => baseTickScale.domain();
    scale.bandwidth = () => baseTickScale.bandwidth();
    scale.range = () => baseTickScale.range();
    
    return scale;
  }, [baseTickScale, panY]);

  // Helper function to convert price to Y position using closest tick
  const priceToY = useCallback((price: number): number => {
    if (!tickScale) return 0;
    
    // Find the closest liquidity data point to this price
    const closest = liquidityData.reduce((prev, curr) => 
      Math.abs(curr.price0 - price) < Math.abs(prev.price0 - price) ? curr : prev
    );
    
    // Get the Y position from the band scale and add half bandwidth for center
    const bandY = tickScale(closest.tick.toString()) || 0;
    return bandY + (tickScale.bandwidth() / 2);
  }, [liquidityData, tickScale]);

  // Helper function to convert Y position back to price
  const yToPrice = useCallback((y: number): number => {
    if (!tickScale) return 0;
    
    // Find the tick at this Y position
    const tickValues = tickScale.domain();
    let closestTick = tickValues[0];
    let minDistance = Math.abs(y - (tickScale(tickValues[0]) || 0));
    
    for (const tick of tickValues) {
      const tickY = tickScale(tick) || 0;
      const centerY = tickY + (tickScale.bandwidth() / 2);
      const distance = Math.abs(y - centerY);
      if (distance < minDistance) {
        minDistance = distance;
        closestTick = tick;
      }
    }
    
    // Find the price for this tick
    const tickData = liquidityData.find(d => d.tick.toString() === closestTick);
    return tickData ? tickData.price0 : 0;
  }, [liquidityData, tickScale]);

  // Filter visible liquidity data based on viewport  
  const visibleLiquidityData = useMemo(() => {
    const viewportTop = 0;
    const viewportBottom = dimensions.height;
    
    return liquidityData.filter(d => {
      const tickY = tickScale(d.tick.toString());
      const barHeight = tickScale.bandwidth();
      
      // Check if bar overlaps with viewport (including some padding for smooth scrolling)
      const barTop = tickY;
      const barBottom = tickY + barHeight;
      
      return barBottom >= viewportTop - 100 && barTop <= viewportBottom + 100;
    });
  }, [liquidityData, tickScale, dimensions.height]);



  // Simplified price line drag using shared logic
  const createPriceLineDrag = (
    lineType: 'min' | 'max',
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    priceToYFunc: (price: number) => number,
    margin: { top: number; right: number; bottom: number; left: number },
    height: number,
    dimensions: { width: number; height: number },
    getOtherPrice: () => number | null
  ) => {
    const getThisPrice = () => lineType === 'min' ? minPrice : maxPrice;
    
    return createSharedPriceDragBehavior<SVGLineElement>({
      lineType,
      g,
      priceToY,
      yToPrice,
      margin,
      height,
      dimensions,
      getThisPrice,
      getOtherPrice,
      setChartState,
      current,
      getColorForPrice,
      getOpacityForPrice
    });
  };

  useEffect(() => {
    if (!data || !liquidityData || !tickScale) return;

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

    // Simplified handle drag using shared logic
    const createHandleDragBehavior = (handleType: 'min' | 'max') => {
      const getThisPrice = () => handleType === 'min' ? minPrice : maxPrice;
      const getOtherPrice = () => handleType === 'min' ? maxPrice : minPrice;
      
      return createSharedPriceDragBehavior<SVGCircleElement>({
        lineType: handleType,
        g,
        priceToY,
        yToPrice,
        margin,
        height,
        dimensions,
        getThisPrice,
        getOtherPrice,
        setChartState,
        current,
        getColorForPrice,
        getOpacityForPrice
      });
    };

    // Shared tick-based drag behavior
    const createTickBasedDragBehavior = (options: { withBodyClasses?: boolean } = {}) => {
      return d3.drag<SVGRectElement, unknown>()
        .on('start', function(event) {
          if (minPrice === null || maxPrice === null) return;
          
          // Store the initial offset relative to the range center
          const currentRangeCenterY = (priceToY(maxPrice) + priceToY(minPrice)) / 2;
          (this as any)._dragOffsetY = event.y - currentRangeCenterY;
          
          // Calculate and store the initial tick range to maintain consistent bar coverage
          const minTick = liquidityData.find(d => Math.abs(d.price0 - minPrice) === Math.min(...liquidityData.map(ld => Math.abs(ld.price0 - minPrice))))?.tick;
          const maxTick = liquidityData.find(d => Math.abs(d.price0 - maxPrice) === Math.min(...liquidityData.map(ld => Math.abs(ld.price0 - maxPrice))))?.tick;
          
          if (minTick !== undefined && maxTick !== undefined) {
            // Store the number of ticks covered by the current range
            const tickIndices = liquidityData.map((d, i) => ({ tick: d.tick, index: i }));
            const minIndex = tickIndices.find(t => t.tick === minTick)?.index || 0;
            const maxIndex = tickIndices.find(t => t.tick === maxTick)?.index || 0;
            (this as any)._tickRangeSize = Math.abs(maxIndex - minIndex);
          }
          
          if (options.withBodyClasses) {
            document.body.classList.add('dragging-range');
            document.body.style.setProperty('cursor', 'move', 'important');
          }
        })
        .on('drag', function(event) {
          if (minPrice === null || maxPrice === null) return;
          
          // Apply the stored offset to maintain consistent drag feel
          const adjustedY = event.y - (this as any)._dragOffsetY;
          const newCenterY = Math.max(-margin.top, Math.min(height + margin.bottom, adjustedY));
          const draggedPrice = yToPrice(newCenterY);
          
          // Find the tick corresponding to the dragged center position
          const centerTick = liquidityData.find(d => Math.abs(d.price0 - draggedPrice) === Math.min(...liquidityData.map(ld => Math.abs(ld.price0 - draggedPrice))));
          
          if (centerTick && (this as any)._tickRangeSize !== undefined) {
            const tickIndices = liquidityData.map((d, i) => ({ tick: d.tick, index: i, price: d.price0 }));
            const centerIndex = tickIndices.find(t => t.tick === centerTick.tick)?.index || 0;
            const halfRange = Math.floor((this as any)._tickRangeSize / 2);
            
            // Calculate new min/max indices based on maintaining the same tick count
            const newMinIndex = Math.max(0, centerIndex - halfRange);
            const newMaxIndex = Math.min(liquidityData.length - 1, centerIndex + halfRange);
            
            // Get the prices for these tick indices
            const newMinPrice = tickIndices[newMinIndex]?.price || minPrice;
            const newMaxPrice = tickIndices[newMaxIndex]?.price || maxPrice;
            
            // Get data bounds to prevent dragging outside chart
            const allPrices = [
              ...data.map(d => d.value),
              ...liquidityData.map(d => d.price0)
            ];
            const dataMin = Math.min(...allPrices);
            const dataMax = Math.max(...allPrices);
            
            // Only update if range stays within data bounds
            if (newMinPrice >= dataMin && newMaxPrice <= dataMax) {
              // Use centralized update system
              chartUpdateManager.updateAll({
                g,
                minPrice: newMinPrice,
                maxPrice: newMaxPrice,
                priceToY,
                width,
                margin,
                dimensions,
                current,
                getColorForPrice,
                getOpacityForPrice
              });
            }
          }
        })
        .on('end', function(event) {
          if (options.withBodyClasses) {
            document.body.classList.remove('dragging-range');
            document.body.style.removeProperty('cursor');
          }
          
          if (minPrice === null || maxPrice === null) return;
          
          // Apply the same offset calculation for consistency
          const adjustedY = event.y - (this as any)._dragOffsetY;
          const newCenterY = Math.max(-margin.top, Math.min(height + margin.bottom, adjustedY));
          const draggedPrice = yToPrice(newCenterY);
          
          // Find the tick corresponding to the dragged center position
          const centerTick = liquidityData.find(d => Math.abs(d.price0 - draggedPrice) === Math.min(...liquidityData.map(ld => Math.abs(ld.price0 - draggedPrice))));
          
          if (centerTick && (this as any)._tickRangeSize !== undefined) {
            const tickIndices = liquidityData.map((d, i) => ({ tick: d.tick, index: i, price: d.price0 }));
            const centerIndex = tickIndices.find(t => t.tick === centerTick.tick)?.index || 0;
            const halfRange = Math.floor((this as any)._tickRangeSize / 2);
            
            // Calculate new min/max indices based on maintaining the same tick count
            const newMinIndex = Math.max(0, centerIndex - halfRange);
            const newMaxIndex = Math.min(liquidityData.length - 1, centerIndex + halfRange);
            
            // Get the prices for these tick indices
            const newMinPrice = tickIndices[newMinIndex]?.price || minPrice;
            const newMaxPrice = tickIndices[newMaxIndex]?.price || maxPrice;
            
            // Get data bounds
            const allPrices = [
              ...data.map(d => d.value),
              ...liquidityData.map(d => d.price0)
            ];
            const dataMin = Math.min(...allPrices);
            const dataMax = Math.max(...allPrices);
            
            // Only update state if range stays within data bounds
            if (newMinPrice >= dataMin && newMaxPrice <= dataMax) {
              setChartState(prev => ({ ...prev, minPrice: newMinPrice, maxPrice: newMaxPrice }));
            }
          }
        });
    };


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
      .y(d => priceToY(d.value))
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

    // Remove X and left Y axes completely

    // Right side liquidity chart - inspired by Uniswap's approach
    const liquidityWidth = margin.right; // Use full margin width
    
    // Use the tick-based scale for liquidity positioning
    const liquidityYScale = tickScale;

    // With native scrolling, all data is rendered - no filtering needed

    // X scale for liquidity amounts - use all data to maintain consistent bar scaling
    // This prevents bars from changing width when scrolling through different liquidity ranges
    const maxLiquidity = d3.max(liquidityData, d => d.activeLiquidity) || 0;

    const liquidityXScale = d3.scaleLinear()
      .domain([0, maxLiquidity])
      .range([0, liquidityWidth]);

    // Draw very thin grey horizontal liquidity bars using data join for better performance
    const bars = g.selectAll<SVGRectElement, LiquidityDataPoint>(`.${DATA_ELEMENT_CLASSES.LIQUIDITY_BAR}`)
      .data(visibleLiquidityData, d => d.price0); // Use price as key for consistent updates
    
    // Remove bars that are no longer needed
    bars.exit()
      .transition()
      .duration(ANIMATION.TOOLTIP_FADE_DURATION)
      .style("opacity", 0)
      .remove();
    
    // Add new bars
    const enterBars = bars.enter()
      .append("rect")
      .attr("class", DATA_ELEMENT_CLASSES.LIQUIDITY_BAR)
      .attr('opacity', d => getOpacityForPrice(d.price0, minPrice, maxPrice))
      .attr("x", d => width + margin.right - liquidityXScale(d.activeLiquidity) - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr("y", d => liquidityYScale(d.tick.toString()) || 0)
      .attr("width", d => liquidityXScale(d.activeLiquidity))
      .attr("height", liquidityYScale.bandwidth());
    
    // Update existing bars with smooth transitions and conditional coloring
    bars.merge(enterBars)
      .transition()
      .duration(100)
      .attr("x", d => width + margin.right - liquidityXScale(d.activeLiquidity) - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr("y", d => liquidityYScale(d.tick.toString()) || 0)
      .attr("width", d => liquidityXScale(d.activeLiquidity))
      .attr("height", liquidityYScale.bandwidth())
      .attr("fill", d => getColorForPrice(d.price0, minPrice, maxPrice))
      .attr('opacity', d => getOpacityForPrice(d.price0, minPrice, maxPrice))
      .attr("cursor", "pointer")
    
    // Add invisible overlay for better hover detection across the entire liquidity area
    const liquidityOverlay = g.append("rect")
      .attr("class", "liquidity-overlay")
      .attr("x", width + CHART_DIMENSIONS.LIQUIDITY_BARS_SPACING)
      .attr("y", 0)
      .attr("width", liquidityWidth + CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr("height", height)
      .attr("fill", "transparent")
      .attr("cursor", "crosshair");
    
    // Add drag behavior for range creation over liquidity area
    liquidityOverlay.call(d3.drag<SVGRectElement, unknown>()
      .on('start', function(event) {
        (this as any)._startY = event.y;
        (this as any)._isDragging = true;
        d3.select(this).attr('cursor', 'move');
        document.body.classList.add('dragging-range');
        document.body.style.setProperty('cursor', 'move', 'important');
        
        // Hide hover tooltip during drag and remember its previous state
        (this as any)._dragStartTooltip = tooltip.visible;
        setTooltip(prev => ({ ...prev, visible: false }));
      })
      .on('drag', function(event) {
        const startY = (this as any)._startY;
        const currentY = event.y;
        const startPrice = yToPrice(startY);
        const currentPrice = yToPrice(currentY);
        
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
          chartUpdateManager.updateAll({
            g,
            minPrice: constrainedMinPrice,
            maxPrice: constrainedMaxPrice,
            priceToY,
            width,
            margin,
            dimensions,
            current,
            getColorForPrice,
            getOpacityForPrice
          });
          
          // Show dual tooltips for min and max during drag
          const minData = findClosestLiquidityData(constrainedMinPrice);
          const maxData = findClosestLiquidityData(constrainedMaxPrice);
          const liquidityBarsEndX = width + CHART_DIMENSIONS.LIQUIDITY_BARS_SPACING + liquidityWidth - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET;
          const fixedTooltipX = dimensions.width - CHART_DIMENSIONS.TOOLTIP_RIGHT_MARGIN;
          
          setDragTooltips({
            visible: true,
            minTooltip: minData ? {
              x: fixedTooltipX,
              y: priceToY(constrainedMinPrice) + margin.top,
              data: minData,
              lineEndX: liquidityBarsEndX
            } : null,
            maxTooltip: maxData ? {
              x: fixedTooltipX,
              y: priceToY(constrainedMaxPrice) + margin.top,
              data: maxData,
              lineEndX: liquidityBarsEndX
            } : null
          });
        }
      })
      .on('end', function(event) {
        (this as any)._isDragging = false;
        d3.select(this).attr('cursor', 'crosshair');
        document.body.classList.remove('dragging-range');
        document.body.style.removeProperty('cursor');
        
        // Hide drag tooltips
        setDragTooltips({ visible: false, minTooltip: null, maxTooltip: null });
        
        // If tooltip was visible before drag, keep it visible
        if ((this as any)._dragStartTooltip) {
          // Restore tooltip at current mouse position
          const mouseY = event.y + margin.top;
          const hoveredPrice = yToPrice(event.y);
          const closestData = findClosestLiquidityData(hoveredPrice);
          
          if (closestData) {
            const liquidityBarsEndX = width + CHART_DIMENSIONS.LIQUIDITY_BARS_SPACING + liquidityWidth - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET;
            const fixedTooltipX = dimensions.width - CHART_DIMENSIONS.TOOLTIP_RIGHT_MARGIN;
            
            setTooltip({
              visible: true,
              x: fixedTooltipX,
              y: mouseY,
              data: closestData,
              lineEndX: liquidityBarsEndX
            });
          }
        }
        
        const startY = (this as any)._startY;
        const endY = event.y;
        const startPrice = yToPrice(startY);
        const endPrice = yToPrice(endY);
        
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
          setChartState(prev => ({ ...prev, minPrice: constrainedMinPrice, maxPrice: constrainedMaxPrice }));
        }
      })
    );
    
    // Add event listeners to the overlay for continuous hover detection
    liquidityOverlay
      .on("mouseenter", function(event) {
        // Find closest liquidity data point
        const mouseY = d3.pointer(event, this)[1];
        const hoveredPrice = yToPrice(mouseY);
        
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
        
        // Alert parent component about the hovered tick
        onHoverTick(closestData);
      })
      .on("mousemove", function(event) {
        // Update tooltip position as mouse moves
        const mouseY = d3.pointer(event, this)[1];
        const hoveredPrice = yToPrice(mouseY);
        
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
        
        // Alert parent component about the hovered tick
        onHoverTick(closestData);
      })
      .on("mouseleave", function() {
        // Only hide tooltip if not currently dragging
        if (!(this as any)._isDragging) {
          setTooltip(prev => ({ ...prev, visible: false }));
          // Alert parent component that no tick is being hovered
          onHoverTick(null);
        }
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
      
      // Calculate current visible price range using tick-based approach
      const topTick = tickScale ? tickScale.domain().find(tick => {
        const tickY = tickScale(tick);
        return tickY !== undefined && tickY <= 0;
      }) : null;
      const bottomTick = tickScale ? tickScale.domain().reverse().find(tick => {
        const tickY = tickScale(tick);
        return tickY !== undefined && tickY >= height;
      }) : null;
      
      const visibleMaxPrice = topTick ? liquidityData.find(d => d.tick.toString() === topTick)?.price0 || 0 : 0;
      const visibleMinPrice = bottomTick ? liquidityData.find(d => d.tick.toString() === bottomTick)?.price0 || 0 : 0;
      
      // Check if we're scrolled past the handles
      const isPastMaxHandle = maxPrice > visibleMaxPrice;
      const isPastMinHandle = minPrice < visibleMinPrice;
      
      // Check if the range is partially visible (use white) vs completely out of view (use pink)
      const isRangePartiallyVisible = (minPrice <= visibleMaxPrice && maxPrice >= visibleMinPrice);
      const iconColor = isRangePartiallyVisible ? 'white' : CHART_COLORS.PRIMARY_PINK;
      
      // Draw dynamic range indicator line inside the border grey line
      g.append('rect')
        .attr('class', `price-range-element ${BACKGROUND_CLASSES.RANGE_INDICATOR}`)
        .attr('x', width + margin.right - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
        .attr('y', priceToY(maxPrice))
        .attr('width', CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
        .attr('height', priceToY(minPrice) - priceToY(maxPrice))
        .attr('fill', CHART_COLORS.PRIMARY_PINK)
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('cursor', 'move')
        .call(createTickBasedDragBehavior());
      
      // Add max price indicator - show fast-forward icon if scrolled past, otherwise show drag handle
      if (isPastMaxHandle) {
        // Show fast-forward icon when scrolled past max handle
        const arrowGroup = g.append('g')
          .attr('class', `price-range-element max-arrow-indicator`)
          .attr('transform', `translate(${width + margin.right - (CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET / 2)}, 10)`)
          .attr('cursor', 'pointer')
          .on('click', () => handleCenterRange(data, liquidityData));
        
        // Fast-forward icon path
        arrowGroup.append('path')
          .attr('d', 'M-3 -4.875L3 -4.875C3.207 -4.875 3.375 -4.707 3.375 -4.5C3.375 -4.293 3.207 -4.125 3 -4.125L0.77295 -4.125L2.78955 -1.57202C3.29355 -0.93402 2.83555 0 2.01855 0L0.00952 0C0.29402 0.0025 0.577 0.127 0.771 0.3725L2.78955 2.92798C3.29355 3.56598 2.83555 4.5 2.01855 4.5L-2.01855 4.5C-2.83555 4.5 -3.29355 3.56648 -2.78955 2.92798L-0.77148 0.3725C-0.57748 0.127 -0.29353 0.0025 -0.00903 0L-2.01855 0C-2.83555 0 -3.29355 -0.93352 -2.78955 -1.57202L-0.77295 -4.125L-3 -4.125C-3.207 -4.125 -3.375 -4.293 -3.375 -4.5C-3.375 -4.707 -3.207 -4.875 -3 -4.875Z')
          .attr('fill', iconColor)
          .attr('opacity', 0.65)
      } else {
        // Show normal drag handle when not scrolled past
        g.append('circle')
          .attr('class', `price-range-element ${DRAG_HANDLE_CLASSES.MAX_HANDLE}`)
          .attr('cx', width + margin.right - (CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET / 2))
          .attr('cy', priceToY(maxPrice) + 8)
          .attr('r', 6)
          .attr('fill', 'white')
          .attr('stroke', 'rgba(0,0,0,0.1)')
          .attr('stroke-width', 1)
          .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
          .attr('cursor', 'ns-resize')
          .call(createHandleDragBehavior('max'));
      }
      
      // Add min price indicator - show fast-backward icon if scrolled past, otherwise show drag handle
      if (isPastMinHandle) {
        // Show fast-backward icon when scrolled past min handle
        const arrowGroup = g.append('g')
          .attr('class', `price-range-element min-arrow-indicator`)
          .attr('transform', `translate(${width + margin.right - (CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET / 2)}, ${height - 10})`)
          .attr('cursor', 'pointer')
          .on('click', () => handleCenterRange(data, liquidityData));
        
        // Fast-backward icon path
        arrowGroup.append('path')
          .attr('d', 'M-3 4.875L3 4.875C3.207 4.875 3.375 4.707 3.375 4.5C3.375 4.293 3.207 4.125 3 4.125L0.77295 4.125L2.78955 1.57202C3.29355 0.93402 2.83555 0 2.01855 0L0.00952 0C0.29402 -0.0025 0.577 -0.127 0.771 -0.3725L2.78955 -2.92798C3.29355 -3.56598 2.83555 -4.5 2.01855 -4.5L-2.01855 -4.5C-2.83555 -4.5 -3.29355 -3.56648 -2.78955 -2.92798L-0.77148 -0.3725C-0.57748 -0.127 -0.29353 -0.0025 -0.00903 0L-2.01855 0C-2.83555 0 -3.29355 0.93352 -2.78955 1.57202L-0.77295 4.125L -3 4.125C-3.207 4.125 -3.375 4.293 -3.375 4.5C-3.375 4.707 -3.207 4.875 -3 4.875Z')
          .attr('fill', iconColor)
          .attr('opacity', 0.65)
      } else {
        // Show normal drag handle when not scrolled past
        g.append('circle')
          .attr('class', `price-range-element ${DRAG_HANDLE_CLASSES.MIN_HANDLE}`)
          .attr('cx', width + margin.right - (CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET / 2))
          .attr('cy', priceToY(minPrice) - 8)
          .attr('r', 6)
          .attr('fill', 'white')
          .attr('stroke', 'rgba(0,0,0,0.1)')
          .attr('stroke-width', 1)
          .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
          .attr('cursor', 'ns-resize')
          .call(createHandleDragBehavior('min'));
      }
      
      // Add center drag indicator for moving entire range
      const centerY = (priceToY(maxPrice) + priceToY(minPrice)) / 2;
      g.append('rect')
        .attr('class', `price-range-element ${DRAG_HANDLE_CLASSES.CENTER_HANDLE}`)
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
        .call(createTickBasedDragBehavior());
      
      // Add 3 grey lines inside the center drag indicator
      const centerIndicatorX = width + margin.right - (CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET / 2);
      for (let i = 0; i < 3; i++) {
        g.append('rect')
          .attr('class', `price-range-element ${DRAG_HANDLE_CLASSES.CENTER_LINES}`)
          .attr('x', centerIndicatorX - 1.75 + (i * 1.25)) // Space the 3 lines evenly within 12px width
          .attr('y', centerY - 1.5) // Center the 3px height within 6px indicator
          .attr('width', 0.5)
          .attr('height', 3)
          .attr('fill', 'rgba(0,0,0,0.3)')
          .style('pointer-events', 'none'); // Don't interfere with drag events
      }
      
      
      // Draw visual pink background that extends over liquidity area (no interactions)
      g.append('rect')
        .attr('class', `price-range-element ${BACKGROUND_CLASSES.VISUAL_BG}`)
        .attr('x', -margin.left) // Extend left to cover the margin area
        .attr('y', priceToY(maxPrice))
        .attr('width', dimensions.width - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET) // Cover the entire SVG width
        .attr('height', priceToY(minPrice) - priceToY(maxPrice))
        .attr('fill', CHART_COLORS.PRIMARY_PINK)
        .attr('opacity', 0.2)
        .attr('stroke', 'none')
        .style('pointer-events', 'none'); // No interactions on this visual layer
      
      // Draw interactive pink background only over main chart area (for dragging)
      g.append('rect')
        .attr('class', `price-range-element ${BACKGROUND_CLASSES.INTERACTIVE_BG}`)
        .attr('x', -margin.left) // Extend left to cover the margin area
        .attr('y', priceToY(maxPrice))
        .attr('width', width + margin.left + 10) // Stop before liquidity area
        .attr('height', priceToY(minPrice) - priceToY(maxPrice))
        .attr('fill', 'transparent') // Invisible, just for interactions
        .attr('stroke', 'none')
        .attr('cursor', 'move')
        .call(createTickBasedDragBehavior({ withBodyClasses: true }));

      // Draw min price line (solid)
      g.append('line')
        .attr('class', `price-range-element ${SOLID_PRICE_LINE_CLASSES.MIN_LINE}`)
        .attr('x1', -margin.left) // Start from left margin
        .attr('x2', dimensions.width - margin.left - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET) // Extend to right edge
        .attr('y1', priceToY(minPrice) + CHART_DIMENSIONS.SOLID_MIN_MAX_LINE_HEIGHT / 2)
        .attr('y2', priceToY(minPrice) + CHART_DIMENSIONS.SOLID_MIN_MAX_LINE_HEIGHT / 2)
        .attr('stroke', '#FF37C7')
        .attr('stroke-width', CHART_DIMENSIONS.SOLID_MIN_MAX_LINE_HEIGHT)
        .attr('opacity', 0.08)

      // Draw max price line (solid)
      g.append('line')
        .attr('class', `price-range-element ${SOLID_PRICE_LINE_CLASSES.MAX_LINE}`)
        .attr('x1', -margin.left) // Start from left margin
        .attr('x2', dimensions.width - margin.left - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET) // Extend to right edge
        .attr('y1', priceToY(maxPrice) - CHART_DIMENSIONS.SOLID_MIN_MAX_LINE_HEIGHT / 2)
        .attr('y2', priceToY(maxPrice) - CHART_DIMENSIONS.SOLID_MIN_MAX_LINE_HEIGHT / 2)
        .attr('stroke', '#FF37C7')
        .attr('stroke-width', 3)
        .attr('opacity', 0.08)

      // Draw min price line (transparent) with drag behavior
      g.append('line')
        .attr('class', `price-range-element ${TRANSPARENT_PRICE_LINE_CLASSES.MIN_LINE}`)
        .attr('x1', -margin.left) // Start from left margin
        .attr('x2', dimensions.width - margin.left - liquidityWidth) // Extend to right edge before liquidity section
        .attr('y1', priceToY(minPrice))
        .attr('y2', priceToY(minPrice))
        .attr('stroke', CHART_COLORS.BOUNDARY_LINE)
        .attr('stroke-width', CHART_DIMENSIONS.TRANSPARENT_MIN_MAX_LINE_HEIGHT)
        .attr('opacity', 0)
        .attr('cursor', 'ns-resize')
        .call(createPriceLineDrag(
          'min',
          g,
          priceToY,
          margin,
          height,
          dimensions,
          () => maxPrice
        ));

      // Draw max price line (transparent) with drag behavior
      g.append('line')
        .attr('class', `price-range-element ${TRANSPARENT_PRICE_LINE_CLASSES.MAX_LINE}`)
        .attr('x1', -margin.left) // Start from left margin
        .attr('x2', dimensions.width - margin.left - liquidityWidth) // Extend to right edge before liquidity section
        .attr('y1', priceToY(maxPrice))
        .attr('y2', priceToY(maxPrice))
        .attr('stroke', CHART_COLORS.BOUNDARY_LINE)
        .attr('stroke-width', CHART_DIMENSIONS.TRANSPARENT_MIN_MAX_LINE_HEIGHT)
        .attr('opacity', 0)
        .attr('cursor', 'ns-resize')
        .call(createPriceLineDrag(
          'max',
          g,
          priceToY,
          margin,
          height,
          dimensions,
          () => minPrice
        ));
        
      // Add min price label
      g.append('text')
        .attr('class', `price-range-element ${LABEL_CLASSES.MIN_LABEL}`)
        .attr('x', -margin.left + 12) // 12px from left border
        .attr('y', priceToY(minPrice) - 5)
        .attr('font-size', '10px')
        .attr('fill', CHART_COLORS.BOUNDARY_LINE)
        .attr('font-weight', 'bold')
        .text(`Min: ${minPrice?.toFixed(0)}`);
        
      // Add max price label
      g.append('text')
        .attr('class', `price-range-element ${LABEL_CLASSES.MAX_LABEL}`)
        .attr('x', -margin.left + 12) // 12px from left border
        .attr('y', priceToY(maxPrice) + 15)
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
        .attr('x2', dimensions.width - margin.left - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET) // Extend to right edge
        .attr('y1', priceToY(current))
        .attr('y2', priceToY(current))
        .attr('stroke', CHART_COLORS.CURRENT_PRICE_GREY)
        .attr('stroke-width', 1.5)
        .attr('stroke-linecap', 'round')
        .attr('stroke-dasharray', '0,6') // Dotted line pattern
        .attr('opacity', 0.8);
        
      // Add current price label on the left like min/max
      g.append('text')
        .attr('class', 'current-price-label')
        .attr('x', -margin.left + 12) // 12px from left border
        .attr('y', priceToY(current) - 5)
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
          dotColor = getColorForPrice(current, minPrice, maxPrice);
        } else {
          dotColor = CHART_COLORS.OUT_RANGE_GREY;
        }
        
        // Check if dot already exists and update it, otherwise create new one
        let currentDot: d3.Selection<any, unknown, null, undefined> = g.select(`.${DATA_ELEMENT_CLASSES.CURRENT_PRICE_DOT}`);
        if (currentDot.empty()) {
          currentDot = g.append('circle')
            .attr('class', DATA_ELEMENT_CLASSES.CURRENT_PRICE_DOT)
            .attr('cx', xScale(lastDataPoint.date))
            .attr('cy', priceToY(lastDataPoint.value))
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
        .attr('height', priceToY(maxPrice) - CHART_DIMENSIONS.TRANSPARENT_MIN_MAX_LINE_HEIGHT)
        .attr('fill', 'transparent')
        .attr('cursor', 'crosshair')
        .style('pointer-events', 'all')
        .call(d3.drag<SVGRectElement, unknown>()
          .on('start', function(event) {
            (this as any)._startY = event.y;
            (this as any)._isDragging = true;
            d3.select(this).attr('cursor', 'move');
            document.body.classList.add('dragging-range');
            document.body.style.setProperty('cursor', 'move', 'important');
            
            // Hide hover tooltip during drag and remember its previous state
            (this as any)._dragStartTooltip = tooltip.visible;
            setTooltip(prev => ({ ...prev, visible: false }));
          })
          .on('drag', function(event) {
            // Hide drag tooltips
            setDragTooltips({ visible: false, minTooltip: null, maxTooltip: null });
            
            const startY = (this as any)._startY;
            const currentY = event.y;
            const startPrice = yToPrice(startY);
            const currentPrice = yToPrice(currentY);
            
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
              chartUpdateManager.updateAll({
                g,
                minPrice: constrainedMinPrice,
                maxPrice: constrainedMaxPrice,
                priceToY,
                width,
                margin,
                dimensions,
                current,
                getColorForPrice,
                getOpacityForPrice
              });
              
              // Show dual tooltips for min and max during drag
              const minData = findClosestLiquidityData(constrainedMinPrice);
              const maxData = findClosestLiquidityData(constrainedMaxPrice);
              const liquidityBarsEndX = width + CHART_DIMENSIONS.LIQUIDITY_BARS_SPACING + liquidityWidth - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET;
              const fixedTooltipX = dimensions.width - CHART_DIMENSIONS.TOOLTIP_RIGHT_MARGIN;
              
              setDragTooltips({
                visible: true,
                minTooltip: minData ? {
                  x: fixedTooltipX,
                  y: priceToY(constrainedMinPrice) + margin.top,
                  data: minData,
                  lineEndX: liquidityBarsEndX
                } : null,
                maxTooltip: maxData ? {
                  x: fixedTooltipX,
                  y: priceToY(constrainedMaxPrice) + margin.top,
                  data: maxData,
                  lineEndX: liquidityBarsEndX
                } : null
              });
            }
          })
          .on('end', function(event) {
            (this as any)._isDragging = false;
            d3.select(this).attr('cursor', 'crosshair');
            document.body.classList.remove('dragging-range');
            document.body.style.removeProperty('cursor');
            
            // Hide drag tooltips
            setDragTooltips({ visible: false, minTooltip: null, maxTooltip: null });
            
            const startY = (this as any)._startY;
            const endY = event.y;
            const startPrice = yToPrice(startY);
            const endPrice = yToPrice(endY);
            
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
                  setChartState(prev => ({ ...prev, minPrice: constrainedMinPrice, maxPrice: constrainedMaxPrice }));
            }
          })
        );
      
      // Area below current range (for dragging below min price)
      g.append('rect')
        .attr('class', 'price-range-element below-range-area')
        .attr('x', -margin.left)
        .attr('y', priceToY(minPrice) + CHART_DIMENSIONS.TRANSPARENT_MIN_MAX_LINE_HEIGHT)
        .attr('width', width + margin.left + 10)
        .attr('height', height - priceToY(minPrice))
        .attr('fill', 'transparent')
        .attr('cursor', 'crosshair')
        .style('pointer-events', 'all')
        .call(d3.drag<SVGRectElement, unknown>()
          .on('start', function(event) {
            (this as any)._startY = event.y;
            (this as any)._isDragging = true;
            d3.select(this).attr('cursor', 'move');
            document.body.classList.add('dragging-range');
            document.body.style.setProperty('cursor', 'move', 'important');
            
            // Hide hover tooltip during drag and remember its previous state
            (this as any)._dragStartTooltip = tooltip.visible;
            setTooltip(prev => ({ ...prev, visible: false }));
          })
          .on('drag', function(event) {
            // Hide drag tooltips
            setDragTooltips({ visible: false, minTooltip: null, maxTooltip: null });
            
            const startY = (this as any)._startY;
            const currentY = event.y;
            const startPrice = yToPrice(startY);
            const currentPrice = yToPrice(currentY);
            
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
              chartUpdateManager.updateAll({
                g,
                minPrice: constrainedMinPrice,
                maxPrice: constrainedMaxPrice,
                priceToY,
                width,
                margin,
                dimensions,
                current,
                getColorForPrice,
                getOpacityForPrice
              });
              
              // Show dual tooltips for min and max during drag
              const minData = findClosestLiquidityData(constrainedMinPrice);
              const maxData = findClosestLiquidityData(constrainedMaxPrice);
              const liquidityBarsEndX = width + CHART_DIMENSIONS.LIQUIDITY_BARS_SPACING + liquidityWidth - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET;
              const fixedTooltipX = dimensions.width - CHART_DIMENSIONS.TOOLTIP_RIGHT_MARGIN;
              
              setDragTooltips({
                visible: true,
                minTooltip: minData ? {
                  x: fixedTooltipX,
                  y: priceToY(constrainedMinPrice) + margin.top,
                  data: minData,
                  lineEndX: liquidityBarsEndX
                } : null,
                maxTooltip: maxData ? {
                  x: fixedTooltipX,
                  y: priceToY(constrainedMaxPrice) + margin.top,
                  data: maxData,
                  lineEndX: liquidityBarsEndX
                } : null
              });
            }
          })
          .on('end', function(event) {
            (this as any)._isDragging = false;
            d3.select(this).attr('cursor', 'crosshair');
            document.body.classList.remove('dragging-range');
            document.body.style.removeProperty('cursor');
            
            // Hide drag tooltips
            setDragTooltips({ visible: false, minTooltip: null, maxTooltip: null });
            
            const startY = (this as any)._startY;
            const endY = event.y;
            const startPrice = yToPrice(startY);
            const endPrice = yToPrice(endY);
            
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
                setChartState(prev => ({ ...prev, minPrice: constrainedMinPrice, maxPrice: constrainedMaxPrice }));
            }
          })
        );
    }


  }, [data, liquidityData, current, currentTick, minPrice, maxPrice, dimensions, tickScale]);

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
                onChange={(e) => setChartState(prev => ({ ...prev, minPrice: e.target.value ? parseFloat(e.target.value) : null }))}
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
                onChange={(e) => setChartState(prev => ({ ...prev, maxPrice: e.target.value ? parseFloat(e.target.value) : null }))}
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
              onClick={() => { setChartState(prev => ({ ...prev, minPrice: null, maxPrice: null })); }}
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
        height: `${dimensions.height}px`,
        maxWidth: '100%',
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
        
        {/* Liquidity Tooltip - Hide when drag tooltips are active */}
        {tooltip.visible && tooltip.data && !dragTooltips.visible && (
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
              {(() => {
                const tooltipTick = tooltip.data.tick;
                
                // If below currentTick, show amount1Locked as USDC
                if (currentTick !== null && currentTick !== undefined && tooltipTick < currentTick) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                      <div style={{ 
                        width: '16px', 
                        height: '16px', 
                        borderRadius: '50%', 
                        background: '#2775CA',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        $
                      </div>
                      <span>USDC</span>
                      <span style={{ color: CHART_COLORS.TEXT_GREY }}>
                        {formatPrice(tooltip.data.amount0Locked || 0)} {tooltip.data.tick}
                      </span>
                      <span style={{ color: CHART_COLORS.TEXT_GREY }}>100%</span>
                    </div>
                  );
                }
                
                // If equal to currentTick, show 50/50 split
                if (currentTick !== null && currentTick !== undefined && tooltipTick === currentTick) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                          {formatPrice(tooltip.data.amount1Locked * 4000 || 0)} {tooltip.data.tick}
                        </span>
                        <span style={{ color: CHART_COLORS.TEXT_GREY }}>50%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <div style={{ 
                          width: '16px', 
                          height: '16px', 
                          borderRadius: '50%', 
                          background: '#2775CA',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '8px',
                          color: 'white',
                          fontWeight: 'bold'
                        }}>
                          $
                        </div>
                        <span>USDC</span>
                        <span style={{ color: CHART_COLORS.TEXT_GREY }}>
                            {formatPrice(tooltip.data.amount0Locked || 0)} {tooltip.data.tick}
                        </span>
                        <span style={{ color: CHART_COLORS.TEXT_GREY }}>50%</span>
                      </div>
                    </div>
                  );
                }
                
                // Default: above currentTick, show amount0Locked as ETH
                return (
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
                      {formatPrice(tooltip.data.amount1Locked * 4000 || 0)} {tooltip.data.tick}
                    </span>
                    <span style={{ color: CHART_COLORS.TEXT_GREY }}>100%</span>
                  </div>
                );
              })()}
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

        {/* Drag Tooltips for Min/Max during range creation */}
        {dragTooltips.visible && (
          <>
            {/* Min Tooltip */}
            {dragTooltips.minTooltip && dragTooltips.minTooltip.data && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    right: 130,
                    top: dragTooltips.minTooltip.y - 18,
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: `1px solid ${CHART_COLORS.BORDER_GREY}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                    zIndex: 1001,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    minWidth: '120px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '10px', color: CHART_COLORS.TEXT_GREY, marginBottom: '4px', fontWeight: 'bold' }}>MIN</div>
                  {(() => {
                    const tooltipTick = dragTooltips.minTooltip.data.tick;
                    
                    // If below currentTick, show amount1Locked as USDC
                    if (currentTick !== null && currentTick !== undefined && tooltipTick < currentTick) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <div style={{ 
                            width: '16px', 
                            height: '16px', 
                            borderRadius: '50%', 
                            background: '#2775CA',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '8px',
                            color: 'white',
                            fontWeight: 'bold'
                          }}>
                            $
                          </div>
                          <span>USDC</span>
                          <span style={{ color: CHART_COLORS.TEXT_GREY }}>
                            {formatPrice(dragTooltips.minTooltip.data.amount0Locked || 0)}
                          </span>
                          <span style={{ color: CHART_COLORS.TEXT_GREY }}>100%</span>
                        </div>
                      );
                    }
                    
                    // If equal to currentTick, show 50/50 split
                    if (currentTick !== null && currentTick !== undefined && tooltipTick === currentTick) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                              {formatPrice(dragTooltips.minTooltip.data.amount1Locked * 4000 || 0)}
                            </span>
                            <span style={{ color: CHART_COLORS.TEXT_GREY }}>50%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <div style={{ 
                              width: '16px', 
                              height: '16px', 
                              borderRadius: '50%', 
                              background: '#2775CA',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '8px',
                              color: 'white',
                              fontWeight: 'bold'
                            }}>
                              $
                            </div>
                            <span>USDC</span>
                            <span style={{ color: CHART_COLORS.TEXT_GREY }}>
                              {formatPrice(dragTooltips.minTooltip.data.amount0Locked || 0)}
                            </span>
                            <span style={{ color: CHART_COLORS.TEXT_GREY }}>50%</span>
                          </div>
                        </div>
                      );
                    }
                    
                    // Default: above currentTick, show amount0Locked as ETH
                    return (
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
                          {formatPrice(dragTooltips.minTooltip.data.amount1Locked * 4000 || 0)}
                        </span>
                        <span style={{ color: CHART_COLORS.TEXT_GREY }}>100%</span>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Connecting line for min tooltip */}
                <div
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: dragTooltips.minTooltip.y - 1,
                    width: `${dragTooltips.minTooltip.lineEndX - (dimensions.width - 210)}px`,
                    height: '2px',
                    background: '#666',
                    pointerEvents: 'none',
                    zIndex: 1000
                  }}
                />
              </>
            )}

            {/* Max Tooltip */}
            {dragTooltips.maxTooltip && dragTooltips.maxTooltip.data && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    right: 130,
                    top: dragTooltips.maxTooltip.y - 18,
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: `1px solid ${CHART_COLORS.BORDER_GREY}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                    zIndex: 1001,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    minWidth: '120px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '10px', color: CHART_COLORS.TEXT_GREY, marginBottom: '4px', fontWeight: 'bold' }}>MAX</div>
                  {(() => {
                    const tooltipTick = dragTooltips.maxTooltip.data.tick;
                    
                    // If below currentTick, show amount1Locked as USDC
                    if (currentTick !== null && currentTick !== undefined && tooltipTick < currentTick) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <div style={{ 
                            width: '16px', 
                            height: '16px', 
                            borderRadius: '50%', 
                            background: '#2775CA',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '8px',
                            color: 'white',
                            fontWeight: 'bold'
                          }}>
                            $
                          </div>
                          <span>USDC</span>
                          <span style={{ color: CHART_COLORS.TEXT_GREY }}>
                            {formatPrice(dragTooltips.maxTooltip.data.amount0Locked || 0)}
                          </span>
                          <span style={{ color: CHART_COLORS.TEXT_GREY }}>100%</span>
                        </div>
                      );
                    }
                    
                    // If equal to currentTick, show 50/50 split
                    if (currentTick !== null && currentTick !== undefined && tooltipTick === currentTick) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                              {formatPrice(dragTooltips.maxTooltip.data.amount1Locked * 4000 || 0)}
                            </span>
                            <span style={{ color: CHART_COLORS.TEXT_GREY }}>50%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <div style={{ 
                              width: '16px', 
                              height: '16px', 
                              borderRadius: '50%', 
                              background: '#2775CA',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '8px',
                              color: 'white',
                              fontWeight: 'bold'
                            }}>
                              $
                            </div>
                            <span>USDC</span>
                            <span style={{ color: CHART_COLORS.TEXT_GREY }}>
                              {formatPrice(dragTooltips.maxTooltip.data.amount0Locked || 0)}
                            </span>
                            <span style={{ color: CHART_COLORS.TEXT_GREY }}>50%</span>
                          </div>
                        </div>
                      );
                    }
                    
                    // Default: above currentTick, show amount0Locked as ETH
                    return (
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
                          {formatPrice(dragTooltips.maxTooltip.data.amount1Locked * 4000 || 0)}
                        </span>
                        <span style={{ color: CHART_COLORS.TEXT_GREY }}>100%</span>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Connecting line for max tooltip */}
                <div
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: dragTooltips.maxTooltip.y - 1,
                    width: `${dragTooltips.maxTooltip.lineEndX - (dimensions.width - 210)}px`,
                    height: '2px',
                    background: '#666',
                    pointerEvents: 'none',
                    zIndex: 1000
                  }}
                />
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default D3Chart;