import React, { useCallback, useEffect, useState } from 'react';
import {
  HiCash,
  HiCheck,
  HiCheckCircle,
  HiKey,
  HiLightningBolt,
  HiLink,
  HiRefresh,
  HiShieldCheck,
  HiShare,
  HiSparkles,
  HiTrendingUp,
  HiUsers,
} from 'react-icons/hi';
import { apiRequest, submitPaystackCheckout } from '../lib/api';

const money = (value) => `R${Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RentIt({ lang, showToast }) {
  const af = lang === 'af';
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [calcReferrals, setCalcReferrals] = useState(0);
  const [calcPaymentRate, setCalcPaymentRate] = useState(100);
  const [calcGrowth, setCalcGrowth] = useState(0);
  const [calcMonths, setCalcMonths] = useState(12);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiRequest('/api/referrals/me?program=huurdit');
      setDashboard(data);
      setError('');
    } catch (err) {
      setError(err?.message || (af ? 'Kon nie HuurDit-status laai nie.' : 'Could not load RentIt status.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [af]);

  useEffect(() => {
    load();
    const retryOne = window.setTimeout(() => load(true), 4000);
    const retryTwo = window.setTimeout(() => load(true), 10000);
    return () => { window.clearTimeout(retryOne); window.clearTimeout(retryTwo); };
  }, [load]);

  const active = dashboard?.program?.status === 'active';
  const referralLink = dashboard?.program?.share_url || '';
  const activationFee = Number(dashboard?.settings?.activation_fee_zar || 1800);
  const referralEarning = Number(dashboard?.settings?.referral_earning_zar || 1000);
  const remaining = Math.max(0, activationFee - referralEarning);
  const stats = dashboard?.stats || {};

  let projectedReferrals = 0;
  let projectedPaidReferrals = 0;
  let finalMonthPaidReferrals = 0;
  for (let month = 1; month <= calcMonths; month += 1) {
    const monthReferrals = Math.max(0, Math.round(calcReferrals * Math.pow(1 + (calcGrowth / 100), month - 1)));
    const monthPaidReferrals = Math.min(monthReferrals, Math.max(0, Math.round(monthReferrals * (calcPaymentRate / 100))));
    projectedReferrals += monthReferrals;
    projectedPaidReferrals += monthPaidReferrals;
    if (month === calcMonths) finalMonthPaidReferrals = monthPaidReferrals;
  }
  const projectedGrossEarnings = projectedPaidReferrals * referralEarning;
  const projectedFinalMonthIncome = finalMonthPaidReferrals * referralEarning;
  const projectedNetIncome = projectedGrossEarnings - activationFee;
  const breakEvenReferrals = referralEarning > 0 ? Math.ceil(activationFee / referralEarning) : 0;
  const remainingToBreakEven = Math.max(0, activationFee - projectedGrossEarnings);

  const resetCalculator = () => {
    setCalcReferrals(0);
    setCalcPaymentRate(100);
    setCalcGrowth(0);
    setCalcMonths(12);
  };

  const startActivation = async () => {
    if (!termsAccepted) {
      showToast?.(af ? 'Bevestig eers die HuurDit-voorwaardes.' : 'Confirm the RentIt terms first.');
      return;
    }
    setPaying(true);
    setError('');
    try {
      const checkout = await apiRequest('/api/referrals/programs/huurdit/checkout', {
        method: 'POST',
        body: JSON.stringify({ accepted_terms: true }),
      });
      submitPaystackCheckout(checkout);
    } catch (err) {
      setError(err?.message || (af ? 'Kon nie Paystack oopmaak nie.' : 'Could not open Paystack.'));
      setPaying(false);
    }
  };

  const copyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      showToast?.(af ? 'HuurDit-skakel gekopieer.' : 'RentIt link copied.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast?.(af ? 'Die skakel kon nie gekopieer word nie.' : 'The link could not be copied.');
    }
  };

  const shareLink = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: af ? 'We-Rise HuurDit' : 'We-Rise RentIt',
          text: af ? 'Kyk na We-Rise HuurDit deur my persoonlike skakel.' : 'Explore We-Rise RentIt through my personal link.',
          url: referralLink,
        });
        return;
      } catch (shareError) {
        if (shareError?.name === 'AbortError') return;
      }
    }
    await copyLink();
  };

  const steps = af
    ? [
        { icon: HiKey, title: 'Aktiveer HuurDit', text: `Jou eerste ${money(activationFee)}-betaling aktiveer jou HuurDit-reg en behoort 100% aan We-Rise. Dit skep nie vir jou ’n ${money(referralEarning)}-verdienste op jou eie betaling nie.` },
        { icon: HiLink, title: 'Kry jou unieke verwysingskakel', text: 'Ná veilige Paystack-bevestiging kry jy jou eie permanente HuurDit-skakel. Die eerste geldige verwysing word aan die nuwe lid vasgemaak en kan nie later omgeruil word nie.' },
        { icon: HiTrendingUp, title: 'Verdien op jou eie geldige verwysings', text: `Wanneer iemand wat deur jou skakel gekom het haar eie ${money(activationFee)} HuurDit-aktivering suksesvol betaal, word ${money(referralEarning)} as aan jou verskuldig aangeteken.` },
      ]
    : [
        { icon: HiKey, title: 'Activate RentIt', text: `Your first ${money(activationFee)} payment activates your RentIt right and belongs 100% to We-Rise. You do not earn ${money(referralEarning)} from your own activation payment.` },
        { icon: HiLink, title: 'Receive your unique referral link', text: 'After secure Paystack confirmation you receive a permanent RentIt link. The first valid referral is attached to the new member and cannot later be swapped.' },
        { icon: HiTrendingUp, title: 'Earn on your own qualifying referrals', text: `When somebody who came through your link successfully pays her own ${money(activationFee)} RentIt activation, ${money(referralEarning)} is recorded as owed to you.` },
      ];

  const benefits = af
    ? [
        { icon: HiSparkles, title: 'Sleutel-klaar model', text: 'Begin met ’n bestaande We-Rise-struktuur eerder as om alles van nuuts af te bou.' },
        { icon: HiLightningBolt, title: 'Duidelike toewysing', text: 'We-Rise weet watter nuwe lid deur jou unieke skakel gekom het en watter lede direk uit We-Rise se eie bemarking gekom het.' },
        { icon: HiRefresh, title: 'Naspeurbare verdienste', text: '’n Verdienste word eers geskep wanneer Paystack die kwalifiserende HuurDit-betaling veilig bevestig.' },
        { icon: HiShieldCheck, title: 'We-Rise beskerm die kern', text: 'Die kernplatform, handelsmerk en intellektuele eiendom bly onder We-Rise se beheer.' },
      ]
    : [
        { icon: HiSparkles, title: 'Turnkey model', text: 'Start with an existing We-Rise structure instead of building everything from scratch.' },
        { icon: HiLightningBolt, title: 'Clear attribution', text: 'We-Rise can distinguish members who came through your unique link from members acquired through We-Rise marketing or direct visits.' },
        { icon: HiRefresh, title: 'Tracked earnings', text: 'An earning is created only after Paystack securely confirms the qualifying RentIt payment.' },
        { icon: HiShieldCheck, title: 'We-Rise protects the core', text: 'The core platform, brand and intellectual property remain under We-Rise control.' },
      ];

  return (
    <section className="rentit-page fade-in">
      <header className="rentit-hero">
        <div className="rentit-hero-icon"><HiKey /></div>
        <div className="eyebrow">{af ? 'WE-RISE HUURDIT' : 'WE-RISE RENTIT'}</div>
        <h2 className="section-title">{af ? 'Bou ’n naspeurbare HuurDit-inkomstestroom' : 'Build a trackable RentIt income stream'}</h2>
        <p className="section-subtitle">{af
          ? 'Aktiveer HuurDit, kry jou eie unieke skakel en verdien slegs op kwalifiserende HuurDit-lede wat werklik deur jou verwysing gekom het.'
          : 'Activate RentIt, receive your own unique link and earn only on qualifying RentIt members genuinely attributed to your referral.'}</p>
      </header>

      <article className="rentit-price-card">
        <div className="rentit-price-topline"><span>{af ? 'HUURDIT-AKTIVERING' : 'RENTIT ACTIVATION'}</span><span className="rentit-upfront-badge">{af ? 'Vooruit betaalbaar' : 'Payable upfront'}</span></div>
        <div className="rentit-price">R{activationFee.toFixed(0)}<span>.00</span></div>
        <p>{af ? 'Jou eie eerste aktiveringsbetaling behoort volledig aan We-Rise.' : 'Your own first activation payment belongs entirely to We-Rise.'}</p>

        <div className="rentit-money-flow" aria-label={af ? 'HuurDit verwysingsverdienste' : 'RentIt referral earning'}>
          <div className="rentit-money-box rentit-money-earned"><small>{af ? 'Jou verdienste per kwalifiserende verwysing' : 'Your earning per qualifying referral'}</small><strong>{money(referralEarning)}</strong></div>
          <div className="rentit-money-operator">+</div>
          <div className="rentit-money-box rentit-money-balance"><small>{af ? 'Oorblywende balans' : 'Remaining balance'}</small><strong>{money(remaining)}</strong></div>
          <div className="rentit-money-operator">=</div>
          <div className="rentit-money-box rentit-money-total"><small>{af ? 'Nuwe huurder se aktivering' : 'New renter activation'}</small><strong>{money(activationFee)}</strong></div>
        </div>

        <div className="rentit-clarifier"><HiCheckCircle /><p>{af
          ? `Belangrik: jy ontvang nie ${money(referralEarning)} uit jou eie eerste ${money(activationFee)} nie. Die ${money(referralEarning)} ontstaan eers wanneer ’n nuwe HuurDit-lid permanent aan jou skakel toegeskryf is én haar kwalifiserende Paystack-betaling suksesvol bevestig is. Die ${money(remaining)}-balans word volgens die geldende We-Rise-ooreenkoms hanteer.`
          : `Important: you do not receive ${money(referralEarning)} from your own first ${money(activationFee)}. The ${money(referralEarning)} is created only when a new RentIt member is permanently attributed to your link and her qualifying Paystack payment is successfully verified. The ${money(remaining)} balance is handled according to the applicable We-Rise agreement.`}</p></div>
      </article>

      {loading ? <div className="referral-engine-loading"><span className="admin-spinner" /> {af ? 'Laai HuurDit…' : 'Loading RentIt…'}</div> : error ? (
        <div className="referral-engine-error"><span>{error}</span><button className="btn btn-secondary" onClick={() => load()}><HiRefresh /> {af ? 'Probeer weer' : 'Retry'}</button></div>
      ) : active ? (
        <article className="card rentit-referral-dashboard">
          <div className="rentit-active-badge"><HiCheckCircle /> {af ? 'HUURDIT AKTIEF' : 'RENTIT ACTIVE'}</div>
          <div className="eyebrow">{af ? 'JOU PERSOONLIKE SKAKEL' : 'YOUR PERSONAL LINK'}</div>
          <h3>{af ? 'Deel hierdie skakel om jou verwysings korrek toe te skryf' : 'Share this link so your referrals are attributed correctly'}</h3>
          <div className="referral-box reseller-referral-box"><HiLink /><input value={referralLink} readOnly aria-label={af ? 'Jou HuurDit-skakel' : 'Your RentIt link'} /><button className="btn btn-primary btn-sm" onClick={copyLink}>{copied ? <HiCheck /> : <HiLink />} {copied ? (af ? 'Gekopieer' : 'Copied') : (af ? 'Kopieer' : 'Copy')}</button></div>
          <button className="btn btn-primary btn-full" onClick={shareLink}><HiShare /> {af ? 'Deel jou HuurDit-skakel' : 'Share your RentIt link'}</button>
          <div className="referral-mini-stats rentit-referral-stats">
            <div><small>{af ? 'Skakel-klikke' : 'Link clicks'}</small><strong>{stats.clicks || 0}</strong></div>
            <div><small>{af ? 'Registrasies' : 'Registrations'}</small><strong>{stats.registrations || 0}</strong></div>
            <div><small>{af ? 'Kwalifiserende betalings' : 'Qualifying payments'}</small><strong>{stats.conversions || 0}</strong></div>
            <div><small>{af ? 'Verskuldig aan jou' : 'Owed to you'}</small><strong>{money(stats.earnings_owed_zar)}</strong></div>
            <div><small>{af ? 'Reeds betaal' : 'Already paid'}</small><strong>{money(stats.earnings_paid_zar)}</strong></div>
          </div>
          {(dashboard?.recent || []).length > 0 && <div className="rentit-recent-referrals">
            <h4>{af ? 'Onlangse verwysings' : 'Recent referrals'}</h4>
            {dashboard.recent.map(row => <div className="rentit-referral-row" key={row.id}>
              <div><strong>{row.referred_member?.display_name || (af ? 'Nuwe lid' : 'New member')}</strong><span>{[row.referred_member?.city_town, row.referred_member?.province].filter(Boolean).join(', ') || row.referred_member?.email || '—'}</span></div>
              <div><strong>{row.earning_amount_zar > 0 ? money(row.earning_amount_zar) : '—'}</strong><span className={`payment-status payment-${row.status}`}>{row.status}</span></div>
            </div>)}
          </div>}
        </article>
      ) : (
        <article className="card rentit-activate-card">
          <div className="eyebrow">{af ? 'AKTIVEER HUURDIT' : 'ACTIVATE RENTIT'}</div>
          <h3>{af ? `Aktiveer vir ${money(activationFee)}` : `Activate for ${money(activationFee)}`}</h3>
          <p>{af
            ? 'Ná ’n suksesvolle Paystack-betaling word jou unieke HuurDit-skakel outomaties geskep. Jou eie aktiveringsbetaling skep geen verwysingsverdienste vir jou nie.'
            : 'After a successful Paystack payment, your unique RentIt link is created automatically. Your own activation payment does not create a referral earning for you.'}</p>
          <label className="rentit-terms-check"><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} /><span>{af
            ? `Ek verstaan dat my eie ${money(activationFee)}-aktivering 100% aan We-Rise betaal word en dat ${money(referralEarning)} slegs verdien word op ’n kwalifiserende nuwe HuurDit-lid wat deur my unieke skakel toegeskryf en deur Paystack bevestig is.`
            : `I understand that my own ${money(activationFee)} activation is paid 100% to We-Rise and that ${money(referralEarning)} is earned only on a qualifying new RentIt member attributed through my unique link and verified by Paystack.`}</span></label>
          <button className="btn btn-primary btn-full rentit-activate-btn" onClick={startActivation} disabled={!termsAccepted || paying}><HiCash /> {paying ? (af ? 'Maak Paystack oop…' : 'Opening Paystack…') : (af ? `Aktiveer HuurDit — ${money(activationFee)}` : `Activate RentIt — ${money(activationFee)}`)}</button>
        </article>
      )}

      <article className="card rentit-calculator-card">
        <div className="rentit-calculator-heading">
          <div>
            <div className="eyebrow">{af ? 'HUURDIT INKOMSTE-SAKREKENAAR' : 'RENTIT INCOME CALCULATOR'}</div>
            <h3>{af ? 'Bereken jou moontlike verwysingsinkomste' : 'Estimate your potential referral income'}</h3>
            <p>{af
              ? `Gebruik jou eie realistiese syfers. Die sakrekenaar gebruik die huidige HuurDit-reël van ${money(referralEarning)} per kwalifiserende betaalde verwysing.`
              : `Use your own realistic numbers. The calculator uses the current RentIt rule of ${money(referralEarning)} per qualifying paid referral.`}</p>
          </div>
          <button className="rentit-calculator-reset" type="button" onClick={resetCalculator}><HiRefresh /> {af ? 'Herstel' : 'Reset'}</button>
        </div>

        <div className="rentit-calculator-inputs">
          <label className="rentit-calc-field">
            <span>{af ? 'Nuwe verwysings per maand' : 'New referrals per month'}</span>
            <div className="rentit-calc-control">
              <input type="range" min="0" max="100" step="1" value={calcReferrals} onChange={e => setCalcReferrals(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
              <input type="number" min="0" max="100" step="1" value={calcReferrals} onChange={e => setCalcReferrals(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
            </div>
            <small>{af ? 'Hoeveel nuwe mense jy realisties elke maand deur jou unieke skakel kan bring.' : 'How many new people you realistically expect to bring through your unique link each month.'}</small>
          </label>

          <label className="rentit-calc-field">
            <span>{af ? 'Suksesvolle betaal-koers' : 'Successful payment rate'}</span>
            <div className="rentit-calc-control">
              <input type="range" min="0" max="100" step="1" value={calcPaymentRate} onChange={e => setCalcPaymentRate(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
              <div className="rentit-calc-number-wrap"><input type="number" min="0" max="100" step="1" value={calcPaymentRate} onChange={e => setCalcPaymentRate(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} /><span>%</span></div>
            </div>
            <small>{af ? 'Slegs Paystack-bevestigde kwalifiserende betalings skep ’n verdienste.' : 'Only Paystack-verified qualifying payments create an earning.'}</small>
          </label>

          <label className="rentit-calc-field">
            <span>{af ? 'Maandelikse groei in verwysings' : 'Monthly referral growth'}</span>
            <div className="rentit-calc-control">
              <input type="range" min="0" max="100" step="1" value={calcGrowth} onChange={e => setCalcGrowth(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
              <div className="rentit-calc-number-wrap"><input type="number" min="0" max="100" step="1" value={calcGrowth} onChange={e => setCalcGrowth(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} /><span>%</span></div>
            </div>
            <small>{af ? 'Hou dit op 0% vir ’n eenvoudige vaste-maand berekening.' : 'Leave this at 0% for a simple flat monthly estimate.'}</small>
          </label>

          <label className="rentit-calc-field rentit-calc-months">
            <span>{af ? 'Projeksie-tydperk' : 'Projection period'}</span>
            <div className="rentit-calc-month-input"><input type="number" min="1" max="36" step="1" value={calcMonths} onChange={e => setCalcMonths(Math.min(36, Math.max(1, Number(e.target.value) || 1)))} /><span>{af ? 'maande' : 'months'}</span></div>
          </label>
        </div>

        <div className="rentit-calculator-results">
          <div className="rentit-calc-result">
            <small>{af ? 'Kwalifiserende betaalde verwysings' : 'Qualifying paid referrals'}</small>
            <strong>{projectedPaidReferrals.toLocaleString('en-ZA')}</strong>
            <span>{af ? `uit ${projectedReferrals.toLocaleString('en-ZA')} geraamde verwysings` : `from ${projectedReferrals.toLocaleString('en-ZA')} estimated referrals`}</span>
          </div>
          <div className="rentit-calc-result">
            <small>{af ? 'Bruto verwysingsverdienste' : 'Gross referral earnings'}</small>
            <strong>{money(projectedGrossEarnings)}</strong>
            <span>{projectedPaidReferrals.toLocaleString('en-ZA')} × {money(referralEarning)}</span>
          </div>
          <div className="rentit-calc-result rentit-calc-result-highlight">
            <small>{af ? 'Geraamde inkomste in finale maand' : 'Estimated final-month income'}</small>
            <strong>{money(projectedFinalMonthIncome)}</strong>
            <span>{af ? `${finalMonthPaidReferrals} kwalifiserende betalings in maand ${calcMonths}` : `${finalMonthPaidReferrals} qualifying payments in month ${calcMonths}`}</span>
          </div>
          <div className={`rentit-calc-result rentit-calc-result-net ${projectedNetIncome >= 0 ? 'is-positive' : 'is-negative'}`}>
            <small>{af ? `Netto posisie ná jou eenmalige ${money(activationFee)}-aktivering` : `Net position after your one-time ${money(activationFee)} activation`}</small>
            <strong>{projectedNetIncome < 0 ? `-${money(Math.abs(projectedNetIncome))}` : money(projectedNetIncome)}</strong>
            <span>{projectedNetIncome >= 0
              ? (af ? `Projeksie is bo gelykbreek. Gelykbreek vereis ${breakEvenReferrals} kwalifiserende betaalde verwysings.` : `Projection is above break-even. Break-even requires ${breakEvenReferrals} qualifying paid referrals.`)
              : (af ? `${money(remainingToBreakEven)} kort van jou aktiveringskoste. Gelykbreek vereis ${breakEvenReferrals} kwalifiserende betaalde verwysings.` : `${money(remainingToBreakEven)} short of your activation cost. Break-even requires ${breakEvenReferrals} qualifying paid referrals.`)}</span>
          </div>
        </div>

        <div className="rentit-calculator-note"><HiShieldCheck /><span>{af
          ? 'Hierdie is slegs ’n inkomste-projeksie, nie ’n waarborg nie. Werklike verdienste word slegs geskep wanneer ’n geldige verwysing deur die We-Rise-stelsel toegeskryf is en Paystack die kwalifiserende betaling bevestig.'
          : 'This is an income projection, not a guarantee. Actual earnings are created only when a valid referral is attributed by the We-Rise system and Paystack verifies the qualifying payment.'}</span></div>
      </article>

      <article className="card rentit-how-card">
        <div className="eyebrow">{af ? 'HOE HUURDIT WERK' : 'HOW RENTIT WORKS'}</div>
        <h3>{af ? 'Eenvoudige vloei. Permanente toewysing.' : 'Simple flow. Permanent attribution.'}</h3>
        <div className="rentit-steps">{steps.map(({ icon: Icon, title, text }, index) => <div className="rentit-step" key={title}><div className="rentit-step-number">{index + 1}</div><div className="rentit-step-icon"><Icon /></div><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>
      </article>

      <article className="card rentit-benefits-card">
        <div className="eyebrow">{af ? 'WAAROM HUURDIT?' : 'WHY RENTIT?'}</div>
        <h3>{af ? 'Jy weet presies wie deur wie gekom het' : 'Know exactly who came through whom'}</h3>
        <div className="rentit-benefit-grid">{benefits.map(({ icon: Icon, title, text }) => <div className="rentit-benefit" key={title}><div className="rentit-benefit-icon"><Icon /></div><strong>{title}</strong><p>{text}</p></div>)}</div>
      </article>

      <article className="card rentit-rules-card">
        <div className="rentit-rules-heading"><div className="rentit-rules-icon"><HiShieldCheck /></div><div><div className="eyebrow">{af ? 'BELANGRIKE REËLS' : 'IMPORTANT RULES'}</div><h3>{af ? 'Die platform en verwysings bly beskerm' : 'The platform and referrals stay protected'}</h3></div></div>
        <ul>
          <li>{af ? 'Die eerste geldige verwysingskakel waarmee ’n nuwe lid registreer, wen. Die toewysing kan nie later gewysig word om iemand anders te bevoordeel nie.' : 'The first valid referral link used when a new member registers wins. Attribution cannot later be changed to benefit somebody else.'}</li>
          <li>{af ? 'Self-verwysings word nie toegelaat nie.' : 'Self-referrals are not allowed.'}</li>
          <li>{af ? `Geen ${money(referralEarning)}-verdienste word geskep bloot deur ’n klik, registrasie of onbetaalde rekening nie. Die kwalifiserende ${money(activationFee)}-betaling moet deur Paystack bevestig word.` : `No ${money(referralEarning)} earning is created from a click, registration or unpaid account alone. The qualifying ${money(activationFee)} payment must be verified by Paystack.`}</li>
          <li>{af ? 'Direkte We-Rise-bemarking en registrasies sonder ’n geldige verwysingskode word aan geen huurder toegeskryf nie.' : 'Direct We-Rise marketing and registrations without a valid referral code are not attributed to any renter.'}</li>
          <li>{af ? 'We-Rise bly die eienaar van die kernplatform, handelsmerk en intellektuele eiendom.' : 'We-Rise remains the owner of the core platform, brand and intellectual property.'}</li>
        </ul>
      </article>
    </section>
  );
}
