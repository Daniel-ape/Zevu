import type { Lang } from '../i18n'
import { inAppLink } from '../data/openLink'

// Information pages under Settings: about the app, privacy, where the data
// comes from (with the attributions the licences require) and terms of use.
// Written out per language: these are read as a whole, not as UI strings.

export type LegalPage = 'about' | 'privacy' | 'sources' | 'terms'

const CONTACT = 'https://github.com/Daniel-ape/hintaopas/issues'
const UPDATED = '2026-11-08'

type Block = { h?: string; p?: string; list?: string[] }
type Doc = Record<LegalPage, { title: string; blocks: Block[] }>

const SV: Doc = {
  about: { title: 'Om ZEVU', blocks: [
    { p: 'ZEVU – Compare More. Spend Less. ZEVU jämför priser mellan butiker i Finland, visar veckans reklamblad och medlemserbjudanden, och räknar ut vad du sparar utifrån dina kvitton.' },
    { h: 'Gratis och reklamfri', p: 'Appen är gratis, har ingen reklam och säljer inga uppgifter. ZEVU har inget samarbete med någon butikskedja.' },
    { h: 'Kontakt', p: `Frågor, fel och önskemål: ${CONTACT}` },
  ] },
  privacy: { title: 'Integritet', blocks: [
    { p: `Senast uppdaterad ${UPDATED}. Kort sagt: ZEVU samlar inte in uppgifter om dig. Utan konto stannar allt på din telefon. Med konto sparas bara det som behövs för att dina saker ska finnas på alla dina enheter.` },
    { h: 'Utan konto', list: [
      'Listor, kuponger, kvitton, bevakade varor, valda butiker och inställningar sparas bara på din enhet.',
      'Kvittobilder och streckkoder läses på telefonen. Bilderna skickas inte någonstans.',
      'Ingen spårning, ingen analys, inga annonser och inga cookies för reklam.',
    ] },
    { h: 'Med Google-konto', list: [
      'Inloggningen sker via Google. ZEVU får ditt namn, din e-postadress och din profilbild.',
      'Det du sparar i appen (listor, kuponger, kvitton, bevakade varor, butiker och inställningar) lagras hos vår databasleverantör Supabase så att det synkas mellan dina enheter.',
      'Rättslig grund: avtal, alltså för att leverera synkningen du har valt (GDPR art. 6.1 b).',
      'Uppgifterna sparas tills du raderar kontot. Då raderas allt.',
    ] },
    { h: 'Tjänster appen hämtar data från', list: [
      'Prisfiler och appen själv: GitHub Pages (ser din IP-adress som vid alla webbesök).',
      'Produktinfo vid streckkodssökning: Open Food Facts (bara streckkoden skickas).',
      'Närmaste butiker: om du tillåter plats skickas ungefärliga koordinater till OpenStreetMaps Overpass-tjänst för att hitta butiker nära dig. Platsen sparas inte.',
      'Reklamblad öppnas från butikernas och utgivarnas egna sidor (t.ex. Publitas, Issuu, Lidl).',
    ] },
    { h: 'Behörigheter', list: [
      'Kamera: för streckkoder, kvitton och kuponger. Bara när du själv öppnar kameran.',
      'Plats: frivilligt, för att visa närmaste butiker.',
      'Notiser: frivilligt, för prisvarningar. Kontrollen görs på telefonen.',
    ] },
    { h: 'Dina rättigheter', p: 'Du har rätt att få veta vilka uppgifter som finns om dig, få dem rättade, raderade eller utlämnade, och att invända. Du raderar konto och data direkt i appen under Du → Integritet → Radera konto. Du kan klaga hos Dataombudsmannens byrå (tietosuoja.fi).' },
    { h: 'Barn', p: 'ZEVU riktar sig inte till barn under 13 år.' },
    { h: 'Personuppgiftsansvarig och kontakt', p: `Utvecklaren av ZEVU. Kontakt: ${CONTACT}` },
  ] },
  sources: { title: 'Datakällor', blocks: [
    { p: 'Priserna i ZEVU kommer från öppet tillgängliga källor. De kan avvika från priset i butiken – kontrollera alltid i butiken innan du köper.' },
    { h: 'Priser', list: [
      'Butikernas egna webbplatser: Tokmanni, Halpa-Halli, Prisma.fi, Lidl, Verkkokauppa.com, Power, Multitronic, Stockmann, Kärkkäinen, Ruohonjuuri, Apteekki360 och Yliopiston Apteekki. Hämtas i lugn takt och enligt varje webbplats robots.txt.',
      'Open Prices av Open Food Facts: priser som privatpersoner rapporterat.',
      'Dina egna kvitton och hyllpriser (bara för dig).',
    ] },
    { h: 'Reklamblad och erbjudanden', p: 'Reklambladen och bilderna ur dem tillhör respektive butik och utgivare. Erbjudandena läses ur de offentliga bladen och gäller bara under de dagar och villkor som anges i bladet.' },
    { h: 'Produktinformation', p: 'Produktnamn, bilder och kategorier: Open Food Facts (openfoodfacts.org), licens Open Database License (ODbL); bilder CC BY-SA.' },
    { h: 'Kartdata', p: 'Butikernas platser: © OpenStreetMaps bidragsgivare, ODbL.' },
    { h: 'Varumärken', p: 'Butikernas namn och logotyper är deras ägares varumärken och används bara för att visa var ett pris gäller. ZEVU har inget samarbete med dem.' },
  ] },
  terms: { title: 'Användarvillkor', blocks: [
    { p: `Senast uppdaterad ${UPDATED}.` },
    { list: [
      'ZEVU är gratis och tillhandahålls i befintligt skick. Vi gör vårt bästa för att priserna ska stämma, men kan inte garantera att de är rätt eller aktuella.',
      'Priset i butiken eller kassan gäller alltid. ZEVU ansvarar inte för köpbeslut som baseras på uppgifter i appen.',
      'Medlemserbjudanden kräver butikens eget medlemskap och gäller enligt butikens villkor.',
      'Använd inte appen för att störa butikernas eller andras tjänster.',
      'Villkoren kan uppdateras. Den senaste versionen finns alltid här i appen.',
    ] },
  ] },
}

const FI: Doc = {
  about: { title: 'Tietoa ZEVUsta', blocks: [
    { p: 'ZEVU – Compare More. Spend Less. ZEVU vertaa kauppojen hintoja Suomessa, näyttää viikon tarjouslehdet ja jäsenedut sekä laskee kuittiesi perusteella, paljonko säästät.' },
    { h: 'Ilmainen ja mainokseton', p: 'Sovellus on ilmainen, siinä ei ole mainoksia eikä se myy tietoja. ZEVU ei tee yhteistyötä minkään kauppaketjun kanssa.' },
    { h: 'Yhteystiedot', p: `Kysymykset, virheet ja toiveet: ${CONTACT}` },
  ] },
  privacy: { title: 'Tietosuoja', blocks: [
    { p: `Päivitetty ${UPDATED}. Lyhyesti: ZEVU ei kerää tietoja sinusta. Ilman tiliä kaikki pysyy puhelimessasi. Tilin kanssa tallennetaan vain se, mitä tarvitaan, jotta tietosi ovat kaikilla laitteillasi.` },
    { h: 'Ilman tiliä', list: [
      'Listat, kupongit, kuitit, seuratut tuotteet, valitut kaupat ja asetukset tallennetaan vain laitteellesi.',
      'Kuittikuvat ja viivakoodit luetaan puhelimessa. Kuvia ei lähetetä minnekään.',
      'Ei seurantaa, analytiikkaa, mainoksia eikä mainosevästeitä.',
    ] },
    { h: 'Google-tilin kanssa', list: [
      'Kirjautuminen tapahtuu Googlen kautta. ZEVU saa nimesi, sähköpostiosoitteesi ja profiilikuvasi.',
      'Sovellukseen tallentamasi tiedot (listat, kupongit, kuitit, seuratut tuotteet, kaupat ja asetukset) säilytetään tietokantapalvelussa Supabase, jotta ne synkronoituvat laitteidesi välillä.',
      'Käsittelyperuste: sopimus eli valitsemasi synkronoinnin toimittaminen (GDPR 6.1 b).',
      'Tiedot säilytetään, kunnes poistat tilin. Silloin kaikki poistetaan.',
    ] },
    { h: 'Palvelut, joista sovellus hakee tietoja', list: [
      'Hintatiedostot ja itse sovellus: GitHub Pages (näkee IP-osoitteesi kuten kaikissa verkkokäynneissä).',
      'Tuotetiedot viivakoodihaussa: Open Food Facts (vain viivakoodi lähetetään).',
      'Lähimmät kaupat: jos sallit sijainnin, likimääräiset koordinaatit lähetetään OpenStreetMapin Overpass-palveluun. Sijaintia ei tallenneta.',
      'Tarjouslehdet avataan kauppojen ja julkaisijoiden omilta sivuilta (esim. Publitas, Issuu, Lidl).',
    ] },
    { h: 'Käyttöoikeudet', list: [
      'Kamera: viivakoodeihin, kuitteihin ja kuponkeihin, vain kun avaat kameran itse.',
      'Sijainti: vapaaehtoinen, lähimpien kauppojen näyttämiseen.',
      'Ilmoitukset: vapaaehtoinen, hintahälytyksiin. Tarkistus tehdään puhelimessa.',
    ] },
    { h: 'Oikeutesi', p: 'Sinulla on oikeus saada tietää, mitä tietoja sinusta on, sekä oikaista, poistaa ja siirtää ne ja vastustaa käsittelyä. Poistat tilin ja tiedot suoraan sovelluksessa: Sinä → Tietosuoja → Poista tili. Voit tehdä valituksen tietosuojavaltuutetulle (tietosuoja.fi).' },
    { h: 'Lapset', p: 'ZEVU ei ole tarkoitettu alle 13-vuotiaille.' },
    { h: 'Rekisterinpitäjä ja yhteystiedot', p: `ZEVUn kehittäjä. Yhteys: ${CONTACT}` },
  ] },
  sources: { title: 'Tietolähteet', blocks: [
    { p: 'ZEVUn hinnat tulevat julkisesti saatavilla olevista lähteistä. Ne voivat poiketa myymälän hinnasta – tarkista aina kaupassa ennen ostoa.' },
    { h: 'Hinnat', list: [
      'Kauppojen omat verkkosivut: Tokmanni, Halpa-Halli, Prisma.fi, Lidl, Verkkokauppa.com, Power, Multitronic, Stockmann, Kärkkäinen, Ruohonjuuri, Apteekki360 ja Yliopiston Apteekki. Haetaan rauhallisesti ja kunkin sivuston robots.txt-ohjeiden mukaan.',
      'Open Prices (Open Food Facts): yksityishenkilöiden ilmoittamat hinnat.',
      'Omat kuittisi ja hyllyhinnat (vain sinulle).',
    ] },
    { h: 'Tarjouslehdet ja tarjoukset', p: 'Tarjouslehdet ja niiden kuvat kuuluvat kyseisille kaupoille ja julkaisijoille. Tarjoukset luetaan julkisista lehdistä, ja ne ovat voimassa vain lehdessä mainittuina päivinä ja ehdoin.' },
    { h: 'Tuotetiedot', p: 'Tuotenimet, kuvat ja tuoteryhmät: Open Food Facts (openfoodfacts.org), lisenssi Open Database License (ODbL); kuvat CC BY-SA.' },
    { h: 'Karttatiedot', p: 'Kauppojen sijainnit: © OpenStreetMapin tekijät, ODbL.' },
    { h: 'Tavaramerkit', p: 'Kauppojen nimet ja logot ovat omistajiensa tavaramerkkejä, ja niitä käytetään vain kertomaan, missä hinta on voimassa. ZEVU ei tee yhteistyötä niiden kanssa.' },
  ] },
  terms: { title: 'Käyttöehdot', blocks: [
    { p: `Päivitetty ${UPDATED}.` },
    { list: [
      'ZEVU on ilmainen ja tarjotaan sellaisenaan. Teemme parhaamme, jotta hinnat pitävät paikkansa, mutta emme voi taata niiden oikeellisuutta tai ajantasaisuutta.',
      'Myymälän tai kassan hinta on aina voimassa. ZEVU ei vastaa sovelluksen tietoihin perustuvista ostopäätöksistä.',
      'Jäsenedut edellyttävät kaupan omaa jäsenyyttä ja ovat voimassa kaupan ehtojen mukaan.',
      'Älä käytä sovellusta kauppojen tai muiden palvelujen häiritsemiseen.',
      'Ehtoja voidaan päivittää. Uusin versio on aina täällä sovelluksessa.',
    ] },
  ] },
}

const EN: Doc = {
  about: { title: 'About ZEVU', blocks: [
    { p: 'ZEVU – Compare More. Spend Less. ZEVU compares shop prices in Finland, shows this week’s leaflets and members’ offers, and works out what you save from your receipts.' },
    { h: 'Free and ad-free', p: 'The app is free, has no ads and sells no data. ZEVU is not affiliated with any retail chain.' },
    { h: 'Contact', p: `Questions, bugs and ideas: ${CONTACT}` },
  ] },
  privacy: { title: 'Privacy', blocks: [
    { p: `Last updated ${UPDATED}. In short: ZEVU does not collect data about you. Without an account everything stays on your phone. With an account only what is needed to have your things on all your devices is stored.` },
    { h: 'Without an account', list: [
      'Lists, coupons, receipts, watched products, chosen shops and settings are stored only on your device.',
      'Receipt photos and barcodes are read on the phone. Photos are not sent anywhere.',
      'No tracking, no analytics, no ads and no advertising cookies.',
    ] },
    { h: 'With a Google account', list: [
      'Sign-in is through Google. ZEVU receives your name, email address and profile picture.',
      'What you save in the app (lists, coupons, receipts, watched products, shops and settings) is stored with our database provider Supabase so it syncs between your devices.',
      'Legal basis: contract, i.e. providing the sync you chose (GDPR Art. 6(1)(b)).',
      'Data is kept until you delete the account. Then everything is deleted.',
    ] },
    { h: 'Services the app gets data from', list: [
      'Price files and the app itself: GitHub Pages (sees your IP address, as with any website visit).',
      'Product information for barcode look-ups: Open Food Facts (only the barcode is sent).',
      'Nearest shops: if you allow location, approximate coordinates are sent to OpenStreetMap’s Overpass service. Location is not stored.',
      'Leaflets open from the shops’ and publishers’ own pages (e.g. Publitas, Issuu, Lidl).',
    ] },
    { h: 'Permissions', list: [
      'Camera: for barcodes, receipts and coupons, only when you open it.',
      'Location: optional, to show nearby shops.',
      'Notifications: optional, for price alerts. Checks run on the phone.',
    ] },
    { h: 'Your rights', p: 'You may access, correct, delete and export your data and object to its use. Delete your account and data in the app: You → Privacy → Delete account. You can complain to the Finnish Data Protection Ombudsman (tietosuoja.fi).' },
    { h: 'Children', p: 'ZEVU is not intended for children under 13.' },
    { h: 'Controller and contact', p: `The developer of ZEVU. Contact: ${CONTACT}` },
  ] },
  sources: { title: 'Data sources', blocks: [
    { p: 'Prices in ZEVU come from publicly available sources. They may differ from the price in the shop – always check in store before buying.' },
    { h: 'Prices', list: [
      'The shops’ own websites: Tokmanni, Halpa-Halli, Prisma.fi, Lidl, Verkkokauppa.com, Power, Multitronic, Stockmann, Kärkkäinen, Ruohonjuuri, Apteekki360 and Yliopiston Apteekki. Read slowly and following each site’s robots.txt.',
      'Open Prices by Open Food Facts: prices reported by the public.',
      'Your own receipts and shelf labels (for you only).',
    ] },
    { h: 'Leaflets and offers', p: 'Leaflets and pictures from them belong to the shops and publishers. Offers are read from the public leaflets and are valid only on the days and terms stated there.' },
    { h: 'Product information', p: 'Product names, pictures and categories: Open Food Facts (openfoodfacts.org), Open Database License (ODbL); pictures CC BY-SA.' },
    { h: 'Map data', p: 'Shop locations: © OpenStreetMap contributors, ODbL.' },
    { h: 'Trademarks', p: 'Shop names and logos are trademarks of their owners, used only to show where a price applies. ZEVU is not affiliated with them.' },
  ] },
  terms: { title: 'Terms of use', blocks: [
    { p: `Last updated ${UPDATED}.` },
    { list: [
      'ZEVU is free and provided as is. We do our best to keep prices right but cannot guarantee they are correct or current.',
      'The price in the shop or at the till always applies. ZEVU is not responsible for purchase decisions based on the app.',
      'Members’ offers need the shop’s own membership and follow the shop’s terms.',
      'Do not use the app to disrupt the shops’ or anyone else’s services.',
      'These terms may be updated. The latest version is always here in the app.',
    ] },
  ] },
}

export const legalTitle = (page: LegalPage, lang: Lang) => ({ sv: SV, fi: FI, en: EN }[lang] ?? EN)[page].title

/** Text with the contact address turned into a link. */
function Text({ s }: { s: string }) {
  const i = s.indexOf(CONTACT)
  if (i < 0) return <>{s}</>
  return <>{s.slice(0, i)}<a href={CONTACT} target="_blank" rel="noreferrer" onClick={inAppLink(CONTACT)}>{CONTACT.replace('https://', '')}</a>{s.slice(i + CONTACT.length)}</>
}

export function LegalText({ page, lang }: { page: LegalPage; lang: Lang }) {
  const doc = ({ sv: SV, fi: FI, en: EN }[lang] ?? EN)[page]
  return (
    <div className="legal">
      {doc.blocks.map((b, i) => (
        <section key={i}>
          {b.h && <h3>{b.h}</h3>}
          {b.p && <p><Text s={b.p} /></p>}
          {b.list && <ul>{b.list.map((x, j) => <li key={j}><Text s={x} /></li>)}</ul>}
        </section>
      ))}
    </div>
  )
}
