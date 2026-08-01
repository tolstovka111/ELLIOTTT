# ELLIOTTT

4real — a link-in-bio info-hub styled after the 4chan front page, with a blog and
a public chat.

## Structure

| File | What it is |
| --- | --- |
| `index.php` | Front page: intro, Boards, Blog, Stats, footer |
| `chat.php` | `/c/` — the public chat |
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
| `assets/emoji/` | Emoji pack |
| `assets/404/` | Pictures the 404 page picks from |
| `assets/blog/`, `assets/chat/` | Uploaded files |

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

Posts are written in **Admin Tools** and shown in the Blog box on the front page.

- Up to **3 files** per post, each either a picture (JPG, PNG, GIF, WEBP, 5 MB)
  or an **MP4** video (15 MB).
- A picture can carry a link; it then shows a semi-transparent **Click** badge in
  its bottom left corner.
- Text up to 1000 characters, with `:emoji:` shortcodes.
- **Background** per post: Default, Dark, Coffee or Green. The text colour
  follows the background so it never blends in.
- Posts **expire after 2 days**; the next request after that drops the post and
  deletes its files, so no cron job is needed.
- More than one live post adds `‹ 1/3 ›` arrows to the box title.

## Chat

`/c/` is open to everyone, no registration.

- The compose row is avatar, name, text and a paperclip for one attachment —
  PNG, WEBP, JPG, GIF or MP4 up to 3 MB. An empty name posts as `Anonymous`.
- Messages are newest first. The attachment sits to the right of the text as a
  thumbnail; clicking it opens the full size with a download button and a close
  cross.
- Dates read `just now`, `5 minutes ago`, `3 hours ago`, `1 day ago`,
  `2 weeks ago`, `1 year ago`.
- **Reply** under a message opens a small form — name and text only, no
  attachments.
- **One message per minute per address.** After sending, the Send button becomes
  a countdown; the last five seconds shimmer through the rainbow and grow a
  little. Replies obey the same limit but show no timer.
- Anyone can delete their own message or reply — ownership is checked by a salted
  hash of the address, never the raw address. A signed-in admin can delete
  anything, always posts as **nysha4real** with a dark red **Admin** tag, and can
  reply to anyone.
- The page refreshes the list by itself every 9 seconds, unless a picture is open
  or a reply is being typed.
- The newest 300 messages are kept; older ones drop off with their files.

## Emoji

The emoji bar under the text field inserts a shortcode such as `:konatathink:`;
on the page it turns into the picture. It works in blog posts and in chat.

To add or remove emoji, drop PNG, GIF or WEBP files into `assets/emoji/` — the
file name is the shortcode, so `konatacry.png` becomes `:konatacry:`.

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
