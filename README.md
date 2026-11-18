# Wildlight: The Asterra League

**[Visit the Wildlight site](https://nearbycoder.github.io/wildlight/)** · **[Play the game](https://nearbycoder.github.io/wildlight/play/)**

Begin in Brinewick Village with a leaf-eared fawn, a ceramic-armoured burrower or a quick little shorebird. Travel through ten habitats, build a party of six and uncover the Stilllight Society’s connection to Asterra’s dormant observatory. Win eight badges to reach the finale and the Asterra Championship.

## Play locally

Open **[play/index.html](play/index.html)** in a modern browser to play. The HTML file contains the entire game, including the region, 300 species, 108 moves, pixel artwork and synthesised soundtrack. It runs offline without installation.

Use the arrow keys or WASD to walk, E or Enter to interact, Escape for the expedition menu, M for the map and Tab for your party. You can also click or tap a destination to walk there. Touch devices have a directional pad and an interaction button.

Settings includes full-screen mode where supported, key bindings, reduced motion, text speed, music and effects volume. Sound starts muted. Use **Save** in the expedition menu to export a portable backup or restore a previous expedition.

## GitHub Pages

The landing page is [index.html](index.html). Its field guide uses artwork rendered by the game. The Play buttons open the standalone game in the same tab. GitHub Pages publishes the repository root from `main`. Relative links work both under the project URL and when browsing a local checkout.

## Browser verification

Run `node verification/verify.mjs` with Node 22 or later and Chrome or Chromium installed. Set `CHROME_PATH` to specify the browser executable. The verifier uses a disposable browser profile and refreshes the screenshots in [verification](verification/).

The automated playthrough follows the walking routes, solves all eight gym rooms, battles the leaders and completes the observatory and championship. The collection audit uses controlled capture rolls to exercise every family, evolution method and legendary shrine in one save. Additional checks cover rematches, switching, conditions, defeat recovery, equipment, the move tutor, mobile touch input, save validation and storage failures.

The contact sheets show [species 001–100](verification/species-1.png), [101–200](verification/species-2.png), [201–300](verification/species-3.png) and the [human cast](verification/characters.png).

The [evolution field studies](verification/evolution-families.png) show eight families side by side. In the Field Atlas, select any stage to compare its anatomy and field notes.
