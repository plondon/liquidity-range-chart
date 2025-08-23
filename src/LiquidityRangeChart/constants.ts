// Chart Color Constants
export const CHART_COLORS = {
  // Primary chart colors
  PRIMARY_PINK: '#FF37C7',
  OUT_RANGE_GREY: '#888888',
  CURRENT_PRICE_GREY: '#666666',
  
  // UI element colors
  HANDLE_STROKE: '#ffffff',
  HANDLE_FILL: '#ffffff',
  TOOLTIP_BACKGROUND: '#333333',
  TOOLTIP_TEXT: '#ffffff',
  
  // Line and boundary colors
  BOUNDARY_LINE: '#131313',
  BACKGROUND_GREY: '#f9f9f9',
  BORDER_GREY: '#ddd',
  TEXT_GREY: '#666',
  
  // Gradient colors
  GRADIENT_START: '#627EEA',
  GRADIENT_END: '#4F7DD9',
} as const;

// Chart Dimension Constants
export const CHART_DIMENSIONS = {
  // Main chart dimensions
  HEIGHT: 768,
  CHART_WIDTH: 768,
  
  // Margins and spacing
  MARGIN_LEFT: 60,
  MARGIN_RIGHT: 60,
  
  // Component spacing
  TRANSPARENT_MIN_MAX_LINE_HEIGHT: 40,
  SOLID_MIN_MAX_LINE_HEIGHT: 3,
  TOOLTIP_OFFSET: 10,
  LIQUIDITY_SECTION_OFFSET: 16,
  LIQUIDITY_BARS_SPACING: 10,
  TOOLTIP_RIGHT_MARGIN: 30,
  
  // Interactive element sizes
  HANDLE_RADIUS: 6,
  PRICE_DOT_RADIUS: 4,
  DRAG_HANDLE_SIZE: 8,
  PRICE_LABEL_OFFSET: 68,
  DRAG_BOUNDARY_MARGIN: 10,
  RANGE_INDICATOR_MIN_HEIGHT: 40,
} as const;

// Typography Constants  
export const TYPOGRAPHY = {
  LABEL_FONT_SIZE: 10,
  CONTROL_FONT_SIZE: 12,
  TOOLTIP_FONT_SIZE: 11,
  PRICE_FONT_SIZE: 12,
} as const;

// Animation Constants
export const ANIMATION = {
  TRANSITION_DURATION: 300,
  ZOOM_ANIMATION_DURATION: 500,
  PAN_ANIMATION_DURATION: 200,
  TOOLTIP_FADE_DURATION: 150,
} as const;

// Chart Behavior Constants
export const CHART_BEHAVIOR = {
  // Zoom constraints
  MIN_ZOOM: 1.0,
  MAX_ZOOM: 10,
  ZOOM_STEP: 0.2,
  
  // Pan constraints
  MIN_PAN: -0.5,
  MAX_PAN: 0.5,
  PAN_STEP: 0.1,
  
  // Data thresholds
  MIN_VISIBLE_POINTS: 10,
  MAX_TOOLTIP_DISTANCE: 20,
  
  // Performance thresholds
  LARGE_DATASET_THRESHOLD: 1000,
  VIEWPORT_BUFFER: 0.1,
} as const;

// Range Overlay Constants
export const RANGE_OVERLAY = {
  OPACITY: 0.15,
  STROKE_WIDTH: 2,
  STROKE_DASH_ARRAY: '5,5',
  MIN_HEIGHT: 20,
} as const;

// Liquidity Bar Constants
export const LIQUIDITY_BARS = {
  MIN_WIDTH: 2,
  MAX_WIDTH_RATIO: 0.8,
  OPACITY: 0.7,
  HOVER_OPACITY: 0.9,
  STROKE_WIDTH: 1,
} as const;

// Responsive Breakpoints
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1200,
} as const;

// Price Formatting Constants
export const PRICE_FORMAT = {
  DECIMAL_PLACES: 2,
  LARGE_NUMBER_THRESHOLD: 10000,
  SCIENTIFIC_NOTATION_THRESHOLD: 1000000,
} as const;