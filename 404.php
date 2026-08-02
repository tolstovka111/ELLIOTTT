<?php

declare(strict_types=1);

require_once __DIR__ . '/api/lib.php';

http_response_code(404);

$dir = project_root() . '/assets/404';
$pictures = [];

if (is_dir($dir)) {
    foreach ((array) scandir($dir) as $file) {
        if (!is_string($file) || $file === '' || $file[0] === '.') {
            continue;
        }

        $extension = strtolower((string) pathinfo($file, PATHINFO_EXTENSION));

        if (in_array($extension, ['png', 'gif', 'webp', 'jpg', 'jpeg', 'svg'], true)) {
            $pictures[] = '/assets/404/' . $file;
        }
    }
}

$picture = $pictures === [] ? '' : $pictures[random_int(0, count($pictures) - 1)];

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>404 Not Found - 4real</title>
<link rel="icon" href="/assets/4real-logo.png">
<link rel="stylesheet" href="/style.css?v=8">
</head>
<body class="blue">

<div class="logo">
	<a href="/404.php"><img src="/assets/4real-logo.png" alt="4real"></a>
</div>

<div class="page">

	<div class="box">
		<div class="box-title centered">404 Not Found</div>
		<div class="notfound">
<?php if ($picture !== ''): ?>
			<img src="<?= e($picture) ?>" alt="404">
<?php else: ?>
			<div class="notfound-fallback">404</div>
<?php endif; ?>
		</div>
	</div>

	<div class="pagelinks">
		<a href="/home">Home</a>
		<span class="dot">&#9679;</span>
		<a href="/faq">FAQ</a>
		<span class="dot">&#9679;</span>
		<a href="/rules">Rules</a>
	</div>

	<div class="copyright">Copyright &copy; 2025-2026 4real community support. All rights reserved</div>

	<div class="madeby">created by tolstovka (<a href="https://t.me/nysh4real" target="_blank" rel="noopener">@nysh4real</a> in telegram)</div>

</div>

</body>
</html>
