# Passage Group Guide

This guide explains how Dino Type Racer passage/challenge groups work and how to add new groups safely.

## Core idea

A group is the `category` field on a passage. There is no separate group model.

```js
{
  id: "space-01",
  title: "Launch Day",
  category: "Space Adventure",
  source: "Original Space Drill",
  enabled: true,
  text: "A valid passage needs at least thirty characters."
}
```

Every enabled passage with the selected `category` becomes part of that challenge group.

## Files to edit

- `src/config.js`
  - Add built-in passage arrays.
  - Add arrays to `STARTER_PASSAGES`.
- `src/app.js`
  - Update `passageCategories()` for picker ordering.
  - Update `installBundledPassages()` and `data.libraryVersion` when existing saves should receive the new group.
  - Update `normalizeBuiltInPassageData()` for category renames or built-in cleanup.
- `tests/game.test.mjs`
  - Add group count and validity assertions.

## Current built-in ordering

`src/app.js` sorts categories with this preferred order:

1. `Biblical Passages`
2. `Typing Basics`
3. `Typing Intermediate`
4. `Typing Advanced`
5. `General`
6. `Movie Quotes`
7. `Books`
8. `Lord of the Rings Quotes`

Unlisted categories appear after those groups and sort alphabetically.

## Naming conventions

- Category: human-readable, title case, user-facing.
  - Good: `Space Adventure`
  - Avoid: `space-adventure`
- IDs: lowercase, stable, hyphenated, numbered.
  - Good: `space-01`, `space-02`
- Titles: readable names shown in the library and race screen.
- Text: 30 to 5,000 normalized characters.
- Source: recommended for every themed group.

## Migration rules

Fresh installs use `STARTER_PASSAGES` from `src/config.js`.

Existing saves are updated by `installBundledPassages()` in `src/app.js`. If existing players should receive a new built-in group, bump the built-in passage `libraryVersion` gate and final assignment together.

Current migration shape:

```js
if ((data.libraryVersion || 0) >= 5) {
  normalizeBuiltInPassageData();
  loadActiveProfileLibrary();
  return;
}
```

For the next bundled group migration, change `5` to `6` in the gate and set `data.libraryVersion = 6` after installing. The installer dedupes by lowercased `category|title` and applies additions to both the active library and every saved profile library.

Do not bump `version` in `src/storage.js` for ordinary passage additions. That is the local-storage schema version, not the starter-library content version.

## Tests to add

For a new 50-passage built-in group:

```js
assert.equal(STARTER_PASSAGES.filter((item) => item.category === "Space Adventure").length, 50);
assert.ok(STARTER_PASSAGES.filter((item) => item.category === "Space Adventure").every((item) => item.source));
```

Also keep this existing broad guarantee passing:

```js
assert.ok(STARTER_PASSAGES.every((item) => item.text.length >= 30));
```

For TXT import/export groups, add or update tests around `[Category]` sections in `src/passages.js`.

## Quick checklist

1. Add the group passages in `src/config.js`.
2. Spread the group into `STARTER_PASSAGES`.
3. Add the category to `passageCategories()` if it needs a fixed picker position.
4. Bump `data.libraryVersion` only if existing saves should get the group.
5. Add tests in `tests/game.test.mjs`.
6. Run `node --test --test-isolation=none tests\\game.test.mjs` or `npm test` if the package script exists.
