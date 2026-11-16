// Real Earth geometry for the globe: Natural Earth 1:110m land (world-atlas, public domain) and a
// 10-degree graticule, projected orthographically with d3-geo into SVG path data.
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryObject, Topology } from "topojson-specification";
import landTopology from "world-atlas/land-110m.json";

import type { Camera } from "./globeLayout";

const topology = landTopology as unknown as Topology<{ land: GeometryObject }>;
const LAND = feature(topology, topology.objects.land);
const GRATICULE = geoGraticule10();
const DEG = 180 / Math.PI;

/**
 * The orthographic projection matching `project()` in globeLayout: the camera at yaw/pitch looks
 * straight at longitude -yaw, latitude pitch (radians), north up, back hemisphere clipped.
 */
export function earthProjection(camera: Camera, cx: number, cy: number, radius: number) {
  return geoOrthographic()
    .scale(radius)
    .translate([cx, cy])
    .rotate([camera.yaw * DEG, -camera.pitch * DEG])
    .clipAngle(90)
    .precision(0.6);
}

/** SVG path data for the visible land and graticule from this camera. */
export function earthPaths(camera: Camera, cx: number, cy: number, radius: number) {
  const path = geoPath(earthProjection(camera, cx, cy, radius)).digits(1);
  return { land: path(LAND) ?? "", grid: path(GRATICULE) ?? "" };
}
