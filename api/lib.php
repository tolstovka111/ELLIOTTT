<?php

declare(strict_types=1);

const POST_TTL = 172800;
const MAX_IMAGES = 3;
const MAX_TEXT = 1000;
const MAX_UPLOAD_BYTES = 5242880;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_SECONDS = 900;

function project_root(): string
{
    return dirname(__DIR__);
}

function data_dir(): string
{
    $dir = __DIR__ . '/data';

    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0770, true) && !is_dir($dir)) {
            return '';
        }
        @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
        @file_put_contents($dir . '/index.html', '');
    }

    return is_writable($dir) ? $dir : '';
}

function uploads_dir(): string
{
    $dir = project_root() . '/assets/blog';

    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return '';
        }
    }

    $guard = $dir . '/.htaccess';

    if (!is_file($guard)) {
        @file_put_contents(
            $guard,
            "<FilesMatch \"\\.(php|php[0-9]|phtml|phar|cgi|pl|py|sh)$\">\nRequire all denied\nDeny from all\n</FilesMatch>\n"
        );
    }

    return is_writable($dir) ? $dir : '';
}

function config_path(): string
{
    return __DIR__ . '/config.php';
}

function load_config(): ?array
{
    $path = config_path();

    if (!is_file($path)) {
        return null;
    }

    $config = require $path;

    if (!is_array($config) || !isset($config['user_hash'], $config['pass_hash'], $config['key_hash'])) {
        return null;
    }

    return $config;
}

function secret_hash(string $kind, string $value): string
{
    return hash('sha256', install_salt() . '|' . $kind . '|' . $value);
}

function save_config(string $userHash, string $passHash, string $keyHash): bool
{
    $body = "<?php\n\nreturn " . var_export([
        'user_hash' => $userHash,
        'pass_hash' => $passHash,
        'key_hash' => $keyHash,
    ], true) . ";\n";

    if (@file_put_contents(config_path(), $body, LOCK_EX) === false) {
        return false;
    }

    @chmod(config_path(), 0640);

    return true;
}

function store_path(): string
{
    $dir = data_dir();

    return $dir === '' ? '' : $dir . '/posts.json';
}

function read_store(): array
{
    $path = store_path();

    if ($path === '' || !is_file($path)) {
        return ['posts' => []];
    }

    $raw = @file_get_contents($path);
    $store = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

    if (!is_array($store) || !isset($store['posts']) || !is_array($store['posts'])) {
        return ['posts' => []];
    }

    return $store;
}

function write_store(array $store): bool
{
    $path = store_path();

    if ($path === '') {
        return false;
    }

    return @file_put_contents($path, (string) json_encode($store), LOCK_EX) !== false;
}

function drop_images(array $post): void
{
    $dir = uploads_dir();

    if ($dir === '' || !isset($post['images']) || !is_array($post['images'])) {
        return;
    }

    foreach ($post['images'] as $image) {
        $file = isset($image['file']) ? basename((string) $image['file']) : '';

        if ($file !== '' && is_file($dir . '/' . $file)) {
            @unlink($dir . '/' . $file);
        }
    }
}

function live_posts(): array
{
    $store = read_store();
    $now = time();
    $kept = [];
    $expired = [];

    foreach ($store['posts'] as $post) {
        if (!is_array($post) || !isset($post['created'])) {
            continue;
        }

        if ($now - (int) $post['created'] < POST_TTL) {
            $kept[] = $post;
        } else {
            $expired[] = $post;
        }
    }

    if ($expired !== []) {
        foreach ($expired as $post) {
            drop_images($post);
        }
        write_store(['posts' => $kept]);
    }

    usort($kept, static function (array $a, array $b): int {
        return (int) $b['created'] <=> (int) $a['created'];
    });

    return $kept;
}

function public_posts(): array
{
    $now = time();
    $out = [];

    foreach (live_posts() as $post) {
        $images = [];

        foreach ((array) ($post['images'] ?? []) as $image) {
            $file = isset($image['file']) ? basename((string) $image['file']) : '';

            if ($file === '') {
                continue;
            }

            $images[] = [
                'src' => 'assets/blog/' . $file,
                'link' => (string) ($image['link'] ?? ''),
            ];
        }

        $out[] = [
            'id' => (string) ($post['id'] ?? ''),
            'text' => (string) ($post['text'] ?? ''),
            'images' => $images,
            'age' => max(0, $now - (int) $post['created']),
        ];
    }

    return $out;
}

function client_ip(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');

    if (getenv('VIEWS_TRUST_PROXY') === '1') {
        $forwarded = (string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');

        if ($forwarded !== '') {
            $first = trim(explode(',', $forwarded)[0]);

            if (filter_var($first, FILTER_VALIDATE_IP) !== false) {
                return $first;
            }
        }
    }

    return $ip;
}

function install_salt(): string
{
    $dir = data_dir();

    if ($dir === '') {
        return '';
    }

    $file = $dir . '/salt';

    if (!is_file($file)) {
        @file_put_contents($file, bin2hex(random_bytes(32)), LOCK_EX);
        @chmod($file, 0640);
    }

    return trim((string) @file_get_contents($file));
}
