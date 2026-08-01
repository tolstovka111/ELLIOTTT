<?php

declare(strict_types=1);

require __DIR__ . '/api/lib.php';

if (isset($_COOKIE['realadmin'])) {
    admin_session_start();
}

$authed = !empty($_SESSION['admin']);
$csrf = (string) ($_SESSION['csrf'] ?? '');
$flash = $_SESSION['flash'] ?? null;
$formErrors = (array) ($_SESSION['form_errors'] ?? []);
unset($_SESSION['flash'], $_SESSION['form_errors']);

$posts = live_posts();
$emoji = $authed ? emoji_map() : [];
$now = time();

if ($authed) {
    header('Cache-Control: no-store, no-cache, must-revalidate');
}

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>4real</title>
<meta name="description" content="4real is a simple and convenient info-hub where anyone can learn more about me and find all of my official profiles.">
<link rel="icon" href="assets/4real-logo.png">
<link rel="stylesheet" href="style.css">
</head>
<body>

<div class="logo">
	<a href="index.php"><img src="assets/4real-logo.png" alt="4real"></a>
</div>

<div class="page">

	<div class="box intro" id="intro">
		<div class="box-title">
			What is 4real?
			<span class="close" id="intro-close" title="Close">&#10005;</span>
		</div>
		<div class="box-body">
			<p>4real is a simple and convenient info-hub (a link-in-bio website) where anyone can learn more
			about me and find all of my official profiles. Here you will find sections dedicated to my content
			across various platforms: from personal blogs and social media to work projects, portfolios, and
			merch. No account registration is required to view my materials or get in touch. Simply choose the
			social network or platform you are interested in from the list below and join my community!</p>
		</div>
	</div>

	<div class="box">
		<div class="box-title">
			Boards
			<span class="corner" id="filter-toggle">filter &#9660;</span>
		</div>
		<div class="boards-filter" id="boards-filter">
			<input type="text" id="filter-input" placeholder="Filter boards&hellip;" autocomplete="off">
		</div>
		<div class="board-columns">

			<div class="board-col">
				<h2><span>SOCIAL MEDIA</span></h2>
				<ul>
					<li><a href="https://www.youtube.com/@nysha4real" target="_blank" rel="noopener">YouTube</a></li>
					<li><a href="https://www.tiktok.com/@nysha4reall" target="_blank" rel="noopener">TikTok</a></li>
					<li><a href="https://www.instagram.com/nysha4real" target="_blank" rel="noopener">Instagram</a></li>
					<li><a href="https://t.me/nysha4real" target="_blank" rel="noopener">TG Channel</a></li>
					<li><a href="https://open.spotify.com/user/31rsjobmhmq7unu3h3y4pfn6jeq4" target="_blank" rel="noopener">Spotify</a></li>
					<li><a href="https://on.soundcloud.com/9eYojPyGN0hkus2GKK" target="_blank" rel="noopener">SoundCloud</a></li>
					<li><a href="https://steamcommunity.com/id/nysha4real/" target="_blank" rel="noopener">Steam</a></li>
				</ul>
			</div>

			<div class="board-col">
				<h2><span>Avatars</span></h2>
				<ul>
					<li><a href="roblox.html">Roblox</a></li>
					<li><a href="minecraft.html">Minecraft</a></li>
				</ul>
			</div>

			<div class="board-col">
				<h2><span>Fav Characters</span></h2>
				<ul>
					<li><a href="anime.html">Anime</a></li>
					<li><a href="games.html">Games</a></li>
				</ul>
			</div>

			<div class="board-col">
				<h2><span>Pictures</span></h2>
				<ul>
					<li><a href="random.html">Random</a></li>
				</ul>
			</div>

		</div>
	</div>

	<div class="box" id="blog">
		<div class="box-title">
			Blog
<?php if (count($posts) > 1): ?>
			<span class="corner blognav" id="blog-nav"><span id="blog-prev">&#8249;</span> <span id="blog-pos">1/<?= count($posts) ?></span> <span id="blog-next">&#8250;</span></span>
<?php endif; ?>
		</div>
		<div id="blog-posts">
<?php foreach ($posts as $post): ?>
			<div class="post">
<?php if ($post['images'] !== []): ?>
				<div class="post-images">
<?php foreach ($post['images'] as $image): ?>
<?php $src = 'assets/blog/' . basename((string) $image['file']); ?>
<?php if (($image['link'] ?? '') !== ''): ?>
					<a class="post-image linked" href="<?= e((string) $image['link']) ?>" target="_blank" rel="noopener noreferrer"><img src="<?= e($src) ?>" alt=""><span class="click">Click</span></a>
<?php else: ?>
					<span class="post-image"><img src="<?= e($src) ?>" alt=""></span>
<?php endif; ?>
<?php endforeach; ?>
				</div>
<?php endif; ?>
<?php if (isset($post['audio']) && is_array($post['audio'])): ?>
<?php $audio = $post['audio']; ?>
<?php $cover = (string) ($audio['cover'] ?? '') !== '' ? 'assets/blog/' . basename((string) $audio['cover']) : 'assets/track-cover.svg'; ?>
				<div class="track">
					<div class="track-art">
						<img src="<?= e($cover) ?>" alt="">
						<button type="button" class="track-play" aria-label="Play">&#9654;</button>
					</div>
					<div class="track-info">
						<div class="track-title"><?= e((string) $audio['title']) ?></div>
						<div class="track-author"><?= e((string) $audio['author']) ?></div>
						<div class="track-controls">
							<input type="range" class="track-seek" min="0" max="1000" value="0" step="1" aria-label="Seek">
							<span class="track-time">0:00</span>
							<div class="track-rates">
								<span data-rate="0.5">0.5</span>
								<span data-rate="0.8">0.8</span>
								<span data-rate="1" class="on">1x</span>
								<span data-rate="1.25">1.25x</span>
								<span data-rate="2">2x</span>
							</div>
						</div>
					</div>
					<audio preload="metadata" src="assets/blog/<?= e(basename((string) $audio['file'])) ?>"></audio>
				</div>
<?php endif; ?>
<?php if ((string) $post['text'] !== ''): ?>
				<p class="post-text"><?= render_post_text((string) $post['text']) ?></p>
<?php endif; ?>
				<div class="date"><?= e(relative_age($now - (int) $post['created'])) ?></div>
			</div>
<?php endforeach; ?>
		</div>
<?php if ($posts === []): ?>
		<div class="empty" id="blog-empty">No Posts in my Blog yet.</div>
<?php endif; ?>
	</div>

<?php if ($authed): ?>
	<div class="box" id="blog-editor">
		<div class="box-title">
			Blog editor
			<span class="corner"><a href="#" id="logout-link">log out</a></span>
		</div>
<?php if ($flash !== null): ?>
		<div class="box-body notice"><?= e((string) $flash['message']) ?></div>
<?php endif; ?>
<?php if ($formErrors !== []): ?>
		<div class="box-body error">
<?php foreach ($formErrors as $message): ?>
			<div><?= e((string) $message) ?></div>
<?php endforeach; ?>
		</div>
<?php endif; ?>
		<div class="box-body">
			<form method="post" action="admin.php" enctype="multipart/form-data" class="adminform">
				<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
				<input type="hidden" name="action" value="create">
<?php for ($i = 0; $i < MAX_IMAGES; $i++): ?>
				<div class="uploadrow">
					<label>Image <?= $i + 1 ?><input type="file" name="image[]" accept="image/jpeg,image/png,image/gif,image/webp"></label>
					<label>Link for image <?= $i + 1 ?> (optional)<input type="url" name="link[]" placeholder="https://"></label>
				</div>
<?php endfor; ?>
				<div class="uploadrow">
					<label>Audio (optional)<input type="file" name="audio" accept="audio/*"></label>
					<label>Cover for the audio (optional)<input type="file" name="cover" accept="image/jpeg,image/png,image/gif,image/webp"></label>
					<label>Track title (optional, taken from the file tags when empty)<input type="text" name="audio_title" maxlength="<?= MAX_META ?>"></label>
					<label>Track author (optional, taken from the file tags when empty)<input type="text" name="audio_author" maxlength="<?= MAX_META ?>"></label>
				</div>
				<label>Text<textarea name="text" id="post-text" rows="4" maxlength="<?= MAX_TEXT ?>"></textarea></label>
<?php if ($emoji !== []): ?>
				<div class="emojibar" id="emojibar">
<?php foreach ($emoji as $name => $src): ?>
					<img src="<?= e($src) ?>" alt=":<?= e($name) ?>:" title=":<?= e($name) ?>:" data-code=":<?= e($name) ?>:">
<?php endforeach; ?>
				</div>
<?php endif; ?>
				<button type="submit">Publish</button>
			</form>
		</div>

		<div class="box-title sub">Live posts</div>
<?php if ($posts === []): ?>
		<div class="empty">No Posts in my Blog yet.</div>
<?php else: ?>
<?php foreach ($posts as $post): ?>
		<div class="entry adminpost">
<?php if ($post['images'] !== []): ?>
			<div class="adminpost-images">
<?php foreach ($post['images'] as $image): ?>
				<img src="assets/blog/<?= e(basename((string) $image['file'])) ?>" alt="">
<?php endforeach; ?>
			</div>
<?php endif; ?>
<?php if (isset($post['audio']) && is_array($post['audio'])): ?>
			<div class="adminpost-audio">&#9834; <?= e((string) $post['audio']['title']) ?> &mdash; <?= e((string) $post['audio']['author']) ?></div>
<?php endif; ?>
			<p><?= render_post_text((string) $post['text']) ?></p>
			<div class="date"><?= e(relative_age($now - (int) $post['created'])) ?></div>
			<form method="post" action="admin.php">
				<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
				<input type="hidden" name="action" value="delete">
				<input type="hidden" name="id" value="<?= e((string) $post['id']) ?>">
				<button type="submit">Delete</button>
			</form>
		</div>
<?php endforeach; ?>
<?php endif; ?>
	</div>

	<form method="post" action="admin.php" id="logout-form">
		<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
		<input type="hidden" name="action" value="logout">
	</form>
<?php endif; ?>

	<div class="box">
		<div class="box-title">Stats</div>
		<div class="box-body stats">
			<span class="stat"><strong>Total Views:</strong> <span id="views-total">&hellip;</span></span>
		</div>
	</div>

	<div class="pagelinks">
		<a href="index.php">Home</a>
		<a href="faq.html">FAQ</a>
		<a href="rules.html">Rules</a>
	</div>

	<div class="copyright">Copyright &copy; 2025-2026 4real community support. All rights reserved</div>

</div>

<script src="script.js"></script>
</body>
</html>
