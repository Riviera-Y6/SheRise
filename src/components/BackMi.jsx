import React, { useCallback, useEffect, useState } from 'react';
import {
  HiHeart, HiPlus, HiUserGroup, HiCalendar, HiCheck, HiChevronDown, HiChevronUp,
  HiLocationMarker, HiTag, HiDocumentAdd, HiShieldCheck, HiEye, HiX,
} from 'react-icons/hi';
import { apiRequest } from '../lib/api';

const initialForm = {
  title: '', reason: '', category: 'Community support', description: '', explanation: '',
  goal: '', age: '', country: 'South Africa', deadline: '',
};

const statusText = (status, lang) => ({
  pending_review: lang === 'en' ? 'Under review' : 'Word nagegaan',
  info_required: lang === 'en' ? 'More information needed' : 'Meer inligting benodig',
  rejected: lang === 'en' ? 'Not approved' : 'Nie goedgekeur nie',
  active: lang === 'en' ? 'Approved and active' : 'Goedgekeur en aktief',
  target_reached: lang === 'en' ? 'Target reached' : 'Teiken bereik',
}[status] || status);

export default function BackMi({
  t, lang, campaigns, campaignsLoading, campaignsError, onRetryCampaigns, onAddCampaign,
  onDonate, showToast, isAuthenticated = false, hasMemberAccess = false, profile, onRequireAuth, onRequireMembership,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showDonate, setShowDonate] = useState(null);
  const [showBackers, setShowBackers] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [documents, setDocuments] = useState([]);
  const [donationAmount, setDonationAmount] = useState('100');
  const [myRequests, setMyRequests] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});
  const [evidence, setEvidence] = useState({});
  const [followupFiles, setFollowupFiles] = useState({});

  const canReview = profile?.role === 'admin' || profile?.role === 'backmi_reviewer';
  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const loadPrivateLists = useCallback(async () => {
    if (!isAuthenticated) { setMyRequests([]); setReviewQueue([]); return; }
    try {
      const mine = await apiRequest('/api/backmi/my-requests');
      setMyRequests(Array.isArray(mine) ? mine : []);
      if (canReview) {
        const queue = await apiRequest('/api/backmi/review-queue');
        setReviewQueue(Array.isArray(queue) ? queue : []);
      }
    } catch {
      // Public BackMi remains readable even if a private status list cannot load.
    }
  }, [canReview, isAuthenticated]);

  useEffect(() => { loadPrivateLists(); }, [loadPrivateLists]);

  const requireMember = () => {
    if (!isAuthenticated) { onRequireAuth?.(); return false; }
    if (!hasMemberAccess) { onRequireMembership?.(); return false; }
    return true;
  };

  const handleCreate = async () => {
    const goal = Number(form.goal);
    if (!form.title.trim() || !form.reason.trim() || !Number.isFinite(goal) || goal <= 0) return;
    const created = await onAddCampaign({
      title: form.title.trim(), reason: form.reason.trim(), category: form.category.trim(),
      description: form.description.trim(), explanation: form.explanation.trim(), goal,
      age: form.age ? Number(form.age) : null, country: form.country.trim(), deadline: form.deadline || null,
    });
    if (!created) return;
    try {
      for (const file of documents) {
        const upload = new FormData();
        upload.append('file', file);
        await apiRequest(`/api/backmi/requests/${created.id}/documents`, { method: 'POST', body: upload });
      }
    } catch (error) {
      showToast?.(error?.message || (lang === 'en' ? 'The request was saved, but a document could not upload.' : 'Die versoek is gestoor, maar ’n dokument kon nie oplaai nie.'));
    }
    setForm(initialForm);
    setDocuments([]);
    setShowCreate(false);
    await loadPrivateLists();
  };

  const handleGift = async (campaignId) => {
    const amount = Number(donationAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const started = await onDonate(campaignId, amount);
    if (started) setShowDonate(null);
  };

  const review = async (request, decision) => {
    const body = {
      decision,
      review_notes: reviewNotes[request.id] || '',
      maturity_date: request.deadline || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    };
    try {
      await apiRequest(`/api/backmi/requests/${request.id}/review`, { method: 'PUT', body: JSON.stringify(body) });
      await Promise.all([loadPrivateLists(), onRetryCampaigns?.()]);
      showToast?.(lang === 'en' ? 'BackMi review saved.' : 'BackMi-beoordeling gestoor.');
    } catch (error) {
      showToast?.(error?.message || (lang === 'en' ? 'The review could not be saved.' : 'Die beoordeling kon nie gestoor word nie.'));
    }
  };

  const loadEvidence = async requestId => {
    try {
      const items = await apiRequest(`/api/backmi/requests/${requestId}/documents`);
      setEvidence(prev => ({ ...prev, [requestId]: Array.isArray(items) ? items : [] }));
    } catch (error) {
      showToast?.(error?.message || (lang === 'en' ? 'Documents could not be opened.' : 'Dokumente kon nie oopgemaak word nie.'));
    }
  };

  const uploadFollowup = async requestId => {
    const files = followupFiles[requestId] || [];
    if (!files.length) return;
    try {
      for (const file of files) {
        const upload = new FormData();
        upload.append('file', file);
        await apiRequest(`/api/backmi/requests/${requestId}/documents`, { method: 'POST', body: upload });
      }
      setFollowupFiles(prev => ({ ...prev, [requestId]: [] }));
      showToast?.(lang === 'en' ? 'Supporting documents uploaded.' : 'Bewysdokumente opgelaai.');
    } catch (error) {
      showToast?.(error?.message || (lang === 'en' ? 'Documents could not upload.' : 'Dokumente kon nie oplaai nie.'));
    }
  };

  const getDailyTotal = campaign => {
    const today = new Date().toISOString().slice(0, 10);
    return (campaign.dailyDonations || []).filter(item => String(item.date || '').slice(0, 10) === today)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  };
  const getDeadline = campaign => {
    const raw = campaign.maturity_date || campaign.deadline;
    if (raw) return new Date(`${String(raw).slice(0, 10)}T23:59:59`);
    return new Date(Date.now() + 30 * 86400000);
  };
  const getDaysLeft = campaign => Math.max(0, Math.ceil((getDeadline(campaign) - new Date()) / 86400000));
  const getProgress = campaign => campaign.goal > 0 ? Math.min(100, (campaign.raised / campaign.goal) * 100) : 0;

  return (
    <div className="fade-in backmi-page">
      <div className="backmi-heading">
        <div>
          <div className="eyebrow">BACKMI</div>
          <h2 className="section-title">{t.backMiTitle}</h2>
          <p className="section-subtitle">{lang === 'en'
            ? 'Verified requests, voluntary community gifts and a transparent payment record. BackMi has no separate monthly fee.'
            : 'Geverifieerde versoeke, vrywillige gemeenskapsgeskenke en ’n deursigtige betalingsrekord. BackMi het geen aparte maandelikse fooi nie.'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { if (requireMember()) setShowCreate(true); }}>
          <HiPlus /> {lang === 'en' ? 'Submit Help Request' : 'Dien Hulpversoek In'}
        </button>
      </div>

      <div className="backmi-trust-strip">
        <span><HiShieldCheck /> {lang === 'en' ? 'Every request is reviewed before publication' : 'Elke versoek word nagegaan voor publikasie'}</span>
        <span><HiHeart /> {lang === 'en' ? 'Gifts are voluntary — never loans or investments' : 'Geskenke is vrywillig — nooit lenings of beleggings nie'}</span>
      </div>

      {isAuthenticated && myRequests.length > 0 && (
        <section className="backmi-private-panel">
          <h3>{lang === 'en' ? 'My Help Requests' : 'My Hulpversoeke'}</h3>
          <div className="backmi-status-list">
            {myRequests.map(request => (
              <div className="backmi-status-row" key={request.id}>
                <div><strong>{request.request_code}</strong><span>{request.title}</span></div>
                <span className={`request-status status-${request.status}`}>{statusText(request.status, lang)}</span>
                {request.review_notes && <small>{request.review_notes}</small>}
                {['pending_review', 'info_required'].includes(request.status) && <div className="backmi-followup-upload"><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => setFollowupFiles(prev => ({ ...prev, [request.id]: Array.from(event.target.files || []).slice(0, 10) }))} /><button className="btn btn-secondary btn-sm" disabled={!followupFiles[request.id]?.length} onClick={() => uploadFollowup(request.id)}><HiDocumentAdd /> {lang === 'en' ? 'Upload evidence' : 'Laai bewyse op'}</button></div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {canReview && reviewQueue.length > 0 && (
        <section className="backmi-review-panel">
          <div className="eyebrow">BACKMI REVIEW</div>
          <h3>{lang === 'en' ? 'Requests Awaiting Review' : 'Versoeke wat Nagegaan Moet Word'}</h3>
          {reviewQueue.map(request => (
            <article className="review-request-card" key={request.id}>
              <div><strong>{request.request_code} · {request.title}</strong><p>{request.explanation || request.description}</p><small>R{Number(request.goal).toLocaleString()} · {request.creator}</small></div>
              <textarea className="input" rows={2} placeholder={lang === 'en' ? 'Reviewer notes...' : 'Beoordelaar se notas...'} value={reviewNotes[request.id] || ''} onChange={event => setReviewNotes(prev => ({ ...prev, [request.id]: event.target.value }))} />
              {evidence[request.id] && <div className="review-documents">{evidence[request.id].length === 0 ? <span>{lang === 'en' ? 'No supporting documents uploaded.' : 'Geen bewysdokumente opgelaai nie.'}</span> : evidence[request.id].map(document => <a key={document.id} href={document.signed_url} target="_blank" rel="noreferrer"><HiDocumentAdd /> {document.file_name}</a>)}</div>}
              <div className="review-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => loadEvidence(request.id)}><HiEye /> {lang === 'en' ? 'Documents' : 'Dokumente'}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => review(request, 'info_required')}><HiDocumentAdd /> {lang === 'en' ? 'Need info' : 'Meer inligting'}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => review(request, 'reject')}><HiX /> {lang === 'en' ? 'Decline' : 'Wys af'}</button>
                <button className="btn btn-primary btn-sm" onClick={() => review(request, 'approve')}><HiCheck /> {lang === 'en' ? 'Approve' : 'Keur goed'}</button>
              </div>
            </article>
          ))}
        </section>
      )}

      {campaignsLoading ? (
        <div className="empty-state"><HiHeart /><p>{lang === 'en' ? 'Loading approved BackMi requests...' : 'Laai goedgekeurde BackMi-versoeke...'}</p></div>
      ) : campaignsError ? (
        <div className="empty-state"><HiHeart /><p>{lang === 'en' ? 'BackMi could not reach the We-Rise API.' : 'BackMi kon nie die We-Rise API bereik nie.'}</p><button className="btn btn-secondary btn-sm" onClick={onRetryCampaigns}>{lang === 'en' ? 'Retry' : 'Probeer weer'}</button></div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state"><HiShieldCheck /><p>{lang === 'en' ? 'There are no approved public requests at the moment.' : 'Daar is tans geen goedgekeurde openbare versoeke nie.'}</p></div>
      ) : (
        <div className="backmi-grid">
          {campaigns.map(campaign => {
            const progress = getProgress(campaign);
            const daysLeft = getDaysLeft(campaign);
            const remaining = Math.max(0, Number(campaign.goal || 0) - Number(campaign.raised || 0));
            const isFunded = campaign.status === 'target_reached' || remaining <= 0;
            const gifts = campaign.donations || [];
            const expanded = showBackers === campaign.id;
            return (
              <article key={campaign.id} className="campaign-card backmi-request-card">
                <div className="backmi-card-topline"><div className="backmi-request-meta"><span className="backmi-category"><HiTag /> {campaign.category}</span><span className="backmi-request-code">{campaign.request_code}</span></div>{isFunded && <span className="badge badge-success">{lang === 'en' ? 'Target reached' : 'Teiken bereik'}</span>}</div>
                <div className="campaign-title backmi-title">{campaign.title}</div>
                <div className="campaign-creator">{lang === 'en' ? 'by' : 'deur'} {campaign.creator}{campaign.country ? <span> · <HiLocationMarker /> {campaign.country}</span> : null}</div>
                {campaign.reason && <div className="backmi-reason">{campaign.reason}</div>}
                <p className="campaign-desc backmi-explanation">{campaign.explanation || campaign.description}</p>
                <div className="backmi-progress-block"><div className="backmi-progress-labels"><span>{lang === 'en' ? 'Verified gifts' : 'Geverifieerde geskenke'}</span><strong>{progress.toFixed(0)}%</strong></div><div className="progress-bar-bg backmi-progress-track"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div></div>
                <div className="backmi-money-row"><div><strong>R{Number(campaign.raised || 0).toLocaleString()}</strong><span>{lang === 'en' ? `received of R${Number(campaign.goal || 0).toLocaleString()}` : `ontvang van R${Number(campaign.goal || 0).toLocaleString()}`}</span></div><div className="backmi-remaining"><strong>R{remaining.toLocaleString()}</strong><span>{lang === 'en' ? 'still needed' : 'nog benodig'}</span></div></div>
                <div className="backmi-stats-strip"><span><HiUserGroup /> <strong>{Number(campaign.backers || gifts.length || 0)}</strong> {lang === 'en' ? 'gifts' : 'geskenke'}</span><span><HiCalendar /> {daysLeft} {t.daysLeft}</span><span><HiHeart /> R{getDailyTotal(campaign).toFixed(0)} {lang === 'en' ? 'today' : 'vandag'}</span></div>
                {!isFunded && <button className="btn btn-primary btn-full backmi-main-action" onClick={() => { if (requireMember()) setShowDonate(campaign.id); }}><HiHeart /> {lang === 'en' ? 'Give a Voluntary Gift' : 'Gee ’n Vrywillige Geskenk'}</button>}
                <button className="backmi-donors-toggle" onClick={() => setShowBackers(expanded ? null : campaign.id)}><span><HiUserGroup /> {lang === 'en' ? `View ${gifts.length} confirmed gifts` : `Sien ${gifts.length} bevestigde geskenke`}</span>{expanded ? <HiChevronUp /> : <HiChevronDown />}</button>
                {expanded && <div className="backmi-donor-list">{gifts.length === 0 ? <div className="backmi-no-donors">{lang === 'en' ? 'No confirmed gifts yet.' : 'Nog geen bevestigde geskenke nie.'}</div> : gifts.slice(0, 50).map((gift, index) => <div className="backmi-donor-row" key={gift.id || index}><div className="trusted-contact-avatar">{String(gift.donor || 'W').charAt(0)}</div><div className="backmi-donor-name"><strong>{gift.donor}</strong><span>{gift.date}</span></div><strong className="backmi-donor-amount">R{Number(gift.amount).toLocaleString()}</strong></div>)}</div>}
              </article>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}><div className="modal-content backmi-create-modal" onClick={event => event.stopPropagation()}>
          <div className="eyebrow">BACKMI REQUEST</div><h3 className="modal-title">{lang === 'en' ? 'Submit a private request for review' : 'Dien ’n private versoek in vir beoordeling'}</h3>
          <div className="backmi-review-warning"><HiShieldCheck /> {lang === 'en' ? 'This request will not appear publicly until the BackMi team has reviewed and approved it.' : 'Hierdie versoek sal nie openbaar verskyn voordat die BackMi-span dit nagegaan en goedgekeur het nie.'}</div>
          <div className="form-group"><label>{t.campaignTitle}</label><input className="input" maxLength={250} value={form.title} onChange={event => updateForm('title', event.target.value)} /></div>
          <div className="backmi-form-grid"><div className="form-group"><label>{lang === 'en' ? 'Reason' : 'Rede'}</label><input className="input" maxLength={160} value={form.reason} onChange={event => updateForm('reason', event.target.value)} /></div><div className="form-group"><label>{lang === 'en' ? 'Category' : 'Kategorie'}</label><select className="input" value={form.category} onChange={event => updateForm('category', event.target.value)}><option>Community support</option><option>Medical</option><option>Family emergency</option><option>Education</option><option>Business</option><option>Housing</option><option>Other</option></select></div></div>
          <div className="form-group"><label>{lang === 'en' ? 'Full explanation' : 'Volledige verduideliking'}</label><textarea className="input" maxLength={4000} rows={5} value={form.explanation} onChange={event => updateForm('explanation', event.target.value)} /></div>
          <div className="backmi-form-grid"><div className="form-group"><label>{t.campaignGoal} (R)</label><input className="input" type="number" min="1" value={form.goal} onChange={event => updateForm('goal', event.target.value)} /></div><div className="form-group"><label>{lang === 'en' ? 'Requested maturity date' : 'Versoekte maturiteitsdatum'}</label><input className="input" type="date" value={form.deadline} onChange={event => updateForm('deadline', event.target.value)} /></div></div>
          <div className="backmi-form-grid"><div className="form-group"><label>{lang === 'en' ? 'Age (optional)' : 'Ouderdom (opsioneel)'}</label><input className="input" type="number" min="18" max="120" value={form.age} onChange={event => updateForm('age', event.target.value)} /></div><div className="form-group"><label>{lang === 'en' ? 'Country' : 'Land'}</label><input className="input" value={form.country} onChange={event => updateForm('country', event.target.value)} /></div></div>
          <div className="form-group"><label>{lang === 'en' ? 'Supporting documents (PDF, JPG or PNG; max 5 MB each)' : 'Bewysdokumente (PDF, JPG of PNG; maksimum 5 MB elk)'}</label><input className="input file-input" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => setDocuments(Array.from(event.target.files || []).slice(0, 10))} /><small>{documents.length} {lang === 'en' ? 'file(s) selected' : 'lêer(s) gekies'}</small></div>
          <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t.cancel}</button><button className="btn btn-primary" onClick={handleCreate} disabled={!form.title.trim() || !form.reason.trim() || !form.goal}><HiCheck /> {lang === 'en' ? 'Submit for Review' : 'Dien in vir Beoordeling'}</button></div>
        </div></div>
      )}

      {showDonate && (
        <div className="modal-overlay" onClick={() => setShowDonate(null)}><div className="modal-content" onClick={event => event.stopPropagation()}>
          <div className="eyebrow">BACKMI VOLUNTARY GIFT</div><h3 className="modal-title">{lang === 'en' ? 'Choose your gift' : 'Kies jou geskenk'}</h3>
          <div className="backmi-review-warning"><HiShieldCheck /> {lang === 'en' ? 'This is a voluntary gift to the specific approved member. It is not an investment, loan or required payment.' : 'Dit is ’n vrywillige geskenk aan die spesifieke goedgekeurde lid. Dit is nie ’n belegging, lening of verpligte betaling nie.'}</div>
          <div className="gift-presets">{[50, 100, 250, 500].map(value => <button key={value} className={Number(donationAmount) === value ? 'active' : ''} onClick={() => setDonationAmount(String(value))}>R{value}</button>)}</div>
          <div className="form-group"><label>{lang === 'en' ? 'Gift amount' : 'Geskenkbedrag'} (R)</label><input className="input" type="number" min="10" value={donationAmount} onChange={event => setDonationAmount(event.target.value)} /></div>
          <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setShowDonate(null)}>{t.cancel}</button><button className="btn btn-primary" onClick={() => handleGift(showDonate)} disabled={!donationAmount}><HiHeart /> {lang === 'en' ? 'Continue to PayFast' : 'Gaan voort na PayFast'}</button></div>
          <p className="payment-note">{lang === 'en' ? 'The gift appears in BackMi only after server-side confirmation from PayFast.' : 'Die geskenk verskyn eers in BackMi nadat PayFast dit direk aan die stelsel bevestig het.'}</p>
        </div></div>
      )}
    </div>
  );
}
