<?php

declare(strict_types=1);

require_once __DIR__ . '/api/lib.php';

admin_session_start();

if (empty($_SESSION['admin'])) {
    require __DIR__ . '/404.php';
    exit;
}

header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

$csrf = (string) ($_SESSION['csrf'] ?? '');
$flash = $_SESSION['flash'] ?? null;
$formErrors = (array) ($_SESSION['form_errors'] ?? []);
unset($_SESSION['flash'], $_SESSION['form_errors']);

$posts = all_posts();
$emoji = emoji_map();
$adminName = admin_name();
$now = time();

$checks = [
    'api/data' => data_dir() !== '',
    'assets/blog' => uploads_dir() !== '',
    'assets/chat' => chat_dir() !== '',
    'assets/comments' => comments_dir() !== '',
];
$broken = in_array(false, $checks, true);

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin Tools - 4real</title>
<link rel="icon" href="/assets/4real-logo.png">
<link rel="stylesheet" href="/style.css?v=8">
</head>
<body class="blue">

<div class="logo">
	<a href="/404.php"><img src="/assets/4real-logo.png" alt="4real"></a>
</div>

<div class="page">

	<div class="nav">[<a href="/home">Return to Home</a>]</div>

<?php if ($broken): ?>
	<div class="box">
		<div class="box-title">Server check</div>
		<div class="box-body error">
			<div>The web server cannot write to these folders, so nothing can be saved:</div>
<?php foreach ($checks as $folder => $ok): ?>
<?php if (!$ok): ?>
			<div>&mdash; <?= e($folder) ?></div>
<?php endif; ?>
<?php endforeach; ?>
			<div>Run on the server: chown -R www-data /var/www/html/api /var/www/html/assets</div>
		</div>
	</div>
<?php endif; ?>

	<div class="box">
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
		<form method="post" action="/admin.php" enctype="multipart/form-data" class="postform">
			<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
			<input type="hidden" name="action" value="create">

<?php for ($i = 0; $i < MAX_IMAGES; $i++): ?>
			<div class="formrow">
				<div class="formlabel">Image or MP4 <?= $i + 1 ?></div>
				<div class="formfield">
					<input type="file" name="image[]" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4">
					<input type="url" name="link[]" placeholder="Link for this picture (optional)">
				</div>
			</div>
<?php endfor; ?>

			<div class="formrow">
				<div class="formlabel">Text</div>
				<div class="formfield">
					<textarea name="text" id="post-text" rows="5" maxlength="<?= MAX_TEXT ?>" placeholder="Up to <?= MAX_TEXT ?> characters"></textarea>
<?php if ($emoji !== []): ?>
					<div class="emojibar" id="emojibar">
<?php foreach ($emoji as $name => $src): ?>
						<img src="<?= e($src) ?>" alt=":<?= e($name) ?>:" title=":<?= e($name) ?>:" data-code=":<?= e($name) ?>:">
<?php endforeach; ?>
					</div>
<?php endif; ?>
				</div>
			</div>

			<div class="formrow">
				<div class="formlabel">Background</div>
				<div class="formfield">
					<div class="bgpicker">
<?php foreach (post_backgrounds() as $background): ?>
						<label class="bgoption bg-<?= e($background) ?>">
							<input type="radio" name="bg" value="<?= e($background) ?>"<?= $background === 'default' ? ' checked' : '' ?>>
							<span><?= e(ucfirst($background)) ?></span>
						</label>
<?php endforeach; ?>
					</div>
				</div>
			</div>

			<div class="formrow">
				<div class="formlabel"></div>
				<div class="formfield"><button type="submit">Post</button></div>
			</div>
		</form>
	</div>

	<div class="box">
		<div class="box-title">Admin nickname</div>
		<div class="box-body">
			<p>This is the name your posts, comments and chat messages are signed with. Up to <?= MAX_NAME ?> characters. It always shows in yellow; everyone else is green.</p>
			<form method="post" action="/admin.php" class="tagform" id="tagform">
				<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
				<input type="hidden" name="action" value="nickname">

				<div class="formrow">
					<div class="formlabel">Nickname</div>
					<div class="formfield">
						<input type="text" name="nickname" id="tag-text" maxlength="<?= MAX_NAME ?>" value="<?= e($adminName) ?>" required>
					</div>
				</div>

				<div class="formrow">
					<div class="formlabel">Preview</div>
					<div class="formfield">
						<span class="msg-name admin" id="tag-preview"><?= e($adminName) ?></span>
					</div>
				</div>

				<div class="formrow">
					<div class="formlabel"></div>
					<div class="formfield"><button type="submit">Save nickname</button></div>
				</div>
			</form>
		</div>
	</div>

	<form method="post" action="/admin.php" id="logout-form">
		<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
		<input type="hidden" name="action" value="logout">
	</form>

	<div class="box">
		<div class="box-title">All posts</div>
<?php if ($posts === []): ?>
		<div class="empty">No Posts in my Blog yet.</div>
<?php else: ?>
<?php foreach ($posts as $post): ?>
		<div class="entry adminpost">
<?php if (($post['images'] ?? []) !== []): ?>
			<div class="adminpost-images">
<?php foreach ((array) $post['images'] as $media): ?>
<?php $src = '/assets/blog/' . basename((string) $media['file']); ?>
<?php if ((string) ($media['type'] ?? 'image') === 'video'): ?>
				<video src="<?= e($src) ?>" preload="metadata" muted></video>
<?php else: ?>
				<img src="<?= e($src) ?>" alt="">
<?php endif; ?>
<?php endforeach; ?>
			</div>
<?php endif; ?>
			<p><?= render_post_text((string) $post['text']) ?></p>
			<div class="date"><?= e(relative_age($now - (int) $post['created'])) ?> &middot; background: <?= e((string) ($post['bg'] ?? 'default')) ?></div>
			<form method="post" action="/admin.php">
				<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
				<input type="hidden" name="action" value="delete">
				<input type="hidden" name="id" value="<?= e((string) $post['id']) ?>">
				<button type="submit">Delete</button>
			</form>
		</div>
<?php endforeach; ?>
<?php endif; ?>
	</div>

	<div class="pagelinks">
		<a href="/home">Home</a>
		<span class="dot">&#9679;</span>
		<a href="/faq">FAQ</a>
		<span class="dot">&#9679;</span>
		<a href="/rules">Rules</a>
		<span class="dot">&#9679;</span>
		<a href="/admintools.php">Admin Tools</a>
	</div>

	<div class="copyright">Copyright &copy; 2025-2026 4real community support. All rights reserved</div>

	<div class="madeby">created by tolstovka (<a href="https://t.me/nysh4real" target="_blank" rel="noopener">@nysh4real</a> in telegram)</div>

</div>

<script src="/script.js?v=8"></script>
</body>
</html>
