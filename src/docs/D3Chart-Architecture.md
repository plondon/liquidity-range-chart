# D3Chart Component Architecture Documentation

## Overview

The D3Chart component is a sophisticated **TradingView-style financial charting system using D3** that combines price visualization with interactive liquidity depth analysis. This is a **DeFi (Decentralized Finance) trading interface** specifically designed for displaying cryptocurrency price movements alongside liquidity pool data.

## Purpose & Use Case

This chart is used for:

- **Price Analysis**: Displaying time-series cryptocurrency price data with interactive zoom/pan
- **Liquidity Visualization**: Showing liquidity depth at different price levels
- **Range Selection**: Allowing users to select and analyze specific price ranges

## Key Features

### 1. **Dual-Panel Layout**

- **Left Panel**: Time-series price line chart with temporal data
- **Right Panel**: Liquidity depth bars showing available liquidity at each price point

### 2. **Interactive Price Range Selection**

- **Visual Selection**: Transparent background overlay indicating selected price range
- **Drag-to-Move**: Entire range can be dragged up/down
- **Individual Boundaries**: Min/max lines can be dragged independently
- **Smart Line Crossing**: Automatic swap when min crosses above max
- **Data Bounds Constraints**: Prevents selection outside available data

### 3. **Advanced Navigation**

- **Zoom Controls**: In/Out/Reset with smooth animations
- **Pan Support**: Scroll-to-pan vertical navigation
- **Center Range**: Auto-center and zoom to fit selected range

### 4. **Real-time Price Indicators**

- **Current Price Line**: Dotted horizontal line across entire chart
- **Price Dot**: Colored indicator at last data point
- **Dynamic Coloring**: Pink (in-range) / Grey (out-range) / Blue (no range)
- **Price Labels**: Min/Max/Current values with auto-formatting

### 5. **Liquidity Depth Integration**

- **Horizontal Bars**: Width represents liquidity amount at each price
- **Color Coding**: Pink bars for in-range liquidity, grey for out-range
- **Hover Tooltips**: Detailed liquidity information with connecting lines
- **Performance Optimization**: Only renders visible liquidity data

## Data Requirements

### Input Data Structure

```javascript
// Price Data (time series)
data: [
  { time: 1640995200, value: 50000.0 }, // Unix timestamp, price value
  // ... more price points
]

// Liquidity Data (depth)
liquidityData: [
  { 
    price0: 49500.0,           // Price level
    activeLiquidity: 1250000,  // Amount of liquidity
    amount0Locked: 125.5       // Locked amount (for tooltip)
  },
  // ... more liquidity points
]
```

## Architecture Patterns

### 1. **Separation of Concerns**

- **Pure D3 Utilities** (`/d3/`): Calculations, scales, transformations
- **Custom Hooks** (`/hooks/chart/`): Effect-based rendering logic  
- **Main Component**: State management and orchestration
- **No Mixed Responsibilities**: Clean boundaries between calculation and rendering

### 2. **State Management Architecture**

```javascript
useChartState() {
  zoomLevel,     // 1.0 = normal, >1 = zoomed in
  panY,          // -0.5 to 0.5, vertical pan offset
  minPrice,      // Selected range minimum (null = no selection)
  maxPrice       // Selected range maximum (null = no selection)
}
```

## Performance Optimizations

### 1. **Data Filtering**

- Only processes liquidity data within visible price range
- Dynamic scale calculation based on visible data
- Binary search for closest data point lookup

### 2. **D3 Data Joins**

- Enter/Update/Exit pattern for efficient DOM manipulation
- Smooth transitions instead of full re-renders
- Keyed data binding for consistent updates

### 3. **Memoization**

- `yScale` calculated in `useMemo` for reuse across hooks
- Price data conversion cached
- Responsive margin calculations

## Interaction Patterns

### 1. **Drag Behaviors**

- **Range Background**: Drag entire range up/down
- **Individual Lines**: Drag min/max boundaries
- **Constraint Logic**: Prevents invalid states and out-of-bounds

### 2. **Mouse Interactions**

- **Liquidity Hover**: Tooltip with liquidity details
- **Scroll Pan**: Vertical panning through price range
- **Click Controls**: Zoom buttons, range inputs, reset actions

### 3. **Touch Support**

- Mobile-optimized touch interactions
- `touchAction: 'manipulation'` for performance
- Responsive control sizing

## Color Scheme & Visual Design

### Colors

- **Blue (#2196F3)**: Default price line, no range selected
- **Pink (#d63384)**: In-range elements (line segments, liquidity bars, handles)
- **Grey (#888888)**: Out-of-range elements
- **Light Pink (#ff69b4)**: Range overlay background (15% opacity)
- **Dark Grey (#666666)**: Current price line and label

### Typography

- **10px**: Labels and small text
- **12px**: Controls and main interface text
- **Bold**: Price values and important labels

## Critical Dependencies

- **React Hooks**: `useState`, `useEffect`, `useMemo`, `useRef`
- **D3.js**: Scales, line generators, drag behaviors, DOM manipulation
- **Custom Utilities**: Binary search, animation helpers, responsive dimensions

## Known Challenges & Solutions

### 1. **Hook Execution Order**

- **Problem**: Hooks tried to render before SVG structure existed
- **Solution**: `useSvgSetup` hook runs first, other hooks wait for group existence

### 2. **Scale Dependencies**

- **Problem**: `yScale` needed by hooks but calculated after them
- **Solution**: Moved `yScale` calculation before hook calls

### 3. **Performance with Large Datasets**

- **Problem**: Rendering all liquidity data caused lag
- **Solution**: Viewport-based filtering and data joins

### 4. **Mobile Responsiveness**

- **Problem**: Controls too small on mobile devices
- **Solution**: Responsive margins, larger touch targets, adapted layouts

## Future Considerations

### Potential Improvements

1. **Virtualization**: For very large datasets (>10,000 points)
2. **Web Workers**: Move heavy calculations off main thread
3. **Canvas Rendering**: For better performance with massive data
4. **Accessibility**: ARIA labels, keyboard navigation
5. **Component Extraction**: Continue breaking down into focused components

### Maintenance Notes

- **File Size Limit**: Keep main component under 300 lines (CLAUDE.md)
- **Testing**: Each D3 utility should have unit tests
- **Performance**: Monitor bundle size and runtime performance
- **Accessibility**: Ensure color contrast and keyboard navigation

This chart represents a sophisticated financial visualization tool optimized for DeFi trading interfaces, with careful attention to performance, user experience, and maintainable architecture.
