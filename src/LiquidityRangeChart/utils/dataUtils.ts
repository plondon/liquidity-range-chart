import { LiquidityDataPoint } from "LiquidityRangeChart/types";

// Cache for price data lookups
const priceDataCache = new Map<string, LiquidityDataPoint>();

export function findClosestElementBinarySearch(data: LiquidityDataPoint[], target: number) {
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