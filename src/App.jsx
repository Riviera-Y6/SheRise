import React, { useState, useEffect, useCallback } from 'react';
import {
  HiHome, HiSparkles, HiHeart, HiUsers, HiCurrencyDollar, HiPencil, HiShieldCheck, HiStar, HiEmojiHappy, HiChatAlt2
} from 'react-icons/hi';
import translations from './i18n/translations';
import { apiRequest } from './lib/api';
import { getOrCreateMemberKey } from './lib/member';
import Home from './components/Home';
import AiAssistant from './components/AiAssistant';
import BackMi from './components/BackMi';
import Community from './components/Community';
import Messages from './components/Messages';
import ResellProgram from './components/ResellProgram';
import Journal from './components/Journal';
import Safety from './components/Safety';
import VisionBoard from './components/VisionBoard';
import Wellness from './components/Wellness';
import Footer from './components/Footer';

const TABS = [
  { id: 'home', icon: HiHome, labelKey: 'home' },
  { id: 'ai', icon: HiSparkles, labelKey: 'aiAssistant' },
  { id: 'journal', icon: HiPencil, labelKey: 'journalTitle' },
  { id: 'vision', icon: HiStar, labelKey: 'visionTitle' },
  { id: 'wellness', icon: HiEmojiHappy, labelKey: 'wellnessTitle' },
  { id: 'safety', icon: HiShieldCheck, labelKey: 'safetyTitle' },
  { id: 'backmi', icon: HiHeart, labelKey: 'backMi' },
  { id: 'community', icon: HiUsers, labelKey: 'community' },
  { id: 'messages', icon: HiChatAlt2, labelKey: 'messages' },
  { id: 'resell', icon: HiCurrencyDollar, labelKey: 'resell' },
];

const normalizeCampaign = (campaign) => ({
  ...campaign,
  goal: Number(campaign.goal || 0),
  raised: Number(campaign.raised || 0),
  backers: Number(campaign.backers || 0),
  creator: campaign.creator || 'Anonymous We-Rise Lady',
  createdAt: campaign.createdAt || campaign.created_at || new Date().toISOString(),
  donations: (campaign.donations || []).map(d => ({ ...d, amount: Number(d.amount || 0) })),
  dailyDonations: (campaign.dailyDonations || campaign.donations || []).map(d => ({ ...d, amount: Number(d.amount || 0) })),
});

export default function App() {
  const [lang, setLang] = useState('en');
  const [activeTab, setActiveTab] = useState('home');
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState(false);
  const [toast, setToast] = useState(null);
  const [communityConversationOpen, setCommunityConversationOpen] = useState(false);
  const [messageConversationOpen, setMessageConversationOpen] = useState(false);
  const [memberKey] = useState(getOrCreateMemberKey);
  const [memberPlan, setMemberPlan] = useState('free');
  const [userName, setUserName] = useState(() => {
    try {
      const current = localStorage.getItem('werise_name');
      const legacy = localStorage.getItem('sherise_name');
      const name = current || legacy || '';
      if (!current && legacy) localStorage.setItem('werise_name', legacy);
      return name;
    } catch { return ''; }
  });
  const [showNamePrompt, setShowNamePrompt] = useState(!userName);

  const t = translations[lang];

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const refreshCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    setCampaignsError(false);
    try {
      const data = await apiRequest('/api/campaigns');
      setCampaigns(Array.isArray(data) ? data.map(normalizeCampaign) : []);
    } catch {
      setCampaigns([]);
      setCampaignsError(true);
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCampaigns();
  }, [refreshCampaigns]);

  useEffect(() => {
    if (!userName?.trim() || !memberKey) return;
    let cancelled = false;
    apiRequest('/api/members/upsert', {
      method: 'POST',
      body: JSON.stringify({ member_key: memberKey, display_name: userName.trim() }),
    })
      .then(profile => {
        if (!cancelled && profile?.plan) setMemberPlan(profile.plan);
      })
      .catch(() => {
        // Phase 1 remains usable even if the Phase 2 migration has not been run yet.
      });
    return () => { cancelled = true; };
  }, [memberKey, userName]);

  const toggleLang = () => setLang(prev => prev === 'en' ? 'af' : 'en');

  const addCampaign = async (campaign) => {
    try {
      await apiRequest('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          ...campaign,
          creator: userName || 'Anonymous We-Rise Lady',
        }),
      });
      await refreshCampaigns();
      showToast(lang === 'en' ? 'Campaign launched! 🎉' : 'Veldtog gelanseer! 🎉');
      return true;
    } catch {
      showToast(lang === 'en'
        ? 'Could not save the campaign. Make sure the We-Rise API is running.'
        : 'Kon nie die veldtog stoor nie. Maak seker die We-Rise API loop.');
      return false;
    }
  };

  const handleDonate = async (campaignId, amount, donorName) => {
    try {
      await apiRequest(`/api/campaigns/${campaignId}/donate`, {
        method: 'POST',
        body: JSON.stringify({ amount, donor: donorName || userName || 'Anonymous' }),
      });
      await refreshCampaigns();
      showToast(lang === 'en' ? 'Thank you for your support! 💗' : 'Dankie vir jou ondersteuning! 💗');
      return true;
    } catch {
      showToast(lang === 'en'
        ? 'Donation could not be recorded. Please try again.'
        : 'Die skenking kon nie aangeteken word nie. Probeer asseblief weer.');
      return false;
    }
  };

  const saveName = (name) => {
    const clean = name.trim();
    if (!clean) return;
    try { localStorage.setItem('werise_name', clean); } catch {}
    setUserName(clean);
    setShowNamePrompt(false);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo-icon">W</div>
          <span className="app-logo">We-Rise</span>
        </div>
        <button className="lang-toggle" onClick={toggleLang} aria-label="Toggle language">
          {lang === 'en' ? 'AF' : 'EN'}
        </button>
      </header>

      <main className="main-content">
        {activeTab === 'home' && <Home t={t} lang={lang} onNavigate={setActiveTab} userName={userName} campaigns={campaigns} />}
        {activeTab === 'ai' && <AiAssistant t={t} lang={lang} userName={userName} />}
        {activeTab === 'backmi' && (
          <BackMi
            t={t}
            lang={lang}
            campaigns={campaigns}
            campaignsLoading={campaignsLoading}
            campaignsError={campaignsError}
            onRetryCampaigns={refreshCampaigns}
            onAddCampaign={addCampaign}
            onDonate={handleDonate}
            showToast={showToast}
          />
        )}
        {activeTab === 'community' && (
          <Community
            t={t}
            lang={lang}
            showToast={showToast}
            userName={userName}
            memberKey={memberKey}
            onConversationChange={setCommunityConversationOpen}
          />
        )}
        {activeTab === 'messages' && (
          <Messages
            lang={lang}
            showToast={showToast}
            userName={userName}
            memberKey={memberKey}
            memberPlan={memberPlan}
            onConversationChange={setMessageConversationOpen}
          />
        )}
        {activeTab === 'vision' && <VisionBoard t={t} lang={lang} showToast={showToast} />}
        {activeTab === 'wellness' && <Wellness t={t} lang={lang} showToast={showToast} />}
        {activeTab === 'safety' && <Safety t={t} lang={lang} showToast={showToast} />}
        {activeTab === 'journal' && <Journal t={t} lang={lang} showToast={showToast} />}
        {activeTab === 'resell' && <ResellProgram t={t} lang={lang} showToast={showToast} />}

        {!((activeTab === 'community' && communityConversationOpen) || (activeTab === 'messages' && messageConversationOpen)) && <Footer t={t} />}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={(e) => {
                setActiveTab(tab.id);
                e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
              }}
            >
              <Icon />
              <span>{t[tab.labelKey]}</span>
            </button>
          );
        })}
      </nav>

      {toast && <div className="toast">{toast}</div>}

      {showNamePrompt && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">💗</div>
            <h3 className="modal-title">{t.namePrompt}</h3>
            <p className="modal-desc">{t.namePromptDesc}</p>
            <input
              className="modal-input"
              placeholder={t.namePlaceholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName(e.currentTarget.value);
              }}
            />
            <button
              className="btn btn-primary btn-full"
              onClick={() => {
                const input = document.querySelector('.modal-input');
                if (input) saveName(input.value);
              }}
            >
              {t.nameSave}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
