import React, { useState } from 'react';
import { HiCash, HiCheck, HiInformationCircle, HiLink, HiPlus, HiShare, HiTag } from 'react-icons/hi';

export default function ResellProgram({ t, lang, showToast }) {
  const [copied, setCopied] = useState(false);
  const affiliateLink = `${window.location.origin}/?ref=risewithme`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(affiliateLink);
      setCopied(true);
      showToast(t.copied);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(lang === 'en' ? 'The link could not be copied.' : 'Die skakel kon nie gekopieer word nie.');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'We-Rise',
          text: lang === 'en'
            ? 'Discover We-Rise through my affiliate link 💗'
            : 'Ontdek We-Rise deur my affiliate-skakel 💗',
          url: affiliateLink,
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    await handleCopy();
  };

  const steps = lang === 'en'
    ? [
        {
          icon: HiTag,
          title: 'Start with the baseline price',
          description: 'The current We-Rise or TrendShop price is the baseline. No part of this amount is paid to the affiliate.',
        },
        {
          icon: HiPlus,
          title: 'Add your own amount',
          description: 'The affiliate chooses the amount she wants to add above the baseline price as her margin.',
        },
        {
          icon: HiCash,
          title: 'Your added amount is your margin',
          description: 'The customer pays the baseline price plus the clearly agreed added amount. Only the added amount represents the affiliate’s earnings.',
        },
      ]
    : [
        {
          icon: HiTag,
          title: 'Begin by die basisprys',
          description: 'Die huidige We-Rise- of TrendShop-prys is die basisprys. Geen deel van hierdie bedrag word aan die affiliate betaal nie.',
        },
        {
          icon: HiPlus,
          title: 'Voeg jou eie bedrag by',
          description: 'Die affiliate kies self watter bedrag sy bo-op die basisprys wil voeg as haar winsmarge.',
        },
        {
          icon: HiCash,
          title: 'Jou bygevoegde bedrag is jou winsmarge',
          description: 'Die kliënt betaal die basisprys plus die duidelik ooreengekome ekstra bedrag. Slegs die bygevoegde bedrag verteenwoordig die affiliate se verdienste.',
        },
      ];

  return (
    <section className="affiliate-page fade-in">
      <header className="affiliate-hero">
        <div className="affiliate-hero-icon"><HiLink /></div>
        <div className="eyebrow">WE-RISE AFFILIATE</div>
        <h2 className="section-title">{lang === 'en' ? 'Share the link. Set your margin.' : 'Deel die skakel. Bepaal jou winsmarge.'}</h2>
        <p className="section-subtitle">{lang === 'en'
          ? 'A simple affiliate concept without a fixed commission percentage.'
          : '’n Eenvoudige affiliate-konsep sonder ’n vaste kommissiepersentasie.'}</p>
      </header>

      <article className="card affiliate-link-card">
        <div className="affiliate-card-heading">
          <div className="affiliate-card-icon"><HiLink /></div>
          <div>
            <h3>{lang === 'en' ? 'Your affiliate link' : 'Jou affiliate-skakel'}</h3>
            <p>{lang === 'en' ? 'Copy or share this link when introducing someone to We-Rise.' : 'Kopieer of deel hierdie skakel wanneer jy iemand aan We-Rise bekendstel.'}</p>
          </div>
        </div>

        <div className="referral-box affiliate-referral-box">
          <HiLink aria-hidden="true" />
          <input aria-label={t.yourLink} type="text" value={affiliateLink} readOnly />
          <button className="btn btn-primary btn-sm" onClick={handleCopy}>
            {copied ? <HiCheck /> : <HiLink />} {copied ? t.copied : t.copyLink}
          </button>
        </div>

        <button className="btn btn-primary btn-full" onClick={handleShare}>
          <HiShare /> {lang === 'en' ? 'Share affiliate link' : 'Deel affiliate-skakel'}
        </button>
      </article>

      <article className="card affiliate-model-card">
        <div className="eyebrow">{lang === 'en' ? 'HOW THE PRICING WORKS' : 'HOE DIE PRYS WERK'}</div>
        <h3>{lang === 'en' ? 'The baseline + your amount' : 'Die basisprys + jou bedrag'}</h3>
        <p className="affiliate-model-intro">{lang === 'en'
          ? 'The existing listed price remains the baseline. If an affiliate wants to earn from a sale, she adds her chosen amount on top of that price.'
          : 'Die bestaande geadverteerde prys bly die basisprys. Indien ’n affiliate uit ’n verkoop wil verdien, voeg sy haar gekose bedrag bo-op daardie prys.'}</p>

        <div className="affiliate-steps">
          {steps.map(({ icon: Icon, title, description }, index) => (
            <div className="affiliate-step" key={title}>
              <div className="affiliate-step-number">{index + 1}</div>
              <div className="affiliate-step-icon"><Icon /></div>
              <div><strong>{title}</strong><p>{description}</p></div>
            </div>
          ))}
        </div>

        <div className="affiliate-example">
          <span>{lang === 'en' ? 'Illustrative example only' : 'Slegs ’n verduidelikende voorbeeld'}</span>
          <div className="affiliate-equation">
            <div><small>{lang === 'en' ? 'Baseline' : 'Basisprys'}</small><strong>R100</strong></div>
            <b>+</b>
            <div><small>{lang === 'en' ? 'Your amount' : 'Jou bedrag'}</small><strong>R40</strong></div>
            <b>=</b>
            <div className="affiliate-total"><small>{lang === 'en' ? 'Customer price' : 'Kliëntprys'}</small><strong>R140</strong></div>
          </div>
          <p>{lang === 'en'
            ? 'The R100 baseline remains payable to We-Rise/TrendShop. The R40 added amount is the affiliate’s margin.'
            : 'Die R100-basisprys bly aan We-Rise/TrendShop betaalbaar. Die bygevoegde R40 is die affiliate se winsmarge.'}</p>
        </div>
      </article>

      <div className="affiliate-information-note">
        <HiInformationCircle />
        <p>{lang === 'en'
          ? 'At this stage We-Rise provides the affiliate link and explains the pricing concept. The app does not yet calculate, collect or pay affiliate margins automatically. The final customer price must always be communicated clearly before a sale.'
          : 'Op hierdie stadium verskaf We-Rise die affiliate-skakel en verduidelik die pryskonsep. Die toepassing bereken, ontvang of betaal nog nie affiliate-winsmarges outomaties uit nie. Die finale kliëntprys moet altyd duidelik voor ’n verkoop gekommunikeer word.'}</p>
      </div>
    </section>
  );
}
