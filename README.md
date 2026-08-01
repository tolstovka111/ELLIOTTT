# ELLIOTTT

4real — a link-in-bio info-hub styled after the 4chan front page.

## Structure

| File | What it is |
| --- | --- |
| `index.html` | Front page: "What is 4real?" box, Boards, Stats, footer |
| `roblox.html`, `minecraft.html` | Avatars |
| `anime.html`, `games.html` | Fav Characters |
| `random.html` | Pictures |
| `faq.html`, `rules.html`, `blog.html` | Pages behind the FAQ / Rules / Blog buttons |
| `style.css` | Yotsuba-style theme |
| `script.js` | Intro box, board filter, gallery state, view counter |
| `api/views.php` | Unique-visitor counter endpoint |
| `fonts/tahomabd.ttf` | Font used for box titles |
| `assets/` | Logo and per-page picture folders |

## View counter

`api/views.php` counts **unique visitors, not page loads**. On each request it
hashes the visitor address with a per-installation random salt and stores the
hash in `api/data/views.json`. An address that is already in the file does not
increase the total, so reloading the page cannot inflate the counter. The raw
address is never written to disk.

Requirements: PHP 7.4+ with write access to the `api/` directory. The `api/data`
directory is created on the first request and is not committed to git.

If the site sits behind Cloudflare or another reverse proxy, `REMOTE_ADDR` is the
proxy, so set the environment variable `VIEWS_TRUST_PROXY=1` to read
`CF-Connecting-IP` / `X-Forwarded-For` instead. Leave it unset otherwise —
without a proxy in front, those headers can be spoofed by anyone.

`api/data/.htaccess` blocks direct access to the stored data on Apache. On nginx,
add the equivalent yourself:

```
location ^~ /api/data/ { deny all; }
```

Static hosting without PHP (GitHub Pages, plain S3) cannot run the counter — the
Stats box then shows `—` instead of a number.

## Adding pictures to a sub page

Drop the files into the matching folder under `assets/` (for example
`assets/roblox/`), then add one block per picture inside the
`<div class="gallery">` of that page:

```html
<figure>
	<img src="assets/roblox/example.png" alt="Example">
	<figcaption>Example</figcaption>
</figure>
```

The "Nothing here yet." line disappears on its own once the gallery has items.

## Adding a blog post

Replace the `<div class="empty">No posts yet.</div>` line in `blog.html` with one
block per post:

```html
<div class="entry">
	<h3>Post title</h3>
	<div class="date">1 August 2026</div>
	<p>Post text.</p>
</div>
```

## Running locally

```
php -S 127.0.0.1:8000
```

Then open <http://127.0.0.1:8000/>.
