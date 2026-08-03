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
const VIEWS_DAYS_KEPT = 120;
const VIEWS_MAX_VISITORS = 4000;
const GEO_MAX = 20000;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_SECONDS = 900;

/**
 * Every file under api/data is written as PHP that exits at once, so fetching
 * one over HTTP returns nothing even where .htaccess is ignored.
 */
const DATA_GUARD = "<?php exit; ?>\n";

function data_path(string $name): string
{
    $dir = data_dir();

    return $dir === '' ? '' : $dir . '/' . $name . '.php';
}

/**
 * Moves a file written before the guard existed over to the guarded name.
 */
function data_migrate(string $name): void
{
    $dir = data_dir();
    $old = $dir === '' ? '' : $dir . '/' . $name;

    if ($old === '' || !is_file($old)) {
        return;
    }

    $body = (string) @file_get_contents($old);

    if (@file_put_contents(data_path($name), DATA_GUARD . $body, LOCK_EX) !== false) {
        @unlink($old);
    }
}

function data_strip(string $raw): string
{
    if (strncmp($raw, '<?php', 5) !== 0) {
        return $raw;
    }

    $stop = strpos($raw, '?>');

    return $stop === false ? '' : ltrim(substr($raw, $stop + 2), "\r\n");
}

function data_read(string $name): string
{
    $path = data_path($name);

    if ($path === '') {
        return '';
    }

    if (!is_file($path)) {
        data_migrate($name);
    }

    return is_file($path) ? data_strip((string) @file_get_contents($path)) : '';
}

function data_write(string $name, string $body): bool
{
    $path = data_path($name);

    if ($path === '') {
        return false;
    }

    if (@file_put_contents($path, DATA_GUARD . $body, LOCK_EX) === false) {
        return false;
    }

    data_drop_legacy($name);

    return true;
}

/**
 * Clears the unguarded file a previous version left behind, so nothing stays
 * readable over HTTP once the guarded copy exists.
 */
function data_drop_legacy(string $name): void
{
    $dir = data_dir();
    $old = $dir === '' ? '' : $dir . '/' . $name;

    if ($old !== '' && is_file($old)) {
        @unlink($old);
    }
}

/**
 * Opens a guarded file for the read-modify-write cycle the counters need.
 * Returns the handle and the payload with the guard already stripped.
 */
function data_open(string $name): array
{
    $path = data_path($name);

    if ($path === '') {
        return [null, ''];
    }

    if (!is_file($path)) {
        data_migrate($name);
    }

    $handle = @fopen($path, 'c+');

    if ($handle === false) {
        return [null, ''];
    }

    if (!flock($handle, LOCK_EX)) {
        fclose($handle);

        return [null, ''];
    }

    return [$handle, data_strip((string) stream_get_contents($handle))];
}

function data_close($handle, ?string $body = null): void
{
    if ($handle === null) {
        return;
    }

    if ($body !== null) {
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, DATA_GUARD . $body);
        fflush($handle);
    }

    flock($handle, LOCK_UN);
    fclose($handle);
}

/**
 * Sweeps away anything an older version left unguarded in api/data.
 */
function data_sweep_legacy(): void
{
    $dir = data_dir();

    if ($dir === '') {
        return;
    }

    foreach (['posts.json', 'chat.json', 'pages.json', 'views.json', 'online.json',
        'chatrate.json', 'logins.json', 'seq.json', 'geo.json', 'adminname.json', 'salt'] as $name) {
        if (is_file($dir . '/' . $name) && is_file($dir . '/' . $name . '.php')) {
            @unlink($dir . '/' . $name);
        }
    }
}

function project_root(): string
{
    return dirname(__DIR__);
}

function data_dir(): string
{
    $dir = __DIR__ . '/data';

    if (!is_dir($dir) && !@mkdir($dir, 0770, true) && !is_dir($dir)) {
        return '';
    }

    if (!is_file($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    }

    if (!is_file($dir . '/index.html')) {
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

function read_store(): array
{
    $raw = data_read('posts.json');
    $store = $raw === '' ? null : json_decode($raw, true);

    if (!is_array($store) || !isset($store['posts']) || !is_array($store['posts'])) {
        return ['posts' => []];
    }

    return $store;
}

function write_store(array $store): bool
{
    return data_write('posts.json', (string) json_encode($store));
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

/**
 * The front page previews: recent posts that actually carry a picture, since a
 * text-only post has nothing to show there.
 */
function live_posts(): array
{
    $now = time();
    $fresh = [];

    foreach (all_posts() as $post) {
        if ($now - (int) $post['created'] >= POST_TTL) {
            continue;
        }

        if (post_thumb($post) === '') {
            continue;
        }

        $fresh[] = $post;
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
    data_sweep_legacy();

    if ($dir === '' || is_file(data_path('seq.json'))) {
        return;
    }

    $chat = chat_read();
    $posts = read_store();
    $rawPages = data_read('pages.json');
    $decoded = $rawPages === '' ? null : json_decode($rawPages, true);
    $pages = is_array($decoded) ? $decoded : [];

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
        data_write('pages.json', (string) json_encode($pages));
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

/**
 * Cloudflare's published edge ranges. A forwarded address is only believed when
 * the connection itself came from one of these, so nobody can hand us someone
 * else's address in a header.
 */
function cloudflare_ranges(): array
{
    return [
        '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
        '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
        '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
        '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
        '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
        '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
    ];
}

function ip_in_range(string $ip, string $range): bool
{
    [$subnet, $bits] = array_pad(explode('/', $range, 2), 2, null);
    $ipBin = @inet_pton($ip);
    $netBin = @inet_pton((string) $subnet);

    if ($ipBin === false || $netBin === false || strlen($ipBin) !== strlen($netBin)) {
        return false;
    }

    $bits = (int) $bits;
    $whole = intdiv($bits, 8);
    $rest = $bits % 8;

    if ($whole > 0 && strncmp($ipBin, $netBin, $whole) !== 0) {
        return false;
    }

    if ($rest === 0) {
        return true;
    }

    $mask = chr(0xff << (8 - $rest) & 0xff);

    return (($ipBin[$whole] & $mask) === ($netBin[$whole] & $mask));
}

function from_cloudflare(string $ip): bool
{
    foreach (cloudflare_ranges() as $range) {
        if (ip_in_range($ip, $range)) {
            return true;
        }
    }

    return false;
}

/**
 * The visitor's address. Everything that matters hangs off this - who owns a
 * message, the posting cooldown, the login lockout - so a header is only
 * trusted when the request really arrived from Cloudflare.
 */
function client_ip(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');

    if (getenv('VIEWS_TRUST_PROXY') !== '1' || $ip === '') {
        return $ip;
    }

    if (!from_cloudflare($ip) && getenv('VIEWS_TRUST_ANY_PROXY') !== '1') {
        return $ip;
    }

    $forwarded = (string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');

    if ($forwarded === '') {
        return $ip;
    }

    $first = trim(explode(',', $forwarded)[0]);

    return filter_var($first, FILTER_VALIDATE_IP) === false ? $ip : $first;
}

function install_salt(): string
{
    static $salt = null;

    if ($salt !== null) {
        return $salt;
    }

    $value = trim(data_read('salt'));

    if ($value === '') {
        $value = bin2hex(random_bytes(32));
        data_write('salt', $value);
        @chmod(data_path('salt'), 0640);
    }

    $salt = $value;

    return $salt;
}

function chat_read(): array
{
    $raw = data_read('chat.json');
    $store = $raw === '' ? null : json_decode($raw, true);

    if (!is_array($store) || !isset($store['messages']) || !is_array($store['messages'])) {
        return ['messages' => []];
    }

    return $store;
}

function chat_write(array $store): bool
{
    if (count($store['messages']) > CHAT_KEEP) {
        $extra = array_slice($store['messages'], CHAT_KEEP);

        foreach ($extra as $message) {
            chat_drop_file($message);
        }

        $store['messages'] = array_slice($store['messages'], 0, CHAT_KEEP);
    }

    return data_write('chat.json', (string) json_encode($store));
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
    $raw = data_read('chatrate.json');
    $data = $raw === '' ? null : json_decode($raw, true);

    if (!is_array($data)) {
        return 0;
    }

    $last = (int) ($data[visitor_hash()] ?? 0);

    return max(0, CHAT_COOLDOWN - (time() - $last));
}

function chat_touch_cooldown(): void
{
    $raw = data_read('chatrate.json');
    $data = $raw === '' ? null : json_decode($raw, true);
    $data = is_array($data) ? $data : [];
    $now = time();
    $data[visitor_hash()] = $now;

    foreach ($data as $key => $stamp) {
        if ($now - (int) $stamp > 86400) {
            unset($data[$key]);
        }
    }

    data_write('chatrate.json', (string) json_encode($data));
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

    [$handle, $raw] = data_open('online.json');

    if ($handle === null) {
        return 0;
    }

    $seen = $raw === '' ? null : json_decode($raw, true);
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

    data_close($handle, (string) json_encode($seen));

    return count($seen);
}

/**
 * Brings an older views.json - a bare hash => timestamp map - up to the shape
 * the stats page reads, without losing the visitors already counted.
 */
function views_normalise(array $store): array
{
    $visitors = (array) ($store['visitors'] ?? []);
    $fixed = [];

    foreach ($visitors as $key => $entry) {
        if (is_array($entry)) {
            $fixed[$key] = [
                'ip' => (string) ($entry['ip'] ?? ''),
                'country' => (string) ($entry['country'] ?? ''),
                'name' => (string) ($entry['name'] ?? ''),
                'city' => (string) ($entry['city'] ?? ''),
                'first' => (int) ($entry['first'] ?? 0),
                'last' => (int) ($entry['last'] ?? 0),
                'hits' => (int) ($entry['hits'] ?? 1),
            ];
            continue;
        }

        $fixed[$key] = [
            'ip' => '',
            'country' => '',
            'name' => '',
            'city' => '',
            'first' => (int) $entry,
            'last' => (int) $entry,
            'hits' => 1,
        ];
    }

    return [
        'total' => (int) ($store['total'] ?? count($fixed)),
        'visitors' => $fixed,
        'days' => array_map('intval', (array) ($store['days'] ?? [])),
    ];
}

function views_trim(array $store): array
{
    $days = (array) $store['days'];

    if (count($days) > VIEWS_DAYS_KEPT) {
        krsort($days);
        $days = array_slice($days, 0, VIEWS_DAYS_KEPT, true);
        ksort($days);
        $store['days'] = $days;
    }

    $visitors = (array) $store['visitors'];

    if (count($visitors) > VIEWS_MAX_VISITORS) {
        uasort($visitors, static function (array $a, array $b): int {
            return (int) $b['last'] <=> (int) $a['last'];
        });
        $store['visitors'] = array_slice($visitors, 0, VIEWS_MAX_VISITORS, true);
    }

    return $store;
}

function views_read(): array
{
    $raw = data_read('views.json');
    $store = $raw === '' ? null : json_decode($raw, true);

    return views_normalise(is_array($store) ? $store : []);
}

/**
 * The last N days as [date => hits], with the quiet days filled in as zero so
 * the chart keeps an even step.
 */
function views_series(array $days, int $span): array
{
    $series = [];
    $now = time();

    for ($i = $span - 1; $i >= 0; $i--) {
        $date = gmdate('Y-m-d', $now - ($i * 86400));
        $series[$date] = (int) ($days[$date] ?? 0);
    }

    return $series;
}

function admin_profile(): array
{
    $fallback = ['name' => 'nysha4real', 'color' => 'yellow'];
    $raw = data_read('adminname.json');
    $data = $raw === '' ? null : json_decode($raw, true);

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
    return data_write('adminname.json', (string) json_encode([
        'name' => $name,
        'color' => $color === 'green' ? 'green' : 'yellow',
    ]));
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

    [$handle, $raw] = data_open('seq.json');

    if ($handle === null) {
        return 0;
    }

    $data = $raw === '' ? null : json_decode($raw, true);
    $next = (int) (is_array($data) ? ($data['seq'] ?? 0) : 0) + 1;

    data_close($handle, (string) json_encode(['seq' => $next]));

    return $next;
}

function seq_seed(int $value): void
{
    data_write('seq.json', (string) json_encode(['seq' => $value]));
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

/**
 * Country code, country name and city for an address, as far as the service
 * can tell. Everything is optional; a blank field just does not show up.
 */
function geo_lookup(string $ip): array
{
    $url = 'http://ip-api.com/json/' . rawurlencode($ip) . '?fields=status,countryCode,country,city';
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
        return [];
    }

    $data = json_decode($body, true);

    if (!is_array($data) || (string) ($data['status'] ?? '') !== 'success') {
        return [];
    }

    $code = strtoupper((string) ($data['countryCode'] ?? ''));

    if (preg_match('/^[A-Z]{2}$/', $code) !== 1) {
        return [];
    }

    return [
        'code' => $code,
        'country' => clean_place((string) ($data['country'] ?? '')),
        'city' => clean_place((string) ($data['city'] ?? '')),
    ];
}

function clean_place(string $name): string
{
    $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
    $name = str_replace(["\0", "\r", "\n", '<', '>'], '', $name);

    return mb_substr($name, 0, 60);
}

/**
 * Where the visitor is, cached per address. Returns code, country and city;
 * any of them can be empty when the address cannot be placed.
 */
function visitor_place(): array
{
    $blank = ['code' => '', 'country' => '', 'city' => ''];
    $ip = client_ip();

    if ($ip === '') {
        return $blank;
    }

    $public = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    $header = strtoupper(trim((string) ($_SERVER['HTTP_CF_IPCOUNTRY'] ?? '')));
    $fromHeader = preg_match('/^[A-Z]{2}$/', $header) === 1 && $header !== 'XX' && $header !== 'T1'
        ? ['code' => $header, 'country' => '', 'city' => '']
        : $blank;

    if ($public === false) {
        return $fromHeader;
    }

    $key = secret_hash('geo', $ip);
    $raw = data_read('geo.json');
    $cache = $raw === '' ? null : json_decode($raw, true);
    $cache = is_array($cache) ? $cache : [];
    $now = time();

    if (isset($cache[$key]['seen']) && $now - (int) $cache[$key]['seen'] < GEO_TTL) {
        return [
            'code' => (string) ($cache[$key]['code'] ?? ''),
            'country' => (string) ($cache[$key]['country'] ?? ''),
            'city' => (string) ($cache[$key]['city'] ?? ''),
        ];
    }

    $place = geo_lookup($ip);

    if ($place === []) {
        $place = $fromHeader;
    }

    foreach ($cache as $entry => $row) {
        if ($now - (int) ($row['seen'] ?? 0) > GEO_TTL) {
            unset($cache[$entry]);
        }
    }

    $cache[$key] = [
        'code' => (string) ($place['code'] ?? ''),
        'country' => (string) ($place['country'] ?? ''),
        'city' => (string) ($place['city'] ?? ''),
        'seen' => $now,
    ];

    if (count($cache) > GEO_MAX) {
        uasort($cache, static function (array $a, array $b): int {
            return (int) $b['seen'] <=> (int) $a['seen'];
        });
        $cache = array_slice($cache, 0, GEO_MAX, true);
    }

    data_write('geo.json', (string) json_encode($cache));

    return [
        'code' => (string) ($place['code'] ?? ''),
        'country' => (string) ($place['country'] ?? ''),
        'city' => (string) ($place['city'] ?? ''),
    ];
}

function visitor_country(): string
{
    return (string) visitor_place()['code'];
}

/**
 * "Finland, Helsinki" when both are known, otherwise whichever part there is.
 */
function place_label(array $entry): string
{
    // A stored visitor keeps the code in 'country' and the name in 'name';
    // a fresh lookup has only 'country', already the full name.
    $country = (string) ($entry['name'] ?? '');
    $country = $country === '' ? (string) ($entry['country'] ?? '') : $country;
    $city = (string) ($entry['city'] ?? '');

    if ($country !== '' && $city !== '') {
        return $country . ', ' . $city;
    }

    return $country !== '' ? $country : $city;
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
