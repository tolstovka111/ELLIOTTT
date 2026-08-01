# ELLIOTTT

4real — a link-in-bio info-hub styled after the 4chan front page.

## Structure

| File | What it is |
| --- | --- |
| `index.html` | Front page: "What is 4real?" box, Boards, Blog, Stats, footer |
| `roblox.html`, `minecraft.html` | Avatars |
| `anime.html`, `games.html` | Fav Characters |
| `random.html` | Pictures |
| `faq.html`, `rules.html` | Pages behind the FAQ / Rules buttons |
| `admin.php` | Admin panel: sign in, publish and delete blog posts |
| `style.css` | Yotsuba-style theme |
| `script.js` | Intro box, board filter, gallery state, blog, view counter |
| `api/lib.php` | Shared storage, post and hashing helpers |
| `api/posts.php` | Serves the live blog posts |
| `api/views.php` | Unique-visitor counter endpoint |
| `fonts/tahomabd.ttf` | Font used for box titles |
| `assets/` | Logo, per-page picture folders, uploaded blog images |

Requirements: PHP 7.4+ with write access to `api/` and `assets/blog/`. Static
hosting without PHP (GitHub Pages, plain S3) cannot run the blog or the counter.

## First run

Upload the files, then open `admin.php` **once** and fill in the setup form:
login, password and a secret key for the admin link. Do this straight after the
upload — until the account exists, the setup form is open to anyone who finds the
page.

The form writes `api/config.php` containing three hashes and nothing else:

- login — SHA-256 with the per-installation salt,
- password — bcrypt (`password_hash`), not reversible,
- secret key — SHA-256 with the same salt.

Nothing is stored in plain text, and none of it is reachable over HTTP: PHP
executes `api/config.php` instead of showing it, `api/data/.htaccess` denies the
storage folder, and the login form is checked server-side only — no credentials
ever reach the browser.

## Admin panel

After setup the panel lives at:

```
https://your-site/admin.php?k=<secret key>
```

Opening `admin.php` without the key — or with a wrong one — returns a plain
**404**, so the panel is invisible to anyone who does not know the link. A
correct key opens the gate for the browser session and disappears from the
address bar, then the login form asks for the login and password.

Protection: session cookie is `HttpOnly` + `SameSite=Strict`, every form carries
a CSRF token, and five wrong logins lock that address out for 15 minutes.

To change the login, password or key, delete `api/config.php` and run the setup
form again.

## Blog

The Blog box sits between Boards and Stats on the front page.

- A post is up to **3 images** plus text; each image can carry its own link.
- An image with a link shows a **Click** overlay and opens the link in a new tab.
- Posts **expire after 2 days**. Expiry is lazy: the next request after a post
  ages out drops it from `api/data/posts.json` and deletes its image files, so no
  cron job is needed.
- With nothing live the box shows `No Posts in my Blog yet.`
- More than one live post adds `‹ 1/3 ›` arrows to the box title. They switch
  posts instantly, without animation.
- The date line reads `just now`, `N minutes ago`, `N hours ago` for the first
  day and `yesterday` after that. The age comes from the server, so a wrong clock
  on the visitor's computer cannot skew it.

Uploads are validated by content, not by file name: only JPG, PNG, GIF and WEBP
pass, the limit is 5 MB per image, files are renamed to random hex, and
`assets/blog/.htaccess` forbids executing anything in the upload folder.

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
