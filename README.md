# Wildlight: The Asterra League

**[Visit the Wildlight site](https://nearbycoder.github.io/wildlight/)** · **[Play the game](https://nearbycoder.github.io/wildlight/play/)**

Brinewick’s lighthouse has stopped pulsing. Follow the gold marker to Researcher Oriel, choose a field partner and practise catching the meadow Gravlet. Take the east trail to Briarbrook and read the notebook at the fork. Its chimes will draw out a local creature.

Follow nine field trails through ten habitats, win eight badges and bring Asterra’s observatory back into motion. The championship opens after the story. Explore its ten sanctuaries and build out the Field Atlas at your own pace.

## Play locally

Open **[play/index.html](play/index.html)** in a modern browser to play. The HTML file contains the region, 300 species, 108 moves, embedded pixel artwork and synthesised soundtrack. It runs offline without installation. Every species has illustrated front and rear art. The [art atlas and prompts](assets/art/README.md) document the images and how to rebuild the embedded atlas.

Use the arrow keys or WASD to walk, E or Enter to interact, Escape for the expedition menu, M for the map and Tab for your party. You can also click or tap a destination to walk there. Touch devices have a directional pad and an interaction button. In battle, press 1–4 to use a move or choose a command on screen. Read the foe’s next move, then switch a partner into a resisted hit to charge a relay. The incoming companion gains three energy and 25% power on its next successful attack.

Settings includes full-screen mode where supported, key bindings, reduced motion, battle and text speed, music and effects volume. **Artwork detail** defaults to **Auto**, which uses the higher-detail atlas on large and high-DPI displays. Choose **High detail** to use it on a smaller display, or **Classic** for the original pixel grid. Sound starts muted. Use **Save** in the expedition menu to export a portable backup or restore a previous expedition.

## GitHub Pages

The landing page is [index.html](index.html). Its scrolling field guide includes a gameplay tour, habitat artwork, evolution studies, battle mechanics, eight gym puzzles, and illustrated controls. Begin expedition opens the standalone game. Play here loads the same game inside the page on demand. GitHub Pages publishes the repository root from `main`. Relative links work both under the project URL and when browsing a local checkout.

## Browser verification

Run `node verification/verify.mjs` with Node 22 or later and Chrome or Chromium installed. Set `CHROME_PATH` to specify the browser executable. The verifier uses a disposable browser profile and refreshes the screenshots in [verification](verification/).

The automated playthrough walks through the Brinewick tutorial with keyboard and pointer input, solves the first field notebook, follows the walking routes, solves all eight gym rooms, battles the leaders and completes the observatory and championship. The collection audit uses controlled capture rolls to exercise every family, evolution method and legendary shrine in one save. Additional checks cover all nine field chime loops, all ten sanctuary entrances and exits, relay timing, touch input, rematches, guarding, conditions, defeat recovery, equipment, the move tutor, save validation and storage failures.

The front sprite sheets cover [species 001–100](verification/species-1.png), [101–200](verification/species-2.png) and [201–300](verification/species-3.png). The rear sprite sheets cover [species 001–100](verification/rear-1.png), [101–200](verification/rear-2.png) and [201–300](verification/rear-3.png). The [human cast sheet](verification/characters.png) pairs portraits with overworld sprites.

The [arena sheet](verification/arenas.png) shows the 30 battle backdrops. The [evolution field studies](verification/evolution-families.png) show eight families side by side. In the Field Atlas, select any stage to compare its anatomy and field notes.

The display checks cover standard HD, 4K, ultrawide, Retina and compact touch screens. The [4K battle capture](verification/4k-battle.png) shows the larger arena and command deck.

## Festival entry

The [contest entry notes](contest/ENTRY.md) include a ready-to-paste description, a short route for players and asset disclosures.
