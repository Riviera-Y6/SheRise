import React, { useEffect, useState } from 'react';
import { HiUserAdd, HiCheckCircle, HiUsers, HiMail, HiGlobeAlt, HiLocationMarker, HiInformationCircle } from 'react-icons/hi';
import { apiRequest } from '../lib/api';

const initialForm = {
  name: '',
  email: '',
  age: '',
  province: '',
  cityTown: '',
  country: 'South Africa',
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
    if (!form.name.trim() || !form.email.trim() || !Number.isFinite(age) || age < 18 || age > 120 || !form.province.trim() || !form.cityTown.trim() || !form.country.trim() || !form.explanation.trim()) {
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
          province: form.province.trim(),
          city_town: form.cityTown.trim(),
          country: form.country.trim(),
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
            ? 'Thank you. Your details have been recorded. If you register for We-Rise later with this email address, your waitlist entry will be removed automatically.'
            : 'Dankie. Jou besonderhede is aangeteken. Indien jy later met hierdie e-posadres vir We-Rise registreer, sal jou waglysinskrywing outomaties verwyder word.'}</p>
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
            ? 'If you want to join We-Rise but are not ready to register yet, add your details to the waitlist.'
            : 'Indien jy by We-Rise wil aansluit maar nog nie gereed is om te registreer nie, voeg jou besonderhede by die waglys.'}</p>
        </div>
      </div>

      <div className="waitlist-registration-note">
        <HiInformationCircle />
        <div>
          <strong>{lang === 'en' ? 'Not ready to pay the R194.00 registration fee yet?' : 'Nog nie gereed om die R194.00 registrasiefooi te betaal nie?'}</strong>
          <span>{lang === 'en'
            ? 'If a prospective member is interested but does not currently have the R194.00 registration fee available, they may join the waitlist. Once they register, their details will automatically be removed from the waitlist.'
            : 'Indien ’n voornemende lid belangstel maar nie tans die R194.00 registrasiefooi beskikbaar het nie, kan hulle by die waglys aansluit. Sodra hulle later registreer, sal hulle besonderhede outomaties van die waglys verwyder word.'}</span>
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

        <div className="waitlist-grid">
          <div className="form-group">
            <label>{lang === 'en' ? 'Province / State' : 'Provinsie / Staat'}</label>
            <div className="input-with-icon"><HiLocationMarker /><input className="input" value={form.province} onChange={e => update('province', e.target.value)} maxLength={80} required /></div>
          </div>
          <div className="form-group">
            <label>{lang === 'en' ? 'City / Town' : 'Stad / Dorp'}</label>
            <div className="input-with-icon"><HiLocationMarker /><input className="input" value={form.cityTown} onChange={e => update('cityTown', e.target.value)} maxLength={100} required /></div>
          </div>
        </div>

        <div className="form-group">
          <label>{lang === 'en' ? 'Country' : 'Land'}</label>
          <div className="input-with-icon"><HiGlobeAlt /><input className="input" value={form.country} onChange={e => update('country', e.target.value)} maxLength={80} required /></div>
        </div>

        <div className="form-group">
          <label>{lang === 'en' ? 'Tell us more' : 'Vertel ons meer'}</label>
          <textarea className="input waitlist-textarea" value={form.explanation} onChange={e => update('explanation', e.target.value)} maxLength={1200} rows={6} placeholder={lang === 'en' ? 'Anything else you would like We-Rise to know?' : 'Enigiets anders wat jy wil hê We-Rise moet weet?'} required />
          <div className="field-counter">{form.explanation.length}/1200</div>
        </div>

        <button className="btn btn-primary btn-full waitlist-submit" disabled={submitting}>
          <HiUserAdd /> {submitting ? (lang === 'en' ? 'Joining...' : 'Sluit aan...') : (lang === 'en' ? 'Join the Waitlist' : 'Sluit aan by die Waglys')}
        </button>
      </form>
    </div>
  );
}
