# Prometix Keyword Harvester

[English](README.md) | **Srpski**

Mali alat za komandnu liniju koji prikuplja ideje za ključne reči iz Google Autocomplete-a (Google Suggest). Zadate jedan početni pojam (seed); alat traži od Google-a dopune za taj pojam i za mnogo njegovih varijacija, pa jedinstvene keyworde izvozi u TXT, CSV i JSON, sortirane po Google-ovom relevance skoru.

- Bez API ključa, bez naloga, bez dodatnih paketa — jedna skripta.
- Potreban je **Node.js 18 ili noviji**.
- Podrazumevano cilja Srbiju (`--hl=sr --gl=RS`); menja se opcijama, vidi [Opcije](#opcije).

## Brzi start

**Windows (dvoklik):** pokrenite `start.bat`, pa unesite keyword i dubinu kada vas pita.

**Bilo koji OS (terminal):**

```bash
node prometix-keyword-harvester.js "protein u prahu"
```

## Opcije

| Opcija | Podrazumevano | Opis |
| --- | --- | --- |
| `--hl=` | `sr` | Jezik predloga. |
| `--gl=` | `RS` | Zemlja predloga. |
| `--source=` | `web` | Koji Google servis se pita: `web`, `youtube`, `news`, `shopping`, `images`, `books`, `videos`. |
| `--depth=` | `1` | `1` ili `2`. Vidi [Kako radi](#kako-radi). |
| `--delay=` | `1200` | Pauza između zahteva, u milisekundama. |
| `--max-requests=` | `120` | Maksimalan broj HTTP zahteva po pokretanju. |
| `--max-results=` | `1000` | Zaustavlja se posle ovoliko jedinstvenih keyworda. |
| `--out=` | `<seed>-<source>` | Naziv izlaznih fajlova, bez ekstenzije. |

## Primeri

Dublja pretraga:

```bash
node prometix-keyword-harvester.js "protein u prahu" --depth=2 --max-requests=200
```

YouTube predlozi:

```bash
node prometix-keyword-harvester.js "protein u prahu" --source=youtube
```

Drugi jezik i zemlja:

```bash
node prometix-keyword-harvester.js "running shoes" --hl=en --gl=US
```

Sopstveni naziv izlaznih fajlova:

```bash
node prometix-keyword-harvester.js "protein u prahu" --out=protein-keywordi
```

## Rezultati

Tri fajla se upisuju u folder iz kog pokrećete komandu (kod `start.bat` to je folder samog alata). Podrazumevano se zovu po seed-u i izvoru, npr. `protein-u-prahu-web.txt`.

| Fajl | Sadržaj |
| --- | --- |
| `.txt` | Samo lista keyworda, jedan po redu, već sortirana. |
| `.csv` | Detaljna tabela (kolone ispod). |
| `.json` | Isti podaci kao u CSV-u, u JSON formatu. |

### Kolone

| CSV kolona | JSON polje | Značenje |
| --- | --- | --- |
| `keyword` | `keyword` | Keyword. |
| `google_relevance` | `googleRelevance` | Najveći Google Suggest relevance skor koji je keyword dobio. |
| `avg_relevance` | `averageRelevance` | Prosečan relevance kroz sve upite u kojima se pojavio. |
| `seed_relevance` | `seedRelevance` | Relevance dobijen baš za osnovni seed upit, ako se tu pojavio. |
| `best_rank` | `bestRank` | Najbolja pozicija u autocomplete rezultatima (1 je najbolje). |
| `occurrences` | `occurrences` | Koliko puta je keyword pronađen kroz sve upite. |
| `source_queries` | `sourceQueries` | Upiti preko kojih je keyword pronađen. |

### Sortiranje

1. `google_relevance` — veće je bolje
2. `avg_relevance` — veće je bolje
3. `occurrences` — veće je bolje
4. `best_rank` — manje je bolje

## Sledeći korak: analiza rezultata uz AI

Sirova lista i dalje sadrži šum. Nalepite prompt ispod u AI asistenta (ChatGPT, Claude, Gemini…), upišite čime se bavite i na kraj nalepite sadržaj `.csv` fajla. Dobijate očišćene keyworde, grupisane po nameri pretrage, i uži izbor onih koje prvo treba ciljati.

```text
Lepim CSV izvezen iz Google Suggest keyword harvestera za glavni pojam pretrage mog biznisa. Kolone: keyword, google_relevance, avg_relevance, seed_relevance, best_rank, occurrences, source_queries.

MOJ BIZNIS: [čime se bavite, grad/područje koje pokrivate]

Uradi sledeće:
1. Ukloni keyworde koji očigledno nisu relevantni za moj biznis, duplikate koji se razlikuju samo po načinu pisanja i nazive konkurentskih brendova.
2. Grupiši preostale keyworde po nameri pretrage: informativna, komercijalna, transakciona, lokalna.
3. Unutar svake grupe sortiraj po google_relevance (veće prvo), zatim occurrences (veće prvo), zatim best_rank (manje prvo).
4. Napomena: google_relevance NIJE search volume. Tretiraj ga samo kao relativan signal.

Rezultat prikaži kao tabelu: Keyword | Namera | Relevance | Occurrences | Predlog upotrebe (blog tema / stranica usluge / FAQ / stranica proizvoda).
Zatim navedi 10 keyworda koje prvo treba da ciljam i za svaki objasni zašto u jednoj rečenici.

[OVDE NALEPITE CSV]
```

## Kako radi

**Dubina 1** šalje sam seed i niz njegovih varijacija — ukupno 53 upita:

- seed praćen svakim slovom `a`–`z` i cifrom `0`–`9` (`protein u prahu a`, `protein u prahu b`, …)
- seed praćen svakim od 16 modifikatora (`kako`, `koliko`, `gde`, `cena`, `iskustva`, `najbolji`, `vs`, `srbija`, …)

**Dubina 2** dodatno uzima do 100 keyworda pronađenih na dubini 1 i za svaki direktno traži predloge od Google-a (bez novog a–z širenja). Povećajte `--max-requests` da bi bilo mesta za njih — podrazumevanih 120 ostavlja samo 67 zahteva posle prvih 53.

Modifikatori su na srpskom. Za drugi jezik izmenite listu `DEFAULT_MODIFIERS` na vrhu fajla `prometix-keyword-harvester.js`.

## Važno

- **Google Suggest relevance NIJE search volume.** To je interni signal rangiranja Autocomplete rezultata i Google ga zvanično ne dokumentuje kao javnu SEO metriku. Rezultate koristite kao signal relevantnosti i alat za otkrivanje ideja, ne kao podatak o mesečnom broju pretraga.
- Alat koristi Google-ov nezvaničan, nedokumentovan suggest endpoint. Može se promeniti ili ograničiti bez najave. Držite `--delay` na razumnoj vrednosti; na HTTP 429 ili 5xx alat pokušava ponovo do tri puta, sa sve dužim pauzama.

## Licenca

[MIT](../LICENSE) © Radovan Vuković / Prometix
