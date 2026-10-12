<?php
// Invito e reset: con il link a uso singolo la persona sceglie la propria password.
require_once __DIR__ . '/access.php';
spa_session_start();

$token = (string)($_POST['t'] ?? $_GET['t'] ?? '');
$username = spa_token_user($token);
if ($username === null) {
    spa_page('Invito non valido', '<div class="card auth"><h2>Link non valido o scaduto</h2><p>Chiedi a chi gestisce il tutor un nuovo link di invito.</p><p><a href="/spagnolo/login.php">Vai all\'accesso</a></p></div>');
}

$problems = [];
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    spa_csrf_check();
    $pw = (string)($_POST['password'] ?? '');
    $problems = spa_password_problems($pw, $username);
    if ($pw !== (string)($_POST['password2'] ?? '')) $problems[] = 'le due password non coincidono';
    if (!$problems) {
        spa_set_password($username, $pw);
        spa_token_burn($token);
        spa_login_session($username);
        header('Location: /spagnolo/');
        exit;
    }
}

$list = '';
foreach ($problems as $p) $list .= '<li>' . spa_h($p) . '</li>';
$body = '<div class="card auth"><h2>Benvenuto, ' . spa_h($username) . '</h2>'
    . '<p>Scegli la tua password per entrare nel tutor di spagnolo.</p>'
    . ($list !== '' ? '<div class="err" role="alert"><p>La password non va bene:</p><ul>' . $list . '</ul></div>' : '')
    . '<form method="post" autocomplete="off">'
    . '<input type="hidden" name="csrf" value="' . spa_h(spa_csrf()) . '">'
    . '<input type="hidden" name="t" value="' . spa_h($token) . '">'
    . '<label class="f" for="p1">Nuova password</label><input id="p1" name="password" type="password" autocomplete="new-password" required autofocus>'
    . '<label class="f" for="p2">Ripetila</label><input id="p2" name="password2" type="password" autocomplete="new-password" required>'
    . '<p class="muted">Almeno ' . SPA_MIN_PW . ' caratteri, con almeno tre tra minuscole, maiuscole, numeri e simboli.</p>'
    . '<p><button class="primary" type="submit">Salva e entra</button></p></form></div>';
spa_page('Scegli la password', $body);
