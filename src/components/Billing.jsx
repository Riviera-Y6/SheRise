import React, { useCallback, useEffect, useState } from 'react';
import { HiCheckCircle, HiClock, HiCreditCard, HiHeart, HiRefresh, HiShieldCheck } from 'react-icons/hi';
import { apiRequest, submitPayFastCheckout } from '../lib/api';

const money = value => `R${Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = value => value ? new Date(value).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export default function Billing({ lang, membership, profile, showToast, onRefreshProfile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [adminSettings, setAdminSettings] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest('/api/billing/status');
      setData(result);
      setAdminSettings(result?.admin_settings || result?.settings || null);
      if (profile?.role === 'admin') {
        const ledgerData = await apiRequest('/api/admin/backmi/ledger?limit=100');
        setLedger(ledgerData);
      }
      await onRefreshProfile?.();
    } catch (error) {
      showToast(error?.message || (lang === 'en' ? 'Could not load membership.' : 'Kon nie lidmaatskap laai nie.'));
    } finally {
      setLoading(false);
    }
  }, [lang, onRefreshProfile, profile?.role, showToast]);

  useEffect(() => { load(); }, [load]);

  const current = data?.membership || membership || {};
  const settings = data?.settings || {};
  const trialActive = current.status === 'trialing' && current.trial_active;
  const active = current.status === 'active';

  const startCheckout = async () => {
    setPaying(true);
    try {
      const checkout = await apiRequest('/api/billing/membership/checkout', { method: 'POST', body: '{}' });
      submitPayFastCheckout(checkout);
    } catch (error) {
      showToast(error?.message || (lang === 'en' ? 'PayFast checkout could not start.' : 'PayFast-betaling kon nie begin nie.'));
      setPaying(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const saved = await apiRequest('/api/admin/payment-settings', { method: 'PUT', body: JSON.stringify(adminSettings) });
      setData(currentData => ({ ...currentData, settings: saved }));
      setAdminSettings(saved);
      showToast(lang === 'en' ? 'Payment settings saved.' : 'Betalingsinstellings gestoor.');
    } catch (error) {
      showToast(error?.message || (lang === 'en' ? 'Settings could not be saved.' : 'Instellings kon nie gestoor word nie.'));
    } finally {
      setSavingSettings(false);
    }
  };

  const updateAdmin = (key, value) => setAdminSettings(currentSettings => ({ ...currentSettings, [key]: value }));

  if (loading && !data) return <div className="empty-state"><HiCreditCard /><p>{lang === 'en' ? 'Loading membership...' : 'Laai lidmaatskap...'}</p></div>;

  return (
    <section className="billing-page fade-in">
      <div className="billing-hero">
        <div>
          <div className="eyebrow">WE-RISE MEMBERSHIP</div>
          <h2 className="section-title">{lang === 'en' ? 'Your Membership' : 'Jou Lidmaatskap'}</h2>
          <p className="section-subtitle">{lang === 'en'
            ? 'One membership gives you the full We-Rise ecosystem. BackMi has no separate monthly fee.'
            : 'Een lidmaatskap gee jou die volle We-Rise-ekosisteem. BackMi het geen aparte maandelikse fooi nie.'}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}><HiRefresh /> {lang === 'en' ? 'Refresh' : 'Verfris'}</button>
      </div>

      <div className={`membership-status-card status-${current.status || 'unknown'}`}>
        <div className="membership-status-icon">{active ? <HiCheckCircle /> : <HiClock />}</div>
        <div>
          <span>{lang === 'en' ? 'Current status' : 'Huidige status'}</span>
          <strong>{active
            ? (lang === 'en' ? 'Active member' : 'Aktiewe lid')
            : trialActive
              ? (lang === 'en' ? `Free trial — ${current.trial_days_remaining} day(s) left` : `Gratis proeftydperk — ${current.trial_days_remaining} dag(e) oor`)
              : current.status === 'past_due'
                ? (lang === 'en' ? 'Payment needs attention' : 'Betaling kort aandag')
                : (lang === 'en' ? 'Trial ended' : 'Proeftydperk verby')}</strong>
          {trialActive && <small>{lang === 'en' ? 'No payment is due during your trial.' : 'Geen betaling is tydens jou proeftydperk betaalbaar nie.'}</small>}
          {active && <small>{lang === 'en' ? `Next monthly date: ${dateText(current.next_billing_date)}` : `Volgende maandelikse datum: ${dateText(current.next_billing_date)}`}</small>}
        </div>
      </div>

      <div className="membership-price-grid">
        <article className="membership-price-card">
          <span>{lang === 'en' ? 'Once-off joining' : 'Eenmalige aansluiting'}</span>
          <strong>{money(settings.joining_fee_zar)}</strong>
          <small>≈ ${Number(settings.joining_fee_usd || 12).toFixed(0)} USD</small>
        </article>
        <article className="membership-price-card featured">
          <span>{lang === 'en' ? 'Monthly membership' : 'Maandelikse lidmaatskap'}</span>
          <strong>{money(settings.monthly_fee_zar)}</strong>
          <small>≈ ${Number(settings.monthly_fee_usd || 10).toFixed(0)} USD</small>
        </article>
        <article className="membership-price-card backmi-allocation-card">
          <span>{lang === 'en' ? 'Monthly amount allocated to BackMi' : 'Maandelikse bedrag aan BackMi toegeken'}</span>
          <strong>{money(settings.backmi_allocation_zar)}</strong>
          <small>{lang === 'en' ? 'Included in membership — not an extra fee' : 'Ingesluit by lidmaatskap — nie ’n ekstra fooi nie'}</small>
        </article>
      </div>

      {!active && !trialActive && !current.joining_paid_at && (
        <div className="membership-checkout-card">
          <HiShieldCheck />
          <div>
            <strong>{lang === 'en' ? 'Complete membership securely with PayFast' : 'Voltooi lidmaatskap veilig met PayFast'}</strong>
            <p>{lang === 'en'
              ? `${money(settings.joining_fee_zar)} once, followed by ${money(settings.monthly_fee_zar)} per month. The first recurring date is shown by PayFast before confirmation.`
              : `${money(settings.joining_fee_zar)} eenmalig, gevolg deur ${money(settings.monthly_fee_zar)} per maand. PayFast wys die eerste herhalende datum voor bevestiging.`}</p>
          </div>
          <button className="btn btn-primary" onClick={startCheckout} disabled={paying || !settings.membership_payments_enabled}>
            <HiCreditCard /> {paying ? (lang === 'en' ? 'Opening PayFast...' : 'Maak PayFast oop...') : (lang === 'en' ? 'Continue to PayFast' : 'Gaan voort na PayFast')}
          </button>
          {!settings.membership_payments_enabled && <small className="payment-disabled-note">{lang === 'en' ? 'Payments are not enabled on the server yet.' : 'Betalings is nog nie op die bediener geaktiveer nie.'}</small>}
        </div>
      )}

      {!active && current.joining_paid_at && (
        <div className="membership-checkout-card">
          <HiShieldCheck />
          <div><strong>{lang === 'en' ? 'Your joining payment is already recorded' : 'Jou aansluitingsbetaling is reeds aangeteken'}</strong><p>{lang === 'en' ? 'Do not pay the joining fee again. Refresh after PayFast processes the monthly payment, or contact We-Rise support if the status does not change.' : 'Moenie die aansluitingsfooi weer betaal nie. Verfris nadat PayFast die maandelikse betaling verwerk het, of kontak We-Rise-ondersteuning indien die status nie verander nie.'}</p></div>
        </div>
      )}

      <div className="billing-principles">
        <span><HiHeart /> {lang === 'en' ? 'BackMi remains a We-Rise benefit with no separate subscription.' : 'BackMi bly ’n We-Rise-voordeel sonder ’n aparte intekening.'}</span>
        <span><HiShieldCheck /> {lang === 'en' ? 'Only PayFast-confirmed payments are recorded as successful.' : 'Slegs betalings wat PayFast bevestig, word as suksesvol aangeteken.'}</span>
      </div>

      <div className="billing-history-card">
        <h3>{lang === 'en' ? 'Payment History' : 'Betalingsgeskiedenis'}</h3>
        {!data?.payments?.length ? <p className="muted-copy">{lang === 'en' ? 'No payments recorded yet.' : 'Nog geen betalings aangeteken nie.'}</p> : (
          <div className="billing-history-list">
            {data.payments.map(payment => (
              <div className="billing-history-row" key={payment.id}>
                <div><strong>{payment.item_name}</strong><span>{dateText(payment.verified_at || payment.created_at)} · {payment.pf_payment_id || payment.checkout_reference}</span></div>
                <div><strong>{money(payment.amount_gross_zar ?? payment.expected_amount_zar)}</strong><span className={`payment-status payment-${payment.status}`}>{payment.status}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {profile?.role === 'admin' && adminSettings && (
        <section className="payment-admin-card">
          <div className="eyebrow">ADMIN PAYMENT SETTINGS</div>
          <h3>{lang === 'en' ? 'Configurable Membership Model' : 'Verstelbare Lidmaatskapmodel'}</h3>
          <p>{lang === 'en' ? 'Changes apply to new checkouts. Existing verified payment records remain unchanged.' : 'Veranderings geld vir nuwe betalings. Bestaande geverifieerde betalingsrekords bly onveranderd.'}</p>
          <div className="payment-admin-grid">
            {[
              ['trial_days', lang === 'en' ? 'Trial days' : 'Proefdae'],
              ['joining_fee_zar', lang === 'en' ? 'Joining fee (R)' : 'Aansluitingsfooi (R)'],
              ['joining_fee_usd', lang === 'en' ? 'Joining reference ($)' : 'Aansluitingsverwysing ($)'],
              ['monthly_fee_zar', lang === 'en' ? 'Monthly fee (R)' : 'Maandelikse fooi (R)'],
              ['monthly_fee_usd', lang === 'en' ? 'Monthly reference ($)' : 'Maandelikse verwysing ($)'],
              ['backmi_allocation_zar', lang === 'en' ? 'BackMi allocation (R)' : 'BackMi-toewysing (R)'],
              ['backmi_allocation_usd', lang === 'en' ? 'BackMi reference ($)' : 'BackMi-verwysing ($)'],
              ['first_recurring_delay_days', lang === 'en' ? 'First recurring delay (days)' : 'Eerste herhaling ná (dae)'],
              ['minimum_gift_zar', lang === 'en' ? 'Minimum gift (R)' : 'Minimum geskenk (R)'],
              ['maximum_gift_zar', lang === 'en' ? 'Maximum gift (R)' : 'Maksimum geskenk (R)'],
            ].map(([key, label]) => <label key={key}>{label}<input className="input" type="number" min="0" step="0.01" value={adminSettings[key] ?? ''} onChange={event => updateAdmin(key, Number(event.target.value))} /></label>)}
            <label>{lang === 'en' ? 'Allocation method' : 'Toewysingsmetode'}<select className="input" value={adminSettings.backmi_allocation_mode} onChange={event => updateAdmin('backmi_allocation_mode', event.target.value)}><option value="fixed">{lang === 'en' ? 'Fixed amount' : 'Vaste bedrag'}</option><option value="percentage">{lang === 'en' ? 'Percentage' : 'Persentasie'}</option></select></label>
            <label>{lang === 'en' ? 'Allocation percentage' : 'Toewysingspersentasie'}<input className="input" type="number" min="0" max="100" step="0.1" value={adminSettings.backmi_allocation_percentage ?? 20} onChange={event => updateAdmin('backmi_allocation_percentage', Number(event.target.value))} /></label>
            <label>{lang === 'en' ? 'Allocation basis' : 'Toewysingsbasis'}<select className="input" value={adminSettings.allocation_fee_basis || 'gross'} onChange={event => updateAdmin('allocation_fee_basis', event.target.value)}><option value="gross">{lang === 'en' ? 'Gross payment' : 'Bruto betaling'}</option><option value="net">{lang === 'en' ? 'After PayFast fee' : 'Ná PayFast-fooi'}</option></select></label>
            <label className="admin-toggle"><input type="checkbox" checked={Boolean(adminSettings.membership_payments_enabled)} onChange={event => updateAdmin('membership_payments_enabled', event.target.checked)} /> {lang === 'en' ? 'Membership checkouts enabled' : 'Lidmaatskapbetalings geaktiveer'}</label>
            <label className="admin-toggle"><input type="checkbox" checked={Boolean(adminSettings.backmi_gifts_enabled)} onChange={event => updateAdmin('backmi_gifts_enabled', event.target.checked)} /> {lang === 'en' ? 'BackMi gift checkouts enabled' : 'BackMi-geskenkbetalings geaktiveer'}</label>
          </div>
          <button className="btn btn-primary" onClick={saveSettings} disabled={savingSettings}>{savingSettings ? (lang === 'en' ? 'Saving...' : 'Stoor...') : (lang === 'en' ? 'Save Settings' : 'Stoor Instellings')}</button>
        </section>
      )}

      {profile?.role === 'admin' && ledger && (
        <section className="billing-history-card">
          <h3>{lang === 'en' ? 'BackMi Internal Ledger' : 'BackMi Interne Grootboek'}</h3>
          <div className="ledger-balances">{Object.entries(ledger.balances || {}).map(([account, balance]) => <div key={account}><span>{account.replaceAll('_', ' ')}</span><strong>{money(balance)}</strong></div>)}</div>
          <div className="billing-history-list">{(ledger.entries || []).slice(0, 20).map(entry => <div className="billing-history-row" key={entry.id}><div><strong>{entry.description}</strong><span>{entry.event_key} · {dateText(entry.created_at)}</span></div><div><strong>{entry.direction === 'debit' ? '−' : '+'}{money(entry.amount_zar)}</strong><span>{entry.account.replaceAll('_', ' ')}</span></div></div>)}</div>
        </section>
      )}

      {profile?.role === 'admin' && <div className="admin-note">{lang === 'en' ? 'Final BackMi payouts remain disabled. No founder, member or split percentage has been hard-coded.' : 'Finale BackMi-uitbetalings bly gedeaktiveer. Geen stigter-, lid- of verdelingspersentasie is hardgekodeer nie.'}</div>}
    </section>
  );
}
