import React, { useEffect, useState } from 'react';
import { HiUserAdd, HiCheckCircle, HiUsers, HiMail, HiGlobeAlt } from 'react-icons/hi';
import { apiRequest } from '../lib/api';

const initialForm = {
  name: '',
  email: '',
  age: '',
  country: 'South Africa',
  reason: '',
  explanation: '',
};

export default function Waitlist({ lang, userName, showToast }) {
  const [form, setForm] = useState(() => ({ ...initialForm, name: userName || '' }));
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState(null);

  useEffect(() => {
    if (!form.name && userName) setForm(prev => ({ ...prev, name: userName }));
  }, [userName]);

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/waitlist/count')
      .then(data => {
        if (!cancelled && Number.isFinite(Number(data?.count))) setWaitlistCount(Number(data.count));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const age = Number(form.age);
    if (!form.name.trim() || !form.email.trim() || !Number.isFinite(age) || age < 18 || age > 120 || !form.country.trim() || !form.reason.trim() || !form.explanation.trim()) {
      showToast(lang === 'en' ? 'Please complete every waitlist field.' : 'Voltooi asseblief elke waglysveld.');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          age,
          country: form.country.trim(),
          reason: form.reason.trim(),
          explanation: form.explanation.trim(),
        }),
      });
      setSubmitted(true);
      setWaitlistCount(prev => Number.isFinite(prev) ? prev + 1 : prev);
      showToast(lang === 'en' ? 'You are on the We-Rise waitlist 💗' : 'Jy is op die We-Rise waglys 💗');
    } catch (error) {
      showToast(error?.message || (lang === 'en' ? 'Could not join the waitlist.' : 'Kon nie by die waglys aansluit nie.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fade-in waitlist-page">
        <div className="waitlist-success-card">
          <div className="waitlist-success-icon"><HiCheckCircle /></div>
          <div className="eyebrow">WE-RISE</div>
          <h2>{lang === 'en' ? 'You are on the list.' : 'Jy is op die lys.'}</h2>
          <p>{lang === 'en'
            ? 'Thank you for joining the movement. Your request has been safely recorded and we will be able to contact you when onboarding opens.'
            : 'Dankie dat jy by die beweging aansluit. Jou versoek is veilig aangeteken en ons sal jou kan kontak wanneer registrasie oopmaak.'}</p>
          {waitlistCount !== null && (
            <div className="waitlist-count-pill"><HiUsers /> {waitlistCount.toLocaleString()} {lang === 'en' ? 'people waiting' : 'mense wag'}</div>
          )}
          <button className="btn btn-secondary" onClick={() => { setSubmitted(false); setForm({ ...initialForm, name: userName || '' }); }}>
            {lang === 'en' ? 'Submit another request' : 'Dien nog ’n versoek in'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in waitlist-page">
      <div className="waitlist-hero">
        <div className="waitlist-icon"><HiUserAdd /></div>
        <div>
          <div className="eyebrow">{lang === 'en' ? 'JOIN THE MOVEMENT' : 'SLUIT AAN BY DIE BEWEGING'}</div>
          <h2>{lang === 'en' ? 'Join the We-Rise Waitlist' : 'Sluit aan by die We-Rise Waglys'}</h2>
          <p>{lang === 'en'
            ? 'Tell us a little about yourself and why We-Rise matters to you. This becomes the foundation for future member onboarding.'
            : 'Vertel ons ’n bietjie van jouself en hoekom We-Rise vir jou belangrik is. Dit vorm die grondslag vir toekomstige lidregistrasie.'}</p>
        </div>
      </div>

      {waitlistCount !== null && (
        <div className="waitlist-count-banner">
          <HiUsers />
          <strong>{waitlistCount.toLocaleString()}</strong>
          <span>{lang === 'en' ? 'people currently on the waitlist' : 'mense tans op die waglys'}</span>
        </div>
      )}

      <form className="card waitlist-form" onSubmit={handleSubmit}>
        <div className="waitlist-grid">
          <div className="form-group">
            <label>{lang === 'en' ? 'Full Name' : 'Volle Naam'}</label>
            <input className="input" value={form.name} onChange={e => update('name', e.target.value)} maxLength={80} required />
          </div>
          <div className="form-group">
            <label>{lang === 'en' ? 'Age' : 'Ouderdom'}</label>
            <input className="input" type="number" min="18" max="120" value={form.age} onChange={e => update('age', e.target.value)} required />
          </div>
        </div>

        <div className="form-group">
          <label>{lang === 'en' ? 'Email Address' : 'E-posadres'}</label>
          <div className="input-with-icon"><HiMail /><input className="input" type="email" value={form.email} onChange={e => update('email', e.target.value)} maxLength={320} placeholder="name@example.com" required /></div>
        </div>

        <div className="form-group">
          <label>{lang === 'en' ? 'Country' : 'Land'}</label>
          <div className="input-with-icon"><HiGlobeAlt /><input className="input" value={form.country} onChange={e => update('country', e.target.value)} maxLength={80} required /></div>
        </div>

        <div className="form-group">
          <label>{lang === 'en' ? 'Reason for Request' : 'Rede vir Versoek'}</label>
          <input className="input" value={form.reason} onChange={e => update('reason', e.target.value)} maxLength={160} placeholder={lang === 'en' ? 'e.g. financial support, safety, community, personal growth' : 'bv. finansiële ondersteuning, veiligheid, gemeenskap, persoonlike groei'} required />
        </div>

        <div className="form-group">
          <label>{lang === 'en' ? 'Tell us more' : 'Vertel ons meer'}</label>
          <textarea className="input waitlist-textarea" value={form.explanation} onChange={e => update('explanation', e.target.value)} maxLength={1200} rows={6} placeholder={lang === 'en' ? 'Why would you like to become part of We-Rise?' : 'Hoekom wil jy deel van We-Rise word?'} required />
          <div className="field-counter">{form.explanation.length}/1200</div>
        </div>

        <button className="btn btn-primary btn-full waitlist-submit" disabled={submitting}>
          <HiUserAdd /> {submitting ? (lang === 'en' ? 'Joining...' : 'Sluit aan...') : (lang === 'en' ? 'Join the Waitlist' : 'Sluit aan by die Waglys')}
        </button>
      </form>
    </div>
  );
}
