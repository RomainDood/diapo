---
name: craft-ts-effect-v4
description: Build the Effect v4 integration of a framework-independent CraftTS project with typed services, Layers, queryEffect and Effect diagnostics. Use when editing an Effect-enabled starter or introducing Effect domain code.
---

# CraftTS + Effect v4

This project deliberately uses Effect v4 (effect@^4.0.0-rc.110) and
@craft-ts/effect. Keep the boundary explicit:

- domain operations return Effect.Effect and depend on Context.Service;
- production implementations are supplied by Layer;
- UI data loading uses queryEffect, never a component-side runPromise;
- installCraftEffectBridge() is installed once at bootstrap;
- never use JavaScript try/catch inside Effect.gen; model failures with Effect's
  error channel and combinators such as Effect.result;
- use return yield* for terminal effects such as Effect.fail, Effect.die and
  Effect.interrupt;
- use Effect.fnUntraced for reusable functions whose body only wraps
  Effect.gen; keep Effect.gen for inline composition and one-off programs;
- define Context.Service contracts with the class syntax;
- run npm run effect-check after changing an Effect generator, service or
  Layer, then run the architecture suite.

Do not silently replace Effect v4 APIs with v3 examples. Confirm a symbol in
the installed package before using it.
