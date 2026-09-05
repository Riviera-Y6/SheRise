import React, { useEffect, useState } from 'react';
import { HiCheckCircle, HiMail, HiPaperClip, HiPaperAirplane, HiShieldCheck, HiSupport } from 'react-icons/hi';
import { apiRequest } from '../lib/api';

const CATEGORIES = {
  en: [
    ['account', 'Account or login'],
    ['profile_photo', 'Profile photo'],
    ['technical', 'Technical problem'],
    ['membership_payment', 'Membership or payment'],
    ['backmi', 'BackMi'],
    ['community_messages', 'Community or Messages'],
    ['safety', 'Safety feature'],
    ['other', 'Something else'],
  ],
  af: [
    ['account', 'Rekening of aanmelding'],
    ['profile_photo', 'Profielprent'],
    ['technical', 'Tegniese probleem'],
    ['membership_payment', 'Lidmaatskap of betaling'],
    ['backmi', 'BackMi'],
    ['community_messages', 'Gemeenskap of Boodskappe'],
    ['safety', 'Veiligheidsfunksie'],
    ['other', 'Iets anders'],
  ],
};

export default function Support({ lang = 'en', user = null, profile = null }) {
  const af = lang === 'af';
  const signedIn = Boolean(user?.id);
  const [name, setName] = useState(profile?.display_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [category, setCategory] = useState('technical');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const chooseAttachment = (event) => {
    const selected = event.target.files?.[0] || null;
    setError('');
    if (!selected) {
      setAttachment(null);
      return;
    }
    if (!String(selected.type || '').startsWith('image/')) {
      setAttachment(null);
      setError(af ? 'Kies asseblief ’n geldige skermskoot.' : 'Please choose a valid screenshot image.');
      return;
    }
    if (selected.size > 8 * 1024 * 1024) {
      setAttachment(null);
      setError(af ? 'Die skermskoot mag nie groter as 8 MB wees nie.' : 'The screenshot may not be larger than 8 MB.');
      return;
    }
    setAttachment(selected);
  };

  useEffect(() => {
    if (profile?.display_name) setName(profile.display_name);
    if (user?.email) setEmail(user.email);
  }, [profile?.display_name, user?.email]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('email', email.trim());
      form.append('category', category);
      form.append('subject', subject.trim());
      form.append('message', message.trim());
      form.append('page_context', `${window.location.pathname}${window.location.search}`.slice(0, 240));
      form.append('website', website);
      if (attachment) form.append('attachment', attachment);
      const response = await apiRequest('/api/support/tickets', { method: 'POST', body: form });
      setResult(response);
      setSubject('');
      setMessage('');
      setAttachment(null);
    } catch (submitError) {
      setError(submitError?.message || (af ? 'Die versoek kon nie gestuur word nie.' : 'The request could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="support-page fade-in">
      <section className="support-hero">
        <div className="support-hero-icon"><HiSupport /></div>
        <div className="support-kicker">WE-RISE SUPPORT</div>
        <h2>{af ? 'Hoe kan ons help?' : 'How can we help?'}</h2>
        <p>{af
          ? 'Vertel ons direk as iets in We-Rise nie reg werk nie. Jou boodskap gaan na We-Rise-ondersteuning.'
          : 'Tell us directly when something in We-Rise is not working correctly. Your message goes to We-Rise support.'}</p>
      </section>

      {result ? (
        <section className="support-success-card">
          <div className="support-success-icon"><HiCheckCircle /></div>
          <h3>{af ? 'Ons het jou boodskap ontvang' : 'We received your message'}</h3>
          <p>{result.email_sent
            ? (af ? 'Dit is direk aan We-Rise-ondersteuning gestuur.' : 'It was sent directly to We-Rise support.')
            : (af ? 'Dit is veilig aangeteken. E-posaflewering is tans vertraag, maar jou versoek is nie verlore nie.' : 'It was recorded safely. Email delivery is currently delayed, but your request is not lost.')}</p>
          <div className="support-reference"><span>{af ? 'Verwysingsnommer' : 'Reference number'}</span><strong>{result.ticket_code}</strong></div>
          <button type="button" className="btn btn-secondary btn-full" onClick={() => setResult(null)}>{af ? 'Stuur nog ’n boodskap' : 'Send another message'}</button>
        </section>
      ) : (
        <form className="support-form-card" onSubmit={submit}>
          {signedIn && (
            <div className="support-member-row">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{String(profile?.display_name || 'W').charAt(0).toUpperCase()}</span>}
              <div><strong>{profile?.display_name || (af ? 'We-Rise-lid' : 'We-Rise member')}</strong><small>{user?.email}</small></div>
            </div>
          )}

          {!signedIn && (
            <div className="support-grid-two">
              <label className="support-field"><span>{af ? 'Jou naam' : 'Your name'}</span><input value={name} onChange={event => setName(event.target.value)} maxLength={80} autoComplete="name" required /></label>
              <label className="support-field"><span>{af ? 'Jou e-pos' : 'Your email'}</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={320} autoComplete="email" required /></label>
            </div>
          )}

          <label className="support-field"><span>{af ? 'Waarmee sukkel jy?' : 'What are you having trouble with?'}</span><select value={category} onChange={event => setCategory(event.target.value)}>{CATEGORIES[lang].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label className="support-field"><span>{af ? 'Onderwerp' : 'Subject'}</span><input value={subject} onChange={event => setSubject(event.target.value)} maxLength={140} placeholder={af ? 'Kort beskrywing van die probleem' : 'Short description of the problem'} required /></label>
          <label className="support-field"><span>{af ? 'Vertel ons wat gebeur het' : 'Tell us what happened'}</span><textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={4000} rows={7} placeholder={af ? 'Verduidelik die probleem en wat jy probeer doen het…' : 'Explain the problem and what you were trying to do…'} required /><small>{message.length}/4000</small></label>

          <label className="support-attachment">
            <HiPaperClip />
            <span>{attachment ? attachment.name : (af ? 'Voeg ’n skermskoot by (opsioneel)' : 'Attach a screenshot (optional)')}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAttachment} />
          </label>

          <label className="support-honeypot" aria-hidden="true">Website<input tabIndex="-1" autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label>
          <div className="support-privacy-note"><HiShieldCheck /><span>{af ? 'Jou besonderhede word slegs gebruik om met hierdie ondersteuningsversoek te help.' : 'Your details are used only to help with this support request.'}</span></div>
          {error && <div className="support-error">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full support-submit" disabled={busy || !subject.trim() || message.trim().length < 10}>
            <HiPaperAirplane /> {busy ? (af ? 'Stuur…' : 'Sending…') : (af ? 'Stuur aan ondersteuning' : 'Send to support')}
          </button>
          <div className="support-direct-line"><HiMail /> {af ? 'Jou versoek gaan direk na We-Rise-ondersteuning.' : 'Your request goes directly to We-Rise support.'}</div>
        </form>
      )}
    </div>
  );
}
