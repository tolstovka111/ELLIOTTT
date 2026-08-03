<?php

declare(strict_types=1);

require_once __DIR__ . '/api/lib.php';
require_once __DIR__ . '/api/ui.php';

if (isset($_COOKIE['realadmin'])) {
    admin_session_start();
}

$authed = !empty($_SESSION['admin']);

$key = (string) ($_GET['b'] ?? '');
$known = board_list() + page_list();

if (!isset($known[$key]) || $key === 'c' || $key === 'n') {
    require __DIR__ . '/404.php';
    exit;
}

$board = $known[$key];
$fragment = project_root() . '/pages/' . $key . '.html';

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e((string) $board['title']) ?> - 4real</title>
<link rel="icon" href="/assets/4real-logo.png">
<link rel="stylesheet" href="/style.css?v=14">
</head>
<body class="blue">

<?= board_nav($key) ?>

<div class="page wide">

<?= board_header((string) $board['title'], 'Go to the page', '#pagebody') ?>

	<div class="board">

		<div class="pagebody" id="pagebody">
<?php if (is_file($fragment)): ?>
<?php require $fragment; ?>
<?php endif; ?>
<?php $gallery = board_gallery($key); ?>
<?= $gallery ?>
<?php if (!is_file($fragment) && $gallery === ''): ?>
			<div class="empty">Nothing here yet.</div>
<?php endif; ?>
		</div>

	</div>

<?= page_footer($authed) ?>

</div>

<div class="lightbox" id="lightbox" hidden>
	<span class="lightbox-close" id="lightbox-close" title="Close">&#10005;</span>
	<div class="lightbox-stage" id="lightbox-stage"></div>
	<a class="lightbox-download" id="lightbox-download" download>Download</a>
</div>

<script src="/script.js?v=14"></script>
</body>
</html>
