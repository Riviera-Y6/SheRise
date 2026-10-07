import React, { useState, useEffect } from 'react';
import { HiSparkles, HiHeart, HiChat, HiCurrencyDollar, HiDownload, HiUserAdd, HiKey, HiLightningBolt, HiX } from 'react-icons/hi';
import BrandMark from './BrandMark';
import { apiRequest } from '../lib/api';

export default function Home({ t, lang, onNavigate, userName, campaigns = [], isAuthenticated = false, onLogin, onRegister }) {
  const [affirmationIndex, setAffirmationIndex] = useState(0);
  const [infoBlock, setInfoBlock] = useState(null);
  const [memberCount, setMemberCount] = useState(null);

  const affirmations = [
    t.affirmation1, t.affirmation2, t.affirmation3, t.affirmation4,
    t.affirmation5, t.affirmation6, t.affirmation7, t.affirmation8,
    t.affirmation9, t.affirmation10,
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setAffirmationIndex(prev => (prev + 1) % affirmations.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [affirmations.length]);

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/public/stats')
      .then((data) => {
        if (!cancelled) setMemberCount(Number(data?.member_count ?? 0));
      })
      .catch(() => {
        if (!cancelled) setMemberCount(null);
      });
    return () => { cancelled = true; };
  }, []);

  const quickActions = [
    { icon: HiSparkles, label: t.aiAssistant, tab: 'ai' },
    { icon: HiHeart, label: t.backMi, tab: 'backmi' },
    { icon: HiChat, label: t.community, tab: 'community' },
    { icon: HiCurrencyDollar, label: t.resell, tab: 'resell' },
  ];


  const opportunityBlocks = [
    {
      id: 'resell',
      icon: HiCurrencyDollar,
      title: lang === 'en' ? 'Resell-It' : 'HerverkoopDit',
      eyebrow: lang === 'en' ? 'SELL YOUR WAY' : 'VERKOOP OP JOU MANIER',
      intro: lang === 'en'
        ? 'Use your own tracked We-Rise Reseller link and build your own profit above the current baseline price.'
        : 'Gebruik jou eie naspeurbare We-Rise Reseller-skakel en bou jou eie wins bo die huidige basisprys.',
      points: lang === 'en'
        ? [
            'Receive your own tracked Reseller link.',
            'First valid referral attribution is stored against the new member.',
            'You choose your customer price above the current baseline and keep your chosen added profit.',
          ]
        : [
            'Ontvang jou eie naspeurbare Reseller-skakel.',
            'Die eerste geldige verwysing word teen die nuwe lid gestoor.',
            'Jy kies jou kliënteprys bo die huidige basisprys en behou jou gekose bykomende wins.',
          ],
      cta: lang === 'en' ? 'Open Resell-It' : 'Maak HerverkoopDit oop',
      tab: 'resell',
    },
    {
      id: 'rentit',
      icon: HiKey,
      title: lang === 'en' ? 'Rent-It' : 'HuurDit',
      eyebrow: lang === 'en' ? 'BUILD RECURRING EARNINGS' : 'BOU HERHALENDE VERDIENSTE',
      intro: lang === 'en'
        ? 'Activate RentIt, receive your own referral link and earn on qualifying paid RentIt referrals.'
        : 'Aktiveer HuurDit, ontvang jou eie verwysingskakel en verdien op kwalifiserende betaalde HuurDit-verwysings.',
      points: lang === 'en'
        ? [
            'R1,800 upfront activates your RentIt right and belongs to We-Rise.',
            'After activation you receive your own permanent tracked link.',
            'A qualifying referred R1,800 RentIt activation creates a R1,000 earning owed to you.',
          ]
        : [
            'R1 800 vooruit aktiveer jou HuurDit-reg en behoort aan We-Rise.',
            'Ná aktivering ontvang jy jou eie permanente naspeurbare skakel.',
            '’n Kwalifiserende verwysde R1 800 HuurDit-aktivering skep ’n R1 000-verdienste wat aan jou verskuldig is.',
          ],
      cta: lang === 'en' ? 'Open Rent-It' : 'Maak HuurDit oop',
      tab: 'rentit',
    },
    {
      id: 'fuelit',
      icon: HiLightningBolt,
      title: lang === 'en' ? 'Fuel-It' : 'Brandstofverligting',
      eyebrow: lang === 'en' ? 'FUEL RELIEF MODEL' : 'BRANDSTOFVERLIGTINGSMODEL',
      intro: lang === 'en'
        ? 'Fuel-It links the growth an active member creates for We-Rise to a calculated fuel-relief benefit. It is not a fuel discount, fuel card or guaranteed payment.'
        : 'Brandstofverligting koppel die groei wat ’n aktiewe lid vir We-Rise skep aan ’n berekende brandstofvoordeel. Dit is nie ’n brandstofafslag, brandstofkaart of gewaarborgde uitbetaling nie.',
      points: lang === 'en'
        ? [
            'The model can also use an applicable portion of a new member’s once-off joining subscription, according to the current We-Rise financial model.',
            'For the R166 monthly membership fee, the current model uses R10 for BackMi, R33 as the Fuel-It calculation basis, and R123 remains within the We-Rise model.',
            'Only members you personally refer who become active paying We-Rise members can contribute to your monthly Fuel-It calculation.',
            'The monthly calculation basis is: qualifying active referred members × R33 = monthly fuel-relief basis.',
            'Because qualifying members continue paying monthly, their R33 Fuel-It basis can continue monthly while they remain active and sufficient funds are available.',
            'No fuel slips or proof of fuel use are required. Fuel is purchased normally and any benefit is made available under the applicable We-Rise rules and available funds.',
          ]
        : [
            'Die model kan ook ’n toepaslike gedeelte van ’n nuwe lid se eenmalige aanvangs-subskripsie gebruik volgens die huidige We-Rise-finansiële model.',
            'Van die R166 maandelikse ledegeld gebruik die huidige model R10 vir BackMi, R33 as die Brandstofverligting-berekeningsbasis, en R123 bly binne die We-Rise-model.',
            'Slegs lede wat jy persoonlik verwys en wat aktiewe betalende We-Rise-lede word, kan tot jou maandelikse Brandstofverligting-berekening bydra.',
            'Die maandelikse berekeningsbasis is: kwalifiserende aktiewe verwysde lede × R33 = maandelikse brandstofverligtingsbasis.',
            'Omdat kwalifiserende lede maandeliks aanhou betaal, kan hul R33 Brandstofverligting-basis maandeliks voortgaan terwyl hulle aktief bly en voldoende fondse beskikbaar is.',
            'Geen brandstofkwitansies of bewys van brandstofverbruik word vereis nie. Brandstof word normaal aangekoop en enige voordeel word volgens die toepaslike We-Rise-reëls en beskikbare fondse beskikbaar gestel.',
          ],
      fuelExample: lang === 'en'
        ? {
            title: 'Simple example',
            note: 'Using the current R33 monthly Fuel-It calculation basis per qualifying active referred member:',
            rows: ['5 qualifying active referrals × R33 = R165 monthly fuel-relief basis', '10 qualifying active referrals × R33 = R330 monthly fuel-relief basis'],
          }
        : {
            title: 'Eenvoudige voorbeeld',
            note: 'Met die huidige R33 maandelikse Brandstofverligting-berekeningsbasis per kwalifiserende aktiewe verwysde lid:',
            rows: ['5 kwalifiserende aktiewe verwysings × R33 = R165 maandelikse brandstofverligtingsbasis', '10 kwalifiserende aktiewe verwysings × R33 = R330 maandelikse brandstofverligtingsbasis'],
          },
      fuelDisclaimer: lang === 'en'
        ? 'R33 is the current monthly calculation basis, not a guaranteed cash payout. The actual benefit depends on verified active paid memberships, actual We-Rise income, available funds and the financial sustainability of the model.'
        : 'R33 is die huidige maandelikse berekeningsbasis, nie ’n gewaarborgde kontantuitbetaling nie. Die werklike voordeel hang af van geverifieerde aktiewe betaalde lidmaatskappe, werklike We-Rise-inkomste, beskikbare fondse en die finansiële volhoubaarheid van die model.',
      cta: lang === 'en' ? 'Open Fuel-It calculator' : 'Maak Brandstofverligtingsakrekenaar oop',
      tab: 'fuelit',
    },
  ];

  const totalRaised = campaigns.reduce((sum, campaign) => sum + Number(campaign.raised || 0), 0);
  const displayRaised = totalRaised >= 1000
    ? `R${(totalRaised / 1000).toFixed(totalRaised >= 10000 ? 0 : 1)}K`
    : `R${Math.round(totalRaised).toLocaleString()}`;

  return (
    <div className="fade-in">
      <div className="home-brand-seal" aria-label="We-Rise — Rise Together. Rise Forever.">
        <BrandMark variant="seal" />
      </div>
      <div className="welcome-hero">
        <h2>{isAuthenticated && userName ? t.welcomeBackName.replace('{name}', userName) : (lang === 'en' ? 'Welcome to We-Rise' : 'Welkom by We-Rise')}</h2>
        <p>{isAuthenticated ? t.joinMovement : (lang === 'en' ? 'Explore the movement freely. Create an account when you are ready to use your personal features.' : 'Verken die beweging vrylik. Skep ’n rekening wanneer jy gereed is om jou persoonlike funksies te gebruik.')}</p>
      </div>

      <div className="tagline tagline-under-seal">{t.tagline}</div>

      {!isAuthenticated && (
        <div className="guest-home-card">
          <div className="guest-home-badge">{lang === 'en' ? 'PUBLIC WEBSITE' : 'PUBLIEKE WEBWERF'}</div>
          <h3>{lang === 'en' ? 'Browse first. Join when you are ready.' : 'Kyk eers rond. Sluit aan wanneer jy gereed is.'}</h3>
          <p>{lang === 'en'
            ? 'You do not need an account to open We-Rise. Login is only required when you want to use personal, community or safety features.'
            : 'Jy het nie ’n rekening nodig om We-Rise oop te maak nie. Aanmelding is net nodig wanneer jy persoonlike, gemeenskap- of veiligheidsfunksies wil gebruik.'}</p>
          <div className="guest-home-actions">
            <button className="btn btn-primary" onClick={onRegister}>{lang === 'en' ? 'Create account' : 'Skep rekening'}</button>
            <button className="btn btn-secondary" onClick={onLogin}>{lang === 'en' ? 'Log in' : 'Meld aan'}</button>
          </div>
        </div>
      )}

      <section className="home-opportunity-section" aria-labelledby="home-opportunity-title">
        <div className="home-opportunity-kicker">{lang === 'en' ? 'DISCOVER YOUR WE-RISE PATH' : 'ONTDEK JOU WE-RISE PAD'}</div>
        <h3 id="home-opportunity-title">{lang === 'en' ? 'What can We-Rise offer you?' : 'Wat kan We-Rise jou bied?'}</h3>
        <p>{lang === 'en'
          ? 'Tap a block to see how each opportunity works.'
          : 'Tik op ’n blokkie om te sien hoe elke geleentheid werk.'}</p>

        <div className="home-opportunity-grid">
          {opportunityBlocks.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`home-opportunity-block home-opportunity-block-${item.id}`}
                style={{ '--opportunity-delay': `${index * 0.28}s` }}
                onClick={() => setInfoBlock(item)}
                aria-label={`${item.title}: ${lang === 'en' ? 'view information' : 'bekyk inligting'}`}
              >
                <span className="home-opportunity-glow" aria-hidden="true" />
                <span className="home-opportunity-icon"><Icon /></span>
                <strong>{item.title}</strong>
                <small>{lang === 'en' ? 'Tap for details' : 'Tik vir besonderhede'}</small>
              </button>
            );
          })}
        </div>
      </section>

      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-number">{memberCount == null ? '—' : memberCount.toLocaleString()}</div>
          <div className="stat-label">{t.statsMembers}</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{campaigns.length}</div>
          <div className="stat-label">{t.statsCampaigns}</div>
        </div>
        <div className="stat-box">
          <div className="stat-number">{displayRaised}</div>
          <div className="stat-label">{t.statsRaised}</div>
        </div>
      </div>

      <div className="affirmation-card">
        <div className="affirmation-text" key={affirmationIndex}>{affirmations[affirmationIndex]}</div>
        <div className="affirmation-share"><HiSparkles /> {t.dailyAffirmation}</div>
      </div>

      <div className="quick-actions">
        {quickActions.map((action, i) => {
          const Icon = action.icon;
          return (
            <button key={i} className="quick-action-btn" onClick={() => onNavigate(action.tab)}>
              <Icon />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">{t.backMiTitle}</div>
        <div className="card-subtitle">{t.supportEachOther}</div>
        <button className="btn btn-primary btn-full" onClick={() => onNavigate('backmi')}>
          <HiHeart /> {t.backMi}
        </button>
      </div>

      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(255,105,180,.07), rgba(255,20,147,.025))' }}>
        <div className="card-title">{lang === 'en' ? 'Join the We-Rise Waitlist' : 'Sluit aan by die We-Rise Waglys'}</div>
        <div className="card-subtitle">{lang === 'en' ? 'Tell us why you want to be part of the movement and be ready for future member onboarding.' : 'Vertel ons hoekom jy deel van die beweging wil wees en wees gereed vir toekomstige lidregistrasie.'}</div>
        <button className="btn btn-secondary btn-full" onClick={() => onNavigate('waitlist')}>
          <HiUserAdd /> {lang === 'en' ? 'Join Waitlist' : 'Sluit aan by Waglys'}
        </button>
      </div>

      <div className="card" style={{ border: '1px solid rgba(255, 193, 7, 0.2)', background: 'rgba(255, 193, 7, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255, 193, 7, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            <HiDownload style={{ color: '#FFC107', fontSize: 18 }} />
          </div>
          <div>
            <div className="card-title" style={{ fontSize: 14, marginBottom: 2 }}>{lang === 'en' ? 'We-Rise Growth Goals' : 'We-Rise Groei-doelwitte'}</div>
            <div className="card-subtitle" style={{ marginBottom: 0, fontSize: 12 }}>{lang === 'en' ? 'Together we are building the We-Rise community, one member at a time.' : 'Saam bou ons die We-Rise-gemeenskap, een lid op ’n slag.'}</div>
          </div>
        </div>
        <div className="install-steps growth-goal-steps">
          <div className="install-step growth-goal-step">
            <span className="install-device growth-goal-label"><strong>{lang === 'en' ? 'SHORT TERM GOAL:' : 'KORT TERMYN DOELWIT:'}</strong></span>
            <span className="install-desc growth-goal-value">{lang === 'en' ? '1,000+ Members' : '1,000+ Lede'}</span>
          </div>
          <div className="install-step growth-goal-step">
            <span className="install-device growth-goal-label"><strong>{lang === 'en' ? 'LONG TERM GOAL:' : 'LANG TERMYN DOELWIT:'}</strong></span>
            <span className="install-desc growth-goal-value">{lang === 'en' ? '1,000,000+ Members' : '1,000,000+ Lede'}</span>
          </div>
        </div>
      </div>


      {infoBlock && (
        <div className="modal-overlay home-opportunity-modal-overlay" onClick={() => setInfoBlock(null)} role="presentation">
          <div
            className={`home-opportunity-modal home-opportunity-modal-${infoBlock.id}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-opportunity-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="home-opportunity-modal-close"
              onClick={() => setInfoBlock(null)}
              aria-label={lang === 'en' ? 'Close' : 'Maak toe'}
            >
              <HiX />
            </button>

            <div className="home-opportunity-modal-icon"><infoBlock.icon /></div>
            <div className="home-opportunity-modal-kicker">{infoBlock.eyebrow}</div>
            <h3 id="home-opportunity-modal-title">{infoBlock.title}</h3>
            <p className="home-opportunity-modal-intro">{infoBlock.intro}</p>

            <div className="home-opportunity-modal-points">
              {infoBlock.points.map((point, index) => (
                <div key={point} className="home-opportunity-modal-point">
                  <span>{index + 1}</span>
                  <p>{point}</p>
                </div>
              ))}
            </div>

            {infoBlock.id === 'fuelit' && infoBlock.fuelExample && (
              <div className="home-fuelit-explainer">
                <div className="home-fuelit-formula">
                  <span>{lang === 'en' ? 'FORMULA' : 'FORMULE'}</span>
                  <strong>{lang === 'en' ? 'Qualifying active referrals × R33' : 'Kwalifiserende aktiewe verwysings × R33'}</strong>
                  <small>{lang === 'en' ? '= monthly fuel-relief basis' : '= maandelikse brandstofverligtingsbasis'}</small>
                </div>
                <div className="home-fuelit-example">
                  <strong>{infoBlock.fuelExample.title}</strong>
                  <p>{infoBlock.fuelExample.note}</p>
                  {infoBlock.fuelExample.rows.map((row) => <div key={row}>{row}</div>)}
                </div>
                <div className="home-fuelit-disclaimer">
                  <strong>{lang === 'en' ? 'Important' : 'Belangrik'}</strong>
                  <p>{infoBlock.fuelDisclaimer}</p>
                </div>
              </div>
            )}

            {infoBlock.tab && (
              <button
                type="button"
                className="btn btn-primary btn-full home-opportunity-modal-cta"
                onClick={() => {
                  setInfoBlock(null);
                  onNavigate(infoBlock.tab);
                }}
              >
                {infoBlock.cta}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
