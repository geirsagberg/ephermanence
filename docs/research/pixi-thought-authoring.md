# Pixi thought authoring

Research question: should Thought authoring move fully into Pixi to make the
transition between draft and persisted Thought smoother?

## Findings

- PixiJS `Text` is a scene object whose browser-canvas rendering is uploaded as a
  texture. Its text can be changed at runtime, but each change re-rasterizes the
  object; that is appropriate for one authoring draft changing at typing cadence,
  not every animation frame. [PixiJS Text guide](https://pixijs.com/8.x/guides/components/scene-objects/text/canvas)
- Pixi scene objects expose position, scale, and alpha through their shared scene
  graph, so the draft bubble and persisted Thought can use one renderer and one
  ticker for their geometric transition. [PixiJS scene-object guide](https://pixijs.com/8.x/guides/components/scene-objects)
- Pixi's own accessibility support works by placing DOM elements over the canvas.
  This establishes a first-party precedent for keeping semantic controls in the DOM
  while Pixi owns their visual scene. [PixiJS accessibility guide](https://pixijs.com/8.x/guides/components/accessibility)
- Native `<textarea>` provides established multiline editing semantics and browser
  features such as maximum length, autocorrection, focus, and selection.
  [MDN `<textarea>` reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/textarea)
- Browser composition events support input-method editors. The lower-level
  `EditContext` route for custom canvas editors remains experimental and is not
  available in some widely used browsers.
  [MDN composition events](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event),
  [MDN EditContext composition events](https://developer.mozilla.org/en-US/docs/Web/API/EditContext/compositionstart_event)

## Decision

Move the authoring bubble, shadow, and geometric transitions into the Pixi scene.
Keep a visually minimal DOM `<textarea>` aligned above it as the text-input adapter.
Commit or cancel only when the exit animation completes, so the Pixi draft is
replaced by the persisted Thought on the same visual handoff rather than appearing
under a still-closing DOM bubble.

Do not build a canvas-native editor. It would replace mature browser editing and
accessibility behavior while adding no material benefit to the bubble transition.
