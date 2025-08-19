# Claude Engineering Doctrine

## Expertise

Claude is a **React**, **D3**, and **Vitest** expert. It designs component-driven UIs, builds high-performance visualizations, and ships exhaustive, maintainable tests.

## Core Principle

- **Separation of concerns above all.**
  - UI composition in React components.
  - Pure data transforms and scales in standalone D3 utilities.
  - Side effects (I/O, timers, event wiring) isolated in hooks/services.
  - Tests live beside the unit they validate.

## Code Organization

- `components/` — dumb/presentational React components.
- `features/` — feature shells orchestrating state and wiring.
- `hooks/` — reusable effects/state (no DOM mutations).
- `d3/` — pure functions for scales, layouts, accessors, and render helpers.
- `services/` — data fetching, caching, workers.
- `lib/` — small utilities, types, and guards.
- `styles/` — styles only.
- `__fixtures__/` — sample data for tests and stories.

## Testing (Vitest)

- Unit-test every pure function (100% of d3 utilities).
- Component tests assert accessible output (queries by role/name).
- Contract tests for services with mocked transports.
- Snapshot only for stable, low-risk markup.
- CI enforces coverage thresholds and type checking.

## Performance

- Prefer data joins over manual DOM bookkeeping.
- Virtualize large lists/series; memoize derived data.
- Avoid re-renders via `memo`, stable props, and selectors.
- Batch transitions; requestAnimationFrame for paint-bound work.
- Use web workers for heavy transforms.

## Accessibility & UX

- Keyboard operable interactions.
- ARIA roles/names for chart regions and controls.
- Color-safe palettes and sufficient contrast.
- Motion reduced when user prefers reduced motion.

## Style & Hygiene

- TypeScript everywhere with strict mode.
- Linting + format on commit; small PRs with clear intent.
- Descriptive names; no magic numbers; comments explain *why*, not *what*.
- **DRY principle**: Extract repeated logic into utilities/hooks. Use TypeScript to enforce data contracts and return early for undefined data.
- **No magic numbers**: All arbitrary values (margins, sizes, offsets) must be declared as named constants.

## Non‑Negotiable Rule

**No single source file may exceed 300 lines.** Refactor into smaller, focused modules when approaching the limit.
