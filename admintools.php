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
$adminColour = admin_color();
$now = time();
$views = views_read();
$series = views_series($views['days'], 30);
$peak = max(1, $series === [] ? 1 : max($series));
$visitors = $views['visitors'];
uasort($visitors, static function (array $a, array $b): int {
    return (int) $b['last'] <=> (int) $a['last'];
});

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
<link rel="stylesheet" href="/style.css?v=17">
</head>
<body class="blue">

<div class="logo">
	<a href="/home"><img src="/assets/4real-logo.png" alt="4real"></a>
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

			<div class="box-body notice">A post without a picture or a video is published, but it stays off the front page and only shows on /n/.</div>

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
				<div class="formlabel"></div>
				<div class="formfield"><button type="submit">Post</button></div>
			</div>
		</form>
	</div>

	<div class="box">
		<div class="box-title">Admin nickname</div>
		<div class="box-body">
			<p>This is the name your posts, comments and chat messages are signed with, up to <?= MAX_NAME ?> characters. Pick whether it stands out in yellow or blends in with the green of everybody else.</p>
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
					<div class="formlabel">Colour</div>
					<div class="formfield">
						<label class="adminswitch"><input type="radio" name="colour" value="yellow" id="tag-yellow"<?= $adminColour === 'yellow' ? ' checked' : '' ?>><span>Yellow (admin)</span></label>
						<label class="adminswitch"><input type="radio" name="colour" value="green" id="tag-green"<?= $adminColour === 'green' ? ' checked' : '' ?>><span>Green (like everyone)</span></label>
					</div>
				</div>

				<div class="formrow">
					<div class="formlabel">Preview</div>
					<div class="formfield">
						<span class="msg-name<?= $adminColour === 'yellow' ? ' admin' : '' ?>" id="tag-preview"><?= e($adminName) ?></span>
					</div>
				</div>

				<div class="formrow">
					<div class="formlabel"></div>
					<div class="formfield"><button type="submit">Save nickname</button></div>
				</div>
			</form>
		</div>
	</div>

	<div class="box">
		<div class="box-title">Emoji</div>
		<div class="box-body">
			<p>The file name is the shortcode: <code>pepecry.png</code> becomes <code>:pepecry:</code>. PNG, GIF, WEBP or JPG up to 2 MB.</p>
			<form method="post" action="/admin.php" enctype="multipart/form-data" class="emojiform">
				<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
				<input type="hidden" name="action" value="emoji">
				<input type="file" name="emoji" accept="image/png,image/gif,image/webp,image/jpeg" required>
				<input type="text" name="code" maxlength="32" placeholder="name (optional)">
				<button type="submit">Add emoji</button>
			</form>
		</div>
<?php if ($emoji !== []): ?>
		<div class="box-body emojilist">
<?php foreach ($emoji as $name => $src): ?>
			<div class="emojicard">
				<img src="<?= e($src) ?>" alt=":<?= e($name) ?>:">
				<span class="emojicode">:<?= e($name) ?>:</span>
				<form method="post" action="/admin.php">
					<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
					<input type="hidden" name="action" value="unemoji">
					<input type="hidden" name="code" value="<?= e($name) ?>">
					<button type="submit">remove</button>
				</form>
			</div>
<?php endforeach; ?>
		</div>
<?php endif; ?>
	</div>

	<form method="post" action="/admin.php" id="logout-form">
		<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
		<input type="hidden" name="action" value="logout">
	</form>

	<div class="box">
		<div class="box-title">Site stats</div>
		<div class="box-body stats-summary">
			<span class="stat"><b><?= number_format((int) $views['total']) ?></b> unique visitors</span>
			<span class="stat"><b><?= number_format(array_sum($views['days'])) ?></b> page views</span>
			<span class="stat"><b><?= number_format(online_count(false)) ?></b> online now</span>
		</div>
		<div class="box-body">
			<div class="chart" id="views-chart" data-peak="<?= $peak ?>">
<?php
$count = count($series);
$width = 720;
$height = 180;
$padLeft = 34;
$padBottom = 22;
$padTop = 10;
$step = $count > 1 ? ($width - $padLeft - 8) / ($count - 1) : 0;
$points = [];
$dots = [];
$index = 0;

foreach ($series as $date => $hits) {
    $x = $padLeft + ($step * $index);
    $y = $padTop + (($height - $padTop - $padBottom) * (1 - ($hits / $peak)));
    $points[] = round($x, 1) . ',' . round($y, 1);
    $dots[] = ['x' => round($x, 1), 'y' => round($y, 1), 'date' => $date, 'hits' => $hits];
    $index++;
}
?>
				<svg viewBox="0 0 <?= $width ?> <?= $height ?>" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Page views per day">
<?php for ($line = 0; $line <= 4; $line++): ?>
<?php $gy = $padTop + (($height - $padTop - $padBottom) / 4 * $line); ?>
					<line class="chart-grid" x1="<?= $padLeft ?>" y1="<?= round($gy, 1) ?>" x2="<?= $width - 8 ?>" y2="<?= round($gy, 1) ?>"></line>
					<text class="chart-axis" x="<?= $padLeft - 6 ?>" y="<?= round($gy + 3, 1) ?>" text-anchor="end"><?= (int) round($peak - ($peak / 4 * $line)) ?></text>
<?php endfor; ?>
					<polyline class="chart-line" points="<?= e(implode(' ', $points)) ?>"></polyline>
<?php foreach ($dots as $spot => $dot): ?>
					<circle class="chart-dot" cx="<?= $dot['x'] ?>" cy="<?= $dot['y'] ?>" r="3" data-date="<?= e((string) $dot['date']) ?>" data-hits="<?= (int) $dot['hits'] ?>"></circle>
<?php if ($spot === 0 || $spot === (int) floor($count / 2) || $spot === $count - 1): ?>
					<text class="chart-axis" x="<?= $dot['x'] ?>" y="<?= $height - 6 ?>" text-anchor="middle"><?= e(gmdate('d M', (int) strtotime((string) $dot['date']))) ?></text>
<?php endif; ?>
<?php endforeach; ?>
				</svg>
				<div class="chart-tip" id="chart-tip" hidden></div>
			</div>
			<div class="chart-note">Page views per day over the last 30 days.</div>
		</div>
	</div>

	<div class="box">
		<div class="box-title">Visitors</div>
<?php if ($visitors === []): ?>
		<div class="empty">Nobody has been here yet.</div>
<?php else: ?>
		<div class="tablewrap">
			<table class="datatable">
				<thead>
					<tr><th>Address</th><th>Location</th><th>Views</th><th>First seen</th><th>Last seen</th></tr>
				</thead>
				<tbody>
<?php foreach ($visitors as $visitor): ?>
					<tr>
						<td><?= $visitor['ip'] === '' ? '<span class="muted">hidden</span>' : e((string) $visitor['ip']) ?></td>
	<?php $where = place_label($visitor); ?>
						<td><?= $visitor['country'] === '' ? '<span class="muted">&mdash;</span>' : country_flag_html((string) $visitor['country']) . ' ' . e($where === '' ? (string) $visitor['country'] : $where) ?></td>
						<td><?= number_format((int) $visitor['hits']) ?></td>
						<td><span class="msg-date" data-ts="<?= (int) $visitor['first'] ?>"><?= e(gmdate('m/d/y(D)H:i:s', (int) $visitor['first'])) ?></span></td>
						<td><span class="msg-date" data-ts="<?= (int) $visitor['last'] ?>"><?= e(gmdate('m/d/y(D)H:i:s', (int) $visitor['last'])) ?></span></td>
					</tr>
<?php endforeach; ?>
				</tbody>
			</table>
		</div>
		<div class="chart-note">Addresses recorded from <?= count($visitors) ?> visitor<?= count($visitors) === 1 ? '' : 's' ?>. Rows added before this update show no address.</div>
<?php endif; ?>
	</div>

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
			<div class="date"><?= e(relative_age($now - (int) $post['created'])) ?><?= (int) ($post['no'] ?? 0) > 0 ? ' &middot; No.' . (int) $post['no'] : '' ?></div>
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
		<a href="/faq/">FAQ</a>
		<span class="dot">&#9679;</span>
		<a href="/rules/">Rules</a>
		<span class="dot">&#9679;</span>
		<a href="/admintools.php">Admin Tools</a>
	</div>

	<div class="copyright">Copyright &copy; 2025-2026 4real community support. All rights reserved</div>

	<div class="madeby">created by tolstovka (<a href="https://t.me/nysh4real" target="_blank" rel="noopener">@nysh4real</a> in telegram)</div>

</div>

<script src="/script.js?v=17"></script>
</body>
</html>
