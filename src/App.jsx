import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiHome, HiSparkles, HiHeart, HiUsers, HiCurrencyDollar, HiPencil, HiShieldCheck, HiStar, HiEmojiHappy, HiChatAlt2, HiUserAdd, HiLockClosed, HiLogout, HiTrendingUp, HiCreditCard
} from 'react-icons/hi';
import translations from './i18n/translations';
import { apiRequest, submitPayFastCheckout } from './lib/api';
import { authConfigured, supabase } from './lib/supabase';
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
import Wealth from './components/Wealth';
import Footer from './components/Footer';
import Waitlist from './components/Waitlist';
import AuthModal from './components/AuthModal';
import FeatureLock from './components/FeatureLock';
import Manifesto from './components/Manifesto';
import MembershipLock from './components/MembershipLock';
import Billing from './components/Billing';
import BrandMark from './components/BrandMark';

const TABS = [
  { id: 'home', icon: HiHome, labelKey: 'home', public: true },
  { id: 'ai', icon: HiSparkles, labelKey: 'aiAssistant' },
  { id: 'journal', icon: HiPencil, labelKey: 'journalTitle' },
  { id: 'vision', icon: HiStar, labelKey: 'visionTitle' },
  { id: 'wellness', icon: HiEmojiHappy, labelKey: 'wellnessTitle' },
  { id: 'wealth', icon: HiTrendingUp, labelKey: 'wealthTitle' },
  { id: 'safety', icon: HiShieldCheck, labelKey: 'safetyTitle' },
  { id: 'backmi', icon: HiHeart, labelKey: 'backMi', public: true },
  { id: 'membership', icon: HiCreditCard, labelKey: 'membership' },
  { id: 'community', icon: HiUsers, labelKey: 'community', public: true },
  { id: 'messages', icon: HiChatAlt2, labelKey: 'messages' },
  { id: 'waitlist', icon: HiUserAdd, labelKey: 'waitlist', public: true },
  { id: 'resell', icon: HiCurrencyDollar, labelKey: 'resell' },
];

const PROTECTED_FEATURE_COPY = {
  ai: { en: 'We-Rise AI Assistant', af: 'We-Rise KI Assistent' },
  journal: { en: 'Personal Journal', af: 'Persoonlike Joernaal' },
  vision: { en: 'Vision Board', af: 'Visiebord' },
  wellness: { en: 'Wellness', af: 'Welstand' },
  wealth: { en: 'Wealth', af: 'Welvaart' },
  safety: { en: 'Safety & Emergency Network', af: 'Veiligheid & Noodnetwerk' },
  messages: { en: 'Private Messages', af: 'Privaat Boodskappe' },
  resell: { en: 'We-Rise Resellers', af: 'We-Rise Resellers' },
};

const normalizeCampaign = (campaign) => ({
  ...campaign,
  goal: Number(campaign.goal || 0),
  raised: Number(campaign.raised || 0),
  backers: Number(campaign.backers || 0),
  creator: campaign.creator || 'Anonymous We-Rise Lady',
  createdAt: campaign.createdAt || campaign.created_at || new Date().toISOString(),
  donations: (campaign.donations || []).map(d => ({ ...d, amount: Number(d.amount || 0) })),
  dailyDonations: (campaign.dailyDonations || campaign.donations || []).map(d => ({ ...d, amount: Number(d.amount || 0) })),
  reason: campaign.reason || '',
  category: campaign.category || '',
  explanation: campaign.explanation || '',
  country: campaign.country || '',
  age: campaign.age ? Number(campaign.age) : null,
  deadline: campaign.deadline || null,
  status: campaign.status || 'active',
});

function fallbackName(user) {
  const metaName = String(user?.user_metadata?.display_name || user?.user_metadata?.full_name || '').trim();
  if (metaName) return metaName;
  const email = String(user?.email || '').trim();
  return email ? email.split('@')[0] : '';
}

export default function App() {
  const [lang, setLang] = useState('en');
  const [activeTab, setActiveTab] = useState('home');
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState(false);
  const [toast, setToast] = useState(null);
  const [communityConversationOpen, setCommunityConversationOpen] = useState(false);
  const [messageConversationOpen, setMessageConversationOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!authConfigured);
  const [profile, setProfile] = useState(null);
  const [membership, setMembership] = useState(null);
  const [authModal, setAuthModal] = useState({ open: false, mode: 'login' });

  const t = translations[lang];
  const user = session?.user || null;
  const isAuthenticated = Boolean(user?.id && session?.access_token);
  const memberKey = user?.id || '';
  const userName = profile?.display_name || fallbackName(user);
  const memberPlan = profile?.plan || 'free';
  const hasMemberAccess = Boolean(isAuthenticated && membership?.access_allowed);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const openAuth = useCallback((mode = 'login') => {
    setAuthModal({ open: true, mode });
  }, []);

  const requireAuth = useCallback(() => {
    if (isAuthenticated) return true;
    openAuth('login');
    showToast(lang === 'en' ? 'Log in to use this We-Rise feature.' : 'Meld aan om hierdie We-Rise funksie te gebruik.');
    return false;
  }, [isAuthenticated, lang, openAuth, showToast]);

  const requireMemberAccess = useCallback(() => {
    if (!requireAuth()) return false;
    if (membership?.access_allowed) return true;
    setActiveTab('membership');
    showToast(lang === 'en' ? 'Your We-Rise membership needs attention.' : 'Jou We-Rise-lidmaatskap kort aandag.');
    return false;
  }, [lang, membership?.access_allowed, requireAuth, showToast]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session || null);
      setAuthReady(true);
    }).catch(() => {
      if (mounted) setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession || null);
      setAuthReady(true);
      if (event === 'PASSWORD_RECOVERY') {
        setAuthModal({ open: true, mode: 'reset' });
      }
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setMembership(null);
        setActiveTab('home');
      }
    });

    return () => {
      mounted = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.access_token) {
      setProfile(null);
      setMembership(null);
      return;
    }
    try {
      const data = await apiRequest('/api/auth/profile', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setProfile(data?.profile || null);
      setMembership(data?.membership || null);
    } catch (error) {
      if (error?.status === 401) {
        setProfile(null);
        setMembership(null);
      }
    }
  }, [session?.access_token]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

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
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (!payment) return;
    const paymentKind = params.get('kind');
    setActiveTab(paymentKind === 'backmi' ? 'backmi' : 'membership');
    showToast(payment === 'success'
      ? (paymentKind === 'backmi'
        ? (lang === 'en' ? 'PayFast returned you to BackMi. The gift will appear after secure confirmation.' : 'PayFast het jou na BackMi teruggestuur. Die geskenk sal ná veilige bevestiging verskyn.')
        : (lang === 'en' ? 'PayFast returned you to We-Rise. We are waiting for secure payment confirmation.' : 'PayFast het jou na We-Rise teruggestuur. Ons wag vir die veilige betalingsbevestiging.'))
      : (lang === 'en' ? 'The PayFast checkout was cancelled. No payment is recorded.' : 'Die PayFast-betaling is gekanselleer. Geen betaling is aangeteken nie.'));
    window.history.replaceState({}, document.title, window.location.pathname);
    if (payment === 'success') {
      window.setTimeout(refreshProfile, 2000);
      window.setTimeout(refreshProfile, 5000);
      if (paymentKind === 'backmi') {
        window.setTimeout(refreshCampaigns, 2000);
        window.setTimeout(refreshCampaigns, 5000);
      }
    }
  }, [lang, refreshCampaigns, refreshProfile, showToast]);

  const toggleLang = () => setLang(prev => prev === 'en' ? 'af' : 'en');

  const addCampaign = async (campaign) => {
    if (!requireMemberAccess()) return false;
    try {
      const created = await apiRequest('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(campaign),
      });
      showToast(lang === 'en' ? `Request ${created.request_code} was submitted privately for review.` : `Versoek ${created.request_code} is privaat ingedien vir beoordeling.`);
      return created;
    } catch (error) {
      if (error?.status === 401) openAuth('login');
      showToast(error?.message || (lang === 'en' ? 'Could not save the campaign.' : 'Kon nie die veldtog stoor nie.'));
      return false;
    }
  };

  const handleDonate = async (campaignId, amount) => {
    if (!requireMemberAccess()) return false;
    try {
      const checkout = await apiRequest(`/api/backmi/requests/${campaignId}/gift-checkout`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      submitPayFastCheckout(checkout);
      return true;
    } catch (error) {
      if (error?.status === 401) openAuth('login');
      showToast(error?.message || (lang === 'en' ? 'The voluntary gift checkout could not start.' : 'Die vrywillige geskenkbetaling kon nie begin nie.'));
      return false;
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      showToast(lang === 'en' ? 'You have been logged out.' : 'Jy is afgemeld.');
    } catch {
      showToast(lang === 'en' ? 'Could not log out.' : 'Kon nie afmeld nie.');
    }
  };

  const protectedContent = useMemo(() => {
    const feature = PROTECTED_FEATURE_COPY[activeTab]?.[lang] || t[TABS.find(item => item.id === activeTab)?.labelKey] || 'We-Rise';
    return (
      <FeatureLock
        lang={lang}
        feature={feature}
        onLogin={() => openAuth('login')}
        onRegister={() => openAuth('register')}
      />
    );
  }, [activeTab, lang, openAuth, t]);

  const membershipLockedContent = useMemo(() => {
    const feature = PROTECTED_FEATURE_COPY[activeTab]?.[lang] || t[TABS.find(item => item.id === activeTab)?.labelKey] || 'We-Rise';
    return <MembershipLock lang={lang} feature={feature} membership={membership} onMembership={() => setActiveTab('membership')} />;
  }, [activeTab, lang, membership, t]);

  const renderPrivateFeature = (content) => !isAuthenticated ? protectedContent : hasMemberAccess ? content : membershipLockedContent;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-left">
          <BrandMark variant="compact" className="app-logo-icon" />
          <span className="app-logo">We-Rise</span>
        </div>
        <div className="app-header-actions">
          <button className="lang-toggle" onClick={toggleLang} aria-label="Toggle language">
            {lang === 'en' ? 'AF' : 'EN'}
          </button>
          {authReady && (isAuthenticated ? (
            <div className="header-member-wrap">
              <div className="header-member-chip" title={user?.email || ''}>
                <span className="header-member-avatar">{String(userName || 'W').trim().charAt(0).toUpperCase()}</span>
                <span className="header-member-name">{userName || (lang === 'en' ? 'Member' : 'Lid')}</span>
              </div>
              <button className="header-logout" onClick={signOut} aria-label={lang === 'en' ? 'Log out' : 'Meld af'} title={lang === 'en' ? 'Log out' : 'Meld af'}><HiLogout /></button>
            </div>
          ) : (
            <button className="header-login" onClick={() => openAuth('login')}><HiLockClosed /> {lang === 'en' ? 'Log in' : 'Meld aan'}</button>
          ))}
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'home' && (
          <Home
            t={t}
            lang={lang}
            onNavigate={setActiveTab}
            userName={userName}
            campaigns={campaigns}
            isAuthenticated={isAuthenticated}
            onLogin={() => openAuth('login')}
            onRegister={() => openAuth('register')}
          />
        )}

        {activeTab === 'ai' && renderPrivateFeature(<AiAssistant t={t} lang={lang} userName={userName} />)}

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
            isAuthenticated={isAuthenticated}
            hasMemberAccess={hasMemberAccess}
            profile={profile}
            onRequireAuth={() => requireAuth()}
            onRequireMembership={() => setActiveTab('membership')}
          />
        )}

        {activeTab === 'membership' && (isAuthenticated ? (
          <Billing
            lang={lang}
            membership={membership}
            profile={profile}
            showToast={showToast}
            onRefreshProfile={refreshProfile}
          />
        ) : protectedContent)}

        {activeTab === 'community' && (
          <Community
            t={t}
            lang={lang}
            showToast={showToast}
            userName={userName}
            memberKey={memberKey}
            isAuthenticated={hasMemberAccess}
            onRequireAuth={() => requireMemberAccess()}
            onConversationChange={setCommunityConversationOpen}
          />
        )}

        {activeTab === 'messages' && renderPrivateFeature(
          <Messages
            lang={lang}
            showToast={showToast}
            userName={userName}
            memberKey={memberKey}
            memberPlan={memberPlan}
            onConversationChange={setMessageConversationOpen}
          />
        )}

        {activeTab === 'vision' && renderPrivateFeature(<VisionBoard t={t} lang={lang} showToast={showToast} />)}
        {activeTab === 'wellness' && renderPrivateFeature(<Wellness t={t} lang={lang} showToast={showToast} />)}
        {activeTab === 'wealth' && renderPrivateFeature(<Wealth lang={lang} showToast={showToast} />)}
        {activeTab === 'safety' && renderPrivateFeature(<Safety t={t} lang={lang} showToast={showToast} memberKey={memberKey} userName={userName} />)}
        {activeTab === 'journal' && renderPrivateFeature(<Journal t={t} lang={lang} showToast={showToast} />)}
        {activeTab === 'waitlist' && <Waitlist lang={lang} userName={userName} showToast={showToast} />}
        {activeTab === 'resell' && renderPrivateFeature(<ResellProgram t={t} lang={lang} showToast={showToast} />)}

        {!((activeTab === 'community' && communityConversationOpen) || (activeTab === 'messages' && messageConversationOpen && isAuthenticated)) && <Footer t={t} />}
      </main>

      <Manifesto />

      <nav className="bottom-nav" aria-label="Main navigation">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const locked = !tab.public && (!isAuthenticated || (tab.id !== 'membership' && !hasMemberAccess));
          return (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''} ${locked ? 'nav-item-locked' : ''}`}
              onClick={(e) => {
                setActiveTab(tab.id);
                e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
              }}
            >
              <span className="nav-icon-wrap"><Icon />{locked && <HiLockClosed className="nav-lock-dot" />}</span>
              <span>{t[tab.labelKey]}</span>
            </button>
          );
        })}
      </nav>

      {toast && <div className="toast">{toast}</div>}

      <AuthModal
        open={authModal.open}
        mode={authModal.mode}
        lang={lang}
        onClose={() => setAuthModal(current => ({ ...current, open: false }))}
      />
    </div>
  );
}
