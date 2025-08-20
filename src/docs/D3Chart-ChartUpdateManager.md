# D3Chart Centralized Update System Documentation

## Overview

The D3Chart component uses a centralized update system that provides a consistent way to update all chart elements.

## Architecture

### ChartUpdateManager

The core of the system is the `ChartUpdateManager` class located in `/src/LiquidityRangeChart/utils/chartUpdateManager.ts`:

```typescript
export class ChartUpdateManager {
  private sliceRegistry: Map<string, UpdateSlice> = new Map();
  
  registerSlice(slice: UpdateSlice): void;
  updateAll(context: UpdateContext): void;
  updateSlices(sliceNames: string[], context: UpdateContext): void;
}
```

### UpdateContext Interface

All update functions receive a standardized context object:

```typescript
export interface UpdateContext {
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  minPrice: number;
  maxPrice: number;
  yScale: d3.ScaleLinear<number, number>;
  width: number;
  margin: { top: number; right: number; bottom: number; left: number };
  dimensions: { width: number; height: number };
  current?: number | null;
  getColorForPrice: (price: number, min: number | null, max: number | null) => string;
}
```

### Update Slices

The system is organized into focused update slices, each handling a specific type of chart element:

## Available Update Slices

### 1. Background Slice (`backgroundSlices.ts`)

**ELI5**: Updates the pink background areas and range indicator that show your selected price range.

**Elements Updated**:

- `.interactive-bg` - Invisible background for drag interactions
- `.visual-bg` - Pink overlay background  
- `.range-indicator` - Pink bar on the right side

**Class Names**:

```typescript
export const BACKGROUND_CLASSES = {
  INTERACTIVE_BG: 'interactive-bg',
  VISUAL_BG: 'visual-bg', 
  RANGE_INDICATOR: 'range-indicator'
} as const;
```

### 2. Indicator Slices (`indicatorSlices.ts`)

**ELI5**: Updates the floating rectangles, invisible drag lines, and circular drag handles.

**Elements Updated**:

- `.min-floating-indicator`, `.max-floating-indicator` - Dark grey floating rectangles
- `.min-line`, `.max-line` - Invisible horizontal drag lines  
- `.min-drag-indicator`, `.max-drag-indicator` - Circular drag handles
- `.center-drag-indicator`, `.center-drag-line` - Center drag rectangle and lines

**Class Names**:

```typescript
export const FLOATING_INDICATOR_CLASSES = {
  MIN_INDICATOR: 'min-floating-indicator',
  MAX_INDICATOR: 'max-floating-indicator'
} as const;

export const PRICE_LINE_CLASSES = {
  MIN_LINE: 'min-line',
  MAX_LINE: 'max-line'  
} as const;

export const DRAG_HANDLE_CLASSES = {
  MIN_HANDLE: 'min-drag-indicator',
  MAX_HANDLE: 'max-drag-indicator',
  CENTER_HANDLE: 'center-drag-indicator', 
  CENTER_LINES: 'center-drag-line'
} as const;
```

### 3. Label Slice (`labelSlices.ts`)

**ELI5**: Updates the text labels that show your actual min and max prices.

**Elements Updated**:

- `.min-label` - "Min: 2500" text
- `.max-label` - "Max: 3000" text

**Class Names**:

```typescript
export const LABEL_CLASSES = {
  MIN_LABEL: 'min-label',
  MAX_LABEL: 'max-label'
} as const;
```

### 4. Data Slices (`dataSlices.ts`)

**ELI5**: Updates colors of liquidity bars, price line segments, and current price dot based on whether they're in your selected range.

**Elements Updated**:

- `.liquidity-bar` - Horizontal liquidity bars (pink/grey)
- `.price-segment` - Price line segments (pink/grey)  
- `.current-price-dot` - Current price indicator dot

**Class Names**:

```typescript
export const DATA_ELEMENT_CLASSES = {
  LIQUIDITY_BAR: 'liquidity-bar',
  PRICE_SEGMENT: 'price-segment',
  CURRENT_PRICE_DOT: 'current-price-dot'
} as const;
```

## Usage Patterns

### Full Update (Default Usage)

Most drag interactions should use the full update to ensure consistency:

```typescript
chartUpdateManager.updateAll({
  g,
  minPrice: newMinPrice,
  maxPrice: newMaxPrice,
  yScale,
  width,
  margin,
  dimensions,
  current,
  getColorForPrice
});
```

### Selective Updates (Performance Optimization)

For performance-critical scenarios where only specific elements changed:

```typescript
chartUpdateManager.updateSlices(['floatingIndicators', 'labels'], context);
```

## Adding New Update Slices

### Step 1: Create the Slice

Create a new slice following the established pattern:

```typescript
// /src/LiquidityRangeChart/utils/updateSlices/myNewSlice.ts

import { UpdateSlice } from '../chartUpdateManager';

// Class names for your elements
export const MY_ELEMENT_CLASSES = {
  MY_INDICATOR: 'my-indicator-class',
  MY_CONTROL: 'my-control-class'
} as const;

/**
 * ELI5: This slice updates [describe what your elements do in simple terms].
 * [Explain when and why these elements change.]
 */
export const MY_NEW_SLICE: UpdateSlice = {
  name: 'myNewElements',
  update: (ctx) => {
    const { g, minPrice, maxPrice, yScale } = ctx;
    
    // Update your elements
    g.select(`.${MY_ELEMENT_CLASSES.MY_INDICATOR}`)
      .attr('y', yScale(minPrice))
      .attr('fill', someColor);
      
    g.select(`.${MY_ELEMENT_CLASSES.MY_CONTROL}`)
      .attr('cx', someCalculation(minPrice, maxPrice));
  },
  dependencies: ['backgrounds'] // Optional: other slices that must run first
};
```

### Step 2: Register the Slice

Add your slice to `/src/LiquidityRangeChart/utils/updateSlices/index.ts`:

```typescript
import { MY_NEW_SLICE, MY_ELEMENT_CLASSES } from './myNewSlice';

export function initializeUpdateSlices(): void {
  // ... existing slices
  chartUpdateManager.registerSlice(MY_NEW_SLICE);
}

// Export for use in D3Chart
export { MY_NEW_SLICE, MY_ELEMENT_CLASSES } from './myNewSlice';
```

### Step 3: Use Class Names in D3Chart

```typescript
import { MY_ELEMENT_CLASSES } from './utils/updateSlices';

g.append('circle')
  .attr('class', `price-range-element ${MY_ELEMENT_CLASSES.MY_INDICATOR}`)
```

### Step 4: Update Dependencies (If Needed)

If your slice depends on other slices running first, specify dependencies:

```typescript
export const MY_NEW_SLICE: UpdateSlice = {
  name: 'myNewElements',
  update: (ctx) => { /* ... */ },
  dependencies: ['backgrounds', 'indicators'] // Run after these
};
```

## File Structure

```
src/LiquidityRangeChart/
├── utils/
│   ├── chartUpdateManager.ts          # Core update manager
│   ├── updateSlices/                  # Individual update slices
│   │   ├── backgroundSlices.ts        # Background and range indicators
│   │   ├── indicatorSlices.ts         # Floating indicators and drag handles  
│   │   ├── labelSlices.ts            # Price labels
│   │   ├── dataSlices.ts             # Data visualization elements
│   │   └── index.ts                  # Registration and exports
├── D3Chart.tsx                       # Uses centralized updates
└── docs/
    └── refactor.md                   # This documentation
```

## Best Practices

### Do ✅

- Use `chartUpdateManager.updateAll()` for most drag interactions
- Create focused slices that handle related elements
- Include ELI5 comments explaining what your slice does
- Export class name constants to avoid magic strings
- Specify dependencies when slice ordering matters

### Don't ❌

- Mix update logic - keep it in slices only
- Create overly broad slices that do too many things
- Forget to register your slice in `index.ts`
- Use hardcoded class strings instead of constants
