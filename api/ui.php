<?php

declare(strict_types=1);

require_once __DIR__ . '/lib.php';

/**
 * Every page that carries the board navigation, in the order it is shown.
 */
function board_list(): array
{
    return [
        'o' => ['url' => '/o/', 'label' => 'o', 'title' => '/o/ - Roblox'],
        'm' => ['url' => '/m/', 'label' => 'm', 'title' => '/m/ - Minecraft'],
        'a' => ['url' => '/a/', 'label' => 'a', 'title' => '/a/ - Anime'],
        'i' => ['url' => '/i/', 'label' => 'i', 'title' => '/i/ - Internet'],
        'b' => ['url' => '/b/', 'label' => 'b', 'title' => '/b/ - Random Pictures'],
        'c' => ['url' => '/c/', 'label' => 'c', 'title' => '/c/ - Chat'],
        'n' => ['url' => '/n/', 'label' => 'n', 'title' => '/n/ - Blog'],
    ];
}

function page_list(): array
{
    return [
        'faq' => ['url' => '/faq/', 'label' => 'faq', 'title' => '/faq/ - FAQ'],
        'rules' => ['url' => '/rules/', 'label' => 'rules', 'title' => '/rules/ - Rules'],
    ];
}

function board_nav(string $current = ''): string
{
    $parts = [];

    foreach (board_list() as $key => $board) {
        $label = e((string) $board['label']);
        $parts[] = $key === $current
            ? '<strong>' . $label . '</strong>'
            : '<a href="' . e((string) $board['url']) . '">' . $label . '</a>';
    }

    $extra = [];

    foreach (page_list() as $key => $page) {
        $label = e((string) $page['label']);
        $extra[] = $key === $current
            ? '<strong>' . $label . '</strong>'
            : '<a href="' . e((string) $page['url']) . '">' . $label . '</a>';
    }

    return '<div class="boardnav">'
        . '<span class="boardnav-list">[' . implode(' / ', $parts) . ']'
        . ' [' . implode(' / ', $extra) . ']</span>'
        . '<span class="boardnav-home">[<a href="/home">Home</a>]</span>'
        . '</div>';
}

/**
 * The banner, the board title, the jump link and the random ad banner.
 */
function board_header(string $title, string $goLabel, string $goTarget, string $subtitle = ''): string
{
    $banner = random_asset('banners', ['png', 'jpg', 'jpeg', 'gif', 'webp']);
    $ad = random_ad_banner();
    $out = '<div class="boardhead">';

    if ($banner !== '') {
        $out .= '<a href="/home"><img class="boardbanner" src="' . e($banner) . '" alt="4real"></a>';
    }

    $out .= '<h1 class="boardtitle">' . e($title) . '</h1></div>'
        . '<hr class="boardrule">'
        . '<div class="boardgo">[<a href="' . e($goTarget) . '" class="goposts">' . e($goLabel) . '</a>]</div>';

    if ($subtitle !== '') {
        $out .= '<div class="boardsub">' . e($subtitle) . '</div>';
    }

    $out .= '<hr class="boardrule thin">';

    if ($ad !== []) {
        $out .= '<div class="adbanner"><a href="' . e((string) $ad['href']) . '">'
            . '<img src="' . e((string) $ad['src']) . '" alt="banner"></a></div>'
            . '<hr class="boardrule">';
    }

    return $out;
}

/**
 * Boards whose pictures come out in a different order on every visit.
 */
function board_shuffled(): array
{
    return ['a', 'i', 'b'];
}

/**
 * Boards laid out staggered rather than in a plain grid.
 */
function board_staggered(): array
{
    return ['i', 'a'];
}

/**
 * Boards whose pictures simply run on in rows, and drop in one by one.
 */
function board_flowing(): array
{
    return ['b'];
}

/**
 * Boards showing a handful of large pictures side by side, captioned with
 * one big letter apiece.
 */
function board_trio(): array
{
    return ['o', 'm'];
}

/**
 * The line under the jump link, half its size and not a link itself.
 */
function board_subtitle(string $key): string
{
    $lines = [
        'a' => 'my fav anime characters',
        'i' => 'my fav characters from internet O.O',
        'o' => 'MY F%%KING AVATAR X_X',
        'm' => 'SKIN MINECRAFT.png',
    ];

    return (string) ($lines[$key] ?? '');
}

function board_pictures(string $key): array
{
    $path = project_root() . '/pages/' . $key . '.txt';

    if (!is_file($path)) {
        return [];
    }

    $lines = (array) @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $dir = project_root() . '/assets/boards/' . $key;
    $found = [];

    foreach ($lines as $line) {
        $line = trim((string) $line);

        if ($line === '' || $line[0] === '#') {
            continue;
        }

        $parts = explode('|', $line, 3);
        $file = basename(trim($parts[0]));
        $caption = isset($parts[1]) ? trim($parts[1]) : '';
        $whole = isset($parts[2]) && strcasecmp(trim($parts[2]), 'whole') === 0;

        if ($file === '' || !is_file($dir . '/' . $file)) {
            continue;
        }

        $found[] = [
            'src' => '/assets/boards/' . $key . '/' . $file,
            'caption' => $caption,
            'whole' => $whole,
        ];
    }

    return $found;
}

/**
 * The picture wall: a thin frame each, the caption underneath, and the picture
 * itself opening full size in the lightbox.
 */
function board_gallery(string $key): string
{
    $pictures = board_pictures($key);

    if ($pictures === []) {
        return '';
    }

    $classes = 'boardgrid';

    if (in_array($key, board_staggered(), true)) {
        $classes .= ' staggered';
    }

    if (in_array($key, board_flowing(), true)) {
        $classes .= ' flowing staged';
    }

    if (in_array($key, board_trio(), true)) {
        $classes .= ' trio';
    }

    if (in_array($key, board_shuffled(), true)) {
        shuffle($pictures);
    }

    $out = '<div class="' . $classes . '">';

    foreach ($pictures as $picture) {
        $src = e((string) $picture['src']);
        $caption = e((string) $picture['caption']);

        $out .= '<figure class="boardpic' . (!empty($picture['whole']) ? ' whole' : '') . '">'
            . '<span class="boardpic-frame">'
            . '<img src="' . $src . '" alt="' . $caption . '" loading="lazy"'
            . ' data-full="' . $src . '" data-kind="image"></span>';

        if ($caption !== '') {
            $out .= '<figcaption>' . $caption . '</figcaption>';
        }

        $out .= '</figure>';
    }

    return $out . '</div>';
}

function site_logo(bool $linkTo404): string
{
    $href = $linkTo404 ? '/404.php' : '/home';

    return '<div class="logo"><a href="' . $href . '"><img src="/assets/4real-logo.png" alt="4real"></a></div>';
}

function page_footer(bool $authed): string
{
    $out = '<div class="pagelinks"><a href="/home">Home</a>'
        . '<span class="dot">&#9679;</span><a href="/faq/">FAQ</a>'
        . '<span class="dot">&#9679;</span><a href="/rules/">Rules</a>';

    if ($authed) {
        $out .= '<span class="dot">&#9679;</span><a href="/admintools.php">Admin Tools</a>';
    }

    return $out . '</div>'
        . '<div class="copyright">Copyright &copy; 2025-2026 4real community support. All rights reserved</div>'
        . '<div class="madeby">created by tolstovka (<a href="https://t.me/nysh4real" target="_blank" rel="noopener">@nysh4real</a> in telegram)</div>';
}
