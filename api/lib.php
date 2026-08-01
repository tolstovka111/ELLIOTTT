<?php

declare(strict_types=1);

const POST_TTL = 172800;
const MAX_IMAGES = 3;
const MAX_TEXT = 1000;
const MAX_UPLOAD_BYTES = 5242880;
const MAX_VIDEO_BYTES = 15728640;
const CHAT_UPLOAD_BYTES = 3145728;
const CHAT_COOLDOWN = 60;
const CHAT_KEEP = 300;
const FRONT_POSTS = 8;
const PREVIEW_CHARS = 110;
const COMMENTS_OPEN = 5;
const ONLINE_WINDOW = 180;
const MAX_NAME = 32;
const MAX_CHAT_TEXT = 600;
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

function chat_dir(): string
{
    $dir = project_root() . '/assets/chat';

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

function image_types(): array
{
    return [
        IMAGETYPE_JPEG => '.jpg',
        IMAGETYPE_PNG => '.png',
        IMAGETYPE_GIF => '.gif',
        IMAGETYPE_WEBP => '.webp',
    ];
}

function video_types(): array
{
    return [
        'video/mp4' => '.mp4',
        'video/quicktime' => '.mp4',
        'application/mp4' => '.mp4',
    ];
}

function drop_files(array $post): void
{
    $dir = uploads_dir();

    if ($dir === '') {
        return;
    }

    foreach ((array) ($post['images'] ?? []) as $image) {
        $name = (string) ($image['file'] ?? '');
        $file = $name === '' ? '' : basename($name);

        if ($file !== '' && is_file($dir . '/' . $file)) {
            @unlink($dir . '/' . $file);
        }
    }
}

function post_backgrounds(): array
{
    return ['default', 'dark', 'coffee', 'green'];
}

function all_posts(): array
{
    $store = read_store();
    $posts = [];

    foreach ($store['posts'] as $post) {
        if (is_array($post) && isset($post['created'])) {
            $posts[] = $post;
        }
    }

    usort($posts, static function (array $a, array $b): int {
        return (int) $b['created'] <=> (int) $a['created'];
    });

    return $posts;
}

function live_posts(): array
{
    $now = time();
    $fresh = [];

    foreach (all_posts() as $post) {
        if ($now - (int) $post['created'] < POST_TTL) {
            $fresh[] = $post;
        }
    }

    return array_slice($fresh, 0, FRONT_POSTS);
}

function post_thumb(array $post): string
{
    foreach ((array) ($post['images'] ?? []) as $media) {
        if ((string) ($media['type'] ?? 'image') === 'image') {
            return '/assets/blog/' . basename((string) $media['file']);
        }
    }

    return '';
}

function shorten(string $text, int $limit): string
{
    $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');

    if (mb_strlen($text) <= $limit) {
        return $text;
    }

    return rtrim(mb_substr($text, 0, $limit)) . '...';
}

function comments_dir(): string
{
    $dir = project_root() . '/assets/comments';

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

function public_token(): string
{
    return hash_hmac('sha256', 'public|' . gmdate('YmdH'), install_salt() . '|' . client_ip());
}

function public_token_valid(string $sent): bool
{
    if ($sent === '') {
        return false;
    }

    if (hash_equals(public_token(), $sent)) {
        return true;
    }

    $previous = hash_hmac('sha256', 'public|' . gmdate('YmdH', time() - 3600), install_salt() . '|' . client_ip());

    return hash_equals($previous, $sent);
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
            $map[$name] = '/assets/emoji/' . $file;
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

function chat_path(): string
{
    $dir = data_dir();

    return $dir === '' ? '' : $dir . '/chat.json';
}

function chat_read(): array
{
    $path = chat_path();

    if ($path === '' || !is_file($path)) {
        return ['messages' => []];
    }

    $raw = @file_get_contents($path);
    $store = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

    if (!is_array($store) || !isset($store['messages']) || !is_array($store['messages'])) {
        return ['messages' => []];
    }

    return $store;
}

function chat_write(array $store): bool
{
    $path = chat_path();

    if ($path === '') {
        return false;
    }

    if (count($store['messages']) > CHAT_KEEP) {
        $extra = array_slice($store['messages'], CHAT_KEEP);

        foreach ($extra as $message) {
            chat_drop_file($message);
        }

        $store['messages'] = array_slice($store['messages'], 0, CHAT_KEEP);
    }

    return @file_put_contents($path, (string) json_encode($store), LOCK_EX) !== false;
}

function chat_drop_file(array $message): void
{
    $dir = chat_dir();

    if ($dir === '') {
        return;
    }

    $name = (string) ($message['file'] ?? '');
    $file = $name === '' ? '' : basename($name);

    if ($file !== '' && is_file($dir . '/' . $file)) {
        @unlink($dir . '/' . $file);
    }
}

function visitor_hash(): string
{
    return secret_hash('chat', client_ip());
}

function chat_cooldown_left(): int
{
    $dir = data_dir();

    if ($dir === '') {
        return 0;
    }

    $path = $dir . '/chatrate.json';

    if (!is_file($path)) {
        return 0;
    }

    $raw = @file_get_contents($path);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

    if (!is_array($data)) {
        return 0;
    }

    $last = (int) ($data[visitor_hash()] ?? 0);

    return max(0, CHAT_COOLDOWN - (time() - $last));
}

function chat_touch_cooldown(): void
{
    $dir = data_dir();

    if ($dir === '') {
        return;
    }

    $path = $dir . '/chatrate.json';
    $raw = @file_get_contents($path);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
    $data = is_array($data) ? $data : [];
    $now = time();
    $data[visitor_hash()] = $now;

    foreach ($data as $key => $stamp) {
        if ($now - (int) $stamp > 86400) {
            unset($data[$key]);
        }
    }

    @file_put_contents($path, (string) json_encode($data), LOCK_EX);
}

function chat_age(int $seconds): string
{
    if ($seconds < 60) {
        return 'just now';
    }

    $units = [
        [31536000, 'year'],
        [2592000, 'month'],
        [604800, 'week'],
        [86400, 'day'],
        [3600, 'hour'],
        [60, 'minute'],
    ];

    foreach ($units as $unit) {
        if ($seconds >= $unit[0]) {
            $value = (int) floor($seconds / $unit[0]);

            return $value . ' ' . $unit[1] . ($value === 1 ? '' : 's') . ' ago';
        }
    }

    return 'just now';
}

function clean_name(string $name): string
{
    $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
    $name = str_replace(["\0", "\r", "\n"], '', $name);

    return mb_substr($name, 0, MAX_NAME);
}

function format_size(int $bytes): string
{
    if ($bytes >= 1048576) {
        return round($bytes / 1048576, 1) . ' MB';
    }

    if ($bytes >= 1024) {
        return (int) round($bytes / 1024) . ' KB';
    }

    return $bytes . ' B';
}

function clean_filename(string $name): string
{
    $name = basename(str_replace('\\', '/', $name));
    $name = preg_replace('/[^\w.\- ]+/u', '', $name) ?? '';
    $name = trim($name);

    return $name === '' ? 'file' : mb_substr($name, 0, 60);
}

function online_count(bool $touch): int
{
    $dir = data_dir();

    if ($dir === '') {
        return 0;
    }

    $handle = @fopen($dir . '/online.json', 'c+');

    if ($handle === false) {
        return 0;
    }

    if (!flock($handle, LOCK_EX)) {
        fclose($handle);

        return 0;
    }

    $raw = stream_get_contents($handle);
    $seen = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
    $seen = is_array($seen) ? $seen : [];
    $now = time();

    foreach ($seen as $key => $stamp) {
        if ($now - (int) $stamp > ONLINE_WINDOW) {
            unset($seen[$key]);
        }
    }

    if ($touch) {
        $seen[visitor_hash()] = $now;
    }

    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, (string) json_encode($seen));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    return count($seen);
}

function random_asset(string $folder, array $extensions): string
{
    $dir = project_root() . '/assets/' . $folder;

    if (!is_dir($dir)) {
        return '';
    }

    $found = [];

    foreach ((array) scandir($dir) as $file) {
        if (!is_string($file) || $file === '' || $file[0] === '.') {
            continue;
        }

        if (in_array(strtolower((string) pathinfo($file, PATHINFO_EXTENSION)), $extensions, true)) {
            $found[] = '/assets/' . $folder . '/' . $file;
        }
    }

    if ($found === []) {
        return '';
    }

    return $found[random_int(0, count($found) - 1)];
}
