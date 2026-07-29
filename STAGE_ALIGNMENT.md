# Stage Alignment Rules

Dino Type Racer stages are full-width panning PNG backgrounds with track-specific runner coordinates in `assets/manifest.json`.

## Required image setup

- Use a PNG background at `2172 x 724` for panning stages.
- Keep the visible race viewport at `1530 x 724`.
- The camera starts at center `762, 362` and ends near `1408, 362` unless a stage needs a custom camera.
- Do not stretch or rotate the background to make it fit. Fix the painted track placement or the manifest coordinates instead.

## Coordinate system

Coordinates are Photoshop-style image coordinates:

- Top-left is `0, 0`.
- X increases to the right.
- Y increases downward.
- `lanePaths` coordinates are the center point of each `1024 x 1024` runner image, because tracks use `racerAnchor: "center"`.

## Lane path rule

Every stage needs five `lanePaths` entries:

1. Bot 1, just above the player
2. Bot 2
3. Bot 3
4. Bot 4, top/back lane
5. Player, bottom/front lane

The player lane should be the largest/front-most lane and is drawn last. The current prehistoric panning stages share one lane grid; only create a stage-specific grid when the painted road is intentionally different.

## Start and finish rule

- Start points should land on or just before the painted start line for each lane.
- Finish points should land on the painted finish line for each lane.
- If the start or finish line is slanted, each lane should have a different X value that follows that slant.
- `raceLine.startX` and `raceLine.finishX` should match the player lane, because the camera midpoint uses those values.

## Current aligned stages

`Prehistoric Winter`, `Prehistoric Wilds`, and `Prehistoric Canyon` share this lane grid:

```text
Bot 1: start 136.75,443.25 -> finish 1957.75,443.25
Bot 2: start 159.5,415.5  -> finish 1938.5,415.5
Bot 3: start 182.25,387.75 -> finish 1919.25,387.75
Bot 4: start 205,360       -> finish 1900,360
User:  start 114,471       -> finish 1977,471
```

`Prehistoric Canyon` has a lower painted track and uses its own grid:

```text
Bot 1: start 145,484 -> finish 1884,484
Bot 2: start 165,461 -> finish 1871,461
Bot 3: start 185,438 -> finish 1858,438
Bot 4: start 205,415 -> finish 1845,415
User:  start 125,507 -> finish 1897,507
```

## Before adding a stage

1. Copy the image into `assets/tracks/<track-id>/<track-id>-panning-background.png`.
2. Add the track to `assets/manifest.json` with a usable `displayName`.
3. Make a quick overlay of lane paths against the image.
4. Confirm all runners sit on the red track and finish on the painted finish line.
5. Update `tests/game.test.mjs` if the expected track list or geometry changes.
6. Run `npm test` and `npm run build`.