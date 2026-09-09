# CraftTS project

This project was created with `craft create`. Treat this file as the project
guide for coding agents: it records the selected runtime and feature surfaces.

## Selected configuration

- Frontend runtime: **effect**
- Backend runtime: **none**
- Type-safe i18n: **enabled**
- Design system: **enabled**
- Typed CSS: **enabled**
- Starter surface: **presentation studio domain feature**

The explanatory demo pages were removed with `npm run reset:starter`; product
work starts in `src/app/features/feature/`.

Read `.agents/skills/craft-ts-project/SKILL.md` before changing application
code. Translation keys live in `src/i18n/`; run `npm run i18n:check` and `npm run i18n:test` after changes.

## Effect boundary

- Effect v4 is enabled in the browser; use `queryEffect` and the installed Craft Effect bridge.
- The backend does not use Effect; do not add Effect dependencies or server Effects unless the runtime choice changes.
Read the Effect-specific guidance in `.agents/skills/craft-ts-effect-v4/SKILL.md`, `.claude/skills/craft-ts-effect-v4/SKILL.md`.


## Workflow

Use Craft primitives and yield every Craft reader. Keep the browser, server and
transport boundaries aligned with the selected runtimes. The architecture
suite is a graph contract: run `npm run architecture` after structural
changes, and do not add a test per feature or a rule for a smell already
covered by the baseline helpers.

## Verification

Run the checks relevant to this generated configuration:

- `npm run lint`
- `npm run typecheck`
- `npm run typecheck-spec`
- `npm run i18n:check`
- `npm run i18n:test`
- `npm run style:check`
- `npm run effect-check`
- `npm test`
- `npm run architecture`
- `npm run typecheck-architecture`
- `npm run build`

## Local source references

The following repositories are vendored with git subtree for agent context only:
- CraftTS source: `.references/craft-ts`
- EffectTS source: `.references/effect-ts`
Read `.references/effect-ts/.patterns/effect.md` for the Effect library patterns.
Use them to inspect implementations, types, tests and examples when the
installed package or project documentation is not enough. Treat these
directories as read-only reference material: do not edit them unless explicitly
asked. The application must always import CraftTS and EffectTS from the npm
dependencies declared in `package.json`; do not add TypeScript, Vite or
package `file:` aliases to these references.
