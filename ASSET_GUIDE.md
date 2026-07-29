# Replacing Dino Type Racer artwork

All artwork is original starter material and can be replaced without editing race logic. Update only the files and `assets/manifest.json`.

## Character folders

Each character has its own folder:

```text
assets/characters/<character-id>/
  <character-id>-portrait.png
  <character-id>-idle.png
  <character-id>-run.png
  <character-id>-boost.png
  <character-id>-win.png
  <character-id>-lose.png
```

Use transparent 1024 x 1024 PNG or WebP images, with the full character facing right. Keep the visible runner large enough to occupy roughly 80-90% of the square while leaving safe padding around hands, feet, hair, and clothing. Each single-frame `idle`, `run`, `boost`, `win`, and `lose` image should be 1024 x 1024. For a true run cycle, export a horizontal sprite sheet whose height is 1024 pixels and whose width is `1024 x frames`; the renderer slices the sheet into equal square frames using `frames` and `fps`. The manifest also accepts per-character `offset`, `renderSize`, `playerScale`, and `footAnchorY` adjustments. `playerScale` enlarges only the foreground human player without changing AI runner sizes. `footAnchorY` is the Y pixel, inside a 1024 x 1024 runner frame, where the visible foot/bottom contact point lands; this keeps transparent padding from making runners float above Photoshop track coordinates.

Add a character by copying an existing folder, giving it a unique lowercase ID, and adding one object to the `characters` array in `assets/manifest.json`. Every animation entry must include a file, frame count, and FPS.

## Track folders

Tracks use these independently replaceable layer slots:

```text
assets/tracks/<track-id>/
  <track-id>-background.png
  <track-id>-middle.png
  <track-id>-track.png
  <track-id>-foreground.png
  <track-id>-start-line.png
  <track-id>-finish-line.png
```

The starter track is a complete 1823 x 863 background image; unused overlay slots are `null`. To create parallax, export transparent middle, track, and foreground PNGs at the same dimensions, place them in the track folder, set their paths in the manifest, and tune the `parallax` values. Start and finish lines may also be transparent overlays.

## Wide panning tracks

A track can also be wider than the visible race window. The browser may display the game at a responsive size such as about 1242 x 586 on a 1080p monitor, but the manifest uses source-art coordinates so lane baselines stay stable on HD, 4K, and resized windows. Keep `viewportSize` at the source-art camera size for that track, then set `worldSize` to the real pixel size of the long image. The current long Prehistoric Wilds track uses a 1530 x 724 camera inside a 2172 x 724 world. The renderer scales that camera to the browser window, treats racer positions as world coordinates, then subtracts the camera offset, so the characters stay parented to the track while the view pans.

For the pan you described, use a background like 2172 x 724, 3000 x 724, 3600 x 724, 5000 x 724, or any other width wider than the scaled visible camera. The practical check is: `imageWidth / imageHeight` must be greater than the visible race-window ratio. Your screenshot is about 1242 / 586 = 2.12, so an 864px-tall image needs to be wider than about 1835px before any horizontal pan can appear. Register it in the track manifest, for example:

```json
"layers": {
  "background": "assets/tracks/prehistoric-wilds/prehistoric-wilds-panning-background.png"
},
"viewportSize": { "width": 1823, "height": 863 },
"worldSize": { "width": 3600, "height": 863 },
"camera": { "startProgress": 0.5, "ease": "smoothstep" }
```

`camera.startProgress: 0.5` means the camera waits until the player reaches about halfway across the visible window, then eases into moving the world from right to left. The current `prehistoric-wilds-panning-background.png` is registered this way from `prehistoric-wilds-stage-source-long-v01.png`. It is 2172 x 724, so it has real horizontal room beyond the 1530 x 724 camera and will visibly pan.

Camera centers are Photoshop/source coordinates, with positive Y moving down from the top-left. The camera moves smoothly from `startCenter` to `endCenter` only after the player passes the race-line midpoint; it does not stay locked to each typed character. The optional `raceLine` block defines source-art placement. For Prehistoric Wilds, the user runner starts at `114, 472` and finishes at `1977, 472`:

```json
"raceLine": { "startX": 114, "finishX": 1977, "playerBaseline": 472 },
"camera": {
  "followAfter": "midpoint",
  "ease": "smootherstep",
  "startCenter": { "x": 762, "y": 362 },
  "endCenter": { "x": 1408, "y": 362 },
  "durationMs": 2200
}
```

## Shared stage alignment contract

Prehistoric Winter, Prehistoric Wilds, and Prehistoric Canyon are registered as one panning-track family. Their backgrounds share the same image size, viewport, camera rules, and current lane grid. Use a custom `lanePaths` grid only when a new painted road is intentionally different.

Use these exact source-art values for panning stages:

- Active background image: `2172 x 724`.
- Visible camera/viewport: `1530 x 724`.
- World size: `2172 x 724`.
- Camera centers: start at `{ "x": 762, "y": 362 }`, end at `{ "x": 1408, "y": 362 }`.
- Race line: match the player lane start and finish. Current panning stages use `{ "startX": 114, "finishX": 1977 }`.
- Lane baselines, in manifest lane order: use the center point of each runner image. Current panning stages use `443.25, 415.5, 387.75, 360, 471`.
- Current panning-stage lane paths:
  - Lane 0: start `{ "x": 136.75, "y": 443.25 }`, finish `{ "x": 1957.75, "y": 443.25 }`
  - Lane 1: start `{ "x": 159.5, "y": 415.5 }`, finish `{ "x": 1938.5, "y": 415.5 }`
  - Lane 2: start `{ "x": 182.25, "y": 387.75 }`, finish `{ "x": 1919.25, "y": 387.75 }`
  - Lane 3: start `{ "x": 205, "y": 360 }`, finish `{ "x": 1900, "y": 360 }`
  - Player lane: start `{ "x": 114, "y": 471 }`, finish `{ "x": 1977, "y": 471 }`
- Racer anchor: `"center"`.
- Lane scales: all `1`.

The visual road and manifest coordinates must agree. In practice, line up the start stripe, finish/checker stripe, lane separators, top track edge, bottom track edge, and foreground border before exporting. If a stage road is lower, higher, shorter, or has the checkers in a different X position, add stage-specific lane paths and verify them with an overlay before committing.

Name new stages with a stable lowercase ID and a readable display name. Folder and file names must include the same ID, for example:

```text
assets/tracks/prehistoric-canyon/prehistoric-canyon-panning-background.png
```

Do not reuse an existing stage ID for new artwork after it has shipped; saved races refer to those IDs.

## Safe replacement checklist

1. Keep filenames lowercase and use forward slashes in the manifest.
2. Use transparent backgrounds for characters and overlay layers.
## Podium artwork

The championship podium has a CSS placeholder until final artwork is supplied. Export the finished podium scene as a wide desktop image, ideally 1400 x 660 pixels, and place it in:

`assets/ui/podium.png`

Then set `ui.podiumBackground` in `assets/manifest.json` to `"assets/ui/podium.png"`. The three winning character images remain positioned over the artwork automatically. Keep the center first-place area tallest, second place on the left, and third place on the right.

3. Keep every frame in a sprite sheet the same size and order frames left to right.
4. Avoid text inside artwork; interface labels belong in HTML.
5. Test idle, race, finish, high-contrast, and reduced-motion states after replacement.

The current starter runner images were generated with the built-in image-generation workflow using original prompts for Nova, Bolt, Moss, Ember, and Pixel. The prehistoric winter and wilds tracks were generated separately from original environment prompts. No Ratatype graphics or code are included.

## Building a 20-stage roster

The renderer loads every entry in `assets/manifest.json` and rotates stages deterministically by championship level and race number. The current build includes three panning background maps: **Prehistoric Winter**, **Prehistoric Wilds**, and **Prehistoric Canyon**. More stages require no JavaScript changes later: copy a track folder, give the track a unique ID, and append its manifest entry.

To keep every runner planted on the lanes without stretching, full-background stages and the race canvas use a consistent camera aspect ratio and these shared values:

- Lane baselines: `443.25, 415.5, 387.75, 360, 471`
- Lane scales: `1, 1, 1, 1, 1`
- The user remains on the bottom, closest lane.
- Never set an independent CSS height on the canvas. Use `width: 100%; height: auto; aspect-ratio: 1823 / 863` so the wrapper stays responsive; the renderer then sizes the backing canvas from each track's `viewportSize`.

The `prehistoric-wilds` folder is the Stage 2 reference. Its generated source, `prehistoric-wilds-source.png`, is retained beside the aligned final image, `prehistoric-wilds-background.png`, and the active camera-ready background is `prehistoric-wilds-panning-background.png`, so future variations can be edited non-destructively.

## Perfect-race celebration

The temporary Perfect image is registered as `ui.perfectCelebration` and currently points to `assets/ui/perfect-race-placeholder.svg`. Replace that file or update the manifest path to use final fireworks artwork. A perfect race means zero incorrect keypresses.
## Recognizable asset names

Every character and stage must have two names in the manifest:

- `id`: a stable lowercase asset name used by files and saved games.
- `displayName`: the readable name shown in the game and used when discussing the asset.

Current character roster: **Nova** (`nova`), **Bolt** (`bolt`), **Moss** (`moss`), **Ember** (`ember`), and **Pixel** (`pixel`).

Current stage roster: **Prehistoric Winter** (`prehistoric-winter`), **Prehistoric Wilds** (`prehistoric-wilds`), and **Prehistoric Canyon** (`prehistoric-canyon`).

Never reuse or silently rename an existing ID after release, because saved races refer to it. New artwork should receive its recognizable name before being registered.
## Generated source filenames

The game loads only the descriptively named files under `assets/`; it does not load images directly from the Codex generated-images folder. The retained originals in generated batch `019f8601-b27e-73a0-9ed4-2949f7a88d42` are also named for recognition:

- `nova-runner-source.png`
- `bolt-runner-source.png`
- `moss-runner-source.png`
- `ember-runner-source.png`
- `pixel-runner-source.png`
- `prehistoric-Winter-stage-source.png`
- `prehistoric-wilds-stage-source.png`
- `prehistoric-wilds-stage-v02.png`
- `prehistoric-wilds-stage-source_v04.png`
- `prehistoric-wilds-stage-source-long-v01.png`


