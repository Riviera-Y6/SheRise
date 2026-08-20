import React, { useState } from 'react';
import { HiHeart, HiPlus, HiUserGroup, HiCalendar, HiCheck } from 'react-icons/hi';

export default function BackMi({ t, lang, campaigns, campaignsLoading, campaignsError, onRetryCampaigns, onAddCampaign, onDonate, showToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showDonate, setShowDonate] = useState(null);
  const [showBackers, setShowBackers] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', goal: '' });
  const [donationAmount, setDonationAmount] = useState('');
  const [donorName, setDonorName] = useState('');

  const handleCreate = async () => {
    if (!form.title.trim() || !form.goal.trim()) return;
    const saved = await onAddCampaign({
      title: form.title.trim(),
      description: form.description.trim(),
      goal: parseFloat(form.goal),
    });
    if (!saved) return;
    setForm({ title: '', description: '', goal: '' });
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
      .reduce((sum, d) => sum + d.amount, 0);
  };

  const getDaysLeft = (campaign) => {
    const createdRaw = String(campaign.createdAt || '').replace(' ', 'T');
    const created = new Date(createdRaw.endsWith('Z') ? createdRaw : `${createdRaw}Z`);
    const deadline = new Date(created);
    deadline.setDate(deadline.getDate() + 30);
    const now = new Date();
    const diff = deadline - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getProgress = (campaign) => {
    return Math.min(100, (campaign.raised / campaign.goal) * 100);
  };

  return (
    <div className="fade-in">
      <h2 className="section-title">{t.backMiTitle}</h2>
      <p className="section-subtitle">{t.backMiDesc}</p>

      {/* Create Button */}
      <button 
        className="btn btn-primary btn-full"
        onClick={() => setShowCreate(true)}
        style={{ marginBottom: 20 }}
      >
        <HiPlus /> {t.createCampaign}
      </button>

      {/* Active Campaigns */}
      {campaignsLoading ? (
        <div className="empty-state"><HiHeart /><p>{lang === 'en' ? 'Loading campaigns...' : 'Laai veldtogte...'}</p></div>
      ) : campaignsError ? (
        <div className="empty-state">
          <HiHeart />
          <p>{lang === 'en' ? 'BackMi is not connected to the We-Rise API yet.' : 'BackMi is nog nie aan die We-Rise API gekoppel nie.'}</p>
          <button className="btn btn-secondary btn-sm" onClick={onRetryCampaigns}>{lang === 'en' ? 'Retry' : 'Probeer weer'}</button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state">
          <HiHeart />
          <p>{t.noCampaigns}</p>
        </div>
      ) : (
        campaigns.map(campaign => {
          const progress = getProgress(campaign);
          const daysLeft = getDaysLeft(campaign);
          const dailyTotal = getDailyTotal(campaign);
          const isFunded = campaign.raised >= campaign.goal;

          return (
            <div key={campaign.id} className="campaign-card">
              <div className="campaign-header">
                <div>
                  <div className="campaign-title">{campaign.title}</div>
                  <div className="campaign-creator">
                    {lang === 'en' ? 'Created by' : 'Geskep deur'} {campaign.creator || 'Anonymous We-Rise Lady'}
                  </div>
                </div>
                {isFunded ? (
                  <span className="badge badge-success">{t.fullyFunded}</span>
                ) : (
                  <span className="badge badge-pink">{daysLeft} {t.daysLeft}</span>
                )}
              </div>

              {campaign.description && (
                <div className="campaign-desc">{campaign.description}</div>
              )}

              {/* Progress Bar */}
              <div className="progress-container">
                <div className="progress-bar-bg">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="progress-stats">
                  <span>
                    <span className="progress-amount">
                      {lang === 'en' ? 'R' : 'R'} {campaign.raised.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    {t.amountRequired}: <span className="progress-amount">
                      {lang === 'en' ? 'R' : 'R'} {campaign.goal.toLocaleString()}
                    </span>
                  </span>
                </div>
              </div>

              {/* Daily Progress */}
              <div className="daily-progress">
                <span>{t.todayDonations}: <span className="today-amount">R{dailyTotal.toFixed(0)}</span></span>
                <span>{progress.toFixed(0)}% {t.goalReached}</span>
              </div>

              {/* Stats */}
              <div className="campaign-stats">
                <span>
                  <HiUserGroup /> <strong>{campaign.backers}</strong> {campaign.backers === 1 ? t.backer : t.backers}
                </span>
                <span>
                  <HiCalendar /> {daysLeft} {t.daysLeft}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {!isFunded && (
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowDonate(campaign.id)}
                    style={{ flex: 1 }}
                  >
                    <HiHeart /> {t.donate}
                  </button>
                )}
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowBackers(campaign.id)}
                  style={{ flex: 1 }}
                >
                  <HiUserGroup /> {campaign.backers} {t.backerList}
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{t.newCampaign}</h3>
            
            <div className="form-group">
              <label>{t.campaignTitle}</label>
              <input
                className="input"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={lang === 'en' ? 'e.g. Help me start my business' : 'b.v. Help my om my besigheid te begin'}
              />
            </div>

            <div className="form-group">
              <label>{lang === 'en' ? 'Description' : 'Beskrywing'}</label>
              <textarea
                className="input"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t.campaignDesc}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>{t.campaignGoal} (R/$)</label>
              <input
                className="input"
                type="number"
                min="1"
                value={form.goal}
                onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                placeholder="5000"
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCreate(false)}
                style={{ flex: 1 }}
              >
                {lang === 'en' ? 'Cancel' : 'Kanselleer'}
              </button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={handleCreate}
                style={{ flex: 1 }}
                disabled={!form.title.trim() || !form.goal.trim()}
              >
                <HiCheck /> {t.submitCampaign}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Donate Modal */}
      {showDonate && (
        <div className="modal-overlay" onClick={() => setShowDonate(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{t.becomeBacker}</h3>
            
            <div className="form-group">
              <label>{lang === 'en' ? 'Your Name (optional)' : 'Jou Naam (opsioneel)'}</label>
              <input
                className="input"
                value={donorName}
                onChange={e => setDonorName(e.target.value)}
                placeholder={lang === 'en' ? 'Anonymous We-Rise Lady' : 'Anonieme We-Rise Lady'}
              />
            </div>

            <div className="form-group">
              <label>{t.donationAmount} (R/$)</label>
              <input
                className="input"
                type="number"
                min="1"
                value={donationAmount}
                onChange={e => setDonationAmount(e.target.value)}
                placeholder="100"
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDonate(null)}
                style={{ flex: 1 }}
              >
                {lang === 'en' ? 'Cancel' : 'Kanselleer'}
              </button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => handleDonateSubmit(showDonate)}
                style={{ flex: 1 }}
                disabled={!donationAmount || parseFloat(donationAmount) <= 0}
              >
                <HiHeart /> {t.confirmDonation}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backers Modal */}
      {showBackers && (
        <div className="modal-overlay" onClick={() => setShowBackers(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{t.backerList}</h3>
            
            {(() => {
              const campaign = campaigns.find(c => c.id === showBackers);
              if (!campaign) return null;
              
              if ((campaign.donations || []).length === 0) {
                return (
                  <div className="empty-state">
                    <p>{t.noDonations}</p>
                  </div>
                );
              }
              
              return (
                <div className="backers-list">
                  {(campaign.donations || []).slice(-10).reverse().map((d, i) => (
                    <div key={i} className="donation-item">
                      <div>
                        <div className="donor-name">{d.donor}</div>
                        <div className="donor-time">{d.time}</div>
                      </div>
                      <div className="donor-amount">R{d.amount.toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <button 
              className="btn btn-secondary btn-sm btn-full"
              onClick={() => setShowBackers(null)}
              style={{ marginTop: 12 }}
            >
              {lang === 'en' ? 'Close' : 'Sluit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}