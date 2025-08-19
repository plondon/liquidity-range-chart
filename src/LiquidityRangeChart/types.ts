export type PriceDataPoint = {
  time: number;
  value: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type LiquidityDataPoint = {
  activeLiquidity: number;
  price0: number;
  tick: number;
  amount0Locked: number;
  amount1Locked: number;
};