export type PriceDataPoint = {
  time: number;
  price: number;
};

export type LiquidityDataPoint = {
  activeLiquidity: number;
  price0: number;
  tick: number;
  amount0Locked: number;
  amount1Locked: number;
};