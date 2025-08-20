import { CHART_COLORS, PRICE_FORMAT } from './constants';

// Utility function to calculate allPrices - used 7 times in the component
export const calculateAllPrices = (data: Array<{value: number}>) => {
  if (!data || data.length === 0) return [];
  return data.map(d => d.value);
};

// Utility function to get price extent - eliminates optional chaining
export const getPriceExtent = (data: Array<{value: number}>) => {
  const allPrices = calculateAllPrices(data);
  if (allPrices.length === 0) return null;
  
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  return [minPrice, maxPrice];
};

// Utility function to determine color for price elements
export const getColorForPrice = (value: number, minPrice: number | null, maxPrice: number | null): string => {
  if (minPrice !== null && maxPrice !== null) {
    const isInRange = value >= minPrice && value <= maxPrice;
    return isInRange ? CHART_COLORS.PRIMARY_PINK : CHART_COLORS.OUT_RANGE_GREY;
  }
  return CHART_COLORS.OUT_RANGE_GREY;
};

// Utility function to determine opacity for price elements
export const getOpacityForPrice = (value: number, minPrice: number | null, maxPrice: number | null): number => {
  if (minPrice !== null && maxPrice !== null) {
    const isInRange = value >= minPrice && value <= maxPrice;
    return isInRange ? 0.5 : 0.2;
  }
  return 0.2;
};

// Utility function to format price values consistently
export const formatPrice = (value: number): string => {
  if (value >= PRICE_FORMAT.SCIENTIFIC_NOTATION_THRESHOLD) {
    return value.toExponential(PRICE_FORMAT.DECIMAL_PLACES);
  }
  if (value >= PRICE_FORMAT.LARGE_NUMBER_THRESHOLD) {
    return Math.round(value).toLocaleString();
  }
  return value.toFixed(PRICE_FORMAT.DECIMAL_PLACES);
};

// Utility function to check if data is valid and return early
export const validateChartData = (data: any[], liquidityData: any[]) => {
  if (!data || !liquidityData || data.length === 0 || liquidityData.length === 0) {
    return false;
  }
  return true;
};

// Utility function to calculate responsive dimensions
export const getResponsiveDimensions = (containerWidth: number) => {
  const isSmallScreen = containerWidth < 768;
  return {
    chartWidth: isSmallScreen ? containerWidth * 0.6 : 768,
    liquidityWidth: isSmallScreen ? containerWidth * 0.4 : 300,
    margin: {
      top: isSmallScreen ? 20 : 40,
      bottom: isSmallScreen ? 40 : 68,
      left: isSmallScreen ? 30 : 60,
      right: isSmallScreen ? 30 : 60,
    }
  };
};

// Utility function to find closest data point (binary search optimization)
export const findClosestDataPoint = (data: Array<{time: number, value: number}>, targetTime: number) => {
  if (!data || data.length === 0) return null;
  
  let left = 0;
  let right = data.length - 1;
  let closest = data[0];
  let minDiff = Math.abs(data[0].time - targetTime);
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const diff = Math.abs(data[mid].time - targetTime);
    
    if (diff < minDiff) {
      minDiff = diff;
      closest = data[mid];
    }
    
    if (data[mid].time < targetTime) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return closest;
};

// Utility function to filter visible liquidity data
export const filterVisibleLiquidityData = (
  liquidityData: Array<{price0: number, activeLiquidity: number}>,
  minVisiblePrice: number,
  maxVisiblePrice: number
) => {
  if (!liquidityData) return [];
  
  return liquidityData.filter(d => 
    d.price0 >= minVisiblePrice && d.price0 <= maxVisiblePrice
  );
};

// Type guard for price extent
export const isPriceExtentValid = (extent: any): extent is [number, number] => {
  return Array.isArray(extent) && extent.length === 2 && 
         typeof extent[0] === 'number' && typeof extent[1] === 'number';
};