import { chartUpdateManager } from '../chartUpdateManager';
import { BACKGROUND_SLICE } from './backgroundSlices';
import { DRAG_HANDLES_SLICE, SOLID_PRICE_LINES_SLICE, TRANSPARENT_PRICE_LINES_SLICE } from './indicatorSlices';
import { LABELS_SLICE } from './labelSlices';
import { LIQUIDITY_BARS_SLICE, PRICE_SEGMENTS_SLICE, CURRENT_PRICE_SLICE } from './dataSlices';

// Register all update slices
export function initializeUpdateSlices(): void {
  // Order matters for visual layering, but dependencies will handle execution order
  chartUpdateManager.registerSlice(BACKGROUND_SLICE);
  chartUpdateManager.registerSlice(TRANSPARENT_PRICE_LINES_SLICE);
  chartUpdateManager.registerSlice(SOLID_PRICE_LINES_SLICE);
  chartUpdateManager.registerSlice(DRAG_HANDLES_SLICE);
  chartUpdateManager.registerSlice(LABELS_SLICE);
  chartUpdateManager.registerSlice(LIQUIDITY_BARS_SLICE);
  chartUpdateManager.registerSlice(PRICE_SEGMENTS_SLICE);
  chartUpdateManager.registerSlice(CURRENT_PRICE_SLICE);
}

// Re-export slices and classes for convenience  
export { BACKGROUND_SLICE, BACKGROUND_CLASSES } from './backgroundSlices';
export { 
  DRAG_HANDLES_SLICE,
  DRAG_HANDLE_CLASSES,
  SOLID_PRICE_LINES_SLICE,
  TRANSPARENT_PRICE_LINES_SLICE,
  TRANSPARENT_PRICE_LINE_CLASSES
} from './indicatorSlices';
export { LABELS_SLICE, LABEL_CLASSES } from './labelSlices';
export { 
  LIQUIDITY_BARS_SLICE, 
  PRICE_SEGMENTS_SLICE, 
  CURRENT_PRICE_SLICE,
  DATA_ELEMENT_CLASSES
} from './dataSlices';
export { chartUpdateManager } from '../chartUpdateManager';
export type { UpdateContext, UpdateSlice } from '../chartUpdateManager';