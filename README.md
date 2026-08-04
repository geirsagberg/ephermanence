# Spacephemeral prototype

A throwaway UI prototype exploring one product question: **can capture feel nearly
effortless while touch, hold, and pull make relationships understandable?**

Three structurally different reflection spaces live on the same route:

- `?variant=A` — Drift: canvas-first, almost no chrome
- `?variant=B` — Landing: new thoughts arrive in a quiet side rail
- `?variant=C` — Focus: reflection begins with one thought at a time

## Run

```sh
bun install
bun run dev
```

Drag an isolated thought to move it. Bring it into contact with another and hold to
attach. A connected group moves together. Press and hold a connected thought, then
pull it away to separate it. Use **Quick capture** to add a thought without placing
or organizing it.

This code is deliberately marked as a prototype. Once a direction wins, rewrite the
chosen interaction as production code and remove the variants and switcher.
