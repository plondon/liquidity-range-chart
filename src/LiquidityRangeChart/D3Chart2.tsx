import React, { useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import liquidityData from './data/liquidity2';
import { CHART_DIMENSIONS, CHART_COLORS, LIQUIDITY_BARS, TYPOGRAPHY } from './constants';
import { useResponsiveDimensions } from './hooks/useResponsiveDimensions';
import { findClosestElementBinarySearch } from './utils/dataUtils';
import { PriceDataPoint, LiquidityDataPoint } from './types';

interface D3Chart2Props {
  data: PriceDataPoint[];
  minPrice?: number | null;
  maxPrice?: number | null;
  onHoverTick: (tick: LiquidityDataPoint | null) => void;
}

const D3Chart2: React.FC<D3Chart2Props> = ({ 
  data,
  minPrice = null,
  maxPrice = null,
  onHoverTick,
}) => {
  const dimensions = useResponsiveDimensions();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate current price and tick from data
  const current = useMemo(() => {
    return data && data.length > 0 ? data[data.length - 1]?.value : null;
  }, [data]);

  // Calculate currentTick based on current price
  const currentTick = useMemo(() => {
    if (!current || !liquidityData) return null;
    return findClosestElementBinarySearch(liquidityData, current)?.tick;
  }, [current, liquidityData]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Use same margin calculation as D3Chart
    const isMobile = window.innerWidth <= 768;
    const margin = { 
      top: 20, 
      right: isMobile ? 120 : 180,
      bottom: 20, 
      left: isMobile ? 60 : 80
    };

    const chartWidth = dimensions.width - margin.left - margin.right;
    const barHeight = 3;
    const barSpacing = 1;
    const totalHeight = liquidityData.length * (barHeight + barSpacing);

    // Set SVG dimensions
    svg
      .attr('width', dimensions.width)
      .attr('height', totalHeight + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Find current tick index for centering - use closest match even if not exact
    const currentDataPointIndex = currentTick 
      ? liquidityData.findIndex((d: LiquidityDataPoint) => 
          Math.abs(d.tick - currentTick) === Math.min(...liquidityData.map(item => Math.abs(item.tick - currentTick)))
        )
      : -1;

    // Scales
    const maxLiquidity = d3.max(liquidityData, (d: LiquidityDataPoint) => d.activeLiquidity) as number;

    const yScale = d3.scaleBand()
      .domain(liquidityData.map((d: LiquidityDataPoint) => d.tick.toString()))
      .range([totalHeight, 0]) // Reversed: highest price at top, lowest at bottom
      .paddingInner(barSpacing / (barHeight + barSpacing));

    const xScale = d3.scaleLinear()
      .domain([0, maxLiquidity])
      .range([0, margin.right - 20]); // Use right margin width minus padding

    // Position bars on the right side like D3Chart liquidity bars
    const barsStartX = chartWidth + CHART_DIMENSIONS.LIQUIDITY_BARS_SPACING;

    // Function to convert price to Y position using the existing band scale
    const priceToY = (price: number): number => {
      // Find the closest liquidity data point to this price
      const closest = liquidityData.reduce((prev, curr) => 
        Math.abs(curr.price0 - price) < Math.abs(prev.price0 - price) ? curr : prev
      );
      
      // Get the Y position from the band scale and add half bar height for center
      const bandY = yScale(closest.tick.toString()) || 0;
      return bandY + (barHeight / 2);
    };

    // Draw price chart if we have price data
    if (data && data.length > 0) {
      // Time scale for X axis
      const timeExtent = d3.extent(data, d => new Date(d.time * 1000)) as [Date, Date];
      const timeScale = d3.scaleTime()
        .domain(timeExtent)
        .range([0, chartWidth - 150]);

      // Create line generator that uses our priceToY function
      const priceLine = d3.line<PriceDataPoint>()
        .x(d => timeScale(new Date(d.time * 1000)))
        .y(d => priceToY(d.value))
        .curve(d3.curveMonotoneX);

      // Draw the price line
      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", CHART_COLORS.PRIMARY_PINK)
        .attr("stroke-width", 2)
        .attr("d", priceLine)
        .attr("class", "price-line");

      // Add current price dot
      const currentPrice = data[data.length - 1];
      if (currentPrice) {
        g.append('circle')
          .attr('cx', timeScale(new Date(currentPrice.time * 1000)))
          .attr('cy', priceToY(currentPrice.value))
          .attr('r', 4)
          .attr('fill', CHART_COLORS.PRIMARY_PINK)
          .attr('class', 'current-price-dot');
      }
    }


    // Create bars
    const bars = g.selectAll('.liquidity-bar')
      .data(liquidityData)
      .enter()
      .append('rect')
      .attr('class', 'liquidity-bar')
      .attr('x', (d: LiquidityDataPoint) => barsStartX + margin.right - xScale(d.activeLiquidity) - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
      .attr('y', (d: LiquidityDataPoint) => yScale(d.tick.toString()) || 0)
      .attr('width', (d: LiquidityDataPoint) => Math.max(LIQUIDITY_BARS.MIN_WIDTH, xScale(d.activeLiquidity)))
      .attr('height', barHeight)
      .attr('fill', CHART_COLORS.PRIMARY_PINK)
      .attr('opacity', LIQUIDITY_BARS.OPACITY)
      .attr('stroke', 'none');

    // Add hover effects
    bars
      .on('mouseover', function() {
        onHoverTick(d3.select(this).data()[0] as LiquidityDataPoint);
        d3.select(this).attr('opacity', LIQUIDITY_BARS.HOVER_OPACITY);
      })
      .on('mouseout', function() {
        onHoverTick(null);
        d3.select(this).attr('opacity', LIQUIDITY_BARS.OPACITY);
      });

    // Add Y-axis (tick labels) on the left
    const yAxis = d3.axisLeft(yScale)
      .tickValues(liquidityData
        .filter((_, i) => i % 20 === 0) // Show every 20th tick for better readability
        .map((d: LiquidityDataPoint) => d.tick.toString())
      )
      .tickFormat((d) => {
        const dataPoint = liquidityData.find((item: LiquidityDataPoint) => item.tick.toString() === d);
        return dataPoint ? `$${dataPoint.price0.toFixed(0)}` : '';
      });

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .selectAll('text')
      .style('font-size', `${TYPOGRAPHY.LABEL_FONT_SIZE}px`)
      .style('fill', CHART_COLORS.TEXT_GREY);

    // Add current price indicator - use closest match
    const currentDataPoint = currentTick 
      ? liquidityData.find((d: LiquidityDataPoint) => 
          Math.abs(d.tick - currentTick) === Math.min(...liquidityData.map(item => Math.abs(item.tick - currentTick)))
        )
      : null;

    if (currentDataPoint && current) {
      const currentY = yScale(currentDataPoint.tick.toString()) || 0;
      
      // Current price line extending across the chart
      g.append('line')
        .attr('class', 'current-price-line')
        .attr('x1', -margin.left)
        .attr('x2', chartWidth + margin.right - CHART_DIMENSIONS.LIQUIDITY_SECTION_OFFSET)
        .attr('y1', currentY + barHeight / 2)
        .attr('y2', currentY + barHeight / 2)
        .attr('stroke', CHART_COLORS.CURRENT_PRICE_GREY)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.8);

      // Current price dot on the left
      g.append('circle')
        .attr('class', 'current-price-dot')
        .attr('cx', -margin.left + 12)
        .attr('cy', currentY + barHeight / 2)
        .attr('r', CHART_DIMENSIONS.PRICE_DOT_RADIUS)
        .attr('fill', CHART_COLORS.CURRENT_PRICE_GREY);

      // Current price label on the left
      g.append('text')
        .attr('class', 'current-price-label')
        .attr('x', -margin.left + 25)
        .attr('y', currentY + barHeight / 2 - 5)
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .style('font-size', `${TYPOGRAPHY.LABEL_FONT_SIZE}px`)
        .style('fill', CHART_COLORS.CURRENT_PRICE_GREY)
        .style('font-weight', 'bold')
        .text(`Current: $${current.toFixed(0)}`);
    }

    // Add price range background if minPrice and maxPrice are provided
    if (minPrice !== null && maxPrice !== null) {
      const maxY = priceToY(maxPrice);
      const minY = priceToY(minPrice);

      // Draw pink background area for the price range
      g.append('rect')
        .attr('class', 'price-range-bg')
        .attr('x', -margin.left)
        .attr('y', maxY)
        .attr('width', dimensions.width)
        .attr('height', minY - maxY)
        .attr('fill', CHART_COLORS.PRIMARY_PINK)
        .attr('opacity', 0.2)
        .style('pointer-events', 'none');

      // Add Min price label
      g.append('text')
        .attr('class', 'min-price-label')
        .attr('x', -margin.left + 12)
        .attr('y', minY + 15)
        .attr('font-size', '12px')
        .attr('fill', CHART_COLORS.TEXT_GREY)
        .attr('font-weight', 'bold')
        .text(`Min: ${minPrice.toFixed(0)}`);

      // Add Max price label  
      g.append('text')
        .attr('class', 'max-price-label')
        .attr('x', -margin.left + 12)
        .attr('y', maxY - 5)
        .attr('font-size', '12px')
        .attr('fill', CHART_COLORS.TEXT_GREY)
        .attr('font-weight', 'bold')
        .text(`Max: ${maxPrice.toFixed(0)}`);

      // Add white dots at range boundaries on the right
      g.append('circle')
        .attr('class', 'max-range-dot')
        .attr('cx', dimensions.width - margin.left - 20)
        .attr('cy', maxY)
        .attr('r', 6)
        .attr('fill', 'white')
        .attr('stroke', CHART_COLORS.BORDER_GREY)
        .attr('stroke-width', 1);

      g.append('circle')
        .attr('class', 'min-range-dot')
        .attr('cx', dimensions.width - margin.left - 20)
        .attr('cy', minY)
        .attr('r', 6)
        .attr('fill', 'white')
        .attr('stroke', CHART_COLORS.BORDER_GREY)
        .attr('stroke-width', 1);
    }

    // Style axes
    g.selectAll('.domain')
      .style('stroke', CHART_COLORS.BORDER_GREY);

    g.selectAll('.tick line')
      .style('stroke', CHART_COLORS.BORDER_GREY);

    // Center the scroll position around the current tick
    if (currentDataPointIndex !== -1 && containerRef.current) {
      // Since we reversed the Y-scale, we need to calculate position from the reversed order
      const reversedIndex = liquidityData.length - 1 - currentDataPointIndex;
      const currentItemY = reversedIndex * (barHeight + barSpacing) + margin.top;
      const containerHeight = containerRef.current.clientHeight;
      const scrollTop = currentItemY - (containerHeight / 2);
      
      // Use setTimeout to ensure DOM is updated before scrolling
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = Math.max(0, scrollTop);
        }
      }, 0);
    }

  }, [currentTick, dimensions, current, minPrice, maxPrice]);

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        height: `${dimensions.height}px`,
        overflow: 'auto',
        backgroundColor: CHART_COLORS.BACKGROUND_GREY,
        border: `1px solid ${CHART_COLORS.BORDER_GREY}`,
        borderRadius: '4px'
      }}
    >
      <svg ref={svgRef} style={{ display: 'block' }} />
    </div>
  );
};

export default D3Chart2;