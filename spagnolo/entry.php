<?php
// Ingresso del tutor: auth/gate.php gli passa ogni richiesta che inizia con /spagnolo/.
// Qui le regole sono quelle del tutor (accessi propri, vedi access.php), non quelle del resto del sito.
define('SP_ENTRY', 1);
require_once __DIR__ . '/access.php';

function spe_json_error(int $code, string $msg): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = '/' . ltrim(rawurldecode($uri), '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($path === '/spagnolo') { header('Location: /spagnolo/'); exit; }

$bad = strpos($path, "\0") !== false;
foreach (explode('/', $path) as $seg) if ($seg === '..' || ($seg !== '' && $seg[0] === '.')) $bad = true;
$rel = ltrim(substr($path, strlen('/spagnolo')), '/');
if ($rel === '') $rel = 'index.html';
if ($bad || strpos($rel, '/') !== false) { http_response_code(404); echo 'Non trovato'; exit; }

// Pagine senza sessione: accesso, uscita, invito.
$publicPages = ['login.php', 'logout.php', 'invito.php'];
if (in_array($rel, $publicPages, true)) {
    chdir(__DIR__);
    require __DIR__ . '/' . $rel;
    exit;
}

$mimes = ['css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'html' => 'text/html; charset=utf-8'];
$ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
$serve = function () use ($path, $ext, $mimes) {
    header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
    header('X-Content-Type-Options: nosniff');
    header('X-Accel-Redirect: /_protected' . implode('/', array_map('rawurlencode', explode('/', $path))));
    exit;
};
// Il foglio di stile serve anche alla pagina di accesso (non contiene nulla di riservato).
if ($rel === 'style.css') $serve();

$user = spa_session_user();
if (!$user) {
    header('Cache-Control: no-store');
    if ($rel === 'api.php') spe_json_error(401, 'Sessione scaduta: accedi di nuovo.');
    if (in_array($method, ['GET', 'HEAD'], true)) { header('Location: /spagnolo/login.php?next=' . rawurlencode($path)); exit; }
    spe_json_error(401, 'Accesso richiesto');
}

// Pagine dinamiche: solo queste. Gli altri .php della cartella sono librerie e non si eseguono dal web.
if (in_array($rel, ['api.php', 'account.php', 'admin.php'], true)) {
    $_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/' . $rel;
    $_SERVER['SCRIPT_NAME'] = $_SERVER['PHP_SELF'] = '/spagnolo/' . $rel;
    chdir(__DIR__);
    require __DIR__ . '/' . $rel;
    exit;
}

// File statici dell'app.
$known = ['index.html', 'common.js', 'conversazione.js', 'grammatica.js', 'esercizi.js', 'vocabolario.js', 'test.js', 'benvenuto.js', 'piano.js', 'home.js'];
if (in_array($rel, $known, true) && is_file(__DIR__ . '/' . $rel)) $serve();

http_response_code(404);
echo 'Non trovato';
