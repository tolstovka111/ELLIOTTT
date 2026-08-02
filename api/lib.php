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
const BLOG_COMMENTS_OPEN = 3;
const ONLINE_WINDOW = 180;
const MAX_NAME = 32;
const MAX_CHAT_TEXT = 600;
const GEO_TTL = 2592000;
const EMOJI_BYTES = 2097152;
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

/**
 * Runs once, when the site moves to the shared counter: every message, post and
 * comment gets a number in the order it was written, and the nested replies are
 * flattened into ordinary entries that quote what they answered.
 */
function migrate_numbers(): void
{
    $dir = data_dir();

    if ($dir === '' || is_file($dir . '/seq.json')) {
        return;
    }

    $chat = chat_read();
    $posts = read_store();
    $pages = [];
    $pagesPath = $dir . '/pages.json';

    if (is_file($pagesPath)) {
        $raw = @file_get_contents($pagesPath);
        $decoded = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
        $pages = is_array($decoded) ? $decoded : [];
    }

    $flat = [];

    foreach ((array) ($chat['messages'] ?? []) as $index => $message) {
        $flat[] = ['at' => (int) ($message['created'] ?? 0), 'kind' => 'chat', 'i' => $index];

        foreach ((array) ($message['replies'] ?? []) as $spot => $reply) {
            $flat[] = ['at' => (int) ($reply['created'] ?? 0), 'kind' => 'chatreply', 'i' => $index, 'j' => $spot];
        }
    }

    foreach ((array) ($posts['posts'] ?? []) as $index => $post) {
        $flat[] = ['at' => (int) ($post['created'] ?? 0), 'kind' => 'post', 'i' => $index];

        foreach ((array) ($post['comments'] ?? []) as $spot => $comment) {
            $flat[] = ['at' => (int) ($comment['created'] ?? 0), 'kind' => 'comment', 'i' => $index, 'j' => $spot];

            foreach ((array) ($comment['answers'] ?? []) as $k => $answer) {
                $flat[] = ['at' => (int) ($answer['created'] ?? 0), 'kind' => 'answer', 'i' => $index, 'j' => $spot, 'k' => $k];
            }
        }
    }

    foreach ($pages as $key => $comments) {
        foreach ((array) $comments as $spot => $comment) {
            $flat[] = ['at' => (int) ($comment['created'] ?? 0), 'kind' => 'page', 'i' => $key, 'j' => $spot];

            foreach ((array) ($comment['answers'] ?? []) as $k => $answer) {
                $flat[] = ['at' => (int) ($answer['created'] ?? 0), 'kind' => 'pageanswer', 'i' => $key, 'j' => $spot, 'k' => $k];
            }
        }
    }

    usort($flat, static function (array $a, array $b): int {
        return $a['at'] <=> $b['at'];
    });

    $seq = 0;
    $extraChat = [];
    $extraComments = [];
    $extraPages = [];

    foreach ($flat as $row) {
        $seq++;

        if ($row['kind'] === 'chat') {
            $chat['messages'][$row['i']]['no'] = $seq;
        } elseif ($row['kind'] === 'chatreply') {
            $reply = $chat['messages'][$row['i']]['replies'][$row['j']];
            $reply['no'] = $seq;
            $reply['to'] = (int) ($chat['messages'][$row['i']]['no'] ?? 0);
            $reply['replies'] = [];
            $extraChat[] = $reply;
        } elseif ($row['kind'] === 'post') {
            $posts['posts'][$row['i']]['no'] = $seq;
        } elseif ($row['kind'] === 'comment') {
            $posts['posts'][$row['i']]['comments'][$row['j']]['no'] = $seq;
        } elseif ($row['kind'] === 'answer') {
            $answer = $posts['posts'][$row['i']]['comments'][$row['j']]['answers'][$row['k']];
            $answer['no'] = $seq;
            $answer['to'] = (int) ($posts['posts'][$row['i']]['comments'][$row['j']]['no'] ?? 0);
            $extraComments[$row['i']][] = $answer;
        } elseif ($row['kind'] === 'page') {
            $pages[$row['i']][$row['j']]['no'] = $seq;
        } elseif ($row['kind'] === 'pageanswer') {
            $answer = $pages[$row['i']][$row['j']]['answers'][$row['k']];
            $answer['no'] = $seq;
            $answer['to'] = (int) ($pages[$row['i']][$row['j']]['no'] ?? 0);
            $extraPages[$row['i']][] = $answer;
        }
    }

    foreach ((array) ($chat['messages'] ?? []) as $index => $message) {
        $chat['messages'][$index]['replies'] = [];
    }

    foreach ($extraChat as $reply) {
        $chat['messages'][] = $reply;
    }

    usort($chat['messages'], static function (array $a, array $b): int {
        return (int) ($b['created'] ?? 0) <=> (int) ($a['created'] ?? 0);
    });

    foreach ((array) ($posts['posts'] ?? []) as $index => $post) {
        foreach ((array) ($post['comments'] ?? []) as $spot => $comment) {
            unset($posts['posts'][$index]['comments'][$spot]['answers']);
        }

        foreach ((array) ($extraComments[$index] ?? []) as $answer) {
            $posts['posts'][$index]['comments'][] = $answer;
        }

        if (isset($posts['posts'][$index]['comments'])) {
            $list = array_values((array) $posts['posts'][$index]['comments']);
            usort($list, static function (array $a, array $b): int {
                return (int) ($a['created'] ?? 0) <=> (int) ($b['created'] ?? 0);
            });
            $posts['posts'][$index]['comments'] = $list;
        }
    }

    foreach ($pages as $key => $comments) {
        foreach ((array) $comments as $spot => $comment) {
            unset($pages[$key][$spot]['answers']);
        }

        foreach ((array) ($extraPages[$key] ?? []) as $answer) {
            $pages[$key][] = $answer;
        }

        $list = array_values((array) $pages[$key]);
        usort($list, static function (array $a, array $b): int {
            return (int) ($a['created'] ?? 0) <=> (int) ($b['created'] ?? 0);
        });
        $pages[$key] = $list;
    }

    unset($posts['pseq'], $chat['seq']);

    chat_write($chat);
    write_store($posts);

    if ($pages !== []) {
        @file_put_contents($pagesPath, (string) json_encode($pages), LOCK_EX);
    }

    seq_seed($seq);
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

function admin_name_path(): string
{
    $dir = data_dir();

    return $dir === '' ? '' : $dir . '/adminname.json';
}

function admin_profile(): array
{
    $fallback = ['name' => 'nysha4real', 'color' => 'yellow'];
    $path = admin_name_path();

    if ($path === '' || !is_file($path)) {
        return $fallback;
    }

    $raw = @file_get_contents($path);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

    if (!is_array($data)) {
        return $fallback;
    }

    $name = clean_name((string) ($data['name'] ?? ''));
    $color = (string) ($data['color'] ?? 'yellow');

    return [
        'name' => $name === '' ? 'nysha4real' : $name,
        'color' => $color === 'green' ? 'green' : 'yellow',
    ];
}

function admin_name(): string
{
    return (string) admin_profile()['name'];
}

function admin_color(): string
{
    return (string) admin_profile()['color'];
}

function save_admin_name(string $name, string $color): bool
{
    $path = admin_name_path();

    if ($path === '') {
        return false;
    }

    $body = (string) json_encode([
        'name' => $name,
        'color' => $color === 'green' ? 'green' : 'yellow',
    ]);

    return @file_put_contents($path, $body, LOCK_EX) !== false;
}

function poster_name_html(string $name, bool $isAdmin): string
{
    $class = 'msg-name';

    if ($isAdmin && admin_color() === 'yellow') {
        $class .= ' admin';
    }

    return '<span class="' . $class . '">' . e($name) . '</span>';
}

/**
 * One running number for the whole site: the chat, the blog and every comment
 * draw from the same counter, so No.N is unique wherever it shows up.
 */
function next_no(): int
{
    $dir = data_dir();

    if ($dir === '') {
        return 0;
    }

    $handle = @fopen($dir . '/seq.json', 'c+');

    if ($handle === false) {
        return 0;
    }

    if (!flock($handle, LOCK_EX)) {
        fclose($handle);

        return 0;
    }

    $raw = stream_get_contents($handle);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
    $next = (int) (is_array($data) ? ($data['seq'] ?? 0) : 0) + 1;

    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, (string) json_encode(['seq' => $next]));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    return $next;
}

function seq_seed(int $value): void
{
    $dir = data_dir();

    if ($dir !== '') {
        @file_put_contents($dir . '/seq.json', (string) json_encode(['seq' => $value]), LOCK_EX);
    }
}

function quote_html(array $item): string
{
    $to = (int) ($item['to'] ?? 0);

    if ($to <= 0) {
        return '';
    }

    return '<div class="quotelink"><a href="#p' . $to . '">&gt;&gt;' . $to . '</a></div>';
}

function emoji_dir(): string
{
    $dir = project_root() . '/assets/emoji';

    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return '';
        }
    }

    return is_writable($dir) ? $dir : '';
}

function clean_emoji_name(string $name): string
{
    $name = strtolower(trim($name));
    $name = preg_replace('/[^a-z0-9_-]+/', '', $name) ?? '';

    return mb_substr($name, 0, 32);
}

function geo_path(): string
{
    $dir = data_dir();

    return $dir === '' ? '' : $dir . '/geo.json';
}

function geo_lookup(string $ip): string
{
    $url = 'http://ip-api.com/json/' . rawurlencode($ip) . '?fields=countryCode';
    $body = '';

    if (function_exists('curl_init')) {
        $handle = curl_init($url);

        if ($handle !== false) {
            curl_setopt($handle, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($handle, CURLOPT_TIMEOUT, 2);
            curl_setopt($handle, CURLOPT_CONNECTTIMEOUT, 2);
            $result = curl_exec($handle);
            curl_close($handle);
            $body = is_string($result) ? $result : '';
        }
    }

    if ($body === '' && ini_get('allow_url_fopen')) {
        $context = stream_context_create(['http' => ['timeout' => 2, 'ignore_errors' => true]]);
        $result = @file_get_contents($url, false, $context);
        $body = is_string($result) ? $result : '';
    }

    if ($body === '') {
        return '';
    }

    $data = json_decode($body, true);
    $code = is_array($data) ? strtoupper((string) ($data['countryCode'] ?? '')) : '';

    return preg_match('/^[A-Z]{2}$/', $code) === 1 ? $code : '';
}

function visitor_country(): string
{
    $header = strtoupper(trim((string) ($_SERVER['HTTP_CF_IPCOUNTRY'] ?? '')));

    if (preg_match('/^[A-Z]{2}$/', $header) === 1 && $header !== 'XX' && $header !== 'T1') {
        return $header;
    }

    $ip = client_ip();

    if ($ip === '') {
        return '';
    }

    $public = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);

    if ($public === false) {
        return '';
    }

    $path = geo_path();

    if ($path === '') {
        return '';
    }

    $key = secret_hash('geo', $ip);
    $raw = @file_get_contents($path);
    $cache = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
    $cache = is_array($cache) ? $cache : [];
    $now = time();

    if (isset($cache[$key]['code'], $cache[$key]['seen']) && $now - (int) $cache[$key]['seen'] < GEO_TTL) {
        return (string) $cache[$key]['code'];
    }

    $code = geo_lookup($ip);

    foreach ($cache as $entry => $row) {
        if ($now - (int) ($row['seen'] ?? 0) > GEO_TTL) {
            unset($cache[$entry]);
        }
    }

    $cache[$key] = ['code' => $code, 'seen' => $now];
    @file_put_contents($path, (string) json_encode($cache), LOCK_EX);

    return $code;
}

function country_flag_html(string $code): string
{
    if (preg_match('/^[A-Za-z]{2}$/', $code) !== 1) {
        return '';
    }

    $code = strtoupper($code);
    $flag = '';

    for ($i = 0; $i < 2; $i++) {
        $flag .= mb_chr(0x1F1E6 + (ord($code[$i]) - 65), 'UTF-8');
    }

    return '<span class="msg-flag" title="' . e($code) . '">' . $flag . '</span>';
}

function ad_banners(): array
{
    $dir = project_root() . '/assets/adbanners';

    if (!is_dir($dir)) {
        return [];
    }

    $boards = ['o', 'm', 'a', 'i', 'b', 'c'];
    $found = [];

    foreach ((array) scandir($dir) as $file) {
        if (!is_string($file) || $file === '' || $file[0] === '.') {
            continue;
        }

        $extension = strtolower((string) pathinfo($file, PATHINFO_EXTENSION));

        if (!in_array($extension, ['gif', 'png', 'jpg', 'jpeg', 'webp'], true)) {
            continue;
        }

        $name = (string) pathinfo($file, PATHINFO_FILENAME);
        $board = strtolower(explode('-', $name)[0]);

        $found[] = [
            'src' => '/assets/adbanners/' . $file,
            'href' => in_array($board, $boards, true) ? '/' . $board . '/' : '/home',
        ];
    }

    return $found;
}

function random_ad_banner(): array
{
    $banners = ad_banners();

    if ($banners === []) {
        return [];
    }

    return $banners[random_int(0, count($banners) - 1)];
}

function media_info(string $file, string $folder): array
{
    $name = basename($file);
    $path = project_root() . '/assets/' . $folder . '/' . $name;

    if ($name === '' || !is_file($path)) {
        return [];
    }

    $size = (int) @filesize($path);
    $info = @getimagesize($path);

    return [
        'size' => $size,
        'w' => $info === false ? 0 : (int) $info[0],
        'h' => $info === false ? 0 : (int) $info[1],
    ];
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
