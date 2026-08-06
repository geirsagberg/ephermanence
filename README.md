# Ephermanence

A spatial canvas for capturing thoughts and discovering connections by bringing them
together.

Thoughts and their bonds are stored locally in the browser. Add `?debug` to the URL to
open the sample spatial field without reading or changing the stored field.

## Controls

- Double-click empty space to create a thought.
- Double-click a thought to edit it; click it to select or delete it.
- Drag a thought to move its connected group. Shift-drag to move it independently and
  recalculate its connections.
- Bring thoughts into contact and release to connect them.
- Drag empty space to pan. Scroll, `+`, or `-` to zoom; `0` resets zoom.
- Press Enter to create a thought at the pointer, or at the viewport center when the
  pointer is outside the spatial field. Enter saves; Shift+Enter adds a line break;
  Escape cancels.

## Development

Requires [Bun](https://bun.sh/).

```sh
bun install
bun run dev
```

```sh
bun run check
bun run test
bun run build
```

## License

[MIT](LICENSE)
