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
$place = visitor_place();
[$handle, $raw] = data_open('views.json');

if ($handle === null) {
    fail(500, 'storage unavailable');
}

$store = $raw === '' ? null : json_decode($raw, true);
$store = views_normalise(is_array($store) ? $store : []);

$now = time();
$today = gmdate('Y-m-d', $now);
$entry = $store['visitors'][$fingerprint] ?? null;

if (!is_array($entry)) {
    $store['visitors'][$fingerprint] = [
        'ip' => $clientIp,
        'country' => (string) $place['code'],
        'name' => (string) $place['country'],
        'city' => (string) $place['city'],
        'first' => $now,
        'last' => $now,
        'hits' => 1,
    ];
    $store['total'] = (int) $store['total'] + 1;
} else {
    $entry['ip'] = $clientIp;
    $entry['last'] = $now;
    $entry['hits'] = (int) ($entry['hits'] ?? 0) + 1;

    if ((string) $place['code'] !== '') {
        $entry['country'] = (string) $place['code'];
        $entry['name'] = (string) $place['country'];
        $entry['city'] = (string) $place['city'];
    }

    $store['visitors'][$fingerprint] = $entry;
}

$store['days'][$today] = (int) ($store['days'][$today] ?? 0) + 1;
$store = views_trim($store);

data_close($handle, (string) json_encode($store));

echo json_encode(['views' => (int) $store['total']]);
