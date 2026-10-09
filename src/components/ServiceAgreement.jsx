import React from 'react';
import { HiDocumentText, HiShieldCheck, HiCash, HiClock, HiScale, HiTrendingUp } from 'react-icons/hi';

function Section({ icon: Icon, title, children }) {
  return (
    <article className="agreement-card">
      <div className="agreement-card-heading"><span className="agreement-icon"><Icon /></span><h3>{title}</h3></div>
      {children}
    </article>
  );
}

export default function ServiceAgreement({ lang }) {
  const af = lang === 'af';
  return (
    <section className="agreement-page fade-in">
      <header className="agreement-hero">
        <div className="agreement-hero-icon"><HiDocumentText /></div>
        <div className="eyebrow">WE-RISE MASTER AGREEMENT</div>
        <h2 className="section-title">{af ? 'Master Witskrif & Amptelike Diensooreenkoms' : 'Master White Paper & Official Service Agreement'}</h2>
        <p className="section-subtitle">{af
          ? 'Die huidige amptelike diens-, prys-, betalings- en platformreëls vir We-Rise.'
          : 'The current official service, pricing, payment and platform rules for We-Rise.'}</p>
      </header>

      <Section icon={HiScale} title={af ? '1. Regulatoriese Nakoming & Regsraamwerk (SARS)' : '1. Regulatory compliance & legal framework (SARS)'}>
        <ul className="agreement-list">
          <li>{af ? "Plaaslike Deursigtigheid: We-Rise is 'n trots Suid-Afrikaanse digitale infrastruktuurplatform. Anders as buitelandse platforms wat buite plaaslike jurisdiksie funksioneer, is We-Rise proaktief belyn en geklaar met die Suid-Afrikaanse Inkomstediens (SARS)." : 'Local transparency: We-Rise is a proudly South African digital infrastructure platform. Unlike foreign platforms operating outside local jurisdiction, We-Rise is proactively aligned and cleared with the South African Revenue Service (SARS).'}</li>
          <li>{af ? 'Valuta-Infrastruktuur: Alle transaksies word uitsluitlik in Suid-Afrikaanse Rand (ZAR) via Paystack geprosesseer om ekonomiese welvaart binne die grense van die Republiek van Suid-Afrika te hou.' : 'Currency infrastructure: All transactions are processed exclusively in South African Rand (ZAR) through Paystack to keep economic value within the Republic of South Africa.'}</li>
        </ul>
      </Section>

      <Section icon={HiCash} title={af ? '2. Die Besigheidsmodel, Prysstrukture & Gelde' : '2. Business model, pricing & fees'}>
        <div className="agreement-tier-grid">
          <div className="agreement-tier">
            <span>{af ? 'A. SUBSKRIPSIE-MODEL' : 'A. SUBSCRIPTION MODEL'}</span>
            <strong>R194.00</strong><small>{af ? 'eenmalige toelatingsfooi' : 'once-off joining fee'}</small>
            <strong>R166.00</strong><small>{af ? 'per maand vanaf die tweede maand' : 'per month from the second month'}</small>
            <p>{af ? 'By suksesvolle registrasie en betaling van die R194.00 word die lid die eienaar van ’n identiese, ten volle ge-hoste en bestuurde We-Rise webtuiste-bate. Die lid besit die reg om hierdie digitale bate binne die platformreëls te bestuur, dit uit te huur, of toegelate subskripsies teen haar eie verkose prys te herverkoop.' : 'After successful registration and payment of R194.00, the member becomes the owner of an identical, fully hosted and managed We-Rise website asset. Subject to the platform rules, the member may manage that digital asset, rent it, or resell permitted subscriptions at her chosen price.'}</p>
          </div>
          <div className="agreement-tier premium">
            <span>{af ? 'B. PREMIUM FRANCHISE-HUURMODEL' : 'B. PREMIUM FRANCHISE RENTAL MODEL'}</span>
            <strong>R1,800.00</strong><small>{af ? 'eenmalige aktivering' : 'once-off activation'}</small>
            <strong>R800.00</strong><small>{af ? 'maandelikse infrastruktuurfooi' : 'monthly infrastructure fee'}</small>
            <p>{af ? 'Elke kwalifiserende Premium-verkoop wat deur ’n lid se geldige HuurDit-skakel ontstaan en deur Paystack bevestig word, skep ’n direkte R1,000.00 verkoopskommissie. Die oorblywende R800.00 van daardie R1,800.00 transaksie word aan We-Rise toegeken vir infrastruktuur en platformbestuur. Geen kommissie word vir blote rekrutering geskep nie.' : 'Each qualifying Premium sale generated through a member’s valid RentIt link and verified by Paystack creates a direct R1,000.00 sales commission. The remaining R800.00 of that R1,800.00 transaction is allocated to We-Rise for infrastructure and platform management. No commission is created for recruitment alone.'}</p>
          </div>
        </div>
      </Section>

      <Section icon={HiShieldCheck} title={af ? '3. Kommersiële Substansie & Teen-Skema Reëls' : '3. Commercial substance & anti-scheme rules'}>
        <ul className="agreement-list">
          <li>{af ? 'Elke transaksie moet die lisensiëring, aankoop, aktivering of huur van ’n werklike, funksionele, ge-isoleerde digitale produk/bate of diens verteenwoordig; geen betaling word as ’n losstaande geld-sirkulasietransaksie behandel nie.' : 'Every transaction must represent the licensing, purchase, activation or rental of a genuine, functional, isolated digital product/asset or service; no payment is treated as a stand-alone money-circulation transaction.'}</li>
          <li>{af ? 'Die R1,000.00 Premium-kommissie is ’n direkte verkoopskommissie op ’n kwalifiserende betaalde digitale lisensie/huurtransaksie.' : 'The R1,000.00 Premium commission is a direct sales commission on a qualifying paid digital licence/rental transaction.'}</li>
          <li>{af ? 'Geen kommissies of gelde word uitbetaal vir blote rekrutering, klikke, registrasies of onbetaalde rekeninge nie.' : 'No commission or payment is earned for recruitment alone, clicks, registrations or unpaid accounts.'}</li>
        </ul>
      </Section>

      <Section icon={HiTrendingUp} title={af ? '4. VulDit / Brandstofbesparing' : '4. Fuel-It / Fuel relief'}>
        <div className="agreement-flow">R166 <b>=</b> R10 BackMi <b>+</b> R33 {af ? 'VulDit' : 'Fuel-It'} <b>+</b> R123 We-Rise</div>
        <ul className="agreement-list">
          <li>{af ? 'Die R33.00 Brandstofbesparing-bydrae uit ’n kwalifiserende aktiewe verwysde lid se maandelikse betaling is ’n gemeenskapskrediet en nie ’n belegging, opbrengswaarborg of brandstofkaart nie.' : 'The R33.00 Fuel-It allocation generated from a qualifying active referred member’s monthly payment is a community credit, not an investment, guaranteed return or fuel card.'}</li>
          <li>{af ? 'Die krediet word eerste teen die lid se eie R166.00 maandelikse platformfooi verreken. Genoeg kwalifiserende krediete kan die effektiewe platformkoste tot R0.00 verminder.' : 'The credit is first applied against the member’s own R166.00 monthly platform fee. Enough qualifying credits can reduce the effective platform cost to R0.00.'}</li>
          <li>{af ? 'Krediete bo die maandelikse platformfooi word as beskikbare oorskot Brandstofbesparing aangedui vir die toepaslike uitbetalingsproses, onderhewig aan geverifieerde betalings en beskikbare fondse.' : 'Credits above the monthly platform fee are shown as available excess Fuel-It credit for the applicable payout process, subject to verified payments and available funds.'}</li>
        </ul>
      </Section>

      <Section icon={HiClock} title={af ? '5. Vyf-dae Grasie- & Bate-Herwinningsbeleid' : '5. Five-day grace & asset recovery policy'}>
        <ul className="agreement-list">
          <li>{af ? 'Wanneer ’n vereiste maandelikse betaling misluk, begin ’n outomatiese 5-dae grasietydperk.' : 'When a required monthly payment fails, an automatic five-day grace period begins.'}</li>
          <li>{af ? 'Indien betaling nie binne die 5 dae herstel word nie, kan die betrokke lidmaatskap, HuurDit-lisensie en toepaslike digitale toegang gedeaktiveer of opgeskort word.' : 'If payment is not restored within five days, the relevant membership, RentIt licence and applicable digital access may be deactivated or suspended.'}</li>
          <li>{af ? 'Die digitale lisensie kan daarna na die algemene platformpoel terugkeer om onnodige infrastruktuurkoste vir onaktiewe rekeninge te voorkom.' : 'The digital licence may then return to the general platform pool to avoid unnecessary infrastructure costs for inactive accounts.'}</li>
        </ul>
      </Section>

      <Section icon={HiDocumentText} title={af ? '6. Onafhanklike Belasting-Verantwoordelikheid' : '6. Independent tax responsibility'}>
        <ul className="agreement-list">
          <li>{af ? 'We-Rise tree op as die infrastruktuur- en tegnologieverskaffer, nie as ’n werkgewer nie.' : 'We-Rise acts as infrastructure and technology provider, not as an employer.'}</li>
          <li>{af ? 'Elke Premium Lid, franchise-houer en subskribent funksioneer as ’n onafhanklike sake-entiteit vir haar eie inkomste- en belastingverpligtinge.' : 'Each Premium Member, franchise holder and subscriber operates as an independent business entity for her own income and tax obligations.'}</li>
          <li>{af ? 'Elke lid is self verantwoordelik om enige belasbare inkomste, insluitend kommissies en huurgelde, korrek aan SARS te verklaar.' : 'Each member is responsible for declaring any taxable income, including commissions and rental income, correctly to SARS.'}</li>
        </ul>
      </Section>

      <Section icon={HiTrendingUp} title={af ? '7. 2027–2031 Groei-teikens' : '7. 2027–2031 growth targets'}>
        <div className="agreement-goals"><div><span>{af ? 'FASE 1 · 2027' : 'PHASE 1 · 2027'}</span><strong>1,000</strong><small>{af ? 'aktiewe Suid-Afrikaanse vroue' : 'active South African women'}</small></div><div><span>{af ? '5-JAAR PLAN' : '5-YEAR PLAN'}</span><strong>1,000,000</strong><small>{af ? 'bemagtigde lede regoor Suid-Afrika' : 'empowered members across South Africa'}</small></div></div>
      </Section>
    </section>
  );
}
