# Tutor di spagnolo

App web per esercitare lo spagnolo (livello A2-B2): conversazione scritta e a voce con correzioni e suggerimenti,
esercizi sempre diversi, grammatica, vocabolario con ripasso a intervalli, coniugazione dei verbi e test di livello.
Il tutor è Claude, chiamato solo dal server: nessuna chiave nel browser né in questo repository.

## Sezioni

| Sezione | Cosa fa |
| --- | --- |
| Home | Descrizione, numeri del giorno, piano della settimana, accesso rapido alle funzioni |
| Conversazione | Dialogo con il tutor (testo e voce), correzione dopo ogni frase, suggerimenti in spagnolo (💡) |
| Esercizi | Serie generate per argomento: scelta multipla, completa, traduci |
| Grammatica | 44 argomenti in 7 sezioni, lezioni generate una volta e conservate |
| Vocabolario | 16 temi con liste di parole e **test di scrittura** (si legge il significato e si scrive la parola; i sinonimi valgono), mazzo personale con ripasso a intervalli |
| Verbi | Coniugazione con le forme irregolari evidenziate (motore a regole, circa 270 verbi) e allenamento |
| Test | 20 domande + testo scritto, stima del livello e progressi |

Al primo accesso c'è un test di ingresso (o la scelta del livello) e il tutor prepara un piano di 8 settimane.

## Struttura del repository

```
public/            sito statico (pagine, script, stile, pagine di accesso)
netlify/functions/ funzione /api (entrata)
netlify/lib/       logica del backend: accessi, azioni, router, dati statici
netlify/test/      prove della logica (archivio in memoria, Claude simulato)
netlify.toml       configurazione del sito
spagnolo/          versione precedente per NAS Synology (PHP): non più sviluppata
```

## Pubblicare su Netlify (da GitHub)

1. Su Netlify: **Add new project → Import an existing project → GitHub** e scegli questo repository.
   Le impostazioni di build vengono da `netlify.toml` (cartella pubblicata `public`, funzioni in `netlify/functions`).
2. In **Project configuration → Environment variables** crea queste variabili (ambito: Functions):

   | Variabile | Valore |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | la chiave API di Claude |
   | `SESSION_SECRET` | una stringa casuale lunga (almeno 32 caratteri), per firmare le sessioni |
   | `SETUP_TOKEN` | una parola d'ordine a tua scelta, serve solo per creare il primo amministratore |
   | `PUBLIC_URL` | (facoltativa) indirizzo del sito, per i link di invito; se manca si usa quello della richiesta |

   Per generare `SESSION_SECRET` da PowerShell: `-join ((48..57)+(97..122) | Get-Random -Count 48 | % {[char]$_})`
3. Rilancia il deploy (**Deploys → Trigger deploy**) perché le variabili valgano.
4. Apri `https://<sito>.netlify.app/setup.html`, inserisci un nome utente e il `SETUP_TOKEN`: ottieni un link a uso
   singolo per scegliere la password dell'amministratore. Dopo il primo amministratore la pagina non funziona più;
   a quel punto si può togliere `SETUP_TOKEN`.

Da lì, `/admin.html` permette di invitare altre persone.

## Provare in locale, senza deploy

**1. Demo immediata (nessuna installazione, serve solo Python).** Da un terminale nella cartella del progetto:

```sh
py tools/demo.py
```

Si apre `http://127.0.0.1:18080/` con il backend vero eseguito nel browser e un **Claude simulato**: le risposte del
tutor, gli esercizi, le liste di vocabolario e la correzione dei sinonimi sono di prova (nel test di vocabolario viene
accettata come sinonimo una risposta che comincia per «sin»), ma si possono percorrere tutte le schermate. Sei già
dentro come utente `demo`; i dati restano nella sessione del browser.

**2. Prova con il vero Claude (`netlify dev`).** Serve Node.js 22 o più recente (`winget install OpenJS.NodeJS.LTS`).
Copia `.env.example` in `.env` e compila le tre variabili (il file è ignorato da git), poi:

```sh
npm install
npx netlify-cli dev
```

Il sito gira su `http://localhost:8888` con funzione `/api` e archivio Blobs locali (separati da quelli online) e non
consuma crediti di deploy. Per il primo accesso apri `/setup.html` con il tuo `SETUP_TOKEN`. Le richieste a Claude
usano la tua chiave e vengono contate come tutte le altre.

## Accessi

- Solo su invito: l'admin crea un link a uso singolo (7 giorni) e la persona sceglie la password.
- Ruoli `admin`, `user`, `guest` (limite di richieste più basso).
- Limite giornaliero di richieste a Claude per persona (predefinito 150, guest 30), per proteggere la chiave API.
- Blocco dopo 5 password errate e tetto di tentativi per indirizzo IP; sessioni invalidate al cambio password.
- Sessione con cookie firmato (HttpOnly, Secure, SameSite=Lax); le richieste che modificano dati richiedono
  un'intestazione che un altro sito non può aggiungere.

Utenti, progressi e lezioni stanno in **Netlify Blobs** (archivio chiave/valore del sito, nessuna configurazione).

## Prove

La logica del backend si prova senza Netlify (archivio in memoria, Claude simulato). Servendo il repository con
un server statico, da una pagina del browser:

```js
const m = await import('/netlify/test/backend.test.mjs');
console.log(await m.run());   // { failures: 0, total: 69, ... }
```

## Limiti da conoscere

- Le funzioni sincrone di Netlify durano al massimo 60 secondi; le chiamate più lente (test, liste di vocabolario,
  lezioni) ne usano 15-50 alla prima generazione, poi il risultato resta in cache.
- Lezioni, liste di vocabolario ed esercizi sono generati da Claude e non sono riletti da un insegnante.
- Il microfono richiede Chrome, Edge o Safari e una connessione a internet.
