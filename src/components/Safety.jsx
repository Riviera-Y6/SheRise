import React, { useEffect, useMemo, useState } from 'react';
import {
  HiShieldCheck, HiPhone, HiLocationMarker, HiUserGroup, HiLightBulb, HiCheckCircle,
  HiExclamation, HiHeart, HiBell, HiPlus, HiTrash, HiRefresh, HiExternalLink
} from 'react-icons/hi';
import { apiRequest } from '../lib/api';

export default function Safety({ t, lang, showToast, memberKey, userName }) {
  const [activeSection, setActiveSection] = useState('main');
  const [trustedContacts, setTrustedContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', relation: '' });
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertResult, setAlertResult] = useState(null);
  const [locationText, setLocationText] = useState('');
  const [coordinates, setCoordinates] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(() => {
    try { return localStorage.getItem('werise_last_checkin') || ''; }
    catch { return ''; }
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const checkInActive = lastCheckIn === todayKey;
  const canAddMore = trustedContacts.length < 5;

  const loadContacts = async () => {
    if (!memberKey) return;
    setContactsLoading(true);
    try {
      const data = await apiRequest(`/api/emergency-contacts?member_key=${encodeURIComponent(memberKey)}`);
      setTrustedContacts(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.message || (lang === 'en' ? 'Could not load emergency contacts.' : 'Kon nie noodkontakte laai nie.'));
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => { loadContacts(); }, [memberKey]);

  const emergencyNumbers = useMemo(() => ([
    { country: lang === 'en' ? 'South Africa' : 'Suid-Afrika', numbers: [
      { name: lang === 'en' ? 'Cellphone Emergency' : 'Selfoonnood', number: '112' },
      { name: lang === 'en' ? 'Police' : 'Polisie', number: '10111' },
      { name: lang === 'en' ? 'Ambulance' : 'Ambulans', number: '10177' },
      { name: lang === 'en' ? 'Gender-Based Violence Command Centre' : 'Geslagsgeweld Command Centre', number: '0800 428 428' },
      { name: 'Childline', number: '116' },
    ]},
  ]), [lang]);

  const safetyTips = [
    { icon: <HiLocationMarker />, title: lang === 'en' ? 'Share Your Location' : 'Deel Jou Ligging', desc: lang === 'en' ? 'Share your live location with a trusted contact when going out.' : 'Deel jou regstreekse ligging met ’n vertroude kontak wanneer jy uitgaan.' },
    { icon: <HiPhone />, title: lang === 'en' ? 'Emergency Speed Dial' : 'Nood Vinnige Skakel', desc: lang === 'en' ? 'Save emergency numbers to your speed dial for quick access.' : 'Stoor noodnommers op jou vinnige skakel vir vinnige toegang.' },
    { icon: <HiUserGroup />, title: lang === 'en' ? 'Buddy System' : 'Maatjies Stelsel', desc: lang === 'en' ? 'Always let someone know where you are going and when you arrive.' : 'Laat altyd iemand weet waar jy gaan en wanneer jy aankom.' },
    { icon: <HiLightBulb />, title: lang === 'en' ? 'Trust Your Intuition' : 'Vertrou Jou Intuïsie', desc: lang === 'en' ? 'If something feels wrong, move to a safer place and contact someone you trust.' : 'As iets verkeerd voel, beweeg na ’n veiliger plek en kontak iemand wat jy vertrou.' },
    { icon: <HiHeart />, title: lang === 'en' ? 'Digital Safety' : 'Digitale Veiligheid', desc: lang === 'en' ? 'Use strong passwords and be careful about location information you share publicly.' : 'Gebruik sterk wagwoorde en wees versigtig met ligginginligting wat jy openbaar deel.' },
  ];

  const addContact = async () => {
    if (!canAddMore) {
      showToast(lang === 'en' ? 'You can save a maximum of 5 emergency contacts.' : 'Jy kan maksimum 5 noodkontakte stoor.');
      return;
    }
    if (!contactForm.name.trim() || !contactForm.phone.trim()) return;
    try {
      await apiRequest('/api/emergency-contacts', {
        method: 'POST',
        body: JSON.stringify({
          member_key: memberKey,
          name: contactForm.name.trim(),
          phone: contactForm.phone.trim(),
          relation: contactForm.relation.trim(),
          display_name: userName || 'We-Rise member',
        }),
      });
      setContactForm({ name: '', phone: '', relation: '' });
      setShowAddContact(false);
      await loadContacts();
      showToast(lang === 'en' ? 'Emergency contact saved.' : 'Noodkontak gestoor.');
    } catch (error) {
      showToast(error?.message || (lang === 'en' ? 'Could not save contact.' : 'Kon nie kontak stoor nie.'));
    }
  };

  const removeContact = async (id) => {
    try {
      await apiRequest(`/api/emergency-contacts/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ member_key: memberKey }),
      });
      setTrustedContacts(prev => prev.filter(c => c.id !== id));
      showToast(lang === 'en' ? 'Contact removed.' : 'Kontak verwyder.');
    } catch (error) {
      showToast(error?.message || (lang === 'en' ? 'Could not remove contact.' : 'Kon nie kontak verwyder nie.'));
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      showToast(lang === 'en' ? 'Location is not available in this browser. Enter it manually.' : 'Ligging is nie in hierdie blaaier beskikbaar nie. Tik dit handmatig in.');
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        const latitude = Number(position.coords.latitude.toFixed(6));
        const longitude = Number(position.coords.longitude.toFixed(6));
        setCoordinates({ latitude, longitude });
        if (!locationText.trim()) setLocationText(`${latitude}, ${longitude}`);
        setLocationLoading(false);
        showToast(lang === 'en' ? 'Current location added.' : 'Huidige ligging bygevoeg.');
      },
      () => {
        setLocationLoading(false);
        showToast(lang === 'en' ? 'We could not access your location. You can enter it manually.' : 'Ons kon nie jou ligging kry nie. Jy kan dit handmatig intik.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const sendEmergencyAlert = async () => {
    if (trustedContacts.length === 0) {
      showToast(lang === 'en' ? 'Add at least one emergency contact first.' : 'Voeg eers ten minste een noodkontak by.');
      setActiveSection('trusted');
      return;
    }
    setAlertLoading(true);
    setAlertResult(null);
    try {
      const result = await apiRequest('/api/emergency-alerts', {
        method: 'POST',
        body: JSON.stringify({
          member_key: memberKey,
          name: userName || 'We-Rise member',
          location_text: locationText.trim(),
          latitude: coordinates?.latitude ?? null,
          longitude: coordinates?.longitude ?? null,
        }),
      });
      setAlertResult(result);
      if (result?.sms_configured && Number(result?.sent_count || 0) > 0) {
        showToast(lang === 'en' ? `Alert submitted to ${result.sent_count} contact(s).` : `Waarskuwing aan ${result.sent_count} kontak(te) voorgelê.`);
      } else {
        showToast(lang === 'en' ? 'Emergency alert prepared. Automatic SMS is not configured yet — use the message buttons below.' : 'Noodwaarskuwing voorberei. Outomatiese SMS is nog nie gekonfigureer nie — gebruik die boodskapknoppies hieronder.');
      }
    } catch (error) {
      showToast(error?.message || (lang === 'en' ? 'Could not prepare the emergency alert.' : 'Kon nie die noodwaarskuwing voorberei nie.'));
    } finally {
      setAlertLoading(false);
    }
  };

  const handleCheckIn = () => {
    try { localStorage.setItem('werise_last_checkin', todayKey); } catch {}
    setLastCheckIn(todayKey);
    showToast(lang === 'en' ? '📍 Check-in recorded on this device.' : '📍 Inboek op hierdie toestel aangeteken.');
  };

  const fallbackSmsHref = (contact) => {
    const phone = String(contact.phone || '').replace(/[^0-9+]/g, '');
    const body = encodeURIComponent(alertResult?.message_text || (lang === 'en'
      ? `WE-RISE SAFETY ALERT: ${userName || 'A We-Rise member'} needs you to check on her. ${locationText ? `Location: ${locationText}` : ''}`
      : `WE-RISE VEILIGHEIDSWAARSKUWING: ${userName || '’n We-Rise lid'} het nodig dat jy na haar omsien. ${locationText ? `Ligging: ${locationText}` : ''}`));
    return `sms:${phone}?body=${body}`;
  };

  if (activeSection === 'alert') {
    return (
      <div className="fade-in safety-alert-page">
        <button className="btn btn-secondary btn-full" onClick={() => { setActiveSection('main'); setAlertResult(null); }} style={{ marginBottom: 16 }}>← {lang === 'en' ? 'Back to Safety Hub' : 'Terug na Veiligheidshub'}</button>
        <div className="emergency-alert-hero">
          <div className="emergency-alert-symbol"><HiExclamation /></div>
          <div>
            <div className="eyebrow danger">{lang === 'en' ? 'EMERGENCY SYSTEM' : 'NOODSTELSEL'}</div>
            <h2>{lang === 'en' ? 'Alert your trusted people' : 'Waarsku jou vertroude mense'}</h2>
            <p>{lang === 'en' ? 'One action prepares an alert for up to 5 trusted contacts. Add your location so they know where to look for you.' : 'Een aksie berei ’n waarskuwing vir tot 5 vertroude kontakte voor. Voeg jou ligging by sodat hulle weet waar om jou te soek.'}</p>
          </div>
        </div>

        <div className="card emergency-alert-card">
          <div className="emergency-location-block">
            <label>{lang === 'en' ? 'Your Location (optional)' : 'Jou Ligging (opsioneel)'}</label>
            <div className="emergency-location-row">
              <input className="input" value={locationText} onChange={e => { setLocationText(e.target.value); setCoordinates(null); }} placeholder={lang === 'en' ? 'e.g. Menlyn, Pretoria or use current location' : 'bv. Menlyn, Pretoria of gebruik huidige ligging'} />
              <button className="btn btn-secondary btn-sm" onClick={requestLocation} disabled={locationLoading}><HiLocationMarker /> {locationLoading ? '...' : (lang === 'en' ? 'Locate me' : 'Vind my')}</button>
            </div>
            {coordinates && <div className="coordinate-chip"><HiLocationMarker /> {coordinates.latitude}, {coordinates.longitude}</div>}
          </div>

          <div className="emergency-contact-heading">
            <span>{lang === 'en' ? 'Emergency contacts' : 'Noodkontakte'}</span>
            <strong>{trustedContacts.length}/5</strong>
          </div>
          <div className="emergency-contact-stack">
            {trustedContacts.map((contact, index) => (
              <div key={contact.id} className="emergency-contact-preview">
                <div className="emergency-contact-number">{index + 1}</div>
                <div className="trusted-contact-info">
                  <div className="trusted-contact-name">{contact.name}</div>
                  <div className="trusted-contact-phone">{contact.relation || (lang === 'en' ? 'Trusted contact' : 'Vertroude kontak')} · {contact.phone}</div>
                </div>
                <HiBell />
              </div>
            ))}
            {trustedContacts.length === 0 && <div className="empty-state compact"><HiUserGroup /><p>{lang === 'en' ? 'No emergency contacts yet.' : 'Nog geen noodkontakte nie.'}</p></div>}
          </div>

          <button className="panic-btn whatnow-panic" onClick={sendEmergencyAlert} disabled={alertLoading || trustedContacts.length === 0}>
            <HiExclamation />
            <span>{alertLoading ? (lang === 'en' ? 'PREPARING ALERT...' : 'BEREI WAARSKUWING VOOR...') : (lang === 'en' ? 'SEND EMERGENCY ALERT' : 'STUUR NOODWAARSKUWING')}</span>
          </button>

          <div className="safety-disclaimer">
            <HiShieldCheck />
            <span>{lang === 'en'
              ? 'We-Rise is a support tool, not an emergency-service replacement. Automatic SMS delivery only occurs when the server SMS provider is configured; otherwise We-Rise will give you ready-to-send SMS buttons.'
              : 'We-Rise is ’n ondersteuningshulpmiddel, nie ’n plaasvervanger vir nooddienste nie. Outomatiese SMS-aflewering gebeur slegs wanneer die bediener se SMS-verskaffer gekonfigureer is; anders gee We-Rise vir jou gereed-om-te-stuur SMS-knoppies.'}</span>
          </div>
        </div>

        {alertResult && (
          <div className={`card alert-result-card ${alertResult.sms_configured ? 'configured' : 'manual'}`}>
            <div className="alert-result-title">
              {alertResult.sms_configured ? <HiCheckCircle /> : <HiExclamation />}
              <div>
                <strong>{alertResult.sms_configured ? (lang === 'en' ? 'Alert request processed' : 'Waarskuwingsversoek verwerk') : (lang === 'en' ? 'Manual send required' : 'Handmatige stuur benodig')}</strong>
                <span>{alertResult.sms_configured
                  ? (lang === 'en' ? `${alertResult.sent_count || 0} of ${alertResult.contact_count || 0} SMS requests were accepted by the SMS provider.` : `${alertResult.sent_count || 0} van ${alertResult.contact_count || 0} SMS-versoeke is deur die SMS-verskaffer aanvaar.`)
                  : (lang === 'en' ? 'Automatic SMS is not configured on Render yet. Tap each contact below and then tap Send in your phone messaging app.' : 'Outomatiese SMS is nog nie op Render gekonfigureer nie. Tik elke kontak hieronder en tik dan Stuur in jou foon se boodskap-app.')}</span>
              </div>
            </div>
            {!alertResult.sms_configured && trustedContacts.map(contact => (
              <a key={contact.id} className="btn btn-secondary btn-full manual-sms-button" href={fallbackSmsHref(contact)}>
                <HiPhone /> {lang === 'en' ? `Message ${contact.name}` : `Boodskap ${contact.name}`} <HiExternalLink />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeSection === 'emergency') {
    return (
      <div className="fade-in">
        <div className="welcome-hero"><h2>🚨 {t.safetyEmergency}</h2><p>{t.safetyEmergencyDesc}</p></div>
        <button className="btn btn-secondary btn-full" onClick={() => setActiveSection('main')} style={{ marginBottom: 16 }}>← {lang === 'en' ? 'Back to Safety Hub' : 'Terug na Veiligheidshub'}</button>
        {emergencyNumbers.map((region, i) => (
          <div key={i} className="card" style={{ marginBottom: 12 }}>
            <div className="card-title" style={{ fontSize: 15, marginBottom: 10 }}>{region.country}</div>
            {region.numbers.map((item, j) => (
              <div key={j} className="emergency-number-row"><div className="emergency-number-info"><span className="emergency-number-name">{item.name}</span><span className="emergency-number">{item.number}</span></div><a href={`tel:${item.number.replace(/[^0-9]/g, '')}`} className="btn btn-sm btn-emergency" style={{ textDecoration: 'none' }}><HiPhone /> {lang === 'en' ? 'Call' : 'Skakel'}</a></div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (activeSection === 'tips') {
    return (
      <div className="fade-in">
        <div className="welcome-hero"><h2>💡 {t.safetyTips}</h2><p>{t.safetyTipsDesc}</p></div>
        <button className="btn btn-secondary btn-full" onClick={() => setActiveSection('main')} style={{ marginBottom: 16 }}>← {lang === 'en' ? 'Back to Safety Hub' : 'Terug na Veiligheidshub'}</button>
        {safetyTips.map((tip, i) => <div key={i} className="card safety-tip-card"><div className="safety-tip-icon">{tip.icon}</div><div><div className="card-title" style={{ fontSize: 15, marginBottom: 4 }}>{tip.title}</div><div className="card-subtitle" style={{ marginBottom: 0 }}>{tip.desc}</div></div></div>)}
      </div>
    );
  }

  if (activeSection === 'trusted') {
    return (
      <div className="fade-in">
        <div className="welcome-hero"><h2>👥 {lang === 'en' ? 'Your 5 Emergency Contacts' : 'Jou 5 Noodkontakte'}</h2><p>{lang === 'en' ? 'Choose up to five people who should be contacted when you trigger a We-Rise alert.' : 'Kies tot vyf mense wat gekontak moet word wanneer jy ’n We-Rise waarskuwing aktiveer.'}</p></div>
        <button className="btn btn-secondary btn-full" onClick={() => setActiveSection('main')} style={{ marginBottom: 16 }}>← {lang === 'en' ? 'Back to Safety Hub' : 'Terug na Veiligheidshub'}</button>

        <div className="contact-capacity"><HiUserGroup /><span>{lang === 'en' ? 'Trusted network' : 'Vertroude netwerk'}</span><strong>{trustedContacts.length}/5</strong></div>
        {!showAddContact && canAddMore && <button className="btn btn-primary btn-full" onClick={() => setShowAddContact(true)} style={{ marginBottom: 16 }}><HiPlus /> {lang === 'en' ? 'Add Emergency Contact' : 'Voeg Noodkontak by'}</button>}
        {!canAddMore && <div className="card contact-limit-card"><HiCheckCircle /> {lang === 'en' ? 'Your five emergency-contact slots are filled.' : 'Jou vyf noodkontakplekke is gevul.'}</div>}

        {showAddContact && (
          <div className="card">
            <div className="card-title" style={{ fontSize: 15, marginBottom: 12 }}>{lang === 'en' ? 'New Emergency Contact' : 'Nuwe Noodkontak'}</div>
            <div className="form-group"><label>{lang === 'en' ? 'Name' : 'Naam'}</label><input className="input" maxLength={80} value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} placeholder="e.g. David M." /></div>
            <div className="form-group"><label>{lang === 'en' ? 'Relationship' : 'Verhouding'}</label><input className="input" maxLength={80} value={contactForm.relation} onChange={e => setContactForm({ ...contactForm, relation: e.target.value })} placeholder={lang === 'en' ? 'e.g. Brother, neighbour, best friend' : 'bv. Broer, buurvrou, beste vriendin'} /></div>
            <div className="form-group"><label>{lang === 'en' ? 'Phone Number' : 'Telefoonnommer'}</label><input className="input" maxLength={32} value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="+27 82 123 4567" type="tel" /></div>
            <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setShowAddContact(false)}>{t.cancel}</button><button className="btn btn-primary" onClick={addContact} disabled={!contactForm.name.trim() || !contactForm.phone.trim()}>{lang === 'en' ? 'Save Contact' : 'Stoor Kontak'}</button></div>
          </div>
        )}

        {contactsLoading ? <div className="empty-state"><HiRefresh /><p>{lang === 'en' ? 'Loading contacts...' : 'Laai kontakte...'}</p></div> : trustedContacts.length === 0 ? <div className="empty-state"><HiUserGroup /><p>{lang === 'en' ? 'No emergency contacts yet.' : 'Nog geen noodkontakte nie.'}</p></div> : (
          <div className="trusted-contacts-list whatnow-contact-list">
            {trustedContacts.map((contact, index) => (
              <div key={contact.id} className="trusted-contact-card">
                <div className="emergency-contact-number">{index + 1}</div>
                <div className="trusted-contact-info"><div className="trusted-contact-name">{contact.name}</div><div className="trusted-contact-phone">{contact.relation || (lang === 'en' ? 'Trusted contact' : 'Vertroude kontak')} · {contact.phone}</div></div>
                <div className="contact-card-actions"><a href={`tel:${String(contact.phone).replace(/[^0-9+]/g, '')}`} className="btn btn-sm btn-primary"><HiPhone /></a><button className="btn btn-sm btn-secondary" onClick={() => removeContact(contact.id)}><HiTrash /></button></div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="welcome-hero"><h2>🛡️ {t.safetyTitle}</h2><p>{lang === 'en' ? 'Your personal safety hub — five trusted contacts, location-aware alerts, emergency numbers and daily check-ins.' : 'Jou persoonlike veiligheidshub — vyf vertroude kontakte, liggingbewuste waarskuwings, noodnommers en daaglikse inboek.'}</p></div>

      <div className="panic-section upgraded-panic-section">
        <button className="panic-btn" onClick={() => setActiveSection('alert')}><HiExclamation /><span>{lang === 'en' ? 'EMERGENCY ALERT' : 'NOODWAARSKUWING'}</span></button>
        <p className="panic-sub">{lang === 'en' ? `Prepare an alert for your ${trustedContacts.length || 0} saved contact(s), up to a maximum of five.` : `Berei ’n waarskuwing vir jou ${trustedContacts.length || 0} gestoorde kontak(te) voor, tot ’n maksimum van vyf.`}</p>
      </div>

      <div className="card safety-network-summary">
        <div><span className="eyebrow">{lang === 'en' ? 'YOUR SAFETY NET' : 'JOU VEILIGHEIDSNET'}</span><strong>{trustedContacts.length}/5 {lang === 'en' ? 'contacts ready' : 'kontakte gereed'}</strong></div>
        <button className="btn btn-secondary btn-sm" onClick={() => setActiveSection('trusted')}><HiUserGroup /> {lang === 'en' ? 'Manage' : 'Bestuur'}</button>
      </div>

      <div className="card" style={{ textAlign: 'center' }}><div className="card-title" style={{ fontSize: 16 }}>📍 {lang === 'en' ? 'Daily Check-In' : 'Daaglikse Inboek'}</div><div className="card-subtitle">{lang === 'en' ? 'Record that you checked in safely today' : 'Teken aan dat jy vandag veilig ingeboek het'}</div><button className={`btn ${checkInActive ? 'btn-secondary' : 'btn-primary'}`} onClick={handleCheckIn} disabled={checkInActive}>{checkInActive ? '✅ ' + (lang === 'en' ? 'Checked In Today!' : 'Vandag Ingeboek!') : '📍 ' + (lang === 'en' ? 'Check In Now' : 'Boek Nou In')}</button></div>

      <div className="safety-actions">
        <button className="safety-action-btn" onClick={() => setActiveSection('emergency')}><div className="safety-action-icon" style={{ background: 'rgba(255,82,82,.15)' }}><HiPhone style={{ color: '#FF5252' }} /></div><span className="safety-action-label">{t.safetyEmergency}</span><span className="safety-action-arrow">→</span></button>
        <button className="safety-action-btn" onClick={() => setActiveSection('tips')}><div className="safety-action-icon" style={{ background: 'rgba(255,193,7,.15)' }}><HiLightBulb style={{ color: '#FFC107' }} /></div><span className="safety-action-label">{t.safetyTips}</span><span className="safety-action-arrow">→</span></button>
        <button className="safety-action-btn" onClick={() => setActiveSection('trusted')}><div className="safety-action-icon" style={{ background: 'rgba(76,175,80,.15)' }}><HiUserGroup style={{ color: '#4CAF50' }} /></div><span className="safety-action-label">{lang === 'en' ? '5 Emergency Contacts' : '5 Noodkontakte'}</span><span className="safety-action-arrow">→</span></button>
      </div>

      <div className="card safety-disclaimer"><HiShieldCheck /><span>{lang === 'en' ? 'For immediate danger, contact the appropriate emergency service. We-Rise helps you reach your trusted network; it does not dispatch police, ambulance, or rescue services.' : 'Vir onmiddellike gevaar, kontak die toepaslike nooddiens. We-Rise help jou om jou vertroude netwerk te bereik; dit stuur nie polisie-, ambulans- of reddingsdienste uit nie.'}</span></div>
    </div>
  );
}
