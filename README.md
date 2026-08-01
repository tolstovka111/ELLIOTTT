# ELLIOTTT

4real — a link-in-bio info-hub styled after the 4chan front page.

## Structure

| File | What it is |
| --- | --- |
| `index.html` | Front page: "What is 4real?" box + Boards |
| `roblox.html`, `minecraft.html` | Avatars |
| `anime.html`, `games.html` | Fav Characters |
| `random.html` | Pictures |
| `style.css` | Yotsuba-style theme |
| `script.js` | Closable intro box + board filter |
| `fonts/tahomabd.ttf` | Font used for box titles |
| `assets/` | Logo and per-page picture folders |

## Adding pictures to a sub page

Drop the files into the matching folder under `assets/` (for example
`assets/roblox/`), then add one block per picture inside the `<div class="gallery">`
of that page:

```html
<figure>
	<img src="assets/roblox/example.png" alt="Example">
	<figcaption>Example</figcaption>
</figure>
```

The "Nothing here yet." line disappears on its own once the gallery has items.

## Running locally

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.
