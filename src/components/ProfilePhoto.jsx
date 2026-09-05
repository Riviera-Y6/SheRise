import React, { useEffect, useState } from 'react';
import { HiCamera, HiCheckCircle, HiPhotograph, HiShieldCheck, HiSupport, HiX } from 'react-icons/hi';
import { apiRequest } from '../lib/api';

export default function ProfilePhoto({
  lang = 'en',
  currentPhotoUrl = '',
  required = false,
  onUploaded,
  onClose,
  onOpenSupport,
}) {
  const af = lang === 'af';
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const choosePhoto = (event) => {
    const selected = event.target.files?.[0] || null;
    setError('');
    setComplete(false);
    if (!selected) return;
    if (!String(selected.type || '').startsWith('image/')) {
      setError(af ? 'Kies asseblief ’n geldige foto.' : 'Please choose a valid image.');
      return;
    }
    if (selected.size > 8 * 1024 * 1024) {
      setError(af ? 'Die foto mag nie groter as 8 MB wees nie.' : 'The photo may not be larger than 8 MB.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const upload = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('photo', file);
      const result = await apiRequest('/api/profile/photo', { method: 'POST', body: form });
      setComplete(true);
      onUploaded?.(result?.profile || null);
    } catch (uploadError) {
      setError(uploadError?.message || (af ? 'Die foto kon nie opgelaai word nie.' : 'The photo could not be uploaded.'));
    } finally {
      setBusy(false);
    }
  };

  const card = (
    <section className={`profile-photo-card ${required ? 'is-required' : ''}`}>
      {!required && <button type="button" className="profile-photo-close" onClick={onClose} aria-label={af ? 'Maak toe' : 'Close'}><HiX /></button>}
      <div className="profile-photo-kicker">WE-RISE LADIES</div>
      <div className="profile-photo-title-row">
        <span className="profile-photo-title-icon"><HiCamera /></span>
        <div>
          <h2>{required ? (af ? 'Voeg jou profielprent by' : 'Add your profile photo') : (af ? 'Jou profielprent' : 'Your profile photo')}</h2>
          <p>{required
            ? (af ? 'Dit is die laaste verpligte stap voordat jou We-Rise-funksies oopmaak.' : 'This is the final required step before your We-Rise features open.')
            : (af ? 'Kies ’n nuwe foto indien jy jou huidige profielprent wil verander.' : 'Choose a new photo if you would like to replace your current profile photo.')}</p>
        </div>
      </div>

      <div className="profile-photo-preview-shell">
        {preview || currentPhotoUrl ? (
          <img src={preview || currentPhotoUrl} alt={af ? 'Profielprent voorskou' : 'Profile photo preview'} />
        ) : (
          <div className="profile-photo-placeholder"><HiPhotograph /><span>{af ? 'Jou foto' : 'Your photo'}</span></div>
        )}
        <span className="profile-photo-camera-badge"><HiCamera /></span>
      </div>

      <div className="profile-photo-actions">
        <label className="profile-photo-picker">
          <HiPhotograph />
          <span>{af ? 'Kies uit jou galery' : 'Choose from gallery'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} />
        </label>
        <label className="profile-photo-picker profile-photo-camera-picker">
          <HiCamera />
          <span>{af ? 'Neem ’n foto' : 'Take a photo'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={choosePhoto} />
        </label>
      </div>

      {file && <div className="profile-photo-selected">{af ? 'Gekies:' : 'Selected:'} <strong>{file.name}</strong></div>}

      <div className="profile-photo-privacy">
        <HiShieldCheck />
        <span>{af
          ? 'Slegs aangemelde, aktiewe We-Rise-lede kan profielprente sien. Foto-inligting soos ligging word verwyder.'
          : 'Only signed-in, active We-Rise members can see profile photos. Photo information such as location is removed.'}</span>
      </div>

      {error && <div className="profile-photo-error">{error}</div>}
      {complete && <div className="profile-photo-success"><HiCheckCircle /> {af ? 'Jou profielprent is veilig gestoor.' : 'Your profile photo was saved securely.'}</div>}

      <button type="button" className="btn btn-primary btn-full profile-photo-save" disabled={!file || busy || complete} onClick={upload}>
        {busy ? (af ? 'Laai op…' : 'Uploading…') : complete ? (af ? 'Foto gestoor' : 'Photo saved') : (af ? 'Stoor profielprent' : 'Save profile photo')}
      </button>

      {required && (
        <button type="button" className="profile-photo-support-link" onClick={onOpenSupport}>
          <HiSupport /> {af ? 'Sukkel jy om ’n foto op te laai? Kontak ondersteuning' : 'Having trouble uploading a photo? Contact support'}
        </button>
      )}
    </section>
  );

  if (required) return <div className="profile-photo-required-screen fade-in">{card}</div>;
  return <div className="modal-overlay profile-photo-modal" role="dialog" aria-modal="true">{card}</div>;
}
