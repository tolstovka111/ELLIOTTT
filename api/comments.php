<?php

declare(strict_types=1);

require_once __DIR__ . '/lib.php';

/**
 * Comments left under the standalone board pages, kept apart from the blog.
 */
function page_store_read(): array
{
    $dir = data_dir();
    $path = $dir === '' ? '' : $dir . '/pages.json';

    if ($path === '' || !is_file($path)) {
        return [];
    }

    $raw = @file_get_contents($path);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

    return is_array($data) ? $data : [];
}

function page_store_write(array $store): bool
{
    $dir = data_dir();

    if ($dir === '') {
        return false;
    }

    return @file_put_contents($dir . '/pages.json', (string) json_encode($store), LOCK_EX) !== false;
}

function comment_upload(array &$errors): array
{
    $error = (int) ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE);

    if ($error === UPLOAD_ERR_NO_FILE) {
        return [];
    }

    $dir = comments_dir();

    if ($dir === '') {
        $errors[] = 'Upload folder assets/comments is not writable.';

        return [];
    }

    $tmp = (string) ($_FILES['file']['tmp_name'] ?? '');

    if ($error !== UPLOAD_ERR_OK || !is_uploaded_file($tmp)) {
        $errors[] = 'The attachment failed to upload.';

        return [];
    }

    $size = (int) ($_FILES['file']['size'] ?? 0);

    if ($size > CHAT_UPLOAD_BYTES) {
        $errors[] = 'The attachment is larger than 3 MB.';

        return [];
    }

    $info = @getimagesize($tmp);
    $allowed = [IMAGETYPE_JPEG => '.jpg', IMAGETYPE_PNG => '.png', IMAGETYPE_GIF => '.gif'];

    if ($info === false || !isset($allowed[$info[2]])) {
        $errors[] = 'The attachment must be PNG, JPG or GIF.';

        return [];
    }

    $name = bin2hex(random_bytes(8)) . $allowed[$info[2]];

    if (!move_uploaded_file($tmp, $dir . '/' . $name)) {
        $errors[] = 'Could not save the attachment.';

        return [];
    }

    @chmod($dir . '/' . $name, 0644);

    return [
        'file' => $name,
        'fname' => clean_filename((string) ($_FILES['file']['name'] ?? '')),
        'fsize' => $size,
        'fw' => (int) $info[0],
        'fh' => (int) $info[1],
    ];
}

function comment_drop_file(array $comment): void
{
    $dir = comments_dir();
    $name = (string) ($comment['file'] ?? '');
    $file = $name === '' ? '' : basename($name);

    if ($dir !== '' && $file !== '' && is_file($dir . '/' . $file)) {
        @unlink($dir . '/' . $file);
    }
}

function comment_stamp(array $item): string
{
    return '<span class="msg-date" data-ts="' . (int) $item['created'] . '">'
        . e(gmdate('m/d/y(D)H:i', (int) $item['created'])) . '</span>';
}

function comment_file_line(array $comment): string
{
    $file = (string) ($comment['file'] ?? '');

    if ($file === '') {
        return '';
    }

    $src = '/assets/comments/' . basename($file);
    $meta = format_size((int) ($comment['fsize'] ?? 0)) . ', ' . (int) ($comment['fw'] ?? 0) . 'x' . (int) ($comment['fh'] ?? 0);

    return '<div class="msg-file">File: <a href="' . e($src) . '" target="_blank" rel="noopener">'
        . e((string) ($comment['fname'] ?? 'file')) . '</a> (' . e($meta) . ')</div>'
        . '<div class="msg-media"><img src="' . e($src) . '" alt="" data-full="' . e($src) . '" data-kind="image"></div>';
}

/**
 * A hidden field block, so one renderer serves both the blog and the pages.
 */
function hidden_fields(array $fields): string
{
    $out = '';

    foreach ($fields as $name => $value) {
        $out .= '<input type="hidden" name="' . e((string) $name) . '" value="' . e((string) $value) . '">';
    }

    return $out;
}

/**
 * Name, flag, date and the bracketed [reply] / [delete] links, as on 4chan.
 */
function comment_head(array $item, array $ctx, array $keys, bool $canReply, bool $canDelete): string
{
    $line = poster_name_html((string) $item['name'], !empty($item['admin']));
    $flag = country_flag_html((string) ($item['country'] ?? ''));

    if ($flag !== '') {
        $line .= ' ' . $flag;
    }

    $line .= ' ' . comment_stamp($item);

    if ($canReply) {
        $line .= ' <span class="msg-act">[<span class="msg-reply" data-target="'
            . e((string) $item['id']) . '">reply</span>]</span>';
    }

    if ($canDelete) {
        $line .= ' <span class="msg-act">[<form method="post" action="' . e((string) $ctx['form']) . '" class="msg-remove">'
            . hidden_fields(array_merge(
                ['token' => $ctx['token'], 'action' => $ctx['action_delete']],
                $keys
            ))
            . '<button type="submit">delete</button></form>]</span>';
    }

    return $line;
}

/**
 * The whole comment area: the folded list, the answers and the compose box.
 */
function render_comments(array $comments, array $ctx): string
{
    $total = count($comments);
    $authed = (bool) $ctx['authed'];
    $me = (string) $ctx['me'];
    $out = '<div class="comments" data-total="' . $total . '">'
        . '<div class="comments-body"' . ($total > 0 ? ' hidden' : '') . '>';

    foreach ($comments as $index => $comment) {
        $mine = hash_equals((string) ($comment['ip'] ?? ''), $me);
        $folded = $total > BLOG_COMMENTS_OPEN && $index < $total - BLOG_COMMENTS_OPEN;
        $keys = array_merge($ctx['keys'], ['comment' => (string) $comment['id']]);

        $out .= '<div class="comment' . ($folded ? ' folded' : '') . '">'
            . '<div class="msg-head">' . comment_head($comment, $ctx, $keys, $authed || !$mine, $authed || $mine) . '</div>'
            . comment_file_line($comment);

        if ((string) $comment['text'] !== '') {
            $out .= '<div class="msg-text">' . render_post_text((string) $comment['text']) . '</div>';
        }

        if ($authed || !$mine) {
            $out .= '<form method="post" action="' . e((string) $ctx['form']) . '" class="replyform" id="r'
                . e((string) $comment['id']) . '">'
                . hidden_fields(array_merge(
                    ['token' => $ctx['token'], 'action' => $ctx['action_answer']],
                    $keys
                ))
                . '<input type="text" name="name" maxlength="' . MAX_NAME . '" placeholder="Anonymous"'
                . ($authed ? ' value="' . e((string) $ctx['admin_name']) . '"' : '') . '>'
                . '<input type="text" name="text" maxlength="' . MAX_CHAT_TEXT . '" placeholder="Write an answer&hellip;" required>'
                . '<button type="submit">Answer</button></form>';
        }

        foreach ((array) ($comment['answers'] ?? []) as $answer) {
            $ownAnswer = hash_equals((string) ($answer['ip'] ?? ''), $me);
            $answerKeys = array_merge($keys, ['answer' => (string) $answer['id']]);

            $out .= '<div class="reply">'
                . '<div class="msg-head">' . comment_head($answer, $ctx, $answerKeys, false, $authed || $ownAnswer) . '</div>'
                . '<div class="msg-text">' . render_post_text((string) $answer['text']) . '</div>'
                . '</div>';
        }

        $out .= '</div>';
    }

    $out .= '<form method="post" action="' . e((string) $ctx['form']) . '" enctype="multipart/form-data" class="commentform">'
        . hidden_fields(array_merge(
            ['token' => $ctx['token'], 'action' => $ctx['action_add']],
            $ctx['keys']
        ))
        . '<input type="text" name="name" maxlength="' . MAX_NAME . '" placeholder="Anonymous"'
        . ($authed ? ' value="' . e((string) $ctx['admin_name']) . '"' : '') . '>'
        . '<input type="text" name="text" maxlength="' . MAX_CHAT_TEXT . '" placeholder="Write a comment&hellip;">'
        . '<label class="say-clip" title="Attach PNG / JPG / GIF, up to 3 MB">'
        . '<input type="file" name="file" accept="image/png,image/jpeg,image/gif">'
        . '<img class="clip-icon" src="/assets/clip.png" alt="Attach">'
        . '<span class="clip-name"></span></label>'
        . '<button type="submit">Send</button></form>'
        . '</div>';

    if ($total > 0) {
        $out .= '<div class="comments-bar">';

        if ($total > BLOG_COMMENTS_OPEN) {
            $out .= '<span class="comments-all" hidden>Show all ' . $total . ' comments</span>';
        }

        $out .= '<span class="comments-hide" hidden>Hide comments</span>'
            . '<span class="comments-show">Show comments (' . $total . ')</span>'
            . '</div>';
    }

    return $out . '</div>';
}

/**
 * Shared handling of a new comment or answer; returns the updated list.
 */
function apply_comment(array $comments, string $action, array $input, array &$errors): array
{
    $me = visitor_hash();
    $entry = [
        'id' => bin2hex(random_bytes(8)),
        'created' => time(),
        'name' => (string) $input['name'],
        'text' => (string) $input['text'],
        'ip' => $me,
        'country' => visitor_country(),
        'admin' => (bool) $input['admin'],
    ];

    if ($action === 'add') {
        $comments[] = array_merge($entry, ['answers' => []], (array) $input['upload']);

        return $comments;
    }

    $target = (string) $input['comment'];

    foreach ($comments as $index => $comment) {
        if ((string) ($comment['id'] ?? '') !== $target) {
            continue;
        }

        if (!$input['authed'] && hash_equals((string) ($comment['ip'] ?? ''), $me)) {
            $errors[] = 'You cannot answer your own comment.';

            return $comments;
        }

        $comments[$index]['answers'][] = $entry;

        return $comments;
    }

    $errors[] = 'That comment is gone.';

    return $comments;
}

/**
 * Shared deletion of a comment or one of its answers.
 */
function remove_comment(array $comments, string $target, string $answer, bool $authed): array
{
    $me = visitor_hash();
    $kept = [];

    foreach ($comments as $comment) {
        $mine = hash_equals((string) ($comment['ip'] ?? ''), $me);

        if ($answer === '' && (string) ($comment['id'] ?? '') === $target) {
            if ($authed || $mine) {
                comment_drop_file($comment);
                continue;
            }
        }

        if ($answer !== '' && (string) ($comment['id'] ?? '') === $target) {
            $keptAnswers = [];

            foreach ((array) ($comment['answers'] ?? []) as $item) {
                $ownAnswer = hash_equals((string) ($item['ip'] ?? ''), $me);

                if ((string) ($item['id'] ?? '') === $answer && ($authed || $ownAnswer)) {
                    continue;
                }

                $keptAnswers[] = $item;
            }

            $comment['answers'] = $keptAnswers;
        }

        $kept[] = $comment;
    }

    return $kept;
}

/**
 * Name and admin flag for a comment, shared by every page that takes them.
 */
function comment_author(bool $authed): array
{
    $adminName = admin_name();
    $name = clean_name((string) ($_POST['name'] ?? ''));

    if ($name === '') {
        $name = $authed ? $adminName : 'Anonymous';
    }

    $asAdmin = $authed && $name === $adminName;

    if (!$authed && strcasecmp($name, $adminName) === 0) {
        $name = 'Anonymous';
    }

    return ['name' => $name, 'admin' => $asAdmin];
}
