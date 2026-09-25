import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HiArrowLeft, HiCash, HiChartBar, HiCheckCircle, HiClock, HiCreditCard, HiDocumentDownload,
  HiExclamationCircle, HiEye, HiFilter, HiHome, HiInformationCircle, HiLockClosed, HiLogout,
  HiBell, HiRefresh, HiSearch, HiShieldCheck, HiTrash, HiUserAdd, HiUsers, HiXCircle
} from 'react-icons/hi';
import { apiRequest } from '../lib/api';
import BrandMark from './BrandMark';

const copy = {
  en: {
    title: 'Admin Control Centre', subtitle: 'Members, money and activity in one secure place.', back: 'Back to We-Rise', logout: 'Log out',
    overview: 'Overview', members: 'Members', activity: 'Live activity', payments: 'Payments', waitlist: 'Waitlist',
    community: 'Community', backmi: 'BackMi', resellers: 'Resellers', audit: 'Audit log', system: 'System',
    notifications: 'Notifications', enablePush: 'Enable push notifications', disablePush: 'Disable push', markAllRead: 'Mark all read', noNotifications: 'No admin notifications yet.', pushEnabled: 'Push notifications are on.',
  },
  af: {
    title: 'Admin Beheersentrum', subtitle: 'Lede, geld en aktiwiteit op een veilige plek.', back: 'Terug na We-Rise', logout: 'Meld af',
    overview: 'Oorsig', members: 'Lede', activity: 'Lewende aktiwiteit', payments: 'Betalings', waitlist: 'Waglys',
    community: 'Gemeenskap', backmi: 'BackMi', resellers: 'Herverkopers', audit: 'Ouditlog', system: 'Stelsel',
    notifications: 'Kennisgewings', enablePush: 'Aktiveer stootkennisgewings', disablePush: 'Skakel stoot af', markAllRead: 'Merk almal gelees', noNotifications: 'Nog geen admin-kennisgewings nie.', pushEnabled: 'Stootkennisgewings is aan.',
  },
};

const money = (value) => `R${Number(value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value) => value ? new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const dateOnly = (value) => value ? new Date(value).toLocaleDateString('en-ZA', { dateStyle: 'medium' }) : '—';

function StatusPill({ value }) {
  const status = String(value || 'unknown').toLowerCase();
  return <span className={`admin-status admin-status-${status.replace(/[^a-z0-9]+/g, '-')}`}>{status.replaceAll('_', ' ')}</span>;
}

function Empty({ children }) {
  return <div className="admin-empty"><HiInformationCircle /> <span>{children}</span></div>;
}

function Loading() {
  return <div className="admin-loading"><span className="admin-spinner" /> Loading…</div>;
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

function NotificationsBell({ lang = 'en', strings, onOpenMember }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread_count: 0, push_configured: false });
  const [error, setError] = useState('');
  const [pushState, setPushState] = useState('checking');
  const [pushBusy, setPushBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await apiRequest('/api/admin/notifications?limit=40');
      setData(next || { items: [], unread_count: 0 });
      setError('');
    } catch (e) { setError(e.message); }
  }, []);

  const syncExistingPush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushState('unsupported'); return;
    }
    if (Notification.permission === 'denied') { setPushState('blocked'); return; }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) { setPushState('disabled'); return; }
      setPushState('enabled');
      await apiRequest('/api/admin/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: subscription.toJSON() }) });
    } catch {
      setPushState('disabled');
    }
  }, []);

  useEffect(() => {
    load(); syncExistingPush();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, 12000);
    return () => window.clearInterval(timer);
  }, [load, syncExistingPush]);

  const enablePush = async () => {
    setPushBusy(true); setError('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error(lang === 'af' ? 'Hierdie blaaier ondersteun nie stootkennisgewings nie.' : 'This browser does not support push notifications.');
      const config = await apiRequest('/api/admin/push/config');
      if (!config?.configured || !config?.public_key) throw new Error(lang === 'af' ? 'Stootkennisgewings is nog nie op Render opgestel nie.' : 'Push notifications are not configured on Render yet.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setPushState(permission === 'denied' ? 'blocked' : 'disabled'); return; }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.public_key) });
      }
      await apiRequest('/api/admin/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: subscription.toJSON() }) });
      setPushState('enabled');
    } catch (e) { setError(e.message); }
    finally { setPushBusy(false); }
  };

  const disablePush = async () => {
    setPushBusy(true); setError('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await apiRequest('/api/admin/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setPushState('disabled');
    } catch (e) { setError(e.message); }
    finally { setPushBusy(false); }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/api/admin/notifications/read-all', { method: 'POST', body: '{}' });
      setData(current => ({ ...current, unread_count: 0, items: (current.items || []).map(item => ({ ...item, read: true })) }));
    } catch (e) { setError(e.message); }
  };

  const openNotification = async (item) => {
    if (!item.read) {
      try { await apiRequest(`/api/admin/notifications/${item.id}/read`, { method: 'POST', body: '{}' }); } catch {}
      setData(current => ({ ...current, unread_count: Math.max(0, Number(current.unread_count || 0) - 1), items: (current.items || []).map(row => row.id === item.id ? { ...row, read: true } : row) }));
    }
    setOpen(false);
    if (item.member_key) onOpenMember(item.member_key);
  };

  const pushLabel = pushState === 'enabled' ? strings.pushEnabled
    : pushState === 'blocked' ? (lang === 'af' ? 'Kennisgewings is in jou blaaier geblokkeer.' : 'Notifications are blocked in your browser.')
    : pushState === 'unsupported' ? (lang === 'af' ? 'Stootkennisgewings word nie hier ondersteun nie.' : 'Push notifications are not supported here.')
    : strings.enablePush;

  return <div className="admin-notification-wrap">
    <button className={`admin-bell ${open ? 'active' : ''}`} onClick={() => setOpen(value => !value)} aria-label={strings.notifications}>
      <HiBell />
      {Number(data.unread_count || 0) > 0 && <span className="admin-bell-badge">{Number(data.unread_count) > 99 ? '99+' : data.unread_count}</span>}
    </button>
    {open && <div className="admin-notification-panel">
      <div className="admin-notification-head"><div><strong>{strings.notifications}</strong><span>{Number(data.unread_count || 0)} {lang === 'af' ? 'ongelees' : 'unread'}</span></div>{Number(data.unread_count || 0) > 0 && <button onClick={markAllRead}>{strings.markAllRead}</button>}</div>
      <div className="admin-push-row"><div><HiBell /><span>{pushLabel}</span></div>{pushState === 'enabled' ? <button disabled={pushBusy} onClick={disablePush}>{strings.disablePush}</button> : !['blocked','unsupported'].includes(pushState) ? <button disabled={pushBusy || pushState === 'checking'} onClick={enablePush}>{strings.enablePush}</button> : null}</div>
      {error && <div className="admin-notification-error">{error}</div>}
      <div className="admin-notification-list">
        {(data.items || []).length === 0 ? <div className="admin-notification-empty">{strings.noNotifications}</div> : (data.items || []).map(item => <button key={item.id} className={`admin-notification-item ${item.read ? '' : 'unread'}`} onClick={() => openNotification(item)}>
          <span className="admin-notification-dot" /><div><strong>{item.title}</strong><p>{item.body}</p><time>{dateTime(item.created_at)}</time></div>
        </button>)}
      </div>
    </div>}
  </div>;
}

function Overview({ data, refresh }) {
  const m = data?.metrics || {};
  const cards = [
    ['Members', m.total_members, HiUsers],
    ['New today', m.new_today, HiUserAdd],
    ['Paid members', m.active_members, HiCheckCircle],
    ['Trial members', m.trial_members, HiClock],
    ['Waitlist', m.waitlist_count, HiUsers],
    ['Estimated MRR', money(m.estimated_mrr_zar), HiChartBar],
    ['Revenue this month', money(m.revenue_month_zar), HiCash],
    ['Failed payments', m.failed_payments_month, HiExclamationCircle],
  ];
  return <div className="admin-section-stack">
    <div className="admin-section-heading"><div><h2>Overview</h2><p>Current We-Rise membership and payment health.</p></div><button className="admin-icon-button" onClick={refresh}><HiRefresh /></button></div>
    <div className="admin-metric-grid">{cards.map(([label, value, Icon]) => <div className="admin-metric-card" key={label}><div className="admin-metric-icon"><Icon /></div><div><span>{label}</span><strong>{value ?? 0}</strong></div></div>)}</div>
    <div className="admin-summary-grid">
      <div className="admin-panel"><h3>Membership</h3><div className="admin-kv"><span>Past due</span><strong>{m.past_due_members || 0}</strong></div><div className="admin-kv"><span>Cancelled</span><strong>{m.cancelled_members || 0}</strong></div><div className="admin-kv"><span>Payments today</span><strong>{m.payments_today || 0}</strong></div></div>
      <div className="admin-panel"><h3>Revenue</h3><div className="admin-kv"><span>Today</span><strong>{money(m.revenue_today_zar)}</strong></div><div className="admin-kv"><span>Joining fees this month</span><strong>{money(m.joining_revenue_month_zar)}</strong></div><div className="admin-kv"><span>Recurring this month</span><strong>{money(m.recurring_revenue_month_zar)}</strong></div></div>
      <div className="admin-panel"><h3>Provider</h3><div className="admin-kv"><span>Payments</span><strong>Paystack</strong></div><div className="admin-kv"><span>Mode</span><strong>{data?.system?.paystack_mode || '—'}</strong></div><div className="admin-kv"><span>Ask We-Rise</span><strong>{data?.system?.gemini_configured ? 'Online' : 'Offline'}</strong></div></div>
    </div>
  </div>;
}

function Members({ focusMemberKey = '', onFocusConsumed }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '30', status });
      if (search.trim()) params.set('search', search.trim());
      setData(await apiRequest(`/api/admin/members?${params}`));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => { const timer = setTimeout(load, 220); return () => clearTimeout(timer); }, [load]);

  const openMember = async (memberKey) => {
    try { setSelected({ loading: true }); setSelected(await apiRequest(`/api/admin/members/${encodeURIComponent(memberKey)}`)); }
    catch (e) { setSelected({ error: e.message }); }
  };

  useEffect(() => {
    if (!focusMemberKey) return;
    openMember(focusMemberKey);
    onFocusConsumed?.();
  }, [focusMemberKey]);

  return <div className="admin-section-stack">
    <div className="admin-section-heading"><div><h2>Members</h2><p>Search registered We-Rise accounts and inspect membership/payment history.</p></div><button className="admin-icon-button" onClick={load}><HiRefresh /></button></div>
    <div className="admin-toolbar"><label className="admin-search"><HiSearch /><input placeholder="Search name or email" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><label className="admin-select"><HiFilter /><select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="all">All statuses</option><option value="active">Active</option><option value="trialing">Trial</option><option value="past_due">Past due</option><option value="cancelled">Cancelled</option><option value="suspended">Suspended</option></select></label></div>
    {loading ? <Loading /> : error ? <Empty>{error}</Empty> : <>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th><th>Last seen</th><th></th></tr></thead><tbody>{(data?.items || []).map(row => <tr key={row.member_key}><td><div className="admin-person"><span className="admin-mini-avatar">{row.avatar_url ? <img src={row.avatar_url} alt="" /> : String(row.display_name || 'W')[0]}</span><div><strong>{row.display_name}</strong><small>{row.email || 'No email'}</small></div></div></td><td><StatusPill value={row.role} /></td><td><StatusPill value={row.membership?.status} /></td><td>{dateOnly(row.created_at)}</td><td>{dateTime(row.last_seen_at)}</td><td><button className="admin-small-button" onClick={() => openMember(row.member_key)}><HiEye /> View</button></td></tr>)}</tbody></table></div>
      <div className="admin-pagination"><span>{Number(data?.total || 0).toLocaleString()} members</span><div><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button disabled={!data?.has_more} onClick={() => setPage(p => p + 1)}>Next</button></div></div>
    </>}
    {selected && <div className="admin-drawer-backdrop" onClick={() => setSelected(null)}><aside className="admin-drawer" onClick={e => e.stopPropagation()}><button className="admin-drawer-close" onClick={() => setSelected(null)}><HiXCircle /></button>{selected.loading ? <Loading /> : selected.error ? <Empty>{selected.error}</Empty> : <MemberDetail data={selected} />}</aside></div>}
  </div>;
}

function MemberDetail({ data }) {
  const p = data?.profile || {};
  const a = data?.auth || {};
  const m = data?.membership || {};
  return <div className="admin-member-detail">
    <div className="admin-detail-hero">{p.avatar_url ? <img src={p.avatar_url} alt="Registration selfie" /> : <div className="admin-detail-placeholder">{String(p.display_name || 'W')[0]}</div>}<div><span className="eyebrow">MEMBER RECORD</span><h2>{p.display_name}</h2><p>{p.email || 'No email'}</p><StatusPill value={p.role} /> <StatusPill value={m.status} /></div></div>
    <div className="admin-detail-grid">
      <div><span>Email</span><strong>{p.email || '—'}</strong></div><div><span>Phone</span><strong>{a.phone || 'Not collected'}</strong></div>
      <div><span>Joined</span><strong>{dateTime(p.created_at)}</strong></div><div><span>Last sign-in</span><strong>{dateTime(a.last_sign_in_at)}</strong></div>
      <div><span>Email confirmed</span><strong>{dateTime(a.email_confirmed_at)}</strong></div><div><span>Last seen</span><strong>{dateTime(p.last_seen_at)}</strong></div>
      <div><span>Membership status</span><strong>{m.status || '—'}</strong></div><div><span>Trial ends</span><strong>{dateTime(m.trial_ends_at)}</strong></div>
      <div><span>Joining payment</span><strong>{dateTime(m.joining_paid_at)}</strong></div><div><span>Next billing</span><strong>{m.next_billing_date || '—'}</strong></div>
      <div><span>Monthly amount</span><strong>{m.monthly_amount_zar ? money(m.monthly_amount_zar) : '—'}</strong></div><div><span>Paystack customer</span><strong className="admin-code">{p.paystack_customer_code || '—'}</strong></div>
      <div><span>Subscription</span><strong className="admin-code">{p.subscription_code || '—'}</strong></div><div><span>Subscription status</span><strong>{p.subscription_status || '—'}</strong></div>
    </div>
    <h3>Recent payments</h3>
    {(data?.payments || []).length ? <div className="admin-table-wrap"><table className="admin-table compact"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>{data.payments.map(pay => <tr key={pay.id}><td>{dateTime(pay.verified_at || pay.created_at)}</td><td>{pay.purpose?.replaceAll('_', ' ')}</td><td>{money(pay.amount_gross_zar || pay.expected_amount_zar)}</td><td><StatusPill value={pay.status} /></td></tr>)}</tbody></table></div> : <Empty>No payment history yet.</Empty>}
  </div>;
}

function Activity() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { setError(''); setData(await apiRequest('/api/admin/activity?limit=60')); } catch (e) { setError(e.message); } }, []);
  useEffect(() => { load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer); }, [load]);
  return <div className="admin-section-stack"><div className="admin-section-heading"><div><h2>Live activity</h2><p>Recent joins, payments and waitlist activity.</p></div><button className="admin-icon-button" onClick={load}><HiRefresh /></button></div>{error ? <Empty>{error}</Empty> : !data ? <Loading /> : <div className="admin-feed">{(data.items || []).map((item, i) => <div className="admin-feed-item" key={`${item.type}-${item.id || i}`}><div className={`admin-feed-dot ${item.type}`} /><div><strong>{item.title}</strong><p>{item.detail}</p></div><time>{dateTime(item.at)}</time></div>)}</div>}</div>;
}

function Payments() {
  const [status, setStatus] = useState('all'); const [purpose, setPurpose] = useState('all'); const [page, setPage] = useState(1);
  const [data, setData] = useState(null); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setError(''); const q = new URLSearchParams({ status, purpose, page: String(page), page_size: '40' }); setData(await apiRequest(`/api/admin/payments?${q}`)); } catch (e) { setError(e.message); } }, [page, purpose, status]);
  useEffect(() => { load(); }, [load]);
  return <div className="admin-section-stack"><div className="admin-section-heading"><div><h2>Payments</h2><p>Verified Paystack transaction records stored by We-Rise.</p></div><button className="admin-icon-button" onClick={load}><HiRefresh /></button></div><div className="admin-toolbar"><label className="admin-select"><select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="all">All statuses</option><option value="complete">Complete</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="refunded">Refunded</option><option value="reversed">Reversed</option></select></label><label className="admin-select"><select value={purpose} onChange={e => { setPurpose(e.target.value); setPage(1); }}><option value="all">All payment types</option><option value="membership_joining">Joining fee</option><option value="membership_recurring">Monthly membership</option><option value="backmi_gift">BackMi gift</option></select></label></div>{error ? <Empty>{error}</Empty> : !data ? <Loading /> : <><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Member</th><th>Type</th><th>Gross</th><th>Fee</th><th>Net</th><th>Status</th></tr></thead><tbody>{(data.items || []).map(row => <tr key={row.id}><td>{dateTime(row.verified_at || row.created_at)}</td><td><strong>{row.member_name || 'Member'}</strong><small className="admin-table-sub">{row.member_email || row.member_key}</small></td><td>{row.purpose?.replaceAll('_', ' ')}</td><td>{money(row.amount_gross_zar || row.expected_amount_zar)}</td><td>{row.amount_fee_zar == null ? '—' : money(row.amount_fee_zar)}</td><td>{row.amount_net_zar == null ? '—' : money(row.amount_net_zar)}</td><td><StatusPill value={row.status} /></td></tr>)}</tbody></table></div><div className="admin-pagination"><span>{Number(data.total || 0).toLocaleString()} transactions</span><div><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button disabled={!data.has_more} onClick={() => setPage(p => p + 1)}>Next</button></div></div></>}</div>;
}

function WaitlistAdmin() {
  const [data, setData] = useState(null); const [search, setSearch] = useState(''); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setError(''); const q = new URLSearchParams({ page_size: '500' }); if (search.trim()) q.set('search', search.trim()); setData(await apiRequest(`/api/admin/waitlist?${q}`)); } catch (e) { setError(e.message); } }, [search]);
  useEffect(() => { const t = setTimeout(load, 180); return () => clearTimeout(t); }, [load]);
  const remove = async (row) => { if (!window.confirm(`Remove ${row.name} from the waitlist?`)) return; try { await apiRequest(`/api/admin/waitlist/${row.id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(e.message); } };
  const exportCsv = () => {
    const rows = data?.items || []; const values = [['Name','Email','Age','Province','City/Town','Country','Joined'], ...rows.map(r => [r.name,r.email,r.age,r.province,r.city_town,r.country,r.created_at])];
    const csv = values.map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = `we-rise-waitlist-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(href);
  };
  return <div className="admin-section-stack"><div className="admin-section-heading"><div><h2>Waitlist</h2><p>Prospective members who have not registered yet.</p></div><div className="admin-heading-actions"><button className="admin-small-button" onClick={exportCsv} disabled={!data?.items?.length}><HiDocumentDownload /> Export CSV</button><button className="admin-icon-button" onClick={load}><HiRefresh /></button></div></div><div className="admin-toolbar"><label className="admin-search"><HiSearch /><input placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)} /></label></div>{error ? <Empty>{error}</Empty> : !data ? <Loading /> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Age</th><th>Location</th><th>Details</th><th>Joined</th><th></th></tr></thead><tbody>{(data.items || []).map(row => <tr key={row.id}><td><strong>{row.name}</strong><small className="admin-table-sub">{row.email}</small></td><td>{row.age}</td><td>{[row.city_town,row.province,row.country].filter(Boolean).join(', ')}</td><td className="admin-waitlist-detail">{row.explanation || '—'}</td><td>{dateTime(row.created_at)}</td><td><button className="admin-danger-button" onClick={() => remove(row)}><HiTrash /> Remove</button></td></tr>)}</tbody></table></div>}</div>;
}

function CommunityAdmin() {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setError(''); setData(await apiRequest('/api/admin/community?limit=100')); } catch (e) { setError(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const remove = async (kind, row) => { if (!window.confirm(`Permanently remove this ${kind}?`)) return; try { await apiRequest(`/api/admin/community/${kind === 'topic' ? 'topics' : 'comments'}/${row.id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(e.message); } };
  return <div className="admin-section-stack"><div className="admin-section-heading"><div><h2>Community moderation</h2><p>Review recent posts and comments. Deletions are recorded in the audit log.</p></div><button className="admin-icon-button" onClick={load}><HiRefresh /></button></div>{error ? <Empty>{error}</Empty> : !data ? <Loading /> : <div className="admin-moderation-grid"><div className="admin-panel"><h3>Recent posts</h3>{(data.topics || []).map(row => <div className="admin-mod-item" key={row.id}><div><strong>{row.author}</strong><p>{row.title}</p><small>{dateTime(row.created_at)}</small></div><button onClick={() => remove('topic', row)}><HiTrash /></button></div>)}</div><div className="admin-panel"><h3>Recent comments</h3>{(data.comments || []).map(row => <div className="admin-mod-item" key={row.id}><div><strong>{row.author}</strong><p>{row.content}</p><small>{dateTime(row.created_at)}</small></div><button onClick={() => remove('comment', row)}><HiTrash /></button></div>)}</div></div>}</div>;
}

function BackMiAdmin() {
  const [queue, setQueue] = useState(null); const [ledger, setLedger] = useState(null); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setError(''); const [q,l] = await Promise.all([apiRequest('/api/backmi/review-queue'), apiRequest('/api/admin/backmi/ledger?limit=80')]); setQueue(q); setLedger(l); } catch (e) { setError(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  return <div className="admin-section-stack"><div className="admin-section-heading"><div><h2>BackMi</h2><p>Review queue and financial ledger visibility.</p></div><button className="admin-icon-button" onClick={load}><HiRefresh /></button></div>{error ? <Empty>{error}</Empty> : (!queue || !ledger) ? <Loading /> : <><div className="admin-summary-grid"><div className="admin-panel"><h3>Pending review</h3><div className="admin-big-value">{queue.length}</div></div>{Object.entries(ledger.balances || {}).slice(0,5).map(([key,value]) => <div className="admin-panel" key={key}><h3>{key.replaceAll('_',' ')}</h3><div className="admin-big-value">{money(value)}</div></div>)}</div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Request</th><th>Creator</th><th>Goal</th><th>Status</th><th>Submitted</th></tr></thead><tbody>{queue.map(row => <tr key={row.id}><td>{row.request_code || row.id}</td><td>{row.creator}</td><td>{money(row.goal)}</td><td><StatusPill value={row.status} /></td><td>{dateTime(row.submitted_at || row.createdAt)}</td></tr>)}</tbody></table></div></>}</div>;
}

function ResellersAdmin() {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setError(''); setData(await apiRequest('/api/admin/resellers?limit=200')); } catch (e) { setError(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  return <div className="admin-section-stack"><div className="admin-section-heading"><div><h2>Resellers</h2><p>Referral records currently stored by We-Rise.</p></div><button className="admin-icon-button" onClick={load}><HiRefresh /></button></div>{error ? <Empty>{error}</Empty> : !data ? <Loading /> : <><div className="admin-metric-grid"><div className="admin-metric-card"><div className="admin-metric-icon"><HiUsers /></div><div><span>Referral records</span><strong>{data.total || 0}</strong></div></div><div className="admin-metric-card"><div className="admin-metric-icon"><HiCash /></div><div><span>Recorded commission</span><strong>{money(data.total_commission_zar)}</strong></div></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Referrer</th><th>Referred email</th><th>Commission</th><th>Status</th><th>Date</th></tr></thead><tbody>{(data.items || []).map(row => <tr key={row.id}><td><strong>{row.referrer_name || row.referrer}</strong><small className="admin-table-sub">{row.referrer_email || ''}</small></td><td>{row.referred_email || '—'}</td><td>{money(row.commission)}</td><td><StatusPill value={row.status} /></td><td>{dateTime(row.created_at)}</td></tr>)}</tbody></table></div></>}</div>;
}

function Audit() {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  const load = useCallback(async () => { try { setError(''); setData(await apiRequest('/api/admin/audit?limit=250')); } catch (e) { setError(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  return <div className="admin-section-stack"><div className="admin-section-heading"><div><h2>Audit log</h2><p>Permanent record of sensitive admin actions.</p></div><button className="admin-icon-button" onClick={load}><HiRefresh /></button></div>{error ? <Empty>{error}</Empty> : !data ? <Loading /> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Admin</th><th>Action</th><th>Target</th></tr></thead><tbody>{(data.items || []).map(row => <tr key={row.id}><td>{dateTime(row.created_at)}</td><td><strong>{row.actor_email || row.actor_member_key || 'System'}</strong><small className="admin-table-sub">{row.actor_role}</small></td><td>{row.action?.replaceAll('_',' ')}</td><td>{[row.target_type,row.target_key].filter(Boolean).join(' · ') || '—'}</td></tr>)}</tbody></table></div>}</div>;
}

function SystemAdmin({ data }) {
  const s = data?.system || {};
  const p = data?.payment_settings || {};
  return <div className="admin-section-stack"><div className="admin-section-heading"><div><h2>System</h2><p>Read-only production configuration. Secrets are never exposed here.</p></div></div><div className="admin-summary-grid"><div className="admin-panel"><h3>Payments</h3><div className="admin-kv"><span>Provider</span><strong>Paystack</strong></div><div className="admin-kv"><span>Mode</span><strong>{s.paystack_mode || '—'}</strong></div><div className="admin-kv"><span>Joining fee</span><strong>{money(p.joining_fee_zar)}</strong></div><div className="admin-kv"><span>Monthly fee</span><strong>{money(p.monthly_fee_zar)}</strong></div></div><div className="admin-panel"><h3>Services</h3><div className="admin-kv"><span>Ask We-Rise</span><strong>{s.gemini_configured ? 'Online' : 'Offline'}</strong></div><div className="admin-kv"><span>Emergency SMS</span><strong>{s.sms_configured ? 'Online' : 'Manual'}</strong></div><div className="admin-kv"><span>Support email</span><strong>{s.support_email_configured ? 'Online' : 'Disabled'}</strong></div><div className="admin-kv"><span>Admin push</span><strong>{s.admin_push_configured ? 'Online' : 'Setup required'}</strong></div></div><div className="admin-panel"><h3>Admin roles</h3><p className="admin-help-copy">Owner and Admin accounts bypass membership payment locks. Role access is controlled on Render with environment variables, not in the browser.</p></div></div></div>;
}

export default function AdminDashboard({ lang = 'en', profile, onToggleLang, onLogout }) {
  const strings = copy[lang] || copy.en;
  const initialParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const initialMemberKey = initialParams.get('member') || '';
  const initialNotificationId = Number(initialParams.get('notification') || 0);
  const [section, setSection] = useState(initialMemberKey ? 'members' : 'overview');
  const [focusMemberKey, setFocusMemberKey] = useState(initialMemberKey);
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState('');
  const loadOverview = useCallback(async () => { try { setOverviewError(''); setOverview(await apiRequest('/api/admin/overview')); } catch (e) { setOverviewError(e.message); } }, []);
  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { if (Number.isInteger(initialNotificationId) && initialNotificationId > 0) apiRequest(`/api/admin/notifications/${initialNotificationId}/read`, { method: 'POST', body: '{}' }).catch(() => {}); }, [initialNotificationId]);

  const sections = useMemo(() => [
    ['overview', strings.overview, HiHome], ['members', strings.members, HiUsers], ['activity', strings.activity, HiClock],
    ['payments', strings.payments, HiCreditCard], ['waitlist', strings.waitlist, HiUserAdd], ['community', strings.community, HiUsers],
    ['backmi', strings.backmi, HiShieldCheck], ['resellers', strings.resellers, HiCash], ['audit', strings.audit, HiLockClosed], ['system', strings.system, HiChartBar],
  ], [strings]);

  const page = section === 'overview' ? (overviewError ? <Empty>{overviewError}</Empty> : !overview ? <Loading /> : <Overview data={overview} refresh={loadOverview} />)
    : section === 'members' ? <Members focusMemberKey={focusMemberKey} onFocusConsumed={() => setFocusMemberKey('')} /> : section === 'activity' ? <Activity /> : section === 'payments' ? <Payments />
    : section === 'waitlist' ? <WaitlistAdmin /> : section === 'community' ? <CommunityAdmin /> : section === 'backmi' ? <BackMiAdmin />
    : section === 'resellers' ? <ResellersAdmin /> : section === 'audit' ? <Audit /> : <SystemAdmin data={overview} />;

  const openMemberFromNotification = (memberKey) => {
    setFocusMemberKey(memberKey);
    setSection('members');
    if (typeof window !== 'undefined') window.history.replaceState({}, '', '/admin');
  };

  return <div className="admin-shell">
    <header className="admin-topbar"><div className="admin-brand"><BrandMark variant="compact" className="app-logo-icon" /><div><strong>We-Rise</strong><span>{strings.title}</span></div></div><div className="admin-top-actions"><NotificationsBell lang={lang} strings={strings} onOpenMember={openMemberFromNotification} /><a href="/" className="admin-top-link"><HiArrowLeft /> {strings.back}</a><button className="lang-toggle" onClick={onToggleLang}>{lang === 'en' ? 'AF' : 'EN'}</button><button className="admin-logout" onClick={onLogout}><HiLogout /> <span>{strings.logout}</span></button></div></header>
    <div className="admin-layout"><aside className="admin-sidebar"><div className="admin-owner-card"><span className="admin-mini-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : String(profile?.display_name || 'W')[0]}</span><div><strong>{profile?.display_name || 'Admin'}</strong><small>{profile?.role === 'owner' ? 'OWNER' : 'ADMIN'}</small></div></div><nav>{sections.map(([id,label,Icon]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><Icon /><span>{label}</span></button>)}</nav></aside><main className="admin-main">{page}</main></div>
  </div>;
}
