# ELLIOTTT

4real — a link-in-bio info-hub styled after the 4chan front page, with a blog and
a public chat.

## Structure

| File | What it is |
| --- | --- |
| `index.php` | Front page: intro, Boards, Blog, Stats, footer |
| `chat.php` | `/c/` — the public chat |
| `thread.php` | `/thr/` — every blog post in full, with comments |
| `admintools.php` | Admin only: the blog editor |
| `admin.php` | Setup, sign in, and the handler for publish / delete / log out |
| `404.php` | Not-found page, shows a random picture from `assets/404/` |
| `roblox.html`, `minecraft.html` | `/o/`, `/m/` — avatars |
| `anime.html`, `games.html` | `/a/`, `/g/` — favourite characters |
| `random.html` | `/b/` — random pictures |
| `faq.html`, `rules.html` | `/faq`, `/rules` |
| `.htaccess` | Short URLs, directory index, 404 document |
| `style.css`, `script.js` | Theme and front-end logic |
| `api/lib.php` | Storage, posts, chat, emoji and hashing helpers |
| `api/views.php` | Unique-visitor counter endpoint |
| `api/online.php` | Marks the visitor present and returns the current online count |
| `assets/emoji/` | Emoji pack |
| `assets/404/` | Pictures the 404 page picks from |
| `assets/banners/` | Banners the /thr/ header picks from |
| `assets/videos/` | Looping clips the /thr/ header picks from |
| `assets/blog/`, `assets/chat/`, `assets/comments/` | Uploaded files |

Requirements: Apache with `mod_rewrite` and PHP 7.4+, write access to `api/`,
`assets/blog/` and `assets/chat/`. No database.

## Hosting on a VPS

```
sudo apt install -y apache2 php php-mbstring php-gd php-xml libapache2-mod-php
sudo a2enmod rewrite
```

Ubuntu ships `AllowOverride None`, which makes Apache **ignore every `.htaccess`
file** — short URLs stop working and the rules that protect `api/data/` never
apply. Fix it once:

```
sudo sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf
sudo systemctl restart apache2
```

Then upload the files into `/var/www/html` and give the web server write access:

```
sudo chown -R www-data /var/www/html/api /var/www/html/assets
sudo chgrp -R www-data /var/www/html/api /var/www/html/assets
sudo chmod -R 755 /var/www/html/api /var/www/html/assets
```

## Short URLs

| Address | Page |
| --- | --- |
| `/` or `/home` | front page |
| `/o/` `/m/` | Roblox, Minecraft avatars |
| `/a/` `/g/` | anime, game characters |
| `/b/` | random pictures |
| `/c/` | chat |
| `/thr/` | all blog posts |
| `/faq` `/rules` | FAQ, rules |

Everything else falls through to the styled 404 page. Drop your own pictures into
`assets/404/` — the page shows a random one on every visit.

## First run

Open `admin.php` once and fill in the setup form: login, password and a secret
key for the admin link. Do it straight after the upload — until the account
exists, the setup form is open to anyone who finds the page.

The form writes `api/config.php` with three hashes and nothing else: the login
(SHA-256 with the per-installation salt), the password (bcrypt) and the key
(SHA-256 with the same salt). Nothing is stored in plain text and none of it is
reachable over HTTP.

To change any of them, delete `api/config.php` and run the setup again.

## Signing in

```
https://your-site/admin.php?k=<secret key>
```

Every request without the key — or with a wrong one — returns the 404 page, so
the panel is invisible to anyone who does not know the link. The key is not
remembered between requests; bookmark the link. After signing in the session
takes over: **Admin Tools** appears in the footer, and publishing, deleting and
logging out no longer need the key. Logging out puts the 404 back.

Protection: `HttpOnly` + `SameSite=Strict` session cookie, a CSRF token on every
form, and a 15 minute lockout after five wrong logins.

## Blog

Posts are written in **Admin Tools**.

- Up to **3 files** per post, each either a picture (JPG, PNG, GIF, WEBP, 5 MB)
  or an **MP4** video (15 MB).
- A picture can carry a link; it then shows a semi-transparent **Click** badge in
  its bottom left corner.
- Text up to 1000 characters, with `:emoji:` shortcodes.
- **Background** per post: Default, Dark, Coffee or Green. The text colour
  follows the background so it never blends in.

The front page shows the newest posts as a grid of up to **8 previews** — the
first attached picture and the text cut to 110 characters with `...`, no dates.
A preview leads to the post on `/thr/`. Previews drop off the front page after
**2 days**; the posts themselves stay on `/thr/` forever, newest first, with all
their pictures, videos, text and date.

### The /thr/ header

The page opens with a random banner from `assets/banners/`, the board title
`/thr/ - Blog` under it and a random looping clip from `assets/videos/` under
that. Drop PNG, JPG, GIF or WEBP files into the first folder and MP4 or WEBM
into the second — the page picks one of each on every visit. With a folder
empty its slot is simply skipped.

Posts sit like 4chan threads: the pictures on the left with the **Comments (N)**
button under them, the text and the date to the right.

### Comments

Every post on `/thr/` has comments, folded behind a **Comments (N)** line.

- Opening shows the **5 newest**; with more than five a **Load all N comments**
  button reveals the rest, and **Hide comments** folds everything back.
- A comment is a name (empty means `Anonymous`), text and one optional
  attachment — **PNG, JPG or GIF up to 3 MB**, no video. There is no cooldown.
  The header carries the name and the local-time stamp, and an attachment gets
  the same **File:** line as in the chat. Comments are not numbered.
- **Answer** appears under other people's comments only; you cannot answer your
  own, which is checked by the same salted address hash as everywhere else.
- Anyone can delete their own comment or answer, the admin can delete any.
- The signed-in admin gets the name field prefilled with `nysha4real`; leaving it
  posts with the **Admin** tag, changing it posts under that plain name instead.

## Chat

`/c/` is open to everyone, no registration. Posts read like 4chan:

```
Anonymous 08/01/26(Sat)23:36 No.12
File: photo.jpg (162 KB, 954x954)
```

- The compose row is a name, the text and a paperclip for one picture —
  **PNG, JPG, GIF or WEBP up to 3 MB**, no video. An empty name posts as
  `Anonymous`. There are no avatars.
- Every message and every reply gets its own **running number**, kept in the
  store so numbers are never reused.
- The timestamp is rendered in the **visitor's own time zone** — the server
  sends the epoch seconds and the browser formats them, precise to the minute.
- An attachment is announced by a **File:** line with the original name, size
  and pixel dimensions; the thumbnail floats left of the text and opens full
  size on click, with a download button.
- **Reply** under a message opens a small form — name and text only.
- **One message per minute per address**, replies included. After sending, Send
  becomes a countdown whose last five seconds shimmer through the rainbow. The
  signed-in admin has no cooldown.
- Anyone can delete their own message or reply — ownership is checked by a salted
  hash of the address, never the raw address. The admin can delete anything and
  always posts as **nysha4real — Admin**.
- The page refreshes the list by itself every 9 seconds, unless a picture is open
  or a reply is being typed.
- The newest 300 messages are kept; older ones drop off with their files.

## Colours

The front page keeps the orange Yotsuba palette. Every other page carries
`class="blue"` on its `<body>` and switches to the Yotsuba B blues of the
reference — `#EEF2FF` behind the page, `#D6DAF0` blocks, `#9988EE` title bars,
`#34345C` links.

## Emoji

The emoji bar under the text field inserts a shortcode such as `:konatathink:`;
on the page it turns into the picture. It works in blog posts and in chat.

To add or remove emoji, drop PNG, GIF or WEBP files into `assets/emoji/` — the
file name is the shortcode, so `konatacry.png` becomes `:konatacry:`.

## Counters

The Stats box shows two numbers.

**Total Views** counts unique visitors, not page loads.

**Current Online** counts the addresses seen in the last three minutes. Every
page pings `api/online.php` on load and the front page repeats the ping once a
minute, so a visitor sitting in the chat still counts.

## View counter

`api/views.php` counts **unique visitors, not page loads**. It hashes the visitor
address with a per-installation random salt and stores the hash, so reloading the
page cannot inflate the counter and the raw address is never written to disk.

Behind Cloudflare or another reverse proxy, set `VIEWS_TRUST_PROXY=1` so the real
visitor address is read from `CF-Connecting-IP` / `X-Forwarded-For`. This also
drives the chat rate limit and the delete permissions. Leave it unset without a
proxy in front — those headers can be spoofed by anyone.

## nginx

`.htaccess` files only work on Apache. On nginx add the equivalent rules:

```
location ^~ /api/data/ { deny all; }
location ~ ^/assets/(blog|chat)/.*\.(php|phtml|phar)$ { deny all; }
```

plus rewrites for the short URLs above.

## Adding pictures to a board page

Drop the files into the matching folder under `assets/`, then add one block per
picture inside the `<div class="gallery">` of that page:

```html
<figure>
	<img src="/assets/roblox/example.png" alt="Example">
	<figcaption>Example</figcaption>
</figure>
```

## Filling in FAQ and Rules

Both pages start empty. Replace the `<div class="empty">…</div>` line with your
own content — `<div class="entry">` blocks for questions, a plain `<ol>` inside
`<div class="box-body">` for rules.

## Running locally

```
php -S 127.0.0.1:8000
```

The built-in server ignores `.htaccess`, so short URLs only work under Apache.
