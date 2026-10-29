# Vox Critica i Google Search Console

Sajten har nu en sitemap (`https://voxcritica.se/sitemap.xml`), en `robots.txt`, beskrivningar,
kanoniska länkar och strukturerad data med betyg. Det sista steget kräver åtkomst till domänens DNS
och måste därför göras av dig.

## 1. Lägg till voxcritica.se som domänegendom

1. Gå till <https://search.google.com/search-console> och logga in med ditt Google-konto.
2. Klicka på egendomsväljaren uppe till vänster och välj **Lägg till egendom**.
3. Välj **Domän** (inte _URL-prefix_) och skriv `voxcritica.se`. En domänegendom täcker både
   `https://`, `http://` och `www.`.
4. Klicka på **Fortsätt**. Google visar en TXT-post som börjar med `google-site-verification=`.
   Kopiera den.

## 2. Lägg in TXT-posten hos din DNS-leverantör

1. Logga in där du hanterar DNS för voxcritica.se (där domänen pekar mot GitHub Pages).
2. Skapa en ny post:
   - **Typ:** TXT
   - **Namn/värd:** `@` (eller tomt, alltså själva domänen)
   - **Värde:** hela strängen från Google, t.ex. `google-site-verification=abc123…`
   - **TTL:** standard går bra
3. Spara. Rör inte de befintliga A-, AAAA- eller CNAME-posterna för GitHub Pages.
4. Gå tillbaka till Search Console och klicka på **Verifiera**. Det kan ta från några minuter upp
   till ett dygn innan posten syns. Misslyckas det, vänta en stund och försök igen.

Låt TXT-posten ligga kvar. Tas den bort förlorar du åtkomsten till egendomen.

## 3. Skicka in sitemapen

1. Välj egendomen `voxcritica.se` och gå till **Webbplatskartor** i vänstermenyn.
2. Skriv `https://voxcritica.se/sitemap.xml` och klicka på **Skicka**.
3. Status ska bli **Klart**, med ungefär lika många upptäckta sidor som det finns filmer och
   publikationer på sajten.

Sitemapen uppdateras automatiskt vid varje bygge, så den behöver bara skickas in en gång.

## 4. Vad du kan titta på efteråt

- **Sidor** (under _Indexering_): hur många sidor som är indexerade och varför vissa inte är det.
  Det tar oftast några dagar till några veckor innan de flesta filmsidor syns. _Sök_ är medvetet
  markerad med `noindex` och ska stå som utesluten.
- **Resultat** (under _Prestanda_): visningar, klick och vilka sökord folk hittar sajten med.
- **Förbättringar** (eller _Utökade resultat_): om Google läser betygsdatan på filmsidorna och
  eventuella fel där. Om allt stämmer kan filmsidor visas med betyg i sökresultaten, men Google
  bestämmer själv när det visas.
- **URL-granskning**: klistra in en filmadress, t.ex. `https://voxcritica.se/film/presence-2025/`,
  för att se hur Google ser just den sidan och för att be om indexering.

Vill du kontrollera betygsdatan direkt kan du klistra in en filmadress i Googles
[testverktyg för utökade resultat](https://search.google.com/test/rich-results).
