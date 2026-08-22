import React, { useEffect, useState } from 'react';
import { HiArrowLeft, HiCheckCircle, HiEye, HiEyeOff, HiLockClosed, HiMail, HiUser, HiX } from 'react-icons/hi';
import { authConfigured, supabase } from '../lib/supabase';

const copy = {
  en: {
    login: 'Welcome back',
    loginSub: 'Log in to use your We-Rise features.',
    register: 'Create your We-Rise account',
    registerSub: 'Join the community and unlock your personal features.',
    forgot: 'Reset your password',
    forgotSub: 'We will email you a secure password reset link.',
    reset: 'Choose a new password',
    resetSub: 'Enter a new password for your We-Rise account.',
    name: 'Full name',
    email: 'Email address',
    password: 'Password',
    confirm: 'Confirm password',
    loginButton: 'Log in',
    registerButton: 'Create account',
    resetButton: 'Update password',
    sendReset: 'Send reset email',
    noAccount: 'New to We-Rise?',
    haveAccount: 'Already have an account?',
    create: 'Create account',
    signIn: 'Log in',
    forgotLink: 'Forgot password?',
    checkEmail: 'Check your email',
    checkEmailCopy: 'We sent you a confirmation link. Confirm your email, then return to We-Rise and log in.',
    resetSent: 'Password reset email sent. Check your inbox and follow the link.',
    mismatch: 'Passwords do not match.',
    shortPassword: 'Use at least 8 characters for your password.',
    missingName: 'Please enter your full name.',
    config: 'Login is not configured yet. Add the Supabase frontend environment variables in Vercel.',
  },
  af: {
    login: 'Welkom terug',
    loginSub: 'Meld aan om jou We-Rise funksies te gebruik.',
    register: 'Skep jou We-Rise rekening',
    registerSub: 'Sluit aan by die gemeenskap en ontsluit jou persoonlike funksies.',
    forgot: 'Herstel jou wagwoord',
    forgotSub: 'Ons sal vir jou ’n veilige wagwoord-herstel skakel per e-pos stuur.',
    reset: 'Kies ’n nuwe wagwoord',
    resetSub: 'Voer ’n nuwe wagwoord vir jou We-Rise rekening in.',
    name: 'Volle naam',
    email: 'E-posadres',
    password: 'Wagwoord',
    confirm: 'Bevestig wagwoord',
    loginButton: 'Meld aan',
    registerButton: 'Skep rekening',
    resetButton: 'Dateer wagwoord op',
    sendReset: 'Stuur herstel-e-pos',
    noAccount: 'Nuut by We-Rise?',
    haveAccount: 'Het jy reeds ’n rekening?',
    create: 'Skep rekening',
    signIn: 'Meld aan',
    forgotLink: 'Wagwoord vergeet?',
    checkEmail: 'Gaan kyk jou e-pos',
    checkEmailCopy: 'Ons het vir jou ’n bevestigingskakel gestuur. Bevestig jou e-pos en kom dan terug na We-Rise om aan te meld.',
    resetSent: 'Wagwoord-herstel e-pos gestuur. Gaan kyk jou inkassie en volg die skakel.',
    mismatch: 'Die wagwoorde stem nie ooreen nie.',
    shortPassword: 'Gebruik ten minste 8 karakters vir jou wagwoord.',
    missingName: 'Voer asseblief jou volle naam in.',
    config: 'Aanmelding is nog nie gekonfigureer nie. Voeg die Supabase frontend omgewingsveranderlikes in Vercel by.',
  },
};

export default function AuthModal({ open, mode: requestedMode = 'login', lang = 'en', onClose }) {
  const strings = copy[lang] || copy.en;
  const [mode, setMode] = useState(requestedMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!open) return;
    setMode(requestedMode || 'login');
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  }, [open, requestedMode]);

  if (!open) return null;

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!authConfigured || !supabase) {
      setError(strings.config);
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setError(strings.missingName);
      return;
    }
    if ((mode === 'register' || mode === 'reset') && password.length < 8) {
      setError(strings.shortPassword);
      return;
    }
    if ((mode === 'register' || mode === 'reset') && password !== confirmPassword) {
      setError(strings.mismatch);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        onClose?.();
      } else if (mode === 'register') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (authError) throw authError;
        if (data?.session) {
          onClose?.();
        } else {
          setMode('confirm-email');
        }
      } else if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (authError) throw authError;
        setNotice(strings.resetSent);
      } else if (mode === 'reset') {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setNotice(lang === 'en' ? 'Password updated. You are signed in.' : 'Wagwoord opgedateer. Jy is aangemeld.');
        window.setTimeout(() => onClose?.(), 900);
      }
    } catch (authError) {
      setError(authError?.message || (lang === 'en' ? 'Something went wrong. Please try again.' : 'Iets het verkeerd geloop. Probeer asseblief weer.'));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'register' ? strings.register : mode === 'forgot' ? strings.forgot : mode === 'reset' ? strings.reset : strings.login;
  const subtitle = mode === 'register' ? strings.registerSub : mode === 'forgot' ? strings.forgotSub : mode === 'reset' ? strings.resetSub : strings.loginSub;

  if (mode === 'confirm-email') {
    return (
      <div className="modal-overlay auth-modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-card auth-modal-card">
          <button className="auth-close" onClick={onClose} aria-label="Close"><HiX /></button>
          <div className="auth-success-icon"><HiCheckCircle /></div>
          <div className="eyebrow">WE-RISE</div>
          <h3 className="modal-title">{strings.checkEmail}</h3>
          <p className="modal-desc auth-center-copy">{strings.checkEmailCopy}</p>
          <button className="btn btn-primary btn-full" onClick={() => switchMode('login')}>{strings.signIn}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay auth-modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card auth-modal-card">
        <button className="auth-close" onClick={onClose} aria-label="Close"><HiX /></button>

        <div className="auth-brand-row">
          <div className="auth-brand-mark">W</div>
          <div>
            <div className="eyebrow">WE-RISE ACCOUNT</div>
            <h3 className="modal-title">{title}</h3>
          </div>
        </div>
        <p className="modal-desc auth-subtitle">{subtitle}</p>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <label className="auth-field">
              <span>{strings.name}</span>
              <div className="auth-input-wrap"><HiUser /><input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" required /></div>
            </label>
          )}

          {mode !== 'reset' && (
            <label className="auth-field">
              <span>{strings.email}</span>
              <div className="auth-input-wrap"><HiMail /><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></div>
            </label>
          )}

          {mode !== 'forgot' && (
            <label className="auth-field">
              <span>{strings.password}</span>
              <div className="auth-input-wrap">
                <HiLockClosed />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
                <button type="button" className="auth-eye" onClick={() => setShowPassword(value => !value)} aria-label="Toggle password visibility">{showPassword ? <HiEyeOff /> : <HiEye />}</button>
              </div>
            </label>
          )}

          {(mode === 'register' || mode === 'reset') && (
            <label className="auth-field">
              <span>{strings.confirm}</span>
              <div className="auth-input-wrap"><HiLockClosed /><input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required /></div>
            </label>
          )}

          {error && <div className="auth-message auth-error">{error}</div>}
          {notice && <div className="auth-message auth-notice">{notice}</div>}

          <button className="btn btn-primary btn-full auth-submit" disabled={busy}>
            {busy ? '...' : mode === 'register' ? strings.registerButton : mode === 'forgot' ? strings.sendReset : mode === 'reset' ? strings.resetButton : strings.loginButton}
          </button>
        </form>

        {mode === 'login' && (
          <button type="button" className="auth-text-button" onClick={() => switchMode('forgot')}>{strings.forgotLink}</button>
        )}

        {mode === 'forgot' && (
          <button type="button" className="auth-back-button" onClick={() => switchMode('login')}><HiArrowLeft /> {strings.signIn}</button>
        )}

        {(mode === 'login' || mode === 'register') && (
          <div className="auth-switch-row">
            <span>{mode === 'login' ? strings.noAccount : strings.haveAccount}</span>
            <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? strings.create : strings.signIn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
