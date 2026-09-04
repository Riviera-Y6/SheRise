import React, { useState } from 'react';
import { HiCash, HiCheck, HiInformationCircle, HiLink, HiPlus, HiShare, HiTag } from 'react-icons/hi';

export default function ResellProgram({ t, lang, showToast }) {
  const [copied, setCopied] = useState(false);
  const resellLink = `${window.location.origin}/?ref=risewithme`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resellLink);
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
          title: 'We-Rise Resellers',
          text: lang === 'en'
            ? 'Discover We-Rise through my Reseller link 💗'
            : 'Ontdek We-Rise deur my Reseller-skakel 💗',
          url: resellLink,
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
          title: 'Buy at the baseline price',
          description: 'The current We-Rise or TrendShop product price is the starting baseline for the Reseller.',
        },
        {
          icon: HiShare,
          title: 'Own it and resell it',
          description: 'The Reseller purchases the product, takes ownership of it and can sell it repeatedly under the applicable Reseller terms.',
        },
        {
          icon: HiPlus,
          title: 'Add your own profit amount',
          description: 'The Reseller adds her chosen amount above the baseline when setting her customer price. That amount is her profit—not commission.',
        },
      ]
    : [
        {
          icon: HiTag,
          title: 'Koop teen die basisprys',
          description: 'Die huidige We-Rise- of TrendShop-produkprys is die begin-basisprys vir die Reseller.',
        },
        {
          icon: HiShare,
          title: 'Besit dit en herverkoop dit',
          description: 'Die Reseller koop die produk, neem eienaarskap daarvan en kan dit herhaaldelik volgens die toepaslike Reseller-voorwaardes verkoop.',
        },
        {
          icon: HiPlus,
          title: 'Voeg jou eie winsbedrag by',
          description: 'Die Reseller voeg haar gekose bedrag bo-op die basisprys wanneer sy haar kliëntprys bepaal. Daardie bedrag is haar wins—nie kommissie nie.',
        },
      ];

  return (
    <section className="reseller-page fade-in">
      <header className="reseller-hero">
        <div className="reseller-hero-icon"><HiCash /></div>
        <div className="eyebrow">WE-RISE RESELLERS</div>
        <h2 className="section-title">{lang === 'en' ? 'Own it. Price it. Resell it.' : 'Besit dit. Prys dit. Herverkoop dit.'}</h2>
        <p className="section-subtitle">{lang === 'en'
          ? 'Purchase a product, take ownership and build your own profit through repeated sales. This is not a commission model.'
          : 'Koop ’n produk, neem eienaarskap en bou jou eie wins deur herhaalde verkope. Dit is nie ’n kommissiemodel nie.'}</p>
      </header>

      <article className="card reseller-link-card">
        <div className="reseller-card-heading">
          <div className="reseller-card-icon"><HiLink /></div>
          <div>
            <h3>{lang === 'en' ? 'Your Resell link' : 'Jou Resell-skakel'}</h3>
            <p>{lang === 'en' ? 'Copy or share your link when presenting the product to a customer.' : 'Kopieer of deel jou skakel wanneer jy die produk aan ’n kliënt bekendstel.'}</p>
          </div>
        </div>

        <div className="referral-box reseller-referral-box">
          <HiLink aria-hidden="true" />
          <input aria-label={t.yourLink} type="text" value={resellLink} readOnly />
          <button className="btn btn-primary btn-sm" onClick={handleCopy}>
            {copied ? <HiCheck /> : <HiLink />} {copied ? t.copied : t.copyLink}
          </button>
        </div>

        <button className="btn btn-primary btn-full" onClick={handleShare}>
          <HiShare /> {lang === 'en' ? 'Share your Reseller link' : 'Deel jou Reseller-skakel'}
        </button>
      </article>

      <article className="card reseller-model-card">
        <div className="eyebrow">{lang === 'en' ? 'HOW RESELLING WORKS' : 'HOE HERVERKOOP WERK'}</div>
        <h3>{lang === 'en' ? 'The baseline + your profit amount' : 'Die basisprys + jou winsbedrag'}</h3>
        <p className="reseller-model-intro">{lang === 'en'
          ? 'The existing product price remains the baseline. A Reseller does not earn a percentage of that amount—she adds her chosen profit above it when setting her selling price.'
          : 'Die bestaande produkprys bly die basisprys. ’n Reseller verdien nie ’n persentasie van daardie bedrag nie—sy voeg haar gekose wins bo-op wanneer sy haar verkoopprys bepaal.'}</p>

        <div className="reseller-steps">
          {steps.map(({ icon: Icon, title, description }, index) => (
            <div className="reseller-step" key={title}>
              <div className="reseller-step-number">{index + 1}</div>
              <div className="reseller-step-icon"><Icon /></div>
              <div><strong>{title}</strong><p>{description}</p></div>
            </div>
          ))}
        </div>

        <div className="reseller-example">
          <span>{lang === 'en' ? 'Illustrative example only' : 'Slegs ’n verduidelikende voorbeeld'}</span>
          <div className="reseller-equation">
            <div><small>{lang === 'en' ? 'Baseline' : 'Basisprys'}</small><strong>R100</strong></div>
            <b>+</b>
            <div><small>{lang === 'en' ? 'Your profit' : 'Jou wins'}</small><strong>R40</strong></div>
            <b>=</b>
            <div className="reseller-total"><small>{lang === 'en' ? 'Selling price' : 'Verkoopprys'}</small><strong>R140</strong></div>
          </div>
          <p>{lang === 'en'
            ? 'The R100 product price is the baseline. The Reseller sets the selling price at R140, with R40 added as her chosen profit—not commission.'
            : 'Die R100-produkprys is die basisprys. Die Reseller stel die verkoopprys op R140, met R40 wat as haar gekose wins bygevoeg word—nie kommissie nie.'}</p>
        </div>
      </article>

      <div className="reseller-information-note">
        <HiInformationCircle />
        <p>{lang === 'en'
          ? 'At this stage We-Rise provides the Resell link and explains the Reseller model. The app does not yet process Reseller sales automatically. The final selling price must always be communicated clearly to the customer before a sale.'
          : 'Op hierdie stadium verskaf We-Rise die Resell-skakel en verduidelik die Reseller-model. Die toepassing verwerk nog nie Reseller-verkope outomaties nie. Die finale verkoopprys moet altyd voor ’n verkoop duidelik aan die kliënt gekommunikeer word.'}</p>
      </div>
    </section>
  );
}
