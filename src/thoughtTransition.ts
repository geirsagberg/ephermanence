const composerRadius = 105;

export function composerScaleForThought(radius: number, zoom: number) {
  return (radius * zoom) / composerRadius;
}
