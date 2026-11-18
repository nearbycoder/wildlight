# Wildlight: The Asterra League

**[Visit the Wildlight site](https://nearbycoder.github.io/wildlight/)** · **[Play the game](https://nearbycoder.github.io/wildlight/play/)**

Follow the gold marker to Researcher Oriel in Brinewick Village. Choose a field partner, practise catching the meadow Gravlet, then take the east trail to Briarbrook. Travel through ten habitats, build a party of six and uncover the Stilllight Society’s connection to Asterra’s dormant observatory. Win eight badges to reach the finale and the Asterra Championship.

## Play locally

Open **[play/index.html](play/index.html)** in a modern browser to play. The HTML file contains the region, 300 species, 108 moves, embedded pixel artwork and synthesised soundtrack. It runs offline without installation. Every species has illustrated front and rear art. The [art atlas and prompts](assets/art/README.md) document the images and how to rebuild the embedded atlas.

Use the arrow keys or WASD to walk, E or Enter to interact, Escape for the expedition menu, M for the map and Tab for your party. You can also click or tap a destination to walk there. Touch devices have a directional pad and an interaction button. In battle, press 1–4 to use a move or choose a command on screen. The arena stays visible while you open supplies, switch companions or read the log.

Settings includes full-screen mode where supported, key bindings, reduced motion, battle and text speed, music and effects volume. Sound starts muted. Use **Save** in the expedition menu to export a portable backup or restore a previous expedition.

## GitHub Pages

The landing page is [index.html](index.html). Its scrolling field guide includes a gameplay tour, habitat artwork, evolution studies, battle mechanics, eight gym puzzles, and illustrated controls. Begin expedition opens the standalone game. Play here loads the same game inside the page on demand. GitHub Pages publishes the repository root from `main`. Relative links work both under the project URL and when browsing a local checkout.

## Browser verification

Run `node verification/verify.mjs` with Node 22 or later and Chrome or Chromium installed. Set `CHROME_PATH` to specify the browser executable. The verifier uses a disposable browser profile and refreshes the screenshots in [verification](verification/).

The automated playthrough walks through the Brinewick tutorial with keyboard and pointer input, follows the walking routes, solves all eight gym rooms, battles the leaders and completes the observatory and championship. The collection audit uses controlled capture rolls to exercise every family, evolution method and legendary shrine in one save. Additional checks cover full-screen encounters with touch input, rematches, guarding, switching, conditions, defeat recovery, equipment, the move tutor, save validation and storage failures.

The front sprite sheets cover [species 001–100](verification/species-1.png), [101–200](verification/species-2.png) and [201–300](verification/species-3.png). The rear sprite sheets cover [species 001–100](verification/rear-1.png), [101–200](verification/rear-2.png) and [201–300](verification/rear-3.png). The [human cast sheet](verification/characters.png) pairs portraits with overworld sprites.

The [arena sheet](verification/arenas.png) shows the 30 battle backdrops. The [evolution field studies](verification/evolution-families.png) show eight families side by side. In the Field Atlas, select any stage to compare its anatomy and field notes.
