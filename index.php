<?php

declare(strict_types=1);

require_once __DIR__ . '/api/lib.php';

if (isset($_COOKIE['realadmin'])) {
    admin_session_start();
}

$authed = !empty($_SESSION['admin']);
$posts = live_posts();
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
<meta name="description" content="4real is a link-in-bio info-hub with every official profile in one place.">
<link rel="icon" href="/assets/4real-logo.png">
<link rel="stylesheet" href="/style.css?v=16">
</head>
<body>

<div class="logo">
	<a href="/404"><img src="/assets/4real-logo.png" alt="4real"></a>
</div>

<div class="page">

	<div class="box intro" id="intro">
		<div class="box-title">
			What is 4real?
			<span class="close" id="intro-close" title="Close">&#10005;</span>
		</div>
		<div class="box-body">
			<p>4real is a site where you get fucked up, and that&rsquo;s exactly why you could end up an incel.</p>
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
					<li><a href="https://open.spotify.com/user/31rsjobmhmq7unu3h3y4pfn6jeq4" target="_blank" rel="noopener">Spotify</a></li>
					<li><a href="https://on.soundcloud.com/9eYojPyGN0hkus2GKK" target="_blank" rel="noopener">SoundCloud</a></li>
					<li><a href="https://steamcommunity.com/id/nysha4real/" target="_blank" rel="noopener">Steam</a></li>
					<li><a href="https://namemc.com/profile/nysha4real.1" target="_blank" rel="noopener">NameMC</a></li>
				</ul>
			</div>

			<div class="board-col">
				<h2><span>Avatars</span></h2>
				<ul>
					<li><a href="/o/">Roblox</a></li>
					<li><a href="/m/">Minecraft</a></li>
				</ul>
			</div>

			<div class="board-col">
				<h2><span>Fav Characters</span></h2>
				<ul>
					<li><a href="/a/">Anime</a></li>
					<li><a href="/i/">Internet</a></li>
				</ul>
			</div>

			<div class="board-col">
				<h2><span>Other</span></h2>
				<ul>
					<li><a href="/b/">Random Pictures</a></li>
					<li><a href="/c/">Chat</a></li>
				</ul>
			</div>

		</div>
	</div>

	<div class="box" id="blog">
		<div class="box-title">
			Blog
			<span class="corner"><a href="/n/">all posts &#8250;</a></span>
		</div>
<?php if ($posts === []): ?>
		<div class="empty">No Posts in my Blog yet.</div>
<?php else: ?>
		<div class="threads">
<?php foreach ($posts as $post): ?>
<?php $thumb = post_thumb($post); ?>
			<a class="thread" href="/n/#p<?= e((string) $post['id']) ?>">
<?php if ($thumb !== ''): ?>
				<span class="thread-thumb"><img src="<?= e($thumb) ?>" alt=""></span>
<?php endif; ?>
<?php if ((string) $post['text'] !== ''): ?>
				<span class="thread-text"><?= render_post_text(shorten((string) $post['text'], PREVIEW_CHARS)) ?></span>
<?php endif; ?>
			</a>
<?php endforeach; ?>
		</div>
<?php endif; ?>
	</div>

	<div class="box">
		<div class="box-title">Stats</div>
		<div class="box-body stats">
			<span class="stat"><strong>Total Views:</strong> <span id="views-total">&hellip;</span></span>
			<span class="stat"><strong>Current Online:</strong> <span id="online-total">&hellip;</span></span>
		</div>
	</div>

	<div class="pagelinks">
		<a href="/home">Home</a>
		<span class="dot">&#9679;</span>
		<a href="/faq/">FAQ</a>
		<span class="dot">&#9679;</span>
		<a href="/rules/">Rules</a>
<?php if ($authed): ?>
		<span class="dot">&#9679;</span>
		<a href="/admintools.php">Admin Tools</a>
<?php endif; ?>
	</div>

	<div class="copyright">Copyright &copy; 2025-2026 4real community support. All rights reserved</div>

	<div class="madeby">created by tolstovka (<a href="https://t.me/nysh4real" target="_blank" rel="noopener">@nysh4real</a> in telegram)</div>

</div>

<script src="/script.js?v=16"></script>
</body>
</html>
