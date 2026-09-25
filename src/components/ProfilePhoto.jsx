import React, { useEffect, useRef, useState } from 'react';
import { HiCamera, HiCheckCircle, HiPhotograph, HiShieldCheck, HiSupport, HiX, HiRefresh } from 'react-icons/hi';
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
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const permanentPhoto = Boolean(currentPhotoUrl && !required);

  const stopCamera = () => {
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  useEffect(() => () => {
    stopCamera();
  }, []);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [cameraActive]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const startCamera = async () => {
    if (cameraStarting || permanentPhoto) return;
    setError('');
    setComplete(false);
    setCameraStarting(true);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(af
          ? 'Jou blaaier kan nie die kamera veilig hier oopmaak nie. Maak We-Rise via HTTPS op ’n moderne blaaier oop.'
          : 'Your browser cannot open the camera securely here. Open We-Rise over HTTPS in a modern browser.');
      }
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (cameraError) {
      stopCamera();
      const denied = cameraError?.name === 'NotAllowedError' || cameraError?.name === 'SecurityError';
      setError(cameraError?.message || (denied
        ? (af ? 'Kamera-toegang is geweier. Laat kamera-toegang vir We-Rise toe en probeer weer.' : 'Camera access was denied. Allow camera access for We-Rise and try again.')
        : (af ? 'Die kamera kon nie oopmaak nie. Maak seker jou toestel het ’n werkende kamera.' : 'The camera could not be opened. Make sure your device has a working camera.')));
    } finally {
      setCameraStarting(false);
    }
  };

  const captureSelfie = async () => {
    const video = videoRef.current;
    if (!video || !cameraActive || video.videoWidth < 1 || video.videoHeight < 1) return;
    setError('');

    const sourceSize = Math.min(video.videoWidth, video.videoHeight);
    const sourceX = Math.max(0, (video.videoWidth - sourceSize) / 2);
    const sourceY = Math.max(0, (video.videoHeight - sourceSize) / 2);
    const outputSize = Math.min(900, sourceSize);
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError(af ? 'Die selfie kon nie vasgelê word nie. Probeer weer.' : 'The selfie could not be captured. Please try again.');
      return;
    }

    // Mirror the captured selfie to match the front-camera preview.
    ctx.translate(outputSize, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      setError(af ? 'Die selfie kon nie vasgelê word nie. Probeer weer.' : 'The selfie could not be captured. Please try again.');
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    const captured = new File([blob], 'we-rise-registration-selfie.jpg', { type: 'image/jpeg', lastModified: Date.now() });
    setFile(captured);
    setPreview(URL.createObjectURL(blob));
    stopCamera();
  };

  const retake = async () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    setFile(null);
    setComplete(false);
    await startCamera();
  };

  const upload = async () => {
    if (!file || busy || permanentPhoto) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('photo', file);
      form.append('capture_source', 'live_selfie_camera');
      const result = await apiRequest('/api/profile/photo', { method: 'POST', body: form });
      setComplete(true);
      onUploaded?.(result?.profile || null);
    } catch (uploadError) {
      setError(uploadError?.message || (af ? 'Die selfie kon nie gestoor word nie.' : 'The selfie could not be saved.'));
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
          <h2>{permanentPhoto
            ? (af ? 'Jou permanente selfie' : 'Your permanent selfie')
            : (af ? 'Neem jou registrasie-selfie' : 'Take your registration selfie')}</h2>
          <p>{permanentPhoto
            ? (af ? 'Hierdie selfie is tydens registrasie gestoor en kan nie verander of vervang word nie.' : 'This selfie was saved during registration and cannot be changed or replaced.')
            : (af ? '’n Regstreekse selfie met jou kamera is verpligtend voordat jou We-Rise-funksies oopmaak. Foto’s uit jou galery word nie aanvaar nie.' : 'A live selfie using your camera is required before your We-Rise features open. Gallery photos are not accepted.')}</p>
        </div>
      </div>

      {cameraActive ? (
        <div className="profile-selfie-camera-shell">
          <video ref={videoRef} className="profile-selfie-video" autoPlay muted playsInline />
          <div className="profile-selfie-guide" aria-hidden="true" />
        </div>
      ) : (
        <div className="profile-photo-preview-shell">
          {preview || currentPhotoUrl ? (
            <img src={preview || currentPhotoUrl} alt={af ? 'Profielselfie' : 'Profile selfie'} />
          ) : (
            <div className="profile-photo-placeholder"><HiPhotograph /><span>{af ? 'Jou selfie' : 'Your selfie'}</span></div>
          )}
          <span className="profile-photo-camera-badge"><HiCamera /></span>
        </div>
      )}

      {!permanentPhoto && (
        <div className="profile-photo-actions profile-photo-actions-single">
          {!cameraActive && !file && (
            <button type="button" className="profile-photo-picker profile-photo-camera-picker" disabled={cameraStarting} onClick={startCamera}>
              <HiCamera />
              <span>{cameraStarting ? (af ? 'Maak kamera oop…' : 'Opening camera…') : (af ? 'Maak kamera oop' : 'Open camera')}</span>
            </button>
          )}
          {cameraActive && (
            <button type="button" className="profile-photo-picker profile-photo-camera-picker" onClick={captureSelfie}>
              <HiCamera />
              <span>{af ? 'Neem selfie' : 'Take selfie'}</span>
            </button>
          )}
          {!cameraActive && file && !complete && (
            <button type="button" className="profile-photo-picker" onClick={retake}>
              <HiRefresh />
              <span>{af ? 'Neem weer' : 'Retake selfie'}</span>
            </button>
          )}
        </div>
      )}

      <div className="profile-photo-privacy">
        <HiShieldCheck />
        <span>{permanentPhoto
          ? (af ? 'Jou registrasie-selfie is permanent. We-Rise bied nie ’n funksie om dit later te vervang nie.' : 'Your registration selfie is permanent. We-Rise does not provide a feature to replace it later.')
          : (af ? 'Gebruik jou toestel se kamera vir ’n regstreekse selfie. Die selfie word veilig verwerk en liggingmetadata word nie behou nie.' : 'Use your device camera for a live selfie. The selfie is processed securely and location metadata is not retained.')}</span>
      </div>

      {error && <div className="profile-photo-error">{error}</div>}
      {complete && <div className="profile-photo-success"><HiCheckCircle /> {af ? 'Jou permanente registrasie-selfie is veilig gestoor.' : 'Your permanent registration selfie was saved securely.'}</div>}

      {!permanentPhoto && (
        <button type="button" className="btn btn-primary btn-full profile-photo-save" disabled={!file || busy || complete} onClick={upload}>
          {busy ? (af ? 'Stoor…' : 'Saving…') : complete ? (af ? 'Selfie gestoor' : 'Selfie saved') : (af ? 'Stoor permanente selfie' : 'Save permanent selfie')}
        </button>
      )}

      {required && (
        <button type="button" className="profile-photo-support-link" onClick={onOpenSupport}>
          <HiSupport /> {af ? 'Sukkel jy met die kamera? Kontak ondersteuning' : 'Having trouble with the camera? Contact support'}
        </button>
      )}
    </section>
  );

  if (required) return <div className="profile-photo-required-screen fade-in">{card}</div>;
  return <div className="modal-overlay profile-photo-modal" role="dialog" aria-modal="true">{card}</div>;
}
