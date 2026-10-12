<?php
// Accesso al tutor (pagina pubblica, passa da entry.php).
require_once __DIR__ . '/access.php';
spa_session_start();

function spl_next(): string {
    $n = (string)($_POST['next'] ?? $_GET['next'] ?? '');
    return (strpos($n, '/spagnolo/') === 0 && !preg_match('#^/[/\\\\]#', $n) && strpos($n, "\n") === false) ? $n : '/spagnolo/';
}

if (spa_session_user()) { header('Location: ' . spl_next()); exit; }

$error = '';
$username = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    spa_csrf_check();
    $username = strtolower(trim((string)($_POST['username'] ?? '')));
    [$ok, $error] = spa_attempt_login($username, (string)($_POST['password'] ?? ''));
    if ($ok) {
        spa_login_session($username);
        header('Location: ' . spl_next());
        exit;
    }
}

$body = '<div class="card auth"><h2>Accedi</h2>'
    . ($error !== '' ? '<p class="err" role="alert">' . spa_h($error) . '</p>' : '')
    . '<form method="post" autocomplete="on">'
    . '<input type="hidden" name="csrf" value="' . spa_h(spa_csrf()) . '">'
    . '<input type="hidden" name="next" value="' . spa_h(spl_next()) . '">'
    . '<label class="f" for="u">Nome utente</label><input id="u" name="username" type="text" value="' . spa_h($username) . '" autocomplete="username" autocapitalize="off" spellcheck="false" required autofocus>'
    . '<label class="f" for="p">Password</label><input id="p" name="password" type="password" autocomplete="current-password" required>'
    . '<p><button class="primary" type="submit">Entra</button></p></form>'
    . '<p class="muted">L\'accesso è solo su invito: se non hai un link, chiedilo a chi gestisce il tutor.</p></div>';
spa_page('Accedi', $body);
