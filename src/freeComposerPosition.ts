export type ScreenThought = {
  x: number;
  y: number;
  radius: number;
};

type FreeComposerPositionInput = {
  thoughts: ScreenThought[];
  viewport: { width: number; height: number };
  zoom: number;
};

export function findFreeComposerPosition({
  thoughts,
  viewport,
  zoom,
}: FreeComposerPositionInput) {
  const composerRadius = Math.min(105, (viewport.width - 32) / 2);
  const collisionRadius = Math.min(72 * zoom, composerRadius);
  const minX = composerRadius + 16;
  const maxX = Math.max(minX, viewport.width - composerRadius - 16);
  const minY = composerRadius + 64;
  const maxY = Math.max(minY, viewport.height - composerRadius - 132);
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);
  const preferred = {
    x: viewport.width / 2,
    y: clamp(viewport.height * 0.46, minY, maxY),
  };
  if (thoughts.length === 0) return preferred;

  const step = Math.max(24, Math.min(viewport.width, viewport.height) / 12);
  const scanAxis = (min: number, max: number) => {
    const positions = [];
    for (let position = min; position <= max; position += step) {
      positions.push(position);
    }
    if (positions.at(-1) !== max) positions.push(max);
    return positions;
  };
  const candidates = [
    preferred,
    ...scanAxis(minX, maxX).flatMap((x) => scanAxis(minY, maxY).map((y) => ({ x, y }))),
  ];
  const best = candidates.reduce(
    (currentBest, candidate) => {
      const clearance = thoughts.reduce(
        (closest, thought) =>
          Math.min(
            closest,
            Math.hypot(candidate.x - thought.x, candidate.y - thought.y) -
              thought.radius -
              collisionRadius -
              8,
          ),
        Number.POSITIVE_INFINITY,
      );
      const preferredDistance = Math.hypot(
        candidate.x - preferred.x,
        candidate.y - preferred.y,
      );
      return clearance > currentBest.clearance ||
        (clearance === currentBest.clearance &&
          preferredDistance < currentBest.preferredDistance)
        ? { position: candidate, clearance, preferredDistance }
        : currentBest;
    },
    {
      position: candidates[0],
      clearance: Number.NEGATIVE_INFINITY,
      preferredDistance: Number.POSITIVE_INFINITY,
    },
  );

  if (best.clearance < 0) {
    return { x: viewport.width / 2, y: viewport.height / 2 };
  }
  return best.position;
}
