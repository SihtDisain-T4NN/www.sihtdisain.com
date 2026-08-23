# SIHT DISAIN — Cloudflare Pages kontaktvorm

See projekt jääb staatiliseks HTML/CSS/JavaScript veebileheks. Kontaktvormi serveripoolne osa asub failis `functions/api/contact.js`, mille Cloudflare Pages avaldab automaatselt aadressil `POST /api/contact`.

## Mis on valmis

- olemasolev kujundus, layout ja animatsioonid jäid alles;
- kontaktivorm saadab JSON-i samal domeenil olevasse `/api/contact` endpointi;
- server valideerib nime, e-posti, ettevõtte pikkuse, lubatud teenuse, sõnumi pikkuse ja Turnstile tokeni;
- Cloudflare Turnstile peatab botid enne e-kirja saatmist;
- IP räsi põhine KV rate-limit lubab kuni 3 päringut tunnis ühelt IP-lt;
- Resend saadab päringu `CONTACT_EMAIL` aadressile ning kasutaja e-post lisatakse `reply_to` väljale;
- secrets ei ole reposti salvestatud ja vormil on nii success- kui error-state.

## Vajalikud secrets ja binding

Lisa Cloudflare Pages projekti **Production** ja **Preview** keskkonda järgmised väärtused.

| Nimi | Tüüp | Väärtus |
| --- | --- | --- |
| `CONTACT_EMAIL` | Secret | Aadress, kuhu päringud jõuavad. |
| `EMAIL_FROM` | Secret | Näiteks `SIHT DISAIN <hello@sihtdisain.com>`; saatja domeen peab olema Resendis kinnitatud. |
| `RESEND_API_KEY` | Secret | Resend API key, algab tavaliselt `re_`. |
| `TURNSTILE_SECRET_KEY` | Secret | Turnstile widgeti secret key. |
| `TURNSTILE_HOSTNAME` | Variable | Productionis `sihtdisain.com`. |
| `CONTACT_RATE_LIMIT` | KV binding | Cloudflare Workers KV namespace, mitte tekstiväärtus. |

`YOUR_TURNSTILE_SITE_KEY` failis `index.html` on avalik site key placeholder. Asenda see oma Turnstile widgeti **Site key** väärtusega. Site key võib olla frontendis; secret key ei tohi sinna kunagi jõuda.

## 1. GitHub repository

1. Loo GitHubis tühi private või public repository, näiteks `siht-disain`.
2. Tee selles kaustas `git init`, lisa failid ja tee esimene commit.
3. Seo GitHubi repository ning pushi `main` harusse.
4. Kontrolli enne pushi, et `.dev.vars` ei ilmu `git status` väljundisse. Ainult `.dev.vars.example` on lubatud reposti.

## 2. Resendi seadistamine

1. Loo konto aadressil [resend.com](https://resend.com/).
2. Ava **Domains** ja lisa `sihtdisain.com`.
3. Lisa Resendi näidatud SPF/DKIM DNS-kirjed Cloudflare DNS-i ning oota, kuni domeen on `Verified`.
4. Ava **API Keys**, loo ainult saatmisõigusega key ning kopeeri see väärtus `RESEND_API_KEY` secret’iks.
5. Pane `EMAIL_FROM` väärtuseks selle kinnitatud domeeni saatja, näiteks `SIHT DISAIN <hello@sihtdisain.com>`.

Resendi tasuta plaan lubab praegu 100 transactional e-kirja päevas ja 3 000 kuus, mis on kontaktivormi jaoks tavaliselt piisav.

## 3. Turnstile’i seadistamine

1. Cloudflare dashboardis ava **Turnstile** → **Add widget**.
2. Lisa hostnames: `sihtdisain.com` ja `www.sihtdisain.com`.
3. Vali Managed mode ja kopeeri **Site key** ning **Secret key**.
4. Asenda `index.html` failis `YOUR_TURNSTILE_SITE_KEY` site key väärtusega.
5. Lisa secret key Cloudflare Pages secret’ina nimega `TURNSTILE_SECRET_KEY`.

Turnstile tokenit kontrollib endpoint serveris Cloudflare Siteverify API abil. Vormi klient ei saa ega tohi secret key’d kasutada.

## 4. Cloudflare Pages deployment

1. Cloudflare dashboardis ava **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Vali GitHubi repository ja production branch `main`.
3. Vali framework preset **None**.
4. **Root directory**: jäta tühjaks (projekti juur).
5. **Build command**: jäta tühjaks või kasuta `exit 0`.
6. **Build output directory**: `.`.
7. Deploy. Ära kasuta Pages dashboardi Direct Upload’i — Pages Functions vajab Git integrationi või Wranglerit.

Cloudflare leiab juurkaustas oleva `functions/api/contact.js` ning kaardistab selle automaatselt `/api/contact` route’iks.

### KV binding

1. Loo Cloudflare dashboardis Workers KV namespace nimega näiteks `siht-contact-rate-limit`.
2. Ava Pages projekt → **Settings** → **Bindings** → **Add** → **KV namespace**.
3. Variable name peab olema täpselt `CONTACT_RATE_LIMIT`.
4. Vali äsja loodud namespace ning salvesta.
5. Redeploy projekt — binding jõustub alles pärast uut deploy’d.

### Secrets

Pages projektis ava **Settings** → **Environment variables**. Lisa eespool tabelis olevad väärtused nii Production kui Preview keskkonda. Märgi API key’d ning e-posti aadressid encrypted/secret väärtusteks. Pärast muutmist tee uus deploy.

## 5. Kohalik arendus

Eeldus: Node.js 20 või uuem.

```bash
npm install
cp .dev.vars.example .dev.vars
# asenda .dev.vars failis placeholderid päris development väärtustega
npm run dev
```

Wrangler käivitab saidi tavaliselt aadressil `http://localhost:8788`. Kohaliku KV bindingu loob käsk automaatselt. Testi brauseris just selle serveri kaudu, mitte `file://` URL-ina.

```bash
npm run check
npm test
```

`npm test` kontrollib GET vastust, vigast requesti, e-kirja saatmise flow’d ja 3 päringu tunnis rate-limit’i.

## 6. `sihtdisain.com` ühendamine

Canonical domeen on `https://sihtdisain.com`.

1. Cloudflare dashboardis **Add a site** → sisesta `sihtdisain.com`.
2. Cloudflare näitab kaht nameserverit. Muuda domeeni registrari juures ainult nameserverid nendeks Cloudflare väärtusteks.
3. Oota, kuni zone muutub Cloudflare’is `Active`.
4. Ava Pages projekt → **Custom domains** → **Set up a domain** → lisa `sihtdisain.com`.
5. Cloudflare loob apex-domeeni jaoks vajaliku DNS-kirje ning väljastab HTTPS sertifikaadi automaatselt.
6. Lisa ka `www.sihtdisain.com` Custom domains vaates.
7. Ava **Bulk Redirects**, loo 301 redirect `www.sihtdisain.com` → `https://sihtdisain.com`, lülita sisse query stringi ja path suffixi säilitamine. Lisa `www` jaoks proxied A-kirje `192.0.2.1`, nagu Cloudflare Pagesi redirect-juhend ette näeb.

Kui domeenil on olemas CAA kirjed, kontrolli, et need lubavad Cloudflare’i sertifikaadi väljastajaid; vastasel juhul jääb HTTPS sertifikaat väljastamata.

## 7. Production testimine

Pärast deploy’d kontrolli:

```bash
curl -i https://sihtdisain.com/api/contact
```

Oodatud vastus on `405` ja JSON `{"success":false,"error":"Method not allowed"}`.

Seejärel ava `https://sihtdisain.com`, täida kõik väljad ning lõpeta Turnstile kontroll. Kontrolli:

1. saatmise ajal näitab nupp `SAADAN...` ja väljad on ajutiselt lukus;
2. korrektse päringu järel kuvatakse `SÕNUM SAADETUD ✓`;
3. e-kiri jõuab `CONTACT_EMAIL` aadressile ning Reply vastab kasutaja e-postile;
4. tühi vorm ja vale e-post ei jõua endpointini;
5. vigane/puuduv Turnstile token annab elegantse veateate ega saada e-kirja;
6. neli järjestikust valideeritud päringut samalt IP-lt: neljas saab `429`;
7. `https://www.sihtdisain.com/teekond?x=1` teeb `301` redirecti `https://sihtdisain.com/teekond?x=1`.

Ära testi nelja päringut päris e-posti aadressiga, kui sa ei soovi nelja e-kirja saada.

## 8. Järgmised deploymentid

Tavaline workflow on:

```bash
git add .
git commit -m "Uuenda Siht Disaini lehte"
git push origin main
```

Cloudflare Pages teeb automaatselt uue production deploy. Pull requesti branchid saavad preview URL-i. Kui muudad ainult secret’e või bindinguid Cloudflare dashboardis, käivita seal **Retry deployment** / tee uus deployment, et Function saaks uue konfiguratsiooni.

## Olulised failid

| Fail | Roll |
| --- | --- |
| `functions/api/contact.js` | Serverless API, valideerimine, Turnstile, rate limit ja Resend. |
| `src/main.js` | Vormi `fetch('/api/contact')`, loading/success/error states. |
| `index.html` | Olemasolev vorm koos minimaalsete ettevõtte, teenuse ja Turnstile lisadega. |
| `src/overrides.css` | Uute vormielementide väike stiilikiht. |
| `_headers` | Turva- ja Content Security Policy päised staatilistele failidele. |
| `wrangler.toml` | Kohaliku Wrangler / Pages konfiguratsioon. |
| `.dev.vars.example` | Ohutu lokaalsete secret’ide näidis. |

## Portfolio haldamine — ilma HTML-i muutmata

### Pildi vahetamine (kõige lihtsam)

1. Ava Finderis kaust `assets/projects/`.
2. Näiteks `NOVA` kasutab faili `project-01.png`.
3. Nimeta oma uus PNG fail täpselt `project-01.png`.
4. Lohista see samasse kausta ning vali Finderis **Replace**.
5. Ava `portfolio.html` uuesti või vajuta brauseris `Cmd + Shift + R`.

Valmis — ei HTML-i ega JavaScripti muuta pole vaja. Iga projekti demo pildifail on selles kaustas olemas. Lühem sama juhend asub ka failis `assets/projects/README.txt`.

### Uue projekti lisamine

1. Lisa uus PNG pilt `assets/projects/` kausta, näiteks `minu-projekt.png`.
2. Ava ainult üks fail: `data/projects.js`.
3. Kopeeri üks olemasolev `{ ... }` projektirida ning muuda pealkiri, kategooria, aasta, kirjeldus ja `image` väärtus.
4. Lisa enda pilditee: `image: './assets/projects/minu-projekt.png'`.
5. Salvesta — portfolio ja detailleht genereerivad projekti automaatselt.

### Projekti eemaldamine või järjestuse muutmine

- Eemalda projekt: kustuta selle üks `{ ... }` rida `data/projects.js` failist.
- Muuda järjekorda: lohista sama rida failis üles- või allapoole. Array järjekord on portfolio järjekord.

Portfolio failid: `portfolio.html`, `project.html?id=1`, `data/projects.js`, `src/portfolio.css`, `src/portfolio.js` ja `src/project.js`.
