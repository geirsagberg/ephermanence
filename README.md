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

Run `bash scripts/install-hooks.sh` once per clone to install the shared
post-checkout hook. New worktrees copy `.envrc` from the first checkout that has
one (the main checkout is checked first), leaving an existing destination alone.
The file is gitignored. Run `direnv allow` in the new worktree to trust it.

Add `?debug` to the local URL to open the sample spatial field without reading or
changing the stored field.

Sync development uses a local Supabase stack configured in `supabase/config.toml`,
with passkeys for `http://localhost:5173`. It requires a Docker-compatible runtime.

```sh
bunx supabase start
```

Production uses the hosted project `ulfoxuxzaqjomwnyogdg`, with passkeys for
`https://ephermanence.sagberg.net`.

The [secure sync capability spike](docs/spikes/secure-sync.md) describes the
development-only passkey and Supabase probes, setup, and remaining verification steps.

## Hosting

Run `bun run build` and publish the generated `dist` directory with any static hosting
provider. The app is a client-side experience and does not require a backend.

## License

[MIT](LICENSE)
