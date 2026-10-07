import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HiArrowLeft, HiClipboardCopy, HiExternalLink, HiPhotograph, HiPlus, HiTrash } from 'react-icons/hi';
import { apiRequest } from '../lib/api';
import BrandMark from './BrandMark';

const BUILT_IN_CARDS = [
  { slug: 'promo-01', title: 'Bou Jou Welvaart', image_url: '/share-images/we-rise-promo-01.jpeg', share_url: 'https://werise-mu.vercel.app/share/promo-01.html', uploaded: false },
  { slug: 'promo-02', title: 'Digitale Wealth Hub — 3 Dae Gratis', image_url: '/share-images/we-rise-promo-02.jpeg', share_url: 'https://werise-mu.vercel.app/share/promo-02.html', uploaded: false },
  { slug: 'promo-03', title: 'Belangrike Aankondiging — 50 Dames', image_url: '/share-images/we-rise-promo-03.jpeg', share_url: 'https://werise-mu.vercel.app/share/promo-03.html', uploaded: false },
  { slug: 'promo-04', title: 'Bou Jou Welvaart — Kom Ons Begin', image_url: '/share-images/we-rise-promo-04.jpeg', share_url: 'https://werise-mu.vercel.app/share/promo-04.html', uploaded: false },
];

function withReferral(base, referralCode) {
  const raw = String(referralCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40);
  if (!raw) return base;
  const url = new URL(base, window.location.origin);
  url.searchParams.set('ref', raw);
  return url.toString();
}

export default function ShareCards({ lang = 'en', isAdmin = false, onToggleLang }) {
  const [uploaded, setUploaded] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState('');
  const [copied, setCopied] = useState('');
  const fileRef = useRef(null);

  const copy = lang === 'af' ? {
    eyebrow: 'WE-RISE DEELKAARTE',
    title: 'Kies ’n foto en deel dit',
    intro: 'Hierdie foto’s word as klikbare Facebook-skakelkaarte gedeel. Voeg ’n verwysingskode by indien die plasing aan ’n Herverkoper/HuurDit-lid gekoppel moet word.',
    referral: 'Opsionele verwysingskode',
    referralHint: 'Laat leeg vir gewone We-Rise-bemarking.',
    addPhoto: 'Voeg Foto By',
    uploadTitle: 'Voeg ’n nuwe deelkaart by',
    shortTitle: 'Kort naam vir die kaart',
    choose: 'Kies foto',
    upload: 'Laai Foto Op',
    cancel: 'Kanselleer',
    share: 'Deel op Facebook',
    copyLink: 'Kopieer skakel',
    copied: 'Gekopieer',
    remove: 'Verwyder',
    adminNote: 'Admin-modus: nuwe foto’s word outomaties na die Facebook 1200 × 630-verhouding aangepas.',
    loading: 'Laai deelkaarte…',
    back: 'Terug na We-Rise',
    builtIn: 'We-Rise kaart',
    uploaded: 'Admin-oplaai',
  } : {
    eyebrow: 'WE-RISE SHARE CARDS',
    title: 'Choose a photo and share it',
    intro: 'These images share as clickable Facebook link cards. Add a referral code when the post must be attributed to a Reseller/RentIt member.',
    referral: 'Optional referral code',
    referralHint: 'Leave blank for normal We-Rise marketing.',
    addPhoto: 'Add Photo',
    uploadTitle: 'Add a new share card',
    shortTitle: 'Short name for the card',
    choose: 'Choose photo',
    upload: 'Upload Photo',
    cancel: 'Cancel',
    share: 'Share on Facebook',
    copyLink: 'Copy link',
    copied: 'Copied',
    remove: 'Remove',
    adminNote: 'Admin mode: new photos are automatically fitted to the Facebook 1200 × 630 share-card ratio.',
    loading: 'Loading share cards…',
    back: 'Back to We-Rise',
    builtIn: 'We-Rise card',
    uploaded: 'Admin upload',
  };

  const cards = useMemo(() => [...uploaded, ...BUILT_IN_CARDS], [uploaded]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/api/share-cards');
      setUploaded(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(err.message || 'Could not load uploaded share cards.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function chooseFile(nextFile) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile || null);
    setPreview(nextFile ? URL.createObjectURL(nextFile) : '');
    if (nextFile && !title) setTitle(String(nextFile.name || '').replace(/\.[^.]+$/, '').slice(0, 100));
  }

  async function uploadCard(event) {
    event.preventDefault();
    if (!file || saving) return;
    setSaving(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      form.append('title', title || 'We-Rise Share Card');
      const data = await apiRequest('/api/admin/share-cards', { method: 'POST', body: form });
      if (data?.item) setUploaded(current => [data.item, ...current]);
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview('');
      setTitle('');
      setShowUpload(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setSaving(false);
    }
  }

  async function removeCard(card) {
    const message = lang === 'af'
      ? `Verwyder “${card.title}” uit die deelkaarte?`
      : `Remove “${card.title}” from the share cards?`;
    if (!window.confirm(message)) return;
    setDeleting(card.slug);
    setError('');
    try {
      await apiRequest(`/api/admin/share-cards/${encodeURIComponent(card.slug)}`, { method: 'DELETE' });
      setUploaded(current => current.filter(item => item.slug !== card.slug));
    } catch (err) {
      setError(err.message || 'Could not remove the card.');
    } finally {
      setDeleting('');
    }
  }

  function facebookShare(card) {
    const shareUrl = withReferral(card.share_url, referralCode);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer');
  }

  async function copyLink(card) {
    const shareUrl = withReferral(card.share_url, referralCode);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(card.slug);
      window.setTimeout(() => setCopied(''), 1200);
    } catch {
      window.prompt('Copy this link:', shareUrl);
    }
  }

  return (
    <div className="share-cards-page">
      <header className="share-cards-header">
        <a href="/" className="share-cards-back"><HiArrowLeft /> {copy.back}</a>
        <div className="share-cards-brand"><BrandMark variant="compact" /><strong>We-Rise</strong></div>
        <button type="button" className="lang-toggle" onClick={onToggleLang}>{lang === 'en' ? 'AF' : 'EN'}</button>
      </header>

      <main className="share-cards-main">
        <section className="share-cards-hero">
          <div>
            <span>{copy.eyebrow}</span>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
          </div>
          {isAdmin && <button type="button" className="share-add-photo" onClick={() => setShowUpload(true)}><HiPlus /> {copy.addPhoto}</button>}
        </section>

        <section className="share-referral-box">
          <label>{copy.referral}</label>
          <input value={referralCode} onChange={event => setReferralCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 40))} placeholder="WR8K3P7" />
          <small>{copy.referralHint}</small>
        </section>

        {isAdmin && <div className="share-admin-note"><HiPhotograph /> {copy.adminNote}</div>}
        {error && <div className="share-cards-error">{error}</div>}
        {loading && <div className="share-cards-loading">{copy.loading}</div>}

        <section className="share-cards-grid">
          {cards.map(card => (
            <article key={card.slug} className="share-card-item">
              <div className="share-card-image-wrap"><img src={card.image_url} alt="" /></div>
              <div className="share-card-body">
                <div className="share-card-title-row">
                  <div><strong>{card.title}</strong><small>{card.uploaded ? copy.uploaded : copy.builtIn}</small></div>
                  {isAdmin && card.uploaded && <button type="button" className="share-delete-button" disabled={deleting === card.slug} onClick={() => removeCard(card)} title={copy.remove}><HiTrash /></button>}
                </div>
                <div className="share-card-actions">
                  <button type="button" className="share-facebook-button" onClick={() => facebookShare(card)}><HiExternalLink /> {copy.share}</button>
                  <button type="button" className="share-copy-button" onClick={() => copyLink(card)}><HiClipboardCopy /> {copied === card.slug ? copy.copied : copy.copyLink}</button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>

      {isAdmin && showUpload && (
        <div className="share-upload-overlay" onClick={() => !saving && setShowUpload(false)}>
          <form className="share-upload-modal" onSubmit={uploadCard} onClick={event => event.stopPropagation()}>
            <div className="share-upload-title"><div><span>ADMIN</span><h2>{copy.uploadTitle}</h2></div><button type="button" onClick={() => !saving && setShowUpload(false)}>×</button></div>
            {preview ? <img className="share-upload-preview" src={preview} alt="" /> : <button type="button" className="share-file-picker" onClick={() => fileRef.current?.click()}><HiPhotograph /><strong>{copy.choose}</strong><small>JPG · PNG · WebP · max 12 MB</small></button>}
            <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => chooseFile(event.target.files?.[0])} />
            {preview && <button type="button" className="share-change-photo" onClick={() => fileRef.current?.click()}>{copy.choose}</button>}
            <label className="share-upload-label"><span>{copy.shortTitle}</span><input value={title} onChange={event => setTitle(event.target.value.slice(0, 100))} maxLength={100} /></label>
            <div className="share-upload-actions"><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setShowUpload(false)}>{copy.cancel}</button><button type="submit" className="btn btn-primary" disabled={!file || saving}>{saving ? '…' : copy.upload}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
