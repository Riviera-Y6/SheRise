import React, { useState, useEffect } from 'react';
import { HiShieldCheck, HiPhone, HiLocationMarker, HiUserGroup, HiLightBulb, HiCheckCircle, HiExclamation, HiHeart } from 'react-icons/hi';

export default function Safety({ t, lang, showToast }) {
  const [activeSection, setActiveSection] = useState('main');
  const [trustedContacts, setTrustedContacts] = useState(() => {
    try {
      const saved = localStorage.getItem('werise_trusted') || localStorage.getItem('sherise_trusted');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '' });
  const [panicActive, setPanicActive] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(() => {
    try { return localStorage.getItem('werise_last_checkin') || ''; }
    catch { return ''; }
  });
  const todayKey = new Date().toISOString().slice(0, 10);
  const checkInActive = lastCheckIn === todayKey;

  useEffect(() => {
    localStorage.setItem('werise_trusted', JSON.stringify(trustedContacts));
  }, [trustedContacts]);

  const emergencyNumbers = [
    { country: lang === 'en' ? 'South Africa' : 'Suid-Afrika', numbers: [
      { name: lang === 'en' ? 'Cellphone Emergency' : 'Selfoonnood', number: '112' },
      { name: lang === 'en' ? 'Police' : 'Polisie', number: '10111' },
      { name: lang === 'en' ? 'Ambulance' : 'Ambulans', number: '10177' },
      { name: lang === 'en' ? 'Gender-Based Violence Command Centre' : 'Geslagsgeweld Command Centre', number: '0800 428 428' },
      { name: lang === 'en' ? 'Suicide Crisis Line' : 'Selfmoordkrisislyn', number: '0800 567 567' },
      { name: 'Childline', number: '116' },
    ]},
  ];

  const safetyTips = [
    {
      icon: <HiLocationMarker />,
      title: lang === 'en' ? 'Share Your Location' : 'Deel Jou Ligging',
      desc: lang === 'en' ? 'Share your live location with a trusted contact when going out.' : 'Deel jou regstreekse ligging met n vertroude kontak wanneer jy uitgaan.',
    },
    {
      icon: <HiPhone />,
      title: lang === 'en' ? 'Emergency Speed Dial' : 'Nood Vinnige Skakel',
      desc: lang === 'en' ? 'Save emergency numbers to your speed dial for quick access.' : 'Stoor noodnommers op jou vinnige skakel vir vinnige toegang.',
    },
    {
      icon: <HiUserGroup />,
      title: lang === 'en' ? 'Buddy System' : 'Maatjies Stelsel',
      desc: lang === 'en' ? 'Always let someone know where you are going and when you arrive.' : 'Laat altyd iemand weet waar jy gaan en wanneer jy aankom.',
    },
    {
      icon: <HiLightBulb />,
      title: lang === 'en' ? 'Trust Your Intuition' : 'Vertrou Jou Intuïsie',
      desc: lang === 'en' ? 'If something feels wrong, it probably is. Remove yourself from the situation.' : 'As iets verkeerd voel, is dit waarskynlik. Verwyder jouself uit die situasie.',
    },
    {
      icon: <HiCheckCircle />,
      title: lang === 'en' ? 'Safe Transport' : 'Veilige Vervoer',
      desc: lang === 'en' ? 'Use verified ride-sharing services and share trip details with a friend.' : 'Gebruik geverifieerde ritdeel-dienste en deel reisbesonderhede met n vriendin.',
    },
    {
      icon: <HiHeart />,
      title: lang === 'en' ? 'Digital Safety' : 'Digitale Veiligheid',
      desc: lang === 'en' ? 'Protect your online presence. Use strong passwords and be mindful of what you share.' : 'Beskerm jou aanlyn-teenwoordigheid. Gebruik sterk wagwoorde en wees bedag op wat jy deel.',
    },
  ];

  const handlePanic = () => {
    if (trustedContacts.length === 0) {
      showToast(lang === 'en'
        ? 'Add a trusted contact first. The panic button cannot send an alert by itself.'
        : 'Voeg eers ’n vertroude kontak by. Die paniekknoppie kan nie op sy eie ’n waarskuwing stuur nie.');
      setActiveSection('trusted');
      return;
    }

    setPanicActive(true);
    const numbers = trustedContacts.map(c => c.phone.replace(/[^0-9+]/g, '')).filter(Boolean);
    const body = encodeURIComponent(lang === 'en'
      ? 'WE-RISE SAFETY ALERT: I need you to check on me. Please contact me as soon as possible.'
      : 'WE-RISE VEILIGHEIDSWAARSKUWING: Ek het nodig dat jy na my omsien. Kontak my asseblief so gou moontlik.');
    const recipient = numbers[0] || '';
    showToast(lang === 'en'
      ? 'Opening your messaging app. Review the alert and tap Send.'
      : 'Maak jou boodskap-app oop. Gaan die waarskuwing na en tik Stuur.');
    window.location.href = `sms:${recipient}?body=${body}`;
    setTimeout(() => setPanicActive(false), 3000);
  };

  const handleCheckIn = () => {
    try { localStorage.setItem('werise_last_checkin', todayKey); } catch {}
    setLastCheckIn(todayKey);
    showToast(lang === 'en' ? '📍 Check-in recorded on this device, We-Rise Lady.' : '📍 Inboek op hierdie toestel aangeteken, We-Rise Lady.');
  };

  const addContact = () => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) return;
    setTrustedContacts(prev => [...prev, { ...contactForm, id: Date.now().toString() }]);
    setContactForm({ name: '', phone: '' });
    setShowAddContact(false);
    showToast(lang === 'en' ? 'Trusted contact added' : 'Vertroude kontak bygevoeg');
  };

  const removeContact = (id) => {
    setTrustedContacts(prev => prev.filter(c => c.id !== id));
    showToast(lang === 'en' ? 'Contact removed' : 'Kontak verwyder');
  };

  if (activeSection === 'emergency') {
    return (
      <div className="fade-in">
        <div className="welcome-hero">
          <h2>🚨 {t.safetyEmergency}</h2>
          <p>{t.safetyEmergencyDesc}</p>
        </div>
        <button className="btn btn-secondary btn-full" onClick={() => setActiveSection('main')} style={{ marginBottom: 16 }}>
          ← {lang === 'en' ? 'Back to Safety Hub' : 'Terug na Veiligheidshub'}
        </button>
        {emergencyNumbers.map((region, i) => (
          <div key={i} className="card" style={{ marginBottom: 12 }}>
            <div className="card-title" style={{ fontSize: 15, marginBottom: 10 }}>{region.country}</div>
            {region.numbers.map((item, j) => (
              <div key={j} className="emergency-number-row">
                <div className="emergency-number-info">
                  <span className="emergency-number-name">{item.name}</span>
                  <span className="emergency-number">{item.number}</span>
                </div>
                <a href={`tel:${item.number.replace(/[^0-9]/g, '')}`} className="btn btn-sm btn-emergency" style={{ textDecoration: 'none' }}>
                  <HiPhone /> {lang === 'en' ? 'Call' : 'Skakel'}
                </a>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (activeSection === 'tips') {
    return (
      <div className="fade-in">
        <div className="welcome-hero">
          <h2>💡 {t.safetyTips}</h2>
          <p>{t.safetyTipsDesc}</p>
        </div>
        <button className="btn btn-secondary btn-full" onClick={() => setActiveSection('main')} style={{ marginBottom: 16 }}>
          ← {lang === 'en' ? 'Back to Safety Hub' : 'Terug na Veiligheidshub'}
        </button>
        {safetyTips.map((tip, i) => (
          <div key={i} className="card safety-tip-card">
            <div className="safety-tip-icon">{tip.icon}</div>
            <div>
              <div className="card-title" style={{ fontSize: 15, marginBottom: 4 }}>{tip.title}</div>
              <div className="card-subtitle" style={{ marginBottom: 0 }}>{tip.desc}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activeSection === 'trusted') {
    return (
      <div className="fade-in">
        <div className="welcome-hero">
          <h2>👥 {t.safetyTrusted}</h2>
          <p>{t.safetyTrustedDesc}</p>
        </div>
        <button className="btn btn-secondary btn-full" onClick={() => setActiveSection('main')} style={{ marginBottom: 16 }}>
          ← {lang === 'en' ? 'Back to Safety Hub' : 'Terug na Veiligheidshub'}
        </button>

        {!showAddContact ? (
          <button className="btn btn-primary btn-full" onClick={() => setShowAddContact(true)} style={{ marginBottom: 16 }}>
            <HiUserGroup /> {lang === 'en' ? 'Add Trusted Contact' : 'Voeg Vertroude Kontak by'}
          </button>
        ) : (
          <div className="card">
            <div className="card-title" style={{ fontSize: 15, marginBottom: 12 }}>
              {lang === 'en' ? 'New Contact' : 'Nuwe Kontak'}
            </div>
            <div className="form-group">
              <label>{lang === 'en' ? 'Name' : 'Naam'}</label>
              <input className="input" value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} placeholder={lang === 'en' ? 'e.g. Thandi' : 'bv. Thandi'} />
            </div>
            <div className="form-group">
              <label>{lang === 'en' ? 'Phone Number' : 'Telefoonnommer'}</label>
              <input className="input" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} placeholder="+27 82 123 4567" type="tel" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary btn-full" onClick={() => setShowAddContact(false)}>
                {t.cancel}
              </button>
              <button className="btn btn-primary btn-full" onClick={addContact} disabled={!contactForm.name.trim() || !contactForm.phone.trim()}>
                {lang === 'en' ? 'Save' : 'Stoor'}
              </button>
            </div>
          </div>
        )}

        {trustedContacts.length === 0 ? (
          <div className="empty-state">
            <HiUserGroup style={{ fontSize: 48, opacity: 0.3 }} />
            <p>{lang === 'en' ? 'No trusted contacts yet. Add someone who can help in an emergency.' : 'Nog geen vertroude kontakte nie. Voeg iemand by wat kan help in n noodgeval.'}</p>
          </div>
        ) : (
          <div className="trusted-contacts-list">
            {trustedContacts.map(contact => (
              <div key={contact.id} className="trusted-contact-card">
                <div className="trusted-contact-avatar">{contact.name.charAt(0).toUpperCase()}</div>
                <div className="trusted-contact-info">
                  <div className="trusted-contact-name">{contact.name}</div>
                  <div className="trusted-contact-phone">{contact.phone}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <a href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`} className="btn btn-sm btn-primary" style={{ textDecoration: 'none', padding: '6px 12px', fontSize: 11 }}>
                    <HiPhone />
                  </a>
                  <button className="btn btn-sm btn-secondary" onClick={() => removeContact(contact.id)} style={{ padding: '6px 12px', fontSize: 11 }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Main safety hub
  return (
    <div className="fade-in">
      <div className="welcome-hero">
        <h2>🛡️ {t.safetyTitle}</h2>
        <p>{t.safetyDesc}</p>
      </div>

      {/* Panic Button */}
      <div className="panic-section">
        <button
          className={`panic-btn ${panicActive ? 'active' : ''}`}
          onClick={handlePanic}
        >
          <HiExclamation />
          <span>{panicActive ? (lang === 'en' ? 'OPENING ALERT...' : 'MAAK WAARSKUWING OOP...') : (lang === 'en' ? 'PANIC BUTTON' : 'PANIEKKNOP')}</span>
        </button>
        <p className="panic-sub">
          {lang === 'en' ? 'Opens an emergency SMS draft to your first trusted contact — you must tap Send' : 'Maak ’n nood-SMS-konsep vir jou eerste vertroude kontak oop — jy moet self Stuur tik'}
        </p>
      </div>

      <div className="card" style={{ background: 'rgba(255, 82, 82, 0.06)', border: '1px solid rgba(255, 82, 82, 0.18)', padding: 14 }}>
        <div className="card-title" style={{ fontSize: 13, marginBottom: 4 }}>
          ⚠️ {lang === 'en' ? 'Important' : 'Belangrik'}
        </div>
        <div className="card-subtitle" style={{ marginBottom: 0, fontSize: 11 }}>
          {lang === 'en'
            ? 'We-Rise does not automatically contact emergency services. The panic button prepares an SMS draft and you must send it from your phone.'
            : 'We-Rise kontak nie nooddienste outomaties nie. Die paniekknoppie berei ’n SMS-konsep voor en jy moet dit self vanaf jou foon stuur.'}
        </div>
      </div>

      {/* Check-in */}
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="card-title" style={{ fontSize: 16 }}>📍 {lang === 'en' ? 'Daily Check-In' : 'Daaglikse Inboek'}</div>
        <div className="card-subtitle">
          {lang === 'en' ? 'Record that you checked in safely today' : 'Teken aan dat jy vandag veilig ingeboek het'}
        </div>
        <button
          className={`btn ${checkInActive ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleCheckIn}
          disabled={checkInActive}
        >
          {checkInActive ? '✅ ' + (lang === 'en' ? 'Checked In Today!' : 'Vandag Ingeboek!') : '📍 ' + (lang === 'en' ? 'Check In Now' : 'Boek Nou In')}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="safety-actions">
        <button className="safety-action-btn" onClick={() => setActiveSection('emergency')}>
          <div className="safety-action-icon" style={{ background: 'rgba(255, 82, 82, 0.15)' }}>
            <HiPhone style={{ color: '#FF5252' }} />
          </div>
          <span className="safety-action-label">{t.safetyEmergency}</span>
          <span className="safety-action-arrow">→</span>
        </button>
        <button className="safety-action-btn" onClick={() => setActiveSection('tips')}>
          <div className="safety-action-icon" style={{ background: 'rgba(255, 193, 7, 0.15)' }}>
            <HiLightBulb style={{ color: '#FFC107' }} />
          </div>
          <span className="safety-action-label">{t.safetyTips}</span>
          <span className="safety-action-arrow">→</span>
        </button>
        <button className="safety-action-btn" onClick={() => setActiveSection('trusted')}>
          <div className="safety-action-icon" style={{ background: 'rgba(76, 175, 80, 0.15)' }}>
            <HiUserGroup style={{ color: '#4CAF50' }} />
          </div>
          <span className="safety-action-label">{t.safetyTrusted}</span>
          <span className="safety-action-arrow">→</span>
        </button>
      </div>

      {/* Quick reminder */}
      <div className="card" style={{ background: 'rgba(255, 105, 180, 0.05)', border: '1px solid rgba(255, 105, 180, 0.2)' }}>
        <div className="card-title" style={{ fontSize: 14, marginBottom: 4 }}>💗 {lang === 'en' ? 'You are not alone' : 'Jy is nie alleen nie'}</div>
        <div className="card-subtitle" style={{ marginBottom: 0, fontSize: 12 }}>
          {lang === 'en' ? 'We-Rise is here to help you find support and trusted contacts.' : 'We-Rise help jou om ondersteuning en vertroude kontakte te vind.'}
        </div>
      </div>
    </div>
  );
}