<?php

declare(strict_types=1);

require_once __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

function fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

$dir = data_dir();

if ($dir === '') {
    fail(500, 'storage unavailable');
}

$salt = install_salt();

if ($salt === '') {
    fail(500, 'storage unavailable');
}

$clientIp = client_ip();

if ($clientIp === '') {
    fail(400, 'no client address');
}

$fingerprint = hash('sha256', $salt . '|' . $clientIp);
$handle = @fopen($dir . '/views.json', 'c+');

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
