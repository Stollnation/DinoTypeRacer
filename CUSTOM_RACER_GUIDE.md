# Custom Racer artwork guide

Custom Racer Workshop is designed for parents, tutors, and players who want to race with their own art without editing game code.

## Recommended file

- Canvas: **1024 × 1024 pixels**.
- Format: transparent PNG is best; WebP and JPEG are accepted.
- Direction: face toward the right.
- Placement: center the racer around **X 512** and place the feet at **Y 856**.
- Safety area: leave transparent space around hats, wings, tails, and other details.
- File size: 12 MB or less.

The Workshop automatically crops unused transparency, fits the visible artwork, and places its lowest visible point on the race foot line. Size and horizontal/vertical offset controls provide the final adjustment.

## Removing a background

Choose **Already transparent** when the file has an alpha channel. Choose **Remove hot pink** when the artwork is on a solid `#ff00ff` background. Increase Pink tolerance if a fringe remains; decrease it if pink details in the character disappear.

## Storage and privacy

The processed 1024 × 1024 PNG is stored in IndexedDB on the current browser. It is associated with the active player profile and is not uploaded to a server. Clearing browser site data removes it. Version one uses the same pose for idle, run, boost, win, and lose; a future animation pack can accept five separate poses without changing the race renderer.
