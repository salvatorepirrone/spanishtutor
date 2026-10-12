# Tutor di spagnolo

App web per esercitare lo spagnolo (livello A2-B1): conversazione scritta e a voce con correzioni, esercizi,
grammatica, vocabolario con ripasso a intervalli e test di livello. Pensata per Web Station di un NAS Synology
(nginx + PHP 7.4). Usa l'API di Claude lato server: nessuna chiave nel browser né nel repository.

## Sezioni

| Sezione | Cosa fa |
| --- | --- |
| Conversazione | Dialogo con il tutor (testo e voce), correzione dopo ogni frase, suggerimenti in spagnolo (💡) |
| Esercizi | Serie generate per argomento: scelta multipla, completa, traduci |
| Grammatica | 44 argomenti in 7 sezioni, lezioni generate una volta e conservate |
| Vocabolario | 16 temi, mazzo personale e flashcard con ripasso a intervalli |
| Test | 20 domande + testo scritto, stima del livello e progressi |

## Installazione sul NAS

1. Copiare la cartella `spagnolo/` in `/volume2/web/`.
2. La chiave API di Claude sta fuori dal sito, in `/volume2/web/auth-data/anthropic.key` (una riga, mai nel repo).
3. Far gestire `/spagnolo/` al tutor: in cima a `auth/gate.php` del sito, prima di qualsiasi `require`, c'è questo blocco
   (se il gate viene sostituito da un deploy del sito, va rimesso):

```php
$__sp = '/' . ltrim(rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/'), '/');
if ($__sp === '/spagnolo' || strpos($__sp, '/spagnolo/') === 0) {
    require __DIR__ . '/../spagnolo/entry.php';
    exit;
}
unset($__sp);
```

## Accessi (autonomi dal resto del sito)

Utenti, sessioni, inviti e limiti stanno in `/volume2/web/auth-data/spagnolo/` (chiuso al web).

- Accesso solo su invito: l'admin crea un link a uso singolo (7 giorni) e la persona sceglie la password.
- Ruoli: `admin` (pagina `/spagnolo/admin.php`), `user`, `guest` (limite di richieste più basso).
- Limite giornaliero di richieste a Claude per persona (predefinito 150, guest 30), per proteggere la chiave API.
- Blocco dopo 5 password errate e tetto di tentativi per indirizzo IP; sessioni invalidate al cambio password.

Primo amministratore, dal NAS (via SSH):

```sh
/usr/local/bin/php74 /volume2/web/spagnolo/cli.php invite <utente> admin    # stampa il link di invito
/usr/local/bin/php74 /volume2/web/spagnolo/cli.php set-password <utente>    # in alternativa: la password si digita nel terminale
/usr/local/bin/php74 /volume2/web/spagnolo/cli.php list
```

La password non si passa mai come argomento e non va mai scritta nel repository.
