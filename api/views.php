<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

function fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

$dataDir = __DIR__ . '/data';

if (!is_dir($dataDir)) {
    if (!@mkdir($dataDir, 0770, true) && !is_dir($dataDir)) {
        fail(500, 'storage unavailable');
    }
    @file_put_contents($dataDir . '/.htaccess', "Require all denied\nDeny from all\n");
    @file_put_contents($dataDir . '/index.html', '');
}

$saltFile = $dataDir . '/salt';

if (!is_file($saltFile)) {
    if (@file_put_contents($saltFile, bin2hex(random_bytes(32)), LOCK_EX) === false) {
        fail(500, 'storage unavailable');
    }
    @chmod($saltFile, 0640);
}

$salt = trim((string) @file_get_contents($saltFile));

if ($salt === '') {
    fail(500, 'storage unavailable');
}

$clientIp = (string) ($_SERVER['REMOTE_ADDR'] ?? '');

if (getenv('VIEWS_TRUST_PROXY') === '1') {
    $forwarded = (string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');

    if ($forwarded !== '') {
        $first = trim(explode(',', $forwarded)[0]);

        if (filter_var($first, FILTER_VALIDATE_IP) !== false) {
            $clientIp = $first;
        }
    }
}

if ($clientIp === '') {
    fail(400, 'no client address');
}

$fingerprint = hash('sha256', $salt . '|' . $clientIp);
$storeFile = $dataDir . '/views.json';
$handle = @fopen($storeFile, 'c+');

if ($handle === false) {
    fail(500, 'storage unavailable');
}

if (!flock($handle, LOCK_EX)) {
    fclose($handle);
    fail(500, 'storage busy');
}

$raw = stream_get_contents($handle);
$store = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

if (!is_array($store) || !isset($store['total'], $store['visitors']) || !is_array($store['visitors'])) {
    $store = ['total' => 0, 'visitors' => []];
}

if (!isset($store['visitors'][$fingerprint])) {
    $store['visitors'][$fingerprint] = time();
    $store['total'] = (int) $store['total'] + 1;

    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, (string) json_encode($store));
    fflush($handle);
}

flock($handle, LOCK_UN);
fclose($handle);

echo json_encode(['views' => (int) $store['total']]);
