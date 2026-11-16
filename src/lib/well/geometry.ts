// Where the round pool sits inside its drawing surface, in layout pixels.
// Pool space: (0,0) is the pool centre, radius 1 is the water's edge (R pixels), +y points down.

/** Width of the marble rim in pool radii: the shader draws it from r = 1 to r = 1 + RIM. */
export const RIM = 0.15;

export interface PoolFrame {
  /** Size of the drawing surface (layout px). */
  width: number;
  height: number;
  /** Pool centre and water radius (layout px). */
  cx: number;
  cy: number;
  R: number;
}

/** The small round pool: the water fills a size × size square's circle. */
export function circleFrame(size: number): PoolFrame {
  return { width: size, height: size, cx: size / 2, cy: size / 2, R: size / 2 };
}

/**
 * The Pool tab's hero: a full-width pool so big that the top of the water runs off the top of the
 * surface (no rim there), while the marble rim curves along the bottom with a strip of night garden
 * below it. The water reaches both side edges and both top corners.
 */
export function heroFrame(width: number): PoolFrame {
  const height = Math.round(width * 1.25);
  const R = width * 0.7;
  const garden = width * 0.035;
  return { width, height, cx: width / 2, cy: height - R * (1 + RIM) - garden, R };
}

/** A layout point (px) in pool space. */
export function toPoolSpace(f: PoolFrame, x: number, y: number) {
  return { x: (x - f.cx) / f.R, y: (y - f.cy) / f.R };
}

/** Where boats may drift, in pool space: inside the water, within the visible width, below minY. */
export interface BoatBounds {
  minY: number;
  maxX: number;
  maxR: number;
}

export const OPEN_WATER: BoatBounds = { minY: -1, maxX: 1, maxR: 0.8 };

/**
 * Boat bounds for a frame. `openTop` is the layout y (px) where open water starts, e.g. just below a
 * header drawn over the pool; boats stay under it and inside the visible width.
 */
export function boatBounds(f: PoolFrame, openTop?: number): BoatBounds {
  const minY = openTop == null ? -1 : Math.max(-1, (openTop - f.cy) / f.R);
  const maxX = Math.min(1, (f.width / 2) / f.R - 0.04);
  return { minY, maxX, maxR: 0.8 };
}

/** Middle of the open water in pool space: where a coin lands when no spot was tapped. */
export function openWaterCentre(b: BoatBounds) {
  return { x: 0, y: Math.min(0.6, (Math.max(b.minY, -b.maxR) + b.maxR) / 2) };
}
