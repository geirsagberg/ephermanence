# Ephermanence

Ephermanence is a spatial canvas for capturing thoughts and discovering relationships
through proximity and movement.

Thoughts can be arranged freely and brought together to form visible bonds. The space
is stored locally in the browser, keeping the experience private and immediate.

## Development

Development requires [Bun](https://bun.sh/).

```sh
bun install
bun run dev
```

```sh
bun run check
bun run test
bun run build
```

Add `?debug` to the local URL to open the sample spatial field without reading or
changing the stored field.

## Hosting

Run `bun run build` and publish the generated `dist` directory with any static hosting
provider. The app is a client-side experience and does not require a backend.

## License

[MIT](LICENSE)
