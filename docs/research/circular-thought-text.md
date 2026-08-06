# Circular thought text layout

## Findings

- PixiJS `Text` uses the browser's native text engine, rasterizing the result into a texture. Its built-in wrapping is controlled by one rectangular `wordWrapWidth`; it does not expose a circular wrapping shape. [PixiJS text guide](https://pixijs.com/8.x/guides/components/scene-objects/text)
- PixiJS 8 exposes `CanvasTextMetrics.measureText(text, style)`, including measured width, lines, and line widths. This lets custom layout use the same `TextStyle` and measurement path as the final `Text` object. [PixiJS CanvasTextMetrics API](https://pixijs.download/dev/docs/text.CanvasTextMetrics.html)
- The project uses PixiJS 8.19.0. Its `TextStyle` supports rectangular `wordWrap` and `wordWrapWidth`, so custom newlines can be rendered by disabling built-in wrapping after layout. [PixiJS 8.19 TextStyle API](https://pixijs.download/v8.19.0/docs/text.TextStyle.html)
- Splitting the label into many Pixi display objects is unnecessary. Pixi's experimental `SplitText` targets per-line, word, or character animation and loses native kerning when split into characters. [PixiJS SplitText guide](https://pixijs.com/8.x/guides/components/scene-objects/text/split-text)

## Implementation

The renderer uses one centered `Text` object. Before creating it:

1. Calculate each prospective line's available width from the horizontal chord of an inset circle.
2. Measure candidate word ranges with `CanvasTextMetrics.measureText` and the final `TextStyle`.
3. Choose the smallest line count for which every line fits, preferring word boundaries.
4. Insert newlines and disable Pixi's rectangular word wrapping.

This keeps native font shaping and one texture per thought while making the layout follow the bubble silhouette.
