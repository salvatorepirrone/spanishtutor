# Come creare la propria copia del tutor di spagnolo

Questa guida è per chi vuole avere un'app identica a questa, tutta sua: con i propri utenti, i propri dati e la propria chiave Claude.
Un'app non è condivisa tra più persone: ogni copia ha il suo sito, il suo archivio e il suo conto per le richieste a Claude.

Ci sono due strade:

- **Strada A, copia del progetto esistente (consigliata).** Si parte dal codice già pronto, si adatta e si pubblica. Richiede circa un'ora.
- **Strada B, ricostruzione da zero con Claude Code.** Si fa scrivere l'app a Claude partendo da una descrizione. Richiede molto più tempo e il risultato non sarà identico.

## Cosa serve (per entrambe)

| Cosa | Perché | Costo |
| --- | --- | --- |
| Account **GitHub** | contiene il codice | gratuito |
| Account **Netlify** | pubblica il sito e le funzioni | gratuito, ma ha un limite di crediti: ogni deploy ne consuma 15 su 300 al mese |
| **Chiave API Anthropic** (console.anthropic.com) | il tutor è Claude, chiamato solo dal server | a consumo: ogni richiesta ha un costo, vedi il piano dei prezzi |
| **Git** installato sul computer | per copiare e salvare il codice | gratuito |
| Python 3 (facoltativo) | per provare l'app in locale con la demo | gratuito |
| Node.js 22 o più recente (facoltativo) | per provare in locale con il vero Claude | gratuito |

La chiave API è personale: non va mai scritta nel codice né condivisa. Resta solo nelle impostazioni di Netlify e nel file `.env` locale (che non va su GitHub).

## Strada A: copiare il progetto

### 1. Ottenere il codice

Il progetto è su GitHub (`salvatorepirrone/spanishtutor`). Se il repository è privato, chi lo possiede deve invitarti come collaboratore, oppure darti il codice in una cartella compressa.

Con accesso al repository, da un terminale:

```sh
git clone https://github.com/salvatorepirrone/spanishtutor.git
cd spanishtutor
```

Per avere una copia indipendente (consigliato), crea un **nuovo repository vuoto** sul tuo GitHub e collegalo:

```sh
git remote remove origin
git remote add origin https://github.com/TUO-UTENTE/NOME-REPO.git
git push -u origin main
```

### 2. Provare subito in locale, senza spendere nulla

```sh
py tools/demo.py
```

Apri `http://127.0.0.1:18080/`. Vedi tutto il sito con un tutor **simulato**: le risposte sono di prova e non si paga nulla. Serve per capire come funziona e per vedere le modifiche prima di pubblicarle.

### 3. Adattare l'app a te

Apri `netlify/lib/core.mjs` (oggetto `CFG`, in cima al file) e cambia:

- `DEADLINE`: la data a cui vuoi arrivare preparato (nel progetto originale `2026-12-02`).
- `START`: la data di inizio del percorso.
- Il limite giornaliero di richieste a Claude per persona si imposta in `netlify/lib/auth.mjs` (`DEFAULT_LIMIT`, valore iniziale 150; i guest ne hanno meno) e per ogni utente dalla pagina `/admin.html`: serve a proteggere la tua chiave.

La scritta «giorni al 2 dicembre» è anche in alcuni testi: `public/index.html`, `public/home.js`, `public/piano.js`, `public/test.js`. Cercala con la ricerca del tuo editor e sostituiscila con la tua data.

Il livello iniziale non va impostato nel codice: al primo accesso l'app propone un test di livello e prepara un piano di 8 settimane.

### 4. Creare il sito su Netlify

1. Su Netlify: **Add new project → Import an existing project → GitHub** e scegli il tuo repository. Le impostazioni di build vengono da `netlify.toml` (cartella pubblicata `public`, funzioni in `netlify/functions`, Node 22).
2. **Prima del primo deploy**, in **Project configuration → Environment variables** crea queste variabili (ambito: Functions). Così non servirà un secondo deploy.

   | Variabile | Valore |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | la tua chiave API di Claude |
   | `SESSION_SECRET` | stringa casuale di almeno 32 caratteri, per firmare le sessioni |
   | `SETUP_TOKEN` | una parola d'ordine a tua scelta, serve solo per creare il primo amministratore |
   | `PUBLIC_URL` | (facoltativa) indirizzo del sito, per i link di invito |

   Per generare `SESSION_SECRET` da PowerShell:

   ```powershell
   -join ((48..57)+(97..122) | Get-Random -Count 48 | % {[char]$_})
   ```

3. Lancia il deploy: **Deploys → Trigger deploy → Deploy site**. Aspetta lo stato **Published**.

### 5. Primo accesso

1. Apri `https://NOME-SITO.netlify.app/setup.html`.
2. Inserisci un nome utente e il `SETUP_TOKEN`: ottieni un link a uso singolo per scegliere la tua password di amministratore. Dopo il primo amministratore la pagina non funziona più; puoi togliere `SETUP_TOKEN` dalle variabili.
3. Entra e fai il test di livello: l'app prepara il tuo piano.
4. Da `/admin.html` puoi invitare altre persone (link a uso singolo valido 7 giorni). Ruoli: `admin`, `user`, `guest` (con limite di richieste più basso).

### 6. Risparmiare crediti Netlify

- Ogni deploy costa 15 crediti. Se vuoi evitare deploy a ogni push, in **Build & deploy → Continuous deployment** premi **Stop builds**: i push su GitHub non pubblicheranno più nulla. Per pubblicare, riattiva le build, fai **Trigger deploy** e fermale di nuovo.
- Raccogli più modifiche in un solo deploy.
- Prova tutto prima con la demo locale.
- Il file `ELENCO-DEPLOY.md` contiene l'elenco di controllo da seguire prima di ogni pubblicazione.

### 7. Provare con il vero Claude in locale (facoltativo)

Serve Node.js 22 o più recente. Copia `.env.example` in `.env`, compila le tre variabili (`ANTHROPIC_API_KEY`, `SESSION_SECRET`, `SETUP_TOKEN`), poi:

```sh
npm install
npx netlify-cli dev
```

Il sito gira su `http://localhost:8888` con archivio locale, senza consumare crediti di deploy. Le richieste a Claude usano la tua chiave e si pagano come tutte le altre.

## Per adattare la copia ad altre lingue

La stessa struttura è stata usata per il portoghese del Brasile. Per un'altra lingua bisogna rivedere:

- i prompt in `netlify/lib/actions.mjs` (conversazione, esercizi, valutazioni) e le regole di base `CFG.BASE_RULES` in `core.mjs`;
- il catalogo di argomenti di grammatica e i temi di vocabolario in `netlify/lib/data.mjs`;
- il motore di coniugazione `public/coniugatore.js` (elenco dei verbi, regole ortografiche, nomi dei tempi) e la sezione `public/verbi.js`;
- la sintesi vocale e il riconoscimento della voce, che usano la lingua del browser (`es-ES` nel progetto originale);
- tutti i testi dell'interfaccia in italiano che nominano la lingua.

È un lavoro di alcune ore: conviene farlo con Claude Code, partendo dal progetto portoghese come esempio.

## Strada B: ricostruzione da zero con Claude Code

Chi preferisce creare l'app con Claude, senza copiare il codice, può aprire una cartella vuota con Claude Code e dare istruzioni a passi. Un ordine che ha funzionato:

1. **Struttura e accesso.** «Crea un sito statico in `public/` e un backend su Netlify Functions (Node 22, Netlify Blobs per i dati). Accesso solo su invito con ruoli admin, user e guest, password con PBKDF2, cookie di sessione firmato e difesa CSRF. La chiave API di Claude deve stare solo sul server.»
2. **Conversazione.** «Una sezione in cui parlo in spagnolo con il tutor, a voce e per iscritto: dopo ogni mia frase mi corregge e mi dà suggerimenti. Pulsante Stop per la voce e un suggerimento in spagnolo se non conosco una parola.»
3. **Esercizi.** «Serie generate al momento: scelta multipla, completa la frase (una casella per ogni spazio) e traduzione libera con punteggio da 0 a 1 a passi di 0,25. Mai parole italiane nelle frasi.»
4. **Grammatica.** «Un catalogo di argomenti (pronomi, avverbi, tempi verbali…) con lezioni generate una volta sola e conservate.»
5. **Vocabolario.** «Temi con liste di parole e test di scrittura nei due versi, con sinonimi accettati; mazzo personale con ripasso a intervalli.»
6. **Verbi.** «Un motore di coniugazione a regole con le forme irregolari evidenziate, allenamento e controllo con il tutor per i verbi non in elenco.»
7. **Test e piano.** «Test di livello all'ingresso e piano di 8 settimane; un test a settimana per vedere i progressi.»
8. **Prove.** «Una demo locale con un Claude simulato e prove automatiche del backend.»

Poi si segue dal punto 4 della Strada A per pubblicare.

Consigli: chiedi di far provare ogni passo prima del successivo, descrivi i limiti di costo (richieste giornaliere per persona) fin dall'inizio e non incollare mai la chiave API nella chat.

## Sicurezza e privacy

- La chiave API è tua e personale: non va nel codice, nel repository, in chat o in screenshot.
- Le password non vengono mai memorizzate in chiaro; gli utenti entrano solo su invito.
- Anche con i deploy fermi, chiunque abbia il link al sito può vederne la pagina di accesso: senza invito non può entrare.
- Le conversazioni passano da Claude (Anthropic): non scrivere dati personali sensibili.

## Limiti da conoscere

- Lezioni, liste di vocabolario ed esercizi sono generati da Claude e non sono riletti da un insegnante.
- Un verbo non presente nell'elenco può non esistere o essere irregolare: lo decide Claude e può sbagliare su verbi rari.
- Le funzioni di Netlify durano al massimo 60 secondi; le chiamate più lente usano 15-50 secondi alla prima generazione e poi restano in cache.
- Il microfono richiede Chrome, Edge o Safari e una connessione a internet.
- Il piano gratuito di Netlify ha un limite di crediti mensili: tieni d'occhio la pagina Usage.

## Dove guardare nel codice

| Cosa | Dove |
| --- | --- |
| Impostazioni (date, modello, limiti) | `netlify/lib/core.mjs` |
| Azioni e prompt per Claude | `netlify/lib/actions.mjs` |
| Accessi e utenti | `netlify/lib/auth.mjs`, `netlify/lib/router.mjs` |
| Dati statici (argomenti, temi) | `netlify/lib/data.mjs` |
| Pagine e script | `public/` |
| Motore dei verbi | `public/coniugatore.js`, `public/verbi.js` |
| Prove automatiche e Claude simulato | `netlify/test/backend.test.mjs` |
| Demo locale | `tools/demo.py` |
| Riassunto per riprendere il lavoro | `RIASSUNTO-PROGETTO.md` |
| Elenco di controllo per i deploy | `ELENCO-DEPLOY.md` |
