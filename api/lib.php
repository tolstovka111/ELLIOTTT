<?php

declare(strict_types=1);

const POST_TTL = 172800;
const MAX_IMAGES = 3;
const MAX_TEXT = 1000;
const MAX_UPLOAD_BYTES = 5242880;
const MAX_AUDIO_BYTES = 20971520;
const MAX_META = 120;
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

function drop_files(array $post): void
{
    $dir = uploads_dir();

    if ($dir === '') {
        return;
    }

    $names = [];

    foreach ((array) ($post['images'] ?? []) as $image) {
        $names[] = (string) ($image['file'] ?? '');
    }

    if (isset($post['audio']) && is_array($post['audio'])) {
        $names[] = (string) ($post['audio']['file'] ?? '');
        $names[] = (string) ($post['audio']['cover'] ?? '');
    }

    foreach ($names as $name) {
        $file = $name === '' ? '' : basename($name);

        if ($file !== '' && is_file($dir . '/' . $file)) {
            @unlink($dir . '/' . $file);
        }
    }
}

function audio_types(): array
{
    return [
        'audio/mpeg' => '.mp3',
        'audio/mp3' => '.mp3',
        'audio/ogg' => '.ogg',
        'application/ogg' => '.ogg',
        'audio/wav' => '.wav',
        'audio/x-wav' => '.wav',
        'audio/mp4' => '.m4a',
        'audio/x-m4a' => '.m4a',
        'audio/aac' => '.m4a',
        'audio/flac' => '.flac',
        'audio/x-flac' => '.flac',
    ];
}

function syncsafe_int(string $bytes): int
{
    $value = 0;

    for ($i = 0; $i < strlen($bytes); $i++) {
        $value = ($value << 7) | (ord($bytes[$i]) & 0x7f);
    }

    return $value;
}

function id3_decode_text(int $encoding, string $raw): string
{
    $charsets = [0 => 'ISO-8859-1', 1 => 'UTF-16', 2 => 'UTF-16BE', 3 => 'UTF-8'];
    $charset = $charsets[$encoding] ?? 'ISO-8859-1';
    $text = (string) @mb_convert_encoding($raw, 'UTF-8', $charset);

    return trim(str_replace("\0", '', $text));
}

function id3_read(string $path): array
{
    $handle = @fopen($path, 'rb');

    if ($handle === false) {
        return [];
    }

    $header = (string) fread($handle, 10);

    if (strlen($header) < 10 || substr($header, 0, 3) !== 'ID3') {
        fclose($handle);

        return [];
    }

    $major = ord($header[3]);
    $size = syncsafe_int(substr($header, 6, 4));

    if ($major < 3 || $size <= 0 || $size > 4194304) {
        fclose($handle);

        return [];
    }

    $body = (string) fread($handle, $size);
    fclose($handle);

    $tags = [];
    $offset = 0;
    $length = strlen($body);

    while ($offset + 10 <= $length) {
        $id = substr($body, $offset, 4);

        if (preg_match('/^[A-Z0-9]{4}$/', $id) !== 1) {
            break;
        }

        $raw = substr($body, $offset + 4, 4);
        $frameSize = $major >= 4 ? syncsafe_int($raw) : (int) unpack('N', $raw)[1];
        $offset += 10;

        if ($frameSize <= 0 || $offset + $frameSize > $length) {
            break;
        }

        $frame = substr($body, $offset, $frameSize);
        $offset += $frameSize;

        if ($id === 'TIT2' || $id === 'TPE1') {
            $key = $id === 'TIT2' ? 'title' : 'author';
            $tags[$key] = id3_decode_text(ord($frame[0]), substr($frame, 1));
            continue;
        }

        if ($id === 'APIC' && !isset($tags['cover'])) {
            $encoding = ord($frame[0]);
            $rest = substr($frame, 1);
            $split = strpos($rest, "\0");

            if ($split === false) {
                continue;
            }

            $mime = strtolower(substr($rest, 0, $split));
            $rest = substr($rest, $split + 2);

            if ($encoding === 1 || $encoding === 2) {
                $end = strpos($rest, "\0\0");
                $rest = $end === false ? '' : substr($rest, $end + 2);
            } else {
                $end = strpos($rest, "\0");
                $rest = $end === false ? '' : substr($rest, $end + 1);
            }

            if ($rest !== '') {
                $tags['cover'] = ['mime' => $mime, 'data' => $rest];
            }
        }
    }

    return $tags;
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
            drop_files($post);
        }
        write_store(['posts' => $kept]);
    }

    usort($kept, static function (array $a, array $b): int {
        return (int) $b['created'] <=> (int) $a['created'];
    });

    return $kept;
}

function relative_age(int $seconds): string
{
    if ($seconds < 60) {
        return 'just now';
    }

    if ($seconds < 3600) {
        $minutes = (int) floor($seconds / 60);

        return $minutes . ($minutes === 1 ? ' minute ago' : ' minutes ago');
    }

    if ($seconds < 86400) {
        $hours = (int) floor($seconds / 3600);

        return $hours . ($hours === 1 ? ' hour ago' : ' hours ago');
    }

    return 'yesterday';
}

function admin_session_start(): void
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    session_name('realadmin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Strict',
        'secure' => $secure,
    ]);
    session_start();
}

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function emoji_map(): array
{
    $dir = project_root() . '/assets/emoji';

    if (!is_dir($dir)) {
        return [];
    }

    $map = [];

    foreach ((array) scandir($dir) as $file) {
        if (!is_string($file) || $file === '' || $file[0] === '.') {
            continue;
        }

        $extension = strtolower((string) pathinfo($file, PATHINFO_EXTENSION));

        if (!in_array($extension, ['png', 'gif', 'webp', 'jpg', 'jpeg'], true)) {
            continue;
        }

        $name = (string) pathinfo($file, PATHINFO_FILENAME);

        if (preg_match('/^[a-z0-9_-]+$/i', $name) === 1) {
            $map[$name] = 'assets/emoji/' . $file;
        }
    }

    ksort($map);

    return $map;
}

function render_post_text(string $text): string
{
    $safe = htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $map = emoji_map();

    if ($map === []) {
        return $safe;
    }

    return (string) preg_replace_callback(
        '/:([A-Za-z0-9_-]+):/',
        static function (array $match) use ($map): string {
            $name = $match[1];

            if (!isset($map[$name])) {
                return $match[0];
            }

            return '<img class="emoji" src="' . htmlspecialchars($map[$name], ENT_QUOTES) . '" alt=":' . htmlspecialchars($name, ENT_QUOTES) . ':">';
        },
        $safe
    );
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
