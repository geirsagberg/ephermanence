# Ephermanence

A spatial canvas for capturing thoughts and discovering connections by bringing them
together.

[Open Ephermanence](https://geirsagberg.github.io/ephermanence/)

## Controls

- Double-click empty space to create a thought.
- Double-click a thought to edit it; click it to select or delete it.
- Drag a thought to move its connected group. Shift-drag to move it independently and
  recalculate its connections.
- Bring thoughts into contact and release to connect them.
- Drag empty space to pan. Scroll, `+`, or `-` to zoom; `0` resets zoom.
- Press Enter to open Quick Capture. Enter saves; Shift+Enter adds a line break; Escape
  cancels.

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

Pushes to `main` are automatically deployed to GitHub Pages.

## License

[MIT](LICENSE)
