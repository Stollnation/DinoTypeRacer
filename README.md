# Dino Type Racer

Dino Type Racer is an original desktop-browser typing game. A new player completes a 60-second calibration, then races deterministic AI runners tuned around that saved WPM. Its Bible championship contains 10 levels of five races, with Straight and Random verse ordering, adaptive five-race pace progression, retry/next controls, and a replaceable top-three podium. It also includes Adaptive, Personal Best, and Fixed Difficulty modes plus a local passage editor with TXT import/export.

## Run locally

```powershell
npm run dev
```

Open `http://127.0.0.1:4174`. Use `npm test` for logic checks and `npm run build` to create the deployable `dist` folder. See `GITHUB_PLAY.md` for the GitHub Pages / downloaded-folder play notes.

## Netlify

This repo is ready for Netlify as a static site. Use `npm run build` as the build command and `dist` as the publish directory.

## Data

The player profile, calibration, settings, custom passages, race records, and best replay are stored only in browser local storage under `typing-race:v1`. There are no accounts, analytics, network services, or online multiplayer.

## Project map

- `assets/manifest.json` is the single registry for runners and tracks.
- `assets/characters/<id>/` contains one replaceable file per animation state.
- `assets/tracks/<id>/` contains replaceable scene layers.
- `src/typing.js` owns typing measurement.
- `src/ai.js` owns deterministic AI movement.
- `src/renderer.js` draws the race.
- `src/passages.js` validates and imports/exports passage packs.

See `ASSET_GUIDE.md` before replacing artwork.
