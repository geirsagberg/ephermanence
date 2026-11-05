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
with passkeys for `http://localhost:5173`. It requires the Supabase CLI and a
Docker-compatible runtime, such as Colima.

```sh
colima start
supabase start
```

The app shows sync only when the build has a Supabase project. For local development,
add the local stack's values to `.envrc`:

```sh
export VITE_SUPABASE_URL=http://127.0.0.1:54321
export VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from `supabase status`>
```

Sign-in codes arrive in Mailpit at `http://127.0.0.1:54324`. Schema changes live in
`supabase/migrations`; apply new ones with `supabase migration up`.

The Supabase integration tests run against the local stack and are skipped without
these variables:

```sh
SUPABASE_TEST_URL=http://127.0.0.1:54321 \
SUPABASE_TEST_PUBLISHABLE_KEY=<PUBLISHABLE_KEY> \
SUPABASE_TEST_SECRET_KEY=<SECRET_KEY> \
bun run test src/sync/supabaseRemote
```

Production uses the hosted project `ulfoxuxzaqjomwnyogdg`, with passkeys for
`https://ephermanence.sagberg.net`. Vercel builds it with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` set for the Production environment.

### How sync works

Sync is optional. A device signs in with an emailed code, then creates the account's
single passkey, or uses the existing one. The passkey's PRF output unlocks a random
space key. Only an encrypted copy of that key and the encrypted space reach Supabase.
Each device keeps the space key as a non-extractable key in IndexedDB until sign-out.
Losing the passkey loses the synced space.

Each upload replaces one revision atomically. A device that falls behind merges the
remote space with its own, using the last synced space as the base, and uploads the
result. Signing out removes the space key, the session, the base and the local space.

The [secure sync capability spike](docs/spikes/secure-sync.md) describes the
development-only passkey and Supabase probes, setup, and remaining verification steps.

## Hosting

Run `bun run build` and publish the generated `dist` directory with any static hosting
provider. The app is a client-side experience and does not require a backend.

## License

[MIT](LICENSE)
