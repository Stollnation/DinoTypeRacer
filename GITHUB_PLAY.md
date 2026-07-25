# Play Dino Type Racer from GitHub

Dino Type Racer is a static browser game. It does not need a database or backend server.

## Best option: GitHub Pages

GitHub Pages is the cleanest way to play it without running a local server yourself. GitHub serves the files over `https://`, so browser module loading and asset fetches work normally.

1. Create a new GitHub repository for this folder, for example `DinoTypeRacer`.
2. Commit the contents of the `TypingRace` folder as the root of that repository.
3. Run the build locally when you want to publish:

```powershell
npm install
npm run build
```

4. Publish the `dist` folder with GitHub Pages, or use a GitHub Pages workflow that builds and uploads `dist`.
5. Open the Pages URL in any modern desktop browser.

## Downloaded folder behavior

Opening `index.html` directly with `file://` is not reliable for this project because browsers restrict local JavaScript modules and local `fetch()` calls. That is why local testing uses a tiny static server.

That server is not game infrastructure. It only lets the browser load the same files that GitHub Pages would serve online.

## Offline options

If the game needs to run from a downloaded folder with no server at all, add a separate offline build that bundles the JavaScript and embeds or rewrites asset loading. That can be done later, but the GitHub Pages route is simpler and cleaner for regular play.