<?php

declare(strict_types=1);

require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

echo json_encode(['posts' => public_posts()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
