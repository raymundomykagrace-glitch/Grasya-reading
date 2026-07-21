# Grasya-reading
Html to reading

## Storybook reader

The `book/` folder contains a self-contained HTML "storybook" reader for
*He's Into Her* by maxinejiji (Seasons 1–3, ~240 chapters), converted from
the original `.txt` files.

Open `book/index.html` in a browser (or serve the `book/` folder) to read.
Features:

- Tap the chapter menu (☰) to browse/search all chapters across all 3 seasons.
- Tap **Aa** to open reading settings: font family, font size, line spacing,
  background/text color (presets or custom colors), text alignment, and
  reading width.
- Settings and your last-read chapter are saved in the browser (localStorage),
  so they persist between visits.
- Previous/Next chapter buttons and left/right arrow keys for navigation.

Chapter text lives in `book/data/season{1,2,3}.js`, generated from the
original text files by splitting on the `=================` section
markers used in the source.
