import React, { useCallback, useEffect, useState } from 'react';
import { HiCalculator, HiCash, HiCheck, HiInformationCircle, HiLink, HiPlus, HiRefresh, HiShare, HiTag } from 'react-icons/hi';
import { apiRequest } from '../lib/api';

export default function ResellProgram({ t, lang, showToast }) {
  const [copied, setCopied] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReferral = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/api/referrals/me?program=reseller');
      setDashboard(data);
    } catch (err) {
      setError(err?.message || (lang === 'en' ? 'Could not load your referral link.' : 'Kon nie jou verwysingskakel laai nie.'));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => { loadReferral(); }, [loadReferral]);

  const resellLink = dashboard?.program?.share_url || '';

  const handleCopy = async () => {
    if (!resellLink) return;
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
    if (!resellLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'We-Rise Resellers',
          text: lang === 'en'
            ? 'Discover We-Rise through my personal Reseller link 💗'
            : 'Ontdek We-Rise deur my persoonlike Reseller-skakel 💗',
          url: resellLink,
        });
        return;
      } catch (shareError) {
        if (shareError?.name === 'AbortError') return;
      }
    }
    await handleCopy();
  };

  const steps = lang === 'en'
    ? [
        { icon: HiTag, title: 'Buy at the baseline price', description: 'The current We-Rise or TrendShop product price is the starting baseline for the Reseller.' },
        { icon: HiShare, title: 'Use your own tracked link', description: 'Your We-Rise link identifies members who came through you. First valid referral attribution is stored permanently when the new member creates her account.' },
        { icon: HiPlus, title: 'Add your own profit amount', description: 'The Reseller adds her chosen amount above the baseline when setting her customer price. That amount is her profit—not a hard-coded We-Rise commission.' },
      ]
    : [
        { icon: HiTag, title: 'Koop teen die basisprys', description: 'Die huidige We-Rise- of TrendShop-produkprys is die begin-basisprys vir die Reseller.' },
        { icon: HiShare, title: 'Gebruik jou eie naspeurbare skakel', description: 'Jou We-Rise-skakel identifiseer lede wat deur jou gekom het. Die eerste geldige verwysing word permanent gestoor wanneer die nuwe lid haar rekening skep.' },
        { icon: HiPlus, title: 'Voeg jou eie winsbedrag by', description: 'Die Reseller voeg haar gekose bedrag bo-op die basisprys wanneer sy haar kliëntprys bepaal. Daardie bedrag is haar wins—nie ’n hardgekodeerde We-Rise-kommissie nie.' },
      ];

  const stats = dashboard?.stats || {};

  return (
    <section className="reseller-page fade-in">
      <header className="reseller-hero">
        <div className="reseller-hero-icon"><HiCash /></div>
        <div className="eyebrow">WE-RISE RESELLERS</div>
        <h2 className="section-title">{lang === 'en' ? 'Own it. Price it. Resell it.' : 'Besit dit. Prys dit. Herverkoop dit.'}</h2>
        <p className="section-subtitle">{lang === 'en'
          ? 'Purchase a product, take ownership and build your own profit through repeated sales. Your personal link now tracks which new members came through you.'
          : 'Koop ’n produk, neem eienaarskap en bou jou eie wins deur herhaalde verkope. Jou persoonlike skakel hou nou rekord van watter nuwe lede deur jou gekom het.'}</p>
      </header>

      <article className="card reseller-link-card">
        <div className="reseller-card-heading">
          <div className="reseller-card-icon"><HiLink /></div>
          <div>
            <h3>{lang === 'en' ? 'Your personal Reseller link' : 'Jou persoonlike Reseller-skakel'}</h3>
            <p>{lang === 'en' ? 'Use this exact link so We-Rise can attribute a new member to you.' : 'Gebruik hierdie presiese skakel sodat We-Rise ’n nuwe lid aan jou kan toeskryf.'}</p>
          </div>
        </div>

        {loading ? <div className="referral-engine-loading"><span className="admin-spinner" /> {lang === 'en' ? 'Creating your secure link…' : 'Skep jou veilige skakel…'}</div> : error ? (
          <div className="referral-engine-error"><span>{error}</span><button className="btn btn-secondary btn-sm" onClick={loadReferral}><HiRefresh /> {lang === 'en' ? 'Retry' : 'Probeer weer'}</button></div>
        ) : <>
          <div className="referral-box reseller-referral-box">
            <HiLink aria-hidden="true" />
            <input aria-label={t.yourLink} type="text" value={resellLink} readOnly />
            <button className="btn btn-primary btn-sm" onClick={handleCopy} disabled={!resellLink}>
              {copied ? <HiCheck /> : <HiLink />} {copied ? t.copied : t.copyLink}
            </button>
          </div>

          <button className="btn btn-primary btn-full" onClick={handleShare} disabled={!resellLink}>
            <HiShare /> {lang === 'en' ? 'Share your Reseller link' : 'Deel jou Reseller-skakel'}
          </button>

          <div className="referral-mini-stats">
            <div><small>{lang === 'en' ? 'Link clicks' : 'Skakel-klikke'}</small><strong>{stats.clicks || 0}</strong></div>
            <div><small>{lang === 'en' ? 'Registrations' : 'Registrasies'}</small><strong>{stats.registrations || 0}</strong></div>
            <div><small>{lang === 'en' ? 'Verified conversions' : 'Geverifieerde omskakelings'}</small><strong>{stats.conversions || 0}</strong></div>
          </div>
        </>}

        <a className="btn btn-full reseller-calculator-btn" href="https://we-rise-calculator.pages.dev/" target="_blank" rel="noopener noreferrer">
          <span className="reseller-calculator-content"><HiCalculator /> {lang === 'en' ? 'We-Rise Calculator' : 'We-Rise Sakrekenaar'}</span>
        </a>
      </article>

      <article className="card reseller-model-card">
        <div className="eyebrow">{lang === 'en' ? 'HOW RESELLING WORKS' : 'HOE HERVERKOOP WERK'}</div>
        <h3>{lang === 'en' ? 'The baseline + your profit amount' : 'Die basisprys + jou winsbedrag'}</h3>
        <p className="reseller-model-intro">{lang === 'en'
          ? 'The existing product price remains the baseline. A Reseller does not automatically earn a fixed We-Rise commission—the reseller adds her chosen profit above the baseline when setting her selling price.'
          : 'Die bestaande produkprys bly die basisprys. ’n Reseller verdien nie outomaties ’n vaste We-Rise-kommissie nie—die reseller voeg haar gekose wins bo-op wanneer sy haar verkoopprys bepaal.'}</p>

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
            <div><small>{lang === 'en' ? 'Baseline' : 'Basisprys'}</small><strong>R100</strong></div><b>+</b>
            <div><small>{lang === 'en' ? 'Your profit' : 'Jou wins'}</small><strong>R40</strong></div><b>=</b>
            <div className="reseller-total"><small>{lang === 'en' ? 'Selling price' : 'Verkoopprys'}</small><strong>R140</strong></div>
          </div>
        </div>
      </article>

      <div className="reseller-information-note">
        <HiInformationCircle />
        <p>{lang === 'en'
          ? 'We-Rise now tracks referral attribution from your personal link. Direct visitors or people who register without your link are not assigned to you. Reseller profit remains based on the Reseller pricing model rather than an automatic We-Rise commission payout.'
          : 'We-Rise hou nou verwysingstoewysing vanaf jou persoonlike skakel dop. Direkte besoekers of mense wat sonder jou skakel registreer, word nie aan jou toegewys nie. Reseller-wins bly gebaseer op die Reseller-prysmodel eerder as ’n outomatiese We-Rise-kommissie-uitbetaling.'}</p>
      </div>
    </section>
  );
}
