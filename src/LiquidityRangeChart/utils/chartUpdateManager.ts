import * as d3 from 'd3';

export interface UpdateContext {
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  minPrice: number;
  maxPrice: number;
  priceToY: (price: number) => number;
  width: number;
  margin: { top: number; right: number; bottom: number; left: number };
  dimensions: { width: number; height: number };
  current?: number | null;
  getColorForPrice: (price: number, min: number | null, max: number | null) => string;
  getOpacityForPrice: (price: number, min: number | null, max: number | null) => number;
}

export interface DrawContext extends UpdateContext {
  xScale: d3.ScaleTime<number, number>;
  priceData: Array<{ date: Date; value: number }>;
  line: d3.Line<{ date: Date; value: number }>;
}

export interface UpdateSlice {
  name: string;
  update: (context: UpdateContext) => void;
  draw?: (context: DrawContext) => void;
  dependencies?: string[]; // Other slices that must run first
}

export class ChartUpdateManager {
  private sliceRegistry: Map<string, UpdateSlice> = new Map();

  /**
   * Register an update slice with the manager
   */
  registerSlice(slice: UpdateSlice): void {
    this.sliceRegistry.set(slice.name, slice);
  }

  /**
   * Update all registered slices in dependency order
   */
  updateAll(context: UpdateContext): void {
    const sliceNames = Array.from(this.sliceRegistry.keys());
    this.updateSlices(sliceNames, context);
  }

  /**
   * Draw all registered slices that have a draw method in dependency order
   */
  drawAll(context: DrawContext): void {
    const sliceNames = Array.from(this.sliceRegistry.keys()).filter(
      name => this.sliceRegistry.get(name)?.draw
    );
    this.drawSlices(sliceNames, context);
  }

  /**
   * Update specific slices by name in dependency order
   */
  updateSlices(sliceNames: string[], context: UpdateContext): void {
    const resolvedOrder = this.resolveDependencies(sliceNames);
    
    for (const sliceName of resolvedOrder) {
      const slice = this.sliceRegistry.get(sliceName);
      if (slice) {
        try {
          slice.update(context);
        } catch (error) {
          console.error(`Error updating slice "${sliceName}":`, error);
        }
      }
    }
  }

  /**
   * Draw specific slices by name in dependency order
   */
  drawSlices(sliceNames: string[], context: DrawContext): void {
    const resolvedOrder = this.resolveDependencies(sliceNames);
    
    for (const sliceName of resolvedOrder) {
      const slice = this.sliceRegistry.get(sliceName);
      if (slice?.draw) {
        try {
          slice.draw(context);
        } catch (error) {
          console.error(`Error drawing slice "${sliceName}":`, error);
        }
      }
    }
  }

  /**
   * Get all registered slice names
   */
  getRegisteredSlices(): string[] {
    return Array.from(this.sliceRegistry.keys());
  }

  /**
   * Resolve dependencies to determine execution order
   */
  private resolveDependencies(requestedSlices: string[]): string[] {
    const resolved: string[] = [];
    const visiting: Set<string> = new Set();
    const visited: Set<string> = new Set();

    const visit = (sliceName: string) => {
      if (visited.has(sliceName)) return;
      if (visiting.has(sliceName)) {
        throw new Error(`Circular dependency detected involving slice "${sliceName}"`);
      }

      visiting.add(sliceName);
      
      const slice = this.sliceRegistry.get(sliceName);
      if (slice?.dependencies) {
        for (const dep of slice.dependencies) {
          if (requestedSlices.includes(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(sliceName);
      visited.add(sliceName);
      resolved.push(sliceName);
    };

    for (const sliceName of requestedSlices) {
      visit(sliceName);
    }

    return resolved;
  }
}

// Create singleton instance
export const chartUpdateManager = new ChartUpdateManager();