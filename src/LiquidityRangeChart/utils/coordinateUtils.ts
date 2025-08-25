import { LiquidityDataPoint } from '../types';

export const createPriceToY = (
  liquidityData: LiquidityDataPoint[], 
  tickScale: ((tick: string) => number | undefined) & {
    domain: () => string[];
    bandwidth: () => number;
    range: () => [number, number];
  }
) => {
  return (price: number): number => {
    if (!tickScale) return 0;
    
    // Find the closest liquidity data point to this price
    const closest = liquidityData.reduce((prev, curr) => 
      Math.abs(curr.price0 - price) < Math.abs(prev.price0 - price) ? curr : prev
    );
    
    // Get the Y position from the band scale and add half bandwidth for center
    const bandY = tickScale(closest.tick.toString()) || 0;
    return bandY + (tickScale.bandwidth() / 2);
  };
};

export const createYToPrice = (
  liquidityData: LiquidityDataPoint[],
  tickScale: ((tick: string) => number | undefined) & {
    domain: () => string[];
    bandwidth: () => number;
    range: () => [number, number];
  }
) => {
  return (y: number): number => {
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
  };
};