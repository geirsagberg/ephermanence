export type SpaceCamera = {
  x: number;
  y: number;
  zoom: number;
};

export type Point = { x: number; y: number };

export function screenToWorld(camera: SpaceCamera, point: Point): Point {
  return {
    x: (point.x - camera.x) / camera.zoom,
    y: (point.y - camera.y) / camera.zoom,
  };
}

export function worldToScreen(camera: SpaceCamera, point: Point): Point {
  return {
    x: point.x * camera.zoom + camera.x,
    y: point.y * camera.zoom + camera.y,
  };
}

export function zoomCameraAt(
  camera: SpaceCamera,
  pointer: Point,
  deltaY: number,
): SpaceCamera {
  const zoom = Math.max(0.3, Math.min(3, camera.zoom * Math.exp(-deltaY * 0.0015)));
  const worldPointer = screenToWorld(camera, pointer);

  return {
    x: pointer.x - worldPointer.x * zoom,
    y: pointer.y - worldPointer.y * zoom,
    zoom,
  };
}
