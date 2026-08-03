# ELLIOTTT

4real — a link-in-bio info-hub styled after the 4chan front page, with a blog and
a public chat.

## Structure

| File | What it is |
| --- | --- |
| `index.php` | Front page: intro, Boards, Blog, Stats, footer |
| `chat.php` | `/c/` — the public chat |
|  `blog.php` | `/blog/` — every blog post in full, with comments |
| `admintools.php` | Admin only: the blog editor |
| `admin.php` | Setup, sign in, and the handler for publish / delete / log out |
| `404.php` | Not-found page, shows a random picture from `assets/404/` |
| `board.php` | `/o/` `/m/` `/a/` `/i/` `/b/` `/faq` `/rules` — the standalone pages |
| `pages/` | The picture list, and any HTML, that fills a board page in |
| `.htaccess` | 404 document, upload limits, and the short URLs as a shortcut |
| `o/` `m/` `a/` `i/` `b/` `c/` `n/` `blog/` `faq/` `rules/` | One-line folders so every short URL works without mod_rewrite |
| `style.css`, `script.js` | Theme and front-end logic |
| `api/lib.php` | Storage, posts, chat, emoji and hashing helpers |
| `api/ui.php` | Board navigation, page header and footer |
| `api/comments.php` | The comment engine shared by the blog and the pages |
| `api/views.php` | Unique-visitor counter endpoint |
| `api/online.php` | Marks the visitor present and returns the current online count |
| `assets/emoji/` | Emoji pack |
| `assets/404/` | Pictures the 404 page picks from |
| `assets/banners/` | Banners the /blog/ header picks from |
| `assets/boards/` | The pictures shown on the board pages |
| `assets/adbanners/` | Clickable banners under the /blog/ header |
| `assets/videos/` | Looping clips |
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
| `/a/` `/i/` | anime characters, internet |
| `/b/` | random pictures |
| `/c/` | chat |
| `/blog/` `/n/` | all blog posts |
| `/faq` `/rules` | FAQ, rules |

Each of these is a real folder holding a one-line `index.php`, so they answer
even where `mod_rewrite` is off or `.htaccess` is ignored; the rewrite rules
only save a directory lookup. Everything else falls through to the styled 404
page. Drop your own pictures into
`assets/404/` — the page shows a random one on every visit. The **4real logo**
leads there from the front page only; everywhere else it goes back home.

Every page except the front page and the 404 carries the **board bar** along the
top — `[o / m / a / g / b / c / n] [faq / rules]` on the left and `[Home]` on the
right.

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
  or an **MP4** video (15 MB). A post with no file at all is published too, but
  it never reaches the front page — there is nothing to preview — and shows only
  on `/n/`.
- A picture can carry a link; it then shows a semi-transparent **Click** badge in
  its bottom left corner.
- Text up to 1000 characters, with `:emoji:` shortcodes.

The front page shows the newest posts as a grid of up to **8 previews** — the
first attached picture and the text cut to 110 characters with `...`, no dates.
A preview leads to the post on `/blog/`. Previews drop off the front page after
**2 days**; the posts themselves stay on `/blog/` forever, newest first, with all
their pictures, videos, text and date.

### The /blog/ header

The page opens with a random banner from `assets/banners/` (one of four) and the
board title `/n/ - posts by nysha4real` under it, then a rule, a
**[Go to the posts]** link that scrolls smoothly down to the first post, and a
random clickable banner from `assets/adbanners/`. The page answers on both
`/blog/` and `/n/`.

Drop PNG, JPG, GIF or WEBP files into `assets/banners/` to add header banners.

An ad banner links to the board named by the part of its file name **before the
first dash**: `c-chat.gif` goes to `/c/`, `a-anime.gif` to `/a/`,
`m-minecraft.gif` to `/m/`. Valid boards are `o m a i b c`; anything else falls
back to `/home`. They are all drawn at the same width, so a banner of any size
lines up with the rest. With either folder empty its slot is simply skipped.

Posts run the full width of the window with only a small margin on each side.
The header line reads name, country flag, date with seconds, running number and
a **▶** link to the post; the **File:** line with size and pixel dimensions sits
under it, and the picture floats to the left of the text.

### Comments per post

A new post starts with its comments **closed**. The signed-in admin sees
**[Allow comments]** under it and opens them with one click; **[Close comments]**
shuts them again. While a post is closed a visitor sees no comment box, no
counter and no toggle — the post simply stands on its own.

### Comments

The **3 newest** comments are always in view. From the fourth on, **Show more
comments** opens the rest and **Hide more comments** folds them back to three;
with three or fewer there is no button at all. A post with no comments shows
just the box.
- A comment is a name (empty means `Anonymous`), text and one optional
  attachment — **PNG, JPG or GIF up to 3 MB**, no video. There is no cooldown.
  The header carries the name and the local-time stamp, and an attachment gets
  the same **File:** line as in the chat. Comments are not numbered.
- Every comment opens with a dark red **>>N**: by default the number of the post
  it sits under, or the number of the comment it answers when **[reply]** was
  used. Hovering a **>>N** opens the quoted entry over the page and moving the
  pointer away closes it.
- Anyone can delete their own comment, the admin can delete any.
- The signed-in admin gets the name field prefilled with the admin nickname;
  leaving it posts in yellow, changing it posts under that plain name instead.

## The standalone pages

`/o/` `/m/` `/a/` `/i/` `/b/` `/faq` `/rules` all run through `board.php` and
share the layout of the blog: the board bar, a random banner, the board title, a
**[Go to the page]** link and a random ad banner. They carry information only —
there is nothing to post there.

The middle of the page is a **picture wall**. Put the pictures in
`assets/boards/<board>/` and list them in `pages/<board>.txt`, one line each:

```
1.jpg | Akira Kogami
```

Each picture gets a thin frame, grows a little under the pointer and opens at
full size on click, where it can be downloaded or closed with the **×**. The
caption sits underneath.

`/a/` keeps the order of the file. `/i/` is **staggered and reshuffled on every
visit**, so the wall never looks the same twice; which boards behave that way is
the list in `board_shuffled()` in `api/ui.php`.

A page that needs more than pictures can also have an HTML fragment in
`pages/<board>.html`, pasted in above the wall. With neither, the page reads
*Nothing here yet.*

## Chat

`/c/` carries the same header as the blog — banner, the title `/c/ - chat`, a
**[Write message]** link down to the compose row, then a random ad banner. It is
open to everyone, no registration, and posts read like 4chan:

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
- **[reply]** and **[delete]** sit in brackets right after the timestamp, as on
  4chan. Reply opens a small form — name and text only.
- **One message per minute per address**, replies included. After sending, Send
  becomes a countdown whose last five seconds shimmer through the rainbow. The
  signed-in admin has no cooldown.
- Anyone can delete their own message or reply — ownership is checked by a salted
  hash of the address, never the raw address. The admin can delete anything.
- The signed-in admin gets a **Post as admin** checkbox, ticked by default, which
  posts under the admin nickname in yellow. Unticking it frees the name field and
  posts as an ordinary user in green — still with no cooldown, and without logging
  out. The admin nickname typed into that field falls back to `Anonymous`.
- The page refreshes the list by itself every 9 seconds, unless a picture is open
  or a reply is being typed.
- The newest 300 messages are kept; older ones drop off with their files.

## Names, numbers and flags

Every name is **green**. The admin picks in **Admin Tools → Admin nickname**
whether theirs stands out in **yellow** or blends in with the green of everyone
else, and sets the name itself — up to 32 characters, `nysha4real` by default,
saved in `api/data/adminname.json`. Nobody else can post under it: typed into a
name field it falls back to `Anonymous`.

Every message, post and comment on the site draws its **No.** from one counter
in `api/data/seq.json`, so a chat message, a blog post and a comment under it
carry 1, 2 and 3 in the order they were written. The numbers are what **>>N**
quotes point at. The first page load after the update renumbers everything that
was already there and unnests the old replies.

A **country flag** sits between the name and the date on posts and comments. The
country comes from the `CF-IPCountry` header behind Cloudflare, otherwise from a
one-off lookup cached per address for 30 days in `api/data/geo.json`. Addresses
that cannot be placed simply get no flag. Windows renders flag emoji as the two
letter code rather than a picture.

## Colours

The front page keeps the orange Yotsuba palette. Every other page carries
`class="blue"` on its `<body>` and switches to the Yotsuba B blues of the
reference — `#EEF2FF` behind the page, `#D6DAF0` blocks, `#9988EE` title bars,
`#34345C` links.

## Emoji

The emoji bar under the text field inserts a shortcode such as `:konatathink:`;
on the page it turns into the picture. It works in blog posts and in chat.

**Admin Tools → Emoji** adds and removes them without touching the server: pick
a PNG, GIF, WEBP or JPG up to 2 MB and give it a name, or leave the name empty
to use the file name. Dropping files straight into `assets/emoji/` still works —
the file name is the shortcode, so `konatacry.png` becomes `:konatacry:`.

## Stats in Admin Tools

**Site stats** draws page views per day over the last 30 days as a line chart;
hovering a point shows that day and its exact count. Above it sit the unique
visitor total, the page views on record and how many people are online now.

**Visitors** lists every address that has ever loaded the site, newest first,
with its flag and place — `Finland, Helsinki` where the city is known, the
country alone where it is not — how many views it accounts for and when it was
first and last seen. Addresses are read the same way as everywhere else, so
behind a proxy `VIEWS_TRUST_PROXY=1` is what makes them real rather than the
proxy's own. The place comes from one lookup per address, cached 30 days in
`api/data/geo.json`, so the server needs outbound HTTP for it to fill in.

Both live in `api/data/views.json`, which keeps 120 days of daily counts and the
4000 most recent visitors. Rows recorded before this feature existed show no
address, only the count they contributed.

## Phones

The layout folds at 760px and again at 460px: the picture in a post stops
floating and the text takes the full width under it, every compose row becomes a
stack of full-width fields, the admin forms drop their label column, the
visitors table scrolls inside its own box and the banners shrink to fit. No page
scrolls sideways.

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
