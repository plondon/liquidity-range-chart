/**
 * Convert GBM-based confidence bands to Uniswap-style ticks.
 * User supplies: p0, T (years), sigma (annual vol), mu (annual drift), alpha, decimals d0/d1.
 * Output: { pl, pu, tickLower, tickUpper } with optional tickSpacing snapping.
 */

// Math utilities
function ln(x: number): number {
  if (x <= 0) throw new Error("log/ln domain error: x must be > 0");
  return Math.log(x);
}

function exp(x: number): number {
  return Math.exp(x);
}

// Acklam's inverse normal CDF approximation (double precision)
// https://web.archive.org/web/20150910044717/http://home.online.no/~pjacklam/notes/invnorm/
function normInv(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    throw new Error("normInv domain error: p must be in (0,1)");
  }

  const a = [
    -3.969683028665376e+01,
     2.209460984245205e+02,
    -2.759285104469687e+02,
     1.383577518672690e+02,
    -3.066479806614716e+01,
     2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01,
     1.615858368580409e+02,
    -1.556989798598866e+02,
     6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
     4.374664141464968e+00,
     2.938163982698783e+00
  ];
  const d = [
     7.784695709041462e-03,
     3.224671290700398e-01,
     2.445134137142996e+00,
     3.754408661907416e+00
  ];

  // Define break-points.
  const PLOW = 0.02425;
  const PHIGH = 1 - PLOW;
  let q: number, r: number;

  if (p < PLOW) {
    // Rational approximation for lower region
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
           ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  } else if (PHIGH < p) {
    // Rational approximation for upper region
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
             ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  } else {
    // Rational approximation for central region
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q /
           (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
  }
}

export interface PriceBandParams {
  p0: number;     // Current price (token1 per token0, Uniswap convention)
  T: number;      // Horizon in years (e.g. 7/365 for one week)
  sigma: number;  // Annualized volatility (e.g. 0.8 = 80%)
  mu?: number;    // Annualized drift (optional, default 0)
  alpha?: number; // Two-sided tail probability (default 0.05 => 95% CI)
}

export interface PriceBandResult {
  pl: number;
  pu: number;
  zLow: number;
  zHigh: number;
}

/**
 * Compute (pl, pu) confidence band for price under GBM over horizon T (years).
 */
export function computePriceBands(params: PriceBandParams): PriceBandResult {
  const { p0, T, sigma, mu = 0, alpha = 0.05 } = params;
  
  if (!(p0 > 0)) throw new Error("p0 must be > 0");
  if (!(T >= 0)) throw new Error("T must be >= 0");
  if (!(sigma >= 0)) throw new Error("sigma must be >= 0");
  if (!(alpha > 0 && alpha < 1)) throw new Error("alpha must be in (0,1)");

  const drift = (mu - 0.5 * sigma * sigma) * T;
  const volT  = sigma * Math.sqrt(T);

  // two-sided: [alpha/2, 1 - alpha/2]
  const zLow  = normInv(alpha / 2);
  const zHigh = normInv(1 - alpha / 2);

  const pl = p0 * exp(drift + zLow  * volT);
  const pu = p0 * exp(drift + zHigh * volT);

  return { pl, pu, zLow, zHigh };
}

/**
 * Convert a price to a (floating) tick using Uniswap convention with decimals.
 * tick = (ln(p) - ln(10^(d0 - d1))) / ln(1.0001)
 */
export function priceToTick(p: number, d0: number, d1: number): number {
  if (!(p > 0)) throw new Error("price must be > 0");
  const scale = Math.pow(10, d0 - d1);
  return (ln(p) - ln(scale)) / ln(1.0001);
}

/**
 * Convert a tick to price given decimals.
 * p = 10^(d0 - d1) * (1.0001)^tick
 */
export function tickToPrice(tick: number, d0: number, d1: number): number {
  const scale = Math.pow(10, d0 - d1);
  return scale * Math.pow(1.0001, tick);
}

type SnapMode = "round" | "floor" | "ceil";

/**
 * Snap a (floating) tick to the nearest valid tick based on tickSpacing.
 */
export function snapTick(tick: number, tickSpacing: number, mode: SnapMode = "round"): number {
  if (!(Number.isInteger(tickSpacing) && tickSpacing > 0)) {
    throw new Error("tickSpacing must be a positive integer");
  }
  const t = Math.round(tick); // V3 ticks are integers
  const q = t / tickSpacing;
  let snapped: number;
  if (mode === "floor") snapped = Math.floor(q) * tickSpacing;
  else if (mode === "ceil") snapped = Math.ceil(q) * tickSpacing;
  else snapped = Math.round(q) * tickSpacing; // "round"
  return snapped;
}

export interface BandsAndTicksParams extends PriceBandParams {
  d0: number;
  d1: number;
  tickSpacing?: number;  // optional; when provided, ticks are snapped
  snapMode?: SnapMode;
}

export interface BandsAndTicksResult {
  pl: number;
  pu: number;
  tickLower: number;
  tickUpper: number;
  tickLowerSnapped?: number;
  tickUpperSnapped?: number;
}

/**
 * Given (p0, T, sigma, mu, alpha, d0, d1), produce price bands and ticks.
 * Optionally snap to a tickSpacing.
 */
export function computeBandsAndTicks(params: BandsAndTicksParams): BandsAndTicksResult {
  const { p0, T, sigma, mu = 0, alpha = 0.05, d0, d1, tickSpacing, snapMode = "round" } = params;

  const { pl, pu } = computePriceBands({ p0, T, sigma, mu, alpha });

  const tickLower = priceToTick(pl, d0, d1);
  const tickUpper = priceToTick(pu, d0, d1);

  const result: BandsAndTicksResult = { pl, pu, tickLower, tickUpper };

  if (tickSpacing != null) {
    result.tickLowerSnapped = snapTick(tickLower, tickSpacing, snapMode);
    result.tickUpperSnapped = snapTick(tickUpper, tickSpacing, snapMode);
  }

  return result;
}

// Convenience: time helpers
export const Years = {
  fromDays: (d: number): number => d / 365,
  fromWeeks: (w: number): number => (7 * w) / 365,
  fromMonths: (m: number): number => (30.4375 * m) / 365, // avg month length
};

// Default parameters for common use cases
export const DEFAULT_SIGMA = 0.8; // 80% annualized volatility
export const DEFAULT_ALPHA = 0.05; // 95% confidence interval
export const DEFAULT_MU = 0; // zero drift assumption

// Calculate mu and sigma from price data
export function calculateMuAndVolatility(priceData: { value: number }[]): { mu: number; sigma: number } {
  // Extract price values
  const prices = priceData.map(p => p.value);
  
  if (prices.length < 2) {
    throw new Error("Need at least 2 price points to calculate returns");
  }
  
  // Calculate log returns: ln(P_t / P_{t-1}) = ln(P_t) - ln(P_{t-1})
  const logReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    logReturns.push(Math.log(prices[i]) - Math.log(prices[i - 1]));
  }
  
  // Calculate mean return
  const meanReturn = logReturns.reduce((sum, ret) => sum + ret, 0) / logReturns.length;
  
  // Calculate variance manually (since we don't have a standard library)
  const variance = logReturns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / logReturns.length;
  const volatility = Math.sqrt(variance);
  
  // Annualize the parameters
  // 4-hourly data: 6 periods per day, 6 * 365.25 = 2191.5 periods per year
  const periodsPerYear = 6 * 365.25;
  
  const mu = meanReturn * periodsPerYear;
  const sigma = volatility * Math.sqrt(periodsPerYear);
  
  return { mu, sigma };
}
