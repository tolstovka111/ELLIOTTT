# ELLIOTTT

4real — a link-in-bio info-hub styled after the 4chan front page.

## Structure

| File | What it is |
| --- | --- |
| `index.php` | Front page: "What is 4real?" box, Boards, Blog, Blog editor, Stats, footer |
| `roblox.html`, `minecraft.html` | Avatars |
| `anime.html`, `games.html` | Fav Characters |
| `random.html` | Pictures |
| `faq.html`, `rules.html` | Pages behind the FAQ / Rules buttons |
| `admin.php` | Setup, sign in, and the handler for publish / delete / log out |
| `style.css` | Yotsuba-style theme |
| `script.js` | Intro box, board filter, gallery state, blog arrows, emoji picker |
| `api/lib.php` | Storage, posts, emoji and hashing helpers |
| `api/views.php` | Unique-visitor counter endpoint |
| `fonts/tahomabd.ttf` | Font used for box titles |
| `assets/emoji/` | Emoji pack used in blog posts |
| `assets/blog/` | Uploaded blog images |

## Hosting

The site needs plain **PHP 7.4+ shared hosting** — nothing else. No database, no
Node, no server to run: the host already runs PHP, it just executes `.php` files
when they are requested.

1. Upload the whole folder into the public web root (`public_html`, `www` or
   `htdocs`, depending on the host).
2. Make sure `api/` and `assets/blog/` are writable (chmod `755` is usually
   enough; some hosts need `775`). The site creates `api/data/` on the first
   request.
3. Open `https://your-site/` — the front page must appear. If the browser
   downloads the file or shows the source code instead, PHP is off for that
   directory; turn it on in the hosting panel.
4. Open `https://your-site/admin.php` once and fill in the setup form.

There is no `index.html` any more, only `index.php` — hosts serve it for `/`
automatically. If the host insists on `index.html` first, delete the leftover
file or add `DirectoryIndex index.php` to `.htaccess`.

## Setting the login and password

The credentials are **not** stored in the repository. They are created directly
on your server, once, through the setup form at `admin.php`:

| Field | What to put in |
| --- | --- |
| Login | your login, 3-32 characters |
| Password | at least 8 characters |
| Repeat password | the same again |
| Secret key for the link | prefilled with a random one; it becomes part of the admin URL |

Pressing **Create** writes `api/config.php` with three values and nothing else:

- login — SHA-256 with the per-installation salt,
- password — bcrypt (`password_hash`), not reversible,
- secret key — SHA-256 with the same salt.

Nothing is stored in plain text, and none of it is reachable over HTTP: PHP
executes `api/config.php` instead of showing it, `api/data/.htaccess` denies the
storage folder, and the login form is checked server-side only — no credentials
ever reach the browser.

Do the setup immediately after upload: until the account exists, the setup form
is open to whoever finds the page.

To change the login, password or key later, delete `api/config.php` and fill in
the setup form again.

## Signing in

```
https://your-site/admin.php?k=<secret key>
```

1. Open that link. A wrong key, or no key at all, returns a plain **404** — the
   panel is invisible to anyone who does not know the link.
2. The key opens the gate for the browser session and disappears from the address
   bar; the login form asks for the login and password.
3. On success you land back on the front page, where a **Blog editor** box is now
   shown under the Blog box. Visitors never see it.
4. `log out` in the corner of that box ends the session.

Protection: the session cookie is `HttpOnly` + `SameSite=Strict`, every form
carries a CSRF token, and five wrong logins lock that address out for 15 minutes.

## Blog

The Blog box sits between Boards and Stats on the front page.

- A post is up to **3 images**, one audio track and text, shown in that order.
- An image with a link shows a semi-transparent **Click** badge in its bottom
  left corner and opens the link in a new tab.
- Posts **expire after 2 days**. Expiry is lazy: the next request after a post
  ages out drops it from `api/data/posts.json` and deletes its image files, so no
  cron job is needed.
- With nothing live the box shows `No Posts in my Blog yet.`
- More than one live post adds `‹ 1/3 ›` arrows to the box title. They switch
  posts instantly, without animation.
- The date line reads `just now`, `N minutes ago`, `N hours ago` for the first
  day and `yesterday` after that. The age is computed on the server, so a wrong
  clock on the visitor's computer cannot skew it.

Uploads are validated by content, not by file name: only JPG, PNG, GIF and WEBP
pass, the limit is 5 MB per image, files are renamed to random hex, and
`assets/blog/.htaccess` forbids executing anything in the upload folder.

## Audio

The audio field takes MP3, OGG, WAV, M4A or FLAC up to 20 MB. The player sits
between the images and the text: cover art with the play button on top, the
title, the author in a smaller font, a seek bar, the elapsed time and the speed
buttons 0.5 / 0.8 / 1x / 1.25x / 2x on the right. Starting one track pauses any
other on the page.

Title and author come from the fields in the form. Leave them empty and the ID3
tags of the uploaded file are used instead (`TIT2` and `TPE1`); with no tags
either, the file name becomes the title and the author reads `Unknown artist`.

The cover works the same way: upload one, or let the embedded `APIC` picture from
the file be used. With neither, `assets/track-cover.svg` is shown.

## Emoji

The emoji bar under the text field inserts a shortcode such as `:konatathink:`
at the cursor; on the page it turns into the picture. Typing the shortcode by
hand works just as well.

To add or remove emoji, drop PNG, GIF or WEBP files into `assets/emoji/` — the
file name is the shortcode, so `konatacry.png` becomes `:konatacry:`. Names may
contain letters, digits, dashes and underscores. Unknown shortcodes are left as
plain text.

## View counter

`api/views.php` counts **unique visitors, not page loads**. On each request it
hashes the visitor address with a per-installation random salt and stores the
hash in `api/data/views.json`. An address that is already in the file does not
increase the total, so reloading the page cannot inflate the counter. The raw
address is never written to disk.

If the site sits behind Cloudflare or another reverse proxy, `REMOTE_ADDR` is the
proxy, so set the environment variable `VIEWS_TRUST_PROXY=1` to read
`CF-Connecting-IP` / `X-Forwarded-For` instead. Leave it unset otherwise —
without a proxy in front, those headers can be spoofed by anyone.

## nginx

`.htaccess` files only work on Apache. On nginx add the equivalent rules:

```
location ^~ /api/data/ { deny all; }
location ~ ^/assets/blog/.*\.(php|phtml|phar)$ { deny all; }
```

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

## Filling in FAQ and Rules

Both pages start empty. Replace the `<div class="empty">…</div>` line with your
own content.

For a list of questions, use one block per item:

```html
<div class="entry">
	<h3>Question</h3>
	<p>Answer.</p>
</div>
```

For a numbered list of rules, use a normal list inside a body block:

```html
<div class="box-body">
	<ol>
		<li>First rule.</li>
		<li>Second rule.</li>
	</ol>
</div>
```

## Running locally

```
php -S 127.0.0.1:8000
```

Then open <http://127.0.0.1:8000/>.
