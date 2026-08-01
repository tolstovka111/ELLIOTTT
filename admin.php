<?php

declare(strict_types=1);

require __DIR__ . '/api/lib.php';

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

header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

function csrf_valid(): bool
{
    $sent = (string) ($_POST['csrf'] ?? '');

    return $sent !== '' && hash_equals((string) $_SESSION['csrf'], $sent);
}

function throttle_path(): string
{
    $dir = data_dir();

    return $dir === '' ? '' : $dir . '/logins.json';
}

function throttle_read(): array
{
    $path = throttle_path();

    if ($path === '' || !is_file($path)) {
        return [];
    }

    $raw = @file_get_contents($path);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

    return is_array($data) ? $data : [];
}

function throttle_key(): string
{
    return hash('sha256', install_salt() . '|login|' . client_ip());
}

function throttle_blocked_for(): int
{
    $data = throttle_read();
    $key = throttle_key();

    if (!isset($data[$key]['until'])) {
        return 0;
    }

    return max(0, (int) $data[$key]['until'] - time());
}

function throttle_fail(): void
{
    $path = throttle_path();

    if ($path === '') {
        return;
    }

    $data = throttle_read();
    $key = throttle_key();
    $now = time();
    $previous = isset($data[$key]) && is_array($data[$key]) ? $data[$key] : [];
    $until = (int) ($previous['until'] ?? 0);
    $fails = (int) ($previous['fails'] ?? 0);

    if ($until > 0 && $until <= $now) {
        $fails = 0;
    }

    $fails++;
    $entry = ['fails' => $fails, 'until' => 0, 'seen' => $now];

    if ($fails >= LOGIN_MAX_ATTEMPTS) {
        $entry = ['fails' => 0, 'until' => $now + LOGIN_LOCK_SECONDS, 'seen' => $now];
    }

    $data[$key] = $entry;

    foreach ($data as $k => $row) {
        if (($now - (int) ($row['seen'] ?? 0)) > 86400) {
            unset($data[$k]);
        }
    }

    @file_put_contents($path, (string) json_encode($data), LOCK_EX);
}

function throttle_clear(): void
{
    $path = throttle_path();

    if ($path === '') {
        return;
    }

    $data = throttle_read();
    unset($data[throttle_key()]);
    @file_put_contents($path, (string) json_encode($data), LOCK_EX);
}

function redirect_self(): void
{
    header('Location: admin.php');
    exit;
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
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

$config = load_config();

if ($config !== null) {
    $provided = (string) ($_GET['k'] ?? '');

    if ($provided !== '' && hash_equals((string) $config['key_hash'], secret_hash('key', $provided))) {
        $_SESSION['gate'] = true;
        redirect_self();
    }

    if (empty($_SESSION['gate'])) {
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
        echo "<!DOCTYPE html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>404 Not Found</title></head>\n<body><h1>Not Found</h1></body>\n</html>\n";
        exit;
    }
}

$authed = !empty($_SESSION['admin']) && $config !== null;
$action = (string) ($_POST['action'] ?? '');
$errors = [];

if ($action !== '' && !csrf_valid()) {
    $errors[] = 'Session expired. Try again.';
    $action = '';
}

if ($action === 'setup' && $config === null) {
    $user = trim((string) ($_POST['user'] ?? ''));
    $pass = (string) ($_POST['pass'] ?? '');
    $pass2 = (string) ($_POST['pass2'] ?? '');
    $key = trim((string) ($_POST['key'] ?? ''));

    if (preg_match('/^[A-Za-z0-9_.-]{3,32}$/', $user) !== 1) {
        $errors[] = 'Login must be 3-32 characters: letters, digits, dot, dash, underscore.';
    }

    if (strlen($pass) < 8) {
        $errors[] = 'Password must be at least 8 characters.';
    }

    if ($pass !== $pass2) {
        $errors[] = 'Passwords do not match.';
    }

    if (preg_match('/^[A-Za-z0-9_-]{16,64}$/', $key) !== 1) {
        $errors[] = 'Secret key must be 16-64 characters: letters, digits, dash, underscore.';
    }

    if ($errors === []) {
        $written = save_config(
            secret_hash('user', $user),
            password_hash($pass, PASSWORD_DEFAULT),
            secret_hash('key', $key)
        );

        if (!$written) {
            $errors[] = 'Could not write api/config.php. Check permissions.';
        } else {
            $_SESSION['gate'] = true;
            flash('ok', 'Account created. Save your link: admin.php?k=' . $key);
            redirect_self();
        }
    }
}

if ($action === 'login' && $config !== null) {
    $wait = throttle_blocked_for();

    if ($wait > 0) {
        $errors[] = 'Too many attempts. Try again in ' . (int) ceil($wait / 60) . ' min.';
    } else {
        $user = trim((string) ($_POST['user'] ?? ''));
        $pass = (string) ($_POST['pass'] ?? '');

        $userOk = hash_equals((string) $config['user_hash'], secret_hash('user', $user));

        if ($userOk && password_verify($pass, (string) $config['pass_hash'])) {
            throttle_clear();
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            redirect_self();
        }

        throttle_fail();
        $errors[] = 'Wrong login or password.';
    }
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    header('Location: index.html');
    exit;
}

if ($action === 'create' && $authed) {
    $text = trim((string) ($_POST['text'] ?? ''));

    if (mb_strlen($text) > MAX_TEXT) {
        $text = mb_substr($text, 0, MAX_TEXT);
    }

    $allowed = [
        IMAGETYPE_JPEG => '.jpg',
        IMAGETYPE_PNG => '.png',
        IMAGETYPE_GIF => '.gif',
        IMAGETYPE_WEBP => '.webp',
    ];

    $dir = uploads_dir();
    $links = (array) ($_POST['link'] ?? []);
    $images = [];
    $saved = [];

    if ($dir === '') {
        $errors[] = 'Upload folder assets/blog is not writable.';
    }

    for ($i = 0; $i < MAX_IMAGES && $errors === []; $i++) {
        $error = (int) ($_FILES['image']['error'][$i] ?? UPLOAD_ERR_NO_FILE);

        if ($error === UPLOAD_ERR_NO_FILE) {
            continue;
        }

        if ($error !== UPLOAD_ERR_OK) {
            $errors[] = 'Image ' . ($i + 1) . ' failed to upload.';
            break;
        }

        $tmp = (string) ($_FILES['image']['tmp_name'][$i] ?? '');

        if (!is_uploaded_file($tmp)) {
            $errors[] = 'Image ' . ($i + 1) . ' is not a valid upload.';
            break;
        }

        if ((int) ($_FILES['image']['size'][$i] ?? 0) > MAX_UPLOAD_BYTES) {
            $errors[] = 'Image ' . ($i + 1) . ' is larger than 5 MB.';
            break;
        }

        $info = @getimagesize($tmp);

        if ($info === false || !isset($allowed[$info[2]])) {
            $errors[] = 'Image ' . ($i + 1) . ' must be JPG, PNG, GIF or WEBP.';
            break;
        }

        $link = trim((string) ($links[$i] ?? ''));

        if ($link !== '') {
            $scheme = strtolower((string) parse_url($link, PHP_URL_SCHEME));

            if (filter_var($link, FILTER_VALIDATE_URL) === false || !in_array($scheme, ['http', 'https'], true)) {
                $errors[] = 'Link ' . ($i + 1) . ' must start with http:// or https://';
                break;
            }
        }

        $name = bin2hex(random_bytes(8)) . $allowed[$info[2]];

        if (!move_uploaded_file($tmp, $dir . '/' . $name)) {
            $errors[] = 'Could not save image ' . ($i + 1) . '.';
            break;
        }

        @chmod($dir . '/' . $name, 0644);
        $saved[] = $dir . '/' . $name;
        $images[] = ['file' => $name, 'link' => $link];
    }

    if ($errors === [] && $text === '' && $images === []) {
        $errors[] = 'Add some text or at least one image.';
    }

    if ($errors !== []) {
        foreach ($saved as $file) {
            @unlink($file);
        }
    } else {
        $posts = live_posts();
        array_unshift($posts, [
            'id' => bin2hex(random_bytes(8)),
            'created' => time(),
            'text' => $text,
            'images' => $images,
        ]);

        if (!write_store(['posts' => $posts])) {
            foreach ($saved as $file) {
                @unlink($file);
            }
            $errors[] = 'Could not write api/data/posts.json. Check permissions.';
        } else {
            flash('ok', 'Posted.');
            redirect_self();
        }
    }
}

if ($action === 'delete' && $authed) {
    $id = (string) ($_POST['id'] ?? '');
    $posts = live_posts();
    $kept = [];

    foreach ($posts as $post) {
        if ((string) ($post['id'] ?? '') === $id) {
            drop_images($post);
            continue;
        }

        $kept[] = $post;
    }

    write_store(['posts' => $kept]);
    flash('ok', 'Post deleted.');
    redirect_self();
}

$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);
$csrf = (string) $_SESSION['csrf'];
$suggestedKey = $config === null ? bin2hex(random_bytes(12)) : '';
$posts = $authed ? live_posts() : [];
$now = time();

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin - 4real</title>
<link rel="icon" href="assets/4real-logo.png">
<link rel="stylesheet" href="style.css">
</head>
<body>

<div class="logo">
	<a href="index.html"><img src="assets/4real-logo.png" alt="4real"></a>
</div>

<div class="page">

	<div class="nav">[<a href="index.html">Return to Home</a>]</div>

<?php if ($flash !== null): ?>
	<div class="box">
		<div class="box-body notice"><?= e((string) $flash['message']) ?></div>
	</div>
<?php endif; ?>

<?php if ($errors !== []): ?>
	<div class="box">
		<div class="box-body error">
<?php foreach ($errors as $message): ?>
			<div><?= e($message) ?></div>
<?php endforeach; ?>
		</div>
	</div>
<?php endif; ?>

<?php if ($config === null): ?>

	<div class="box">
		<div class="box-title">Create admin account</div>
		<div class="box-body">
			<p>This runs once. Login, password and secret key are stored only as hashes in
			<code>api/config.php</code>. After that this page answers 404 to everyone who opens it without
			<code>admin.php?k=&lt;secret key&gt;</code>.</p>
			<form method="post" class="adminform">
				<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
				<input type="hidden" name="action" value="setup">
				<label>Login<input type="text" name="user" autocomplete="username" required></label>
				<label>Password<input type="password" name="pass" autocomplete="new-password" required></label>
				<label>Repeat password<input type="password" name="pass2" autocomplete="new-password" required></label>
				<label>Secret key for the link<input type="text" name="key" value="<?= e($suggestedKey) ?>" required></label>
				<button type="submit">Create</button>
			</form>
		</div>
	</div>

<?php elseif (!$authed): ?>

	<div class="box">
		<div class="box-title">Sign in</div>
		<div class="box-body">
			<form method="post" class="adminform">
				<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
				<input type="hidden" name="action" value="login">
				<label>Login<input type="text" name="user" autocomplete="username" required></label>
				<label>Password<input type="password" name="pass" autocomplete="current-password" required></label>
				<button type="submit">Sign in</button>
			</form>
		</div>
	</div>

<?php else: ?>

	<div class="box">
		<div class="box-title">
			New post
			<span class="corner"><a href="#" onclick="document.getElementById('logout').submit();return false;">log out</a></span>
		</div>
		<div class="box-body">
			<form method="post" enctype="multipart/form-data" class="adminform">
				<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
				<input type="hidden" name="action" value="create">
<?php for ($i = 0; $i < MAX_IMAGES; $i++): ?>
				<div class="uploadrow">
					<label>Image <?= $i + 1 ?><input type="file" name="image[]" accept="image/jpeg,image/png,image/gif,image/webp"></label>
					<label>Link for image <?= $i + 1 ?> (optional)<input type="url" name="link[]" placeholder="https://"></label>
				</div>
<?php endfor; ?>
				<label>Text<textarea name="text" rows="4" maxlength="<?= MAX_TEXT ?>"></textarea></label>
				<button type="submit">Publish</button>
			</form>
		</div>
	</div>

	<form method="post" id="logout">
		<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
		<input type="hidden" name="action" value="logout">
	</form>

	<div class="box">
		<div class="box-title">Live posts</div>
<?php if ($posts === []): ?>
		<div class="empty">No Posts in my Blog yet.</div>
<?php else: ?>
<?php foreach ($posts as $post): ?>
		<div class="entry adminpost">
			<div class="adminpost-images">
<?php foreach ((array) $post['images'] as $image): ?>
				<img src="assets/blog/<?= e(basename((string) $image['file'])) ?>" alt="">
<?php endforeach; ?>
			</div>
			<p><?= e((string) $post['text']) ?></p>
			<div class="date"><?= e(relative_age($now - (int) $post['created'])) ?></div>
			<form method="post">
				<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
				<input type="hidden" name="action" value="delete">
				<input type="hidden" name="id" value="<?= e((string) $post['id']) ?>">
				<button type="submit">Delete</button>
			</form>
		</div>
<?php endforeach; ?>
<?php endif; ?>
	</div>

<?php endif; ?>

	<div class="pagelinks">
		<a href="index.html">Home</a>
		<a href="faq.html">FAQ</a>
		<a href="rules.html">Rules</a>
	</div>

	<div class="copyright">Copyright &copy; 2025-2026 4real community support. All rights reserved</div>

</div>

</body>
</html>
