<?php
// Uscita: solo con POST e token, per evitare uscite provocate da altri siti.
require_once __DIR__ . '/access.php';
spa_session_start();
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    spa_csrf_check();
    spa_logout();
}
header('Location: /spagnolo/login.php');
