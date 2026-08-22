import React, { useState } from 'react';
import {
  HiHeart, HiPlus, HiUserGroup, HiCalendar, HiCheck, HiChevronDown, HiChevronUp,
  HiClock, HiLocationMarker, HiTag
} from 'react-icons/hi';

const initialForm = {
  title: '',
  reason: '',
  category: 'Community support',
  description: '',
  explanation: '',
  goal: '',
  age: '',
  country: 'South Africa',
  deadline: '',
};

export default function BackMi({ t, lang, campaigns, campaignsLoading, campaignsError, onRetryCampaigns, onAddCampaign, onDonate, showToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showDonate, setShowDonate] = useState(null);
  const [showBackers, setShowBackers] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [donationAmount, setDonationAmount] = useState('');
  const [donorName, setDonorName] = useState('');

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleCreate = async () => {
    const goal = Number(form.goal);
    if (!form.title.trim() || !form.reason.trim() || !Number.isFinite(goal) || goal <= 0) return;
    const saved = await onAddCampaign({
      title: form.title.trim(),
      reason: form.reason.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      explanation: form.explanation.trim(),
      goal,
      age: form.age ? Number(form.age) : null,
      country: form.country.trim(),
      deadline: form.deadline || null,
    });
    if (!saved) return;
    setForm(initialForm);
    setShowCreate(false);
  };

  const handleDonateSubmit = async (campaignId) => {
    const amount = parseFloat(donationAmount);
    if (!amount || amount <= 0) return;
    const saved = await onDonate(campaignId, amount, donorName.trim() || undefined);
    if (!saved) return;
    setDonationAmount('');
    setDonorName('');
    setShowDonate(null);
  };

  const getDailyTotal = (campaign) => {
    const today = new Date().toISOString().slice(0, 10);
    return (campaign.dailyDonations || [])
      .filter(d => String(d.date || '').slice(0, 10) === today)
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  };

  const getDeadline = (campaign) => {
    if (campaign.deadline) return new Date(`${String(campaign.deadline).slice(0, 10)}T23:59:59`);
    const createdRaw = String(campaign.createdAt || campaign.created_at || '').replace(' ', 'T');
    const created = createdRaw ? new Date(createdRaw.endsWith('Z') ? createdRaw : `${createdRaw}Z`) : new Date();
    const deadline = new Date(created);
    deadline.setDate(deadline.getDate() + 30);
    return deadline;
  };

  const getDaysLeft = (campaign) => Math.max(0, Math.ceil((getDeadline(campaign) - new Date()) / 86400000));
  const getProgress = (campaign) => campaign.goal > 0 ? Math.min(100, (campaign.raised / campaign.goal) * 100) : 0;

  return (
    <div className="fade-in backmi-page">
      <div className="backmi-heading">
        <div>
          <div className="eyebrow">BACKMI</div>
          <h2 className="section-title">{t.backMiTitle}</h2>
          <p className="section-subtitle">{lang === 'en'
            ? 'Members helping members. Follow every request, see exactly what is still needed, and back a We-Rise Lady when she needs support.'
            : 'Lede help lede. Volg elke versoek, sien presies wat nog benodig word, en ondersteun ’n We-Rise Lady wanneer sy hulp nodig het.'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <HiPlus /> {lang === 'en' ? 'Create BackMi Request' : 'Skep BackMi-versoek'}
        </button>
      </div>

      {campaignsLoading ? (
        <div className="empty-state"><HiHeart /><p>{lang === 'en' ? 'Loading BackMi requests...' : 'Laai BackMi-versoeke...'}</p></div>
      ) : campaignsError ? (
        <div className="empty-state">
          <HiHeart />
          <p>{lang === 'en' ? 'BackMi could not reach the We-Rise API.' : 'BackMi kon nie die We-Rise API bereik nie.'}</p>
          <button className="btn btn-secondary btn-sm" onClick={onRetryCampaigns}>{lang === 'en' ? 'Retry' : 'Probeer weer'}</button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state"><HiHeart /><p>{t.noCampaigns}</p></div>
      ) : (
        <div className="backmi-grid">
          {campaigns.map(campaign => {
            const progress = getProgress(campaign);
            const daysLeft = getDaysLeft(campaign);
            const dailyTotal = getDailyTotal(campaign);
            const remaining = Math.max(0, Number(campaign.goal || 0) - Number(campaign.raised || 0));
            const isFunded = Number(campaign.raised || 0) >= Number(campaign.goal || 0);
            const donations = campaign.donations || [];
            const expanded = showBackers === campaign.id;

            return (
              <article key={campaign.id} className="campaign-card backmi-request-card">
                <div className="backmi-card-topline">
                  <div className="backmi-request-meta">
                    <span className="backmi-category"><HiTag /> {campaign.category || (lang === 'en' ? 'Community support' : 'Gemeenskapsondersteuning')}</span>
                    {!isFunded && <span className="backmi-days"><HiClock /> {daysLeft} {t.daysLeft}</span>}
                  </div>
                  {isFunded && <span className="badge badge-success">{t.fullyFunded}</span>}
                </div>

                <div className="campaign-title backmi-title">{campaign.title}</div>
                <div className="campaign-creator">
                  {lang === 'en' ? 'by' : 'deur'} {campaign.creator || 'Anonymous We-Rise Lady'}
                  {campaign.country ? <span> · <HiLocationMarker /> {campaign.country}</span> : null}
                </div>

                {campaign.reason && <div className="backmi-reason">{campaign.reason}</div>}
                {(campaign.explanation || campaign.description) && (
                  <p className="campaign-desc backmi-explanation">{campaign.explanation || campaign.description}</p>
                )}

                <div className="backmi-progress-block">
                  <div className="backmi-progress-labels">
                    <span>{lang === 'en' ? 'Progress' : 'Vordering'}</span>
                    <strong>{progress.toFixed(0)}%</strong>
                  </div>
                  <div className="progress-bar-bg backmi-progress-track">
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="backmi-money-row">
                  <div>
                    <strong>R{Number(campaign.raised || 0).toLocaleString()}</strong>
                    <span>{lang === 'en' ? `raised of R${Number(campaign.goal || 0).toLocaleString()}` : `ingesamel van R${Number(campaign.goal || 0).toLocaleString()}`}</span>
                  </div>
                  <div className="backmi-remaining">
                    <strong>R{remaining.toLocaleString()}</strong>
                    <span>{lang === 'en' ? 'still needed' : 'nog benodig'}</span>
                  </div>
                </div>

                <div className="backmi-stats-strip">
                  <span><HiUserGroup /> <strong>{Number(campaign.backers || donations.length || 0)}</strong> {t.backers}</span>
                  <span><HiCalendar /> {daysLeft} {t.daysLeft}</span>
                  <span><HiHeart /> R{dailyTotal.toFixed(0)} {lang === 'en' ? 'today' : 'vandag'}</span>
                </div>

                {!isFunded && (
                  <button className="btn btn-primary btn-full backmi-main-action" onClick={() => setShowDonate(campaign.id)}>
                    <HiHeart /> {lang === 'en' ? 'Back This Request' : 'Ondersteun Hierdie Versoek'}
                  </button>
                )}

                <button className="backmi-donors-toggle" onClick={() => setShowBackers(expanded ? null : campaign.id)}>
                  <span><HiUserGroup /> {lang === 'en' ? `View ${donations.length} donors` : `Sien ${donations.length} skenkers`}</span>
                  {expanded ? <HiChevronUp /> : <HiChevronDown />}
                </button>

                {expanded && (
                  <div className="backmi-donor-list">
                    {donations.length === 0 ? (
                      <div className="backmi-no-donors">{t.noDonations}</div>
                    ) : donations.slice(0, 50).map((donation, index) => (
                      <div className="backmi-donor-row" key={donation.id || `${campaign.id}-${index}`}>
                        <div className="trusted-contact-avatar">{String(donation.donor || 'A').charAt(0).toUpperCase()}</div>
                        <div className="backmi-donor-name">
                          <strong>{donation.donor || 'Anonymous'}</strong>
                          <span>{donation.date || ''}</span>
                        </div>
                        <strong className="backmi-donor-amount">R{Number(donation.amount || 0).toLocaleString()}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content backmi-create-modal" onClick={e => e.stopPropagation()}>
            <div className="eyebrow">BACKMI REQUEST</div>
            <h3 className="modal-title">{lang === 'en' ? 'Tell the community what you need' : 'Vertel die gemeenskap wat jy benodig'}</h3>

            <div className="form-group"><label>{t.campaignTitle}</label><input className="input" maxLength={250} value={form.title} onChange={e => updateForm('title', e.target.value)} placeholder={lang === 'en' ? 'e.g. Heart surgery fund' : 'bv. Hartoperasie-fonds'} /></div>
            <div className="backmi-form-grid">
              <div className="form-group"><label>{lang === 'en' ? 'Reason' : 'Rede'}</label><input className="input" maxLength={160} value={form.reason} onChange={e => updateForm('reason', e.target.value)} placeholder={lang === 'en' ? 'Urgent cardiac surgery' : 'Dringende hartoperasie'} /></div>
              <div className="form-group"><label>{lang === 'en' ? 'Category' : 'Kategorie'}</label><select className="input" value={form.category} onChange={e => updateForm('category', e.target.value)}><option>Community support</option><option>Medical</option><option>Family emergency</option><option>Education</option><option>Business</option><option>Housing</option><option>Other</option></select></div>
            </div>
            <div className="form-group"><label>{lang === 'en' ? 'Full Explanation' : 'Volledige Verduideliking'}</label><textarea className="input" maxLength={2000} rows={5} value={form.explanation} onChange={e => updateForm('explanation', e.target.value)} placeholder={lang === 'en' ? 'Explain the situation and how the funds will help...' : 'Verduidelik die situasie en hoe die fondse sal help...'} /></div>
            <div className="backmi-form-grid">
              <div className="form-group"><label>{t.campaignGoal} (R)</label><input className="input" type="number" min="1" value={form.goal} onChange={e => updateForm('goal', e.target.value)} placeholder="15000" /></div>
              <div className="form-group"><label>{lang === 'en' ? 'Deadline' : 'Sperdatum'}</label><input className="input" type="date" value={form.deadline} onChange={e => updateForm('deadline', e.target.value)} /></div>
            </div>
            <div className="backmi-form-grid">
              <div className="form-group"><label>{lang === 'en' ? 'Age (optional)' : 'Ouderdom (opsioneel)'}</label><input className="input" type="number" min="18" max="120" value={form.age} onChange={e => updateForm('age', e.target.value)} /></div>
              <div className="form-group"><label>{lang === 'en' ? 'Country' : 'Land'}</label><input className="input" maxLength={80} value={form.country} onChange={e => updateForm('country', e.target.value)} /></div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t.cancel}</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.title.trim() || !form.reason.trim() || !form.goal}><HiCheck /> {t.submitCampaign}</button>
            </div>
          </div>
        </div>
      )}

      {showDonate && (
        <div className="modal-overlay" onClick={() => setShowDonate(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="eyebrow">BACKMI</div>
            <h3 className="modal-title">{t.becomeBacker}</h3>
            <div className="form-group"><label>{lang === 'en' ? 'Your Name (optional)' : 'Jou Naam (opsioneel)'}</label><input className="input" value={donorName} onChange={e => setDonorName(e.target.value)} placeholder={lang === 'en' ? 'Anonymous We-Rise Lady' : 'Anonieme We-Rise Lady'} /></div>
            <div className="form-group"><label>{t.donationAmount} (R)</label><input className="input" type="number" min="1" value={donationAmount} onChange={e => setDonationAmount(e.target.value)} placeholder="100" /></div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDonate(null)}>{t.cancel}</button>
              <button className="btn btn-primary" onClick={() => handleDonateSubmit(showDonate)} disabled={!donationAmount}><HiHeart /> {t.confirmDonation}</button>
            </div>
            <p className="payment-note">{lang === 'en' ? 'This records the BackMi pledge in We-Rise. Payment-provider settlement can be connected separately.' : 'Dit teken die BackMi-belofte in We-Rise aan. Betalingsverwerking kan apart gekoppel word.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
