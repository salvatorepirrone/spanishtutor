<?php
// Accessi autonomi del tutor di spagnolo: utenti, sessioni, inviti e limiti propri, indipendenti da quelli del sito.
// Tutto sta in auth-data/spagnolo/ (chiuso al web da nginx). Si usa da entry.php, api.php, dalle pagine e da cli.php.
if (!defined('SP_API') && !defined('SP_ENTRY') && PHP_SAPI !== 'cli') { http_response_code(404); exit; }

const SPA_DATA = '/volume2/web/auth-data/spagnolo';
const SPA_PUBLIC_URL = 'https://pirrone.direct.quickconnect.to';
const SPA_BASE = '/spagnolo/';
const SPA_MIN_PW = 10;
const SPA_INVITE_TTL = 604800;     // 7 giorni
const SPA_SESSION_TTL = 2592000;   // 30 giorni
const SPA_DEFAULT_LIMIT = 150;     // richieste a Claude al giorno per utente (0 = senza limite)
const SPA_GUEST_LIMIT = 30;        // tetto più basso per il ruolo ospite
const SPA_ROLES = ['admin', 'user', 'guest'];
const SPA_MAX_FAILS = 5;
const SPA_LOCK_SECONDS = 300;
const SPA_IP_MAX_FAILS = 20;       // tentativi falliti per IP in 15 minuti

function spa_h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

function spa_dir(string $sub = ''): string {
    $dir = SPA_DATA . ($sub !== '' ? '/' . $sub : '');
    if (!is_dir($dir)) {
        $old = umask(0);                       // le cartelle devono essere scrivibili sia da PHP-FPM (http) sia dallo SSH (Claude)
        @mkdir($dir, 0777, true);
        umask($old);
    }
    return $dir;
}

function spa_file(string $name): string { return spa_dir() . '/' . $name . '.json'; }

function spa_read(string $name): array {
    $f = spa_file($name);
    $d = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    return is_array($d) ? $d : [];
}

// Legge, modifica e salva un file JSON sotto lock esclusivo; $fn(array): array.
function spa_update(string $name, callable $fn): array {
    $f = spa_file($name);
    $lock = fopen($f . '.lock', 'c');
    @chmod($f . '.lock', 0666);
    flock($lock, LOCK_EX);
    $d = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    $d = $fn(is_array($d) ? $d : []);
    $tmp = $f . '.tmp';
    file_put_contents($tmp, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    @chmod($tmp, 0666);
    rename($tmp, $f);
    flock($lock, LOCK_UN);
    fclose($lock);
    return $d;
}

// ---------------------------------------------------------------- utenti

function spa_valid_username(string $u): bool {
    // Nome semplice oppure indirizzo email: lettere minuscole, numeri e . _ - @ + (niente spazi né barre: finisce in un nome di file).
    return (bool)preg_match('/^[a-z0-9][a-z0-9._@+-]{2,63}$/', $u) && strpos($u, '..') === false;
}

function spa_user(string $name): ?array {
    $u = spa_read('users')[strtolower($name)] ?? null;
    return is_array($u) ? $u : null;
}

function spa_password_problems(string $pw, string $username): array {
    $p = [];
    if (strlen($pw) < SPA_MIN_PW) $p[] = 'almeno ' . SPA_MIN_PW . ' caratteri';
    $classes = (preg_match('/[a-z]/', $pw) ? 1 : 0) + (preg_match('/[A-Z]/', $pw) ? 1 : 0)
             + (preg_match('/\d/', $pw) ? 1 : 0) + (preg_match('/[^a-zA-Z\d]/', $pw) ? 1 : 0);
    if ($classes < 3) $p[] = 'almeno tre tra minuscole, maiuscole, numeri e simboli';
    $low = strtolower($pw);
    if ($username !== '' && strpos($low, strtolower($username)) !== false) $p[] = 'non deve contenere il nome utente';
    foreach (['password', 'qwerty', 'spagnolo', 'espanol', 'letmein', 'abc123'] as $w) {
        if (strpos($low, $w) !== false) { $p[] = 'non deve contenere parole comuni'; break; }
    }
    if (preg_match('/(.)\1{3,}/', $pw)) $p[] = 'non più di 3 caratteri uguali di fila';
    return $p;
}

// Impronta della password corrente: se cambia, le sessioni aperte con la vecchia smettono di valere.
function spa_fingerprint(array $u): string { return substr(hash('sha256', (string)($u['hash'] ?? '')), 0, 16); }

function spa_admin_count(array $users): int {
    $n = 0;
    foreach ($users as $u) if (($u['role'] ?? '') === 'admin' && empty($u['disabled']) && empty($u['pending'])) $n++;
    return $n;
}

// ---------------------------------------------------------------- inviti e reset

// Crea (o rinnova per un utente esistente) un link a uso singolo. Restituisce l'indirizzo completo.
function spa_invite(string $username, string $role = 'user', ?int $limit = null): string {
    $username = strtolower($username);
    if (!spa_valid_username($username)) throw new InvalidArgumentException('Nome utente non valido: da 3 a 64 caratteri tra lettere, numeri e . _ - @ + (senza spazi).');
    $role = in_array($role, SPA_ROLES, true) ? $role : 'user';
    spa_update('users', function ($users) use ($username, $role, $limit) {
        if (!isset($users[$username])) {
            $users[$username] = [
                'hash' => password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT), 'role' => $role, 'pending' => true,
                'created' => time(), 'fails' => 0, 'locked_until' => 0, 'last_login' => 0,
                'limit' => $limit === null ? ($role === 'guest' ? SPA_GUEST_LIMIT : SPA_DEFAULT_LIMIT) : max(0, $limit),
            ];
        }
        return $users;
    });
    $token = bin2hex(random_bytes(24));
    spa_update('tokens', function ($t) use ($token, $username) {
        $now = time();
        foreach ($t as $k => $v) if (($v['exp'] ?? 0) < $now || ($v['user'] ?? '') === $username) unset($t[$k]);   // un solo link valido per utente
        $t[hash('sha256', $token)] = ['user' => $username, 'exp' => $now + SPA_INVITE_TTL];
        return $t;
    });
    return SPA_PUBLIC_URL . SPA_BASE . 'invito.php?t=' . $token;
}

// Utente a cui appartiene un link valido, oppure null.
function spa_token_user(string $token): ?string {
    if (!preg_match('/^[a-f0-9]{48}$/', $token)) return null;
    $t = spa_read('tokens')[hash('sha256', $token)] ?? null;
    if (!is_array($t) || ($t['exp'] ?? 0) < time()) return null;
    return spa_user((string)$t['user']) ? (string)$t['user'] : null;
}

function spa_token_burn(string $token): void {
    $h = hash('sha256', $token);
    spa_update('tokens', function ($t) use ($h) { unset($t[$h]); return $t; });
}

function spa_set_password(string $username, string $pw): void {
    spa_update('users', function ($users) use ($username, $pw) {
        if (!isset($users[$username])) return $users;
        $users[$username]['hash'] = password_hash($pw, PASSWORD_DEFAULT);
        unset($users[$username]['pending']);
        $users[$username]['fails'] = 0;
        $users[$username]['locked_until'] = 0;
        return $users;
    });
}

// ---------------------------------------------------------------- sessioni

function spa_session_start(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('spagnolo_sid');
    session_save_path(spa_dir('sessions'));
    ini_set('session.gc_maxlifetime', (string)SPA_SESSION_TTL);
    $secure = !empty($_SERVER['HTTPS']) || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params(['lifetime' => SPA_SESSION_TTL, 'path' => '/spagnolo', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

// Utente della sessione, se esiste ancora, non è disattivato e la password è quella con cui ha fatto l'accesso.
function spa_session_user(): ?string {
    spa_session_start();
    $name = $_SESSION['user'] ?? null;
    if (!is_string($name)) return null;
    $u = spa_user($name);
    if (!$u || !empty($u['disabled']) || !empty($u['pending']) || ($_SESSION['pwv'] ?? '') !== spa_fingerprint($u)) {
        unset($_SESSION['user'], $_SESSION['pwv']);
        return null;
    }
    return $name;
}

function spa_login_session(string $name): void {
    spa_session_start();
    session_regenerate_id(true);
    $u = spa_user($name);
    $_SESSION['user'] = $name;
    $_SESSION['pwv'] = $u ? spa_fingerprint($u) : '';
    spa_update('users', function ($users) use ($name) {
        if (isset($users[$name])) { $users[$name]['last_login'] = time(); $users[$name]['fails'] = 0; $users[$name]['locked_until'] = 0; }
        return $users;
    });
}

function spa_logout(): void {
    spa_session_start();
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
}

function spa_csrf(): string {
    spa_session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}

function spa_csrf_check(): void {
    spa_session_start();
    $sent = $_POST['csrf'] ?? '';
    $expected = (string)($_SESSION['csrf'] ?? '');
    if (!is_string($sent) || $expected === '' || !hash_equals($expected, $sent)) {
        http_response_code(400);
        exit('Richiesta non valida, ricarica la pagina.');
    }
}

// Verifica nome e password con blocco temporaneo dopo troppi errori. Restituisce [bool, messaggio].
function spa_attempt_login(string $username, string $pw): array {
    $username = strtolower(trim($username));
    $ip = $_SERVER['REMOTE_ADDR'] ?? '?';
    $now = time();
    $generic = 'Nome utente o password non corretti.';

    $ipLog = spa_read('ipfails');
    $recent = array_filter($ipLog[$ip] ?? [], function ($t) use ($now) { return $t > $now - 900; });
    if (count($recent) >= SPA_IP_MAX_FAILS) return [false, 'Troppi tentativi da questo indirizzo. Riprova tra qualche minuto.'];

    $u = spa_valid_username($username) ? spa_user($username) : null;
    if ($u && ($u['locked_until'] ?? 0) > $now) return [false, 'Account bloccato per qualche minuto dopo troppi errori. Riprova più tardi.'];

    $ok = false;
    if ($u && empty($u['pending']) && empty($u['disabled'])) $ok = password_verify($pw, (string)$u['hash']);
    else password_verify($pw, password_hash('dummy-' . $username, PASSWORD_DEFAULT));   // stesso tempo di risposta anche se l'utente non c'è

    if ($ok) return [true, ''];

    spa_update('ipfails', function ($l) use ($ip, $now) {
        foreach ($l as $k => $times) {
            $l[$k] = array_values(array_filter($times, function ($t) use ($now) { return $t > $now - 900; }));
            if (!$l[$k]) unset($l[$k]);
        }
        $l[$ip][] = $now;
        return $l;
    });
    if ($u) {
        spa_update('users', function ($users) use ($username, $now) {
            if (!isset($users[$username])) return $users;
            $f = (int)($users[$username]['fails'] ?? 0) + 1;
            $users[$username]['fails'] = $f;
            if ($f >= SPA_MAX_FAILS) { $users[$username]['locked_until'] = $now + SPA_LOCK_SECONDS; $users[$username]['fails'] = 0; }
            return $users;
        });
    }
    return [false, $generic];
}

// ---------------------------------------------------------------- limite giornaliero di richieste a Claude

function spa_limit_of(string $user): int {
    $u = spa_user($user);
    return $u ? max(0, (int)($u['limit'] ?? SPA_DEFAULT_LIMIT)) : 0;
}

function spa_usage_today(string $user): int {
    return (int)((spa_read('usage')[$user] ?? [])[date('Y-m-d')] ?? 0);
}

// Registra una richiesta; false se il limite del giorno è già stato raggiunto.
function spa_quota_hit(string $user): bool {
    $limit = spa_limit_of($user);
    $today = date('Y-m-d');
    $allowed = true;
    spa_update('usage', function ($all) use ($user, $limit, $today, &$allowed) {
        $mine = $all[$user] ?? [];
        $n = (int)($mine[$today] ?? 0);
        if ($limit > 0 && $n >= $limit) { $allowed = false; return $all; }
        $mine[$today] = $n + 1;
        krsort($mine);
        $all[$user] = array_slice($mine, 0, 14, true);
        return $all;
    });
    return $allowed;
}

// ---------------------------------------------------------------- pagine HTML (login, invito, account, admin)

function spa_page(string $title, string $body, string $width = 'narrow'): void {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    echo '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
       . '<meta name="theme-color" content="#c2412d"><meta name="robots" content="noindex">'
       . '<title>' . spa_h($title) . ' · Tutor di spagnolo</title><link rel="stylesheet" href="/spagnolo/style.css"></head><body>'
       . '<header><div class="top"><h1>Tutor di spagnolo</h1></div></header>'
       . '<div id="view"><main class="page ' . spa_h($width) . '">' . $body . '</main></div></body></html>';
    exit;
}

function spa_back_link(): string { return '<p><a class="back" href="' . SPA_BASE . '">← Torna al tutor</a></p>'; }
