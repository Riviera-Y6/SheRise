import React, { useEffect, useMemo, useState } from 'react';
import {
  HiCurrencyDollar,
  HiShieldCheck,
  HiCash,
  HiHome,
  HiTrendingUp,
  HiClock,
  HiPlus,
  HiTrash,
  HiSave,
  HiCalculator,
  HiExclamationCircle,
  HiLightBulb,
  HiChevronDown,
  HiChevronUp,
} from 'react-icons/hi';
import { apiRequest } from '../lib/api';

const EMPTY = {
  monthlyIncome: 0,
  monthlyExpenses: 0,
  emergencyFund: 0,
  liquidCapital: 0,
  assetsValue: 0,
  debtBalance: 0,
  age: 30,
  retirementAge: 65,
  retirementSavings: 0,
  retirementMonthlyContribution: 0,
  retirementGrowthRate: 6,
  incomeStreams: [],
  goals: [],
  debtPlanner: { balance: 0, rate: 10.5, payment: 0, extra: 0 },
  whatIf: { scenario: 'partner_income', lostIncome: 0 },
};

const money = (value) => `R${Math.max(0, Number(value || 0)).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : 0));
const num = (value) => Math.max(0, Number(value) || 0);

function monthsToPay(balance, annualRate, payment) {
  balance = num(balance); payment = num(payment); annualRate = num(annualRate) / 100;
  if (!balance || !payment) return null;
  const monthlyRate = annualRate / 12;
  if (!monthlyRate) return Math.ceil(balance / payment);
  if (payment <= balance * monthlyRate) return null;
  return Math.ceil(-Math.log(1 - (monthlyRate * balance) / payment) / Math.log(1 + monthlyRate));
}

function totalInterest(balance, annualRate, payment) {
  const months = monthsToPay(balance, annualRate, payment);
  if (!months) return null;
  return Math.max(0, months * num(payment) - num(balance));
}

function futureValue(current, monthly, years, annualRate) {
  const months = Math.max(0, Math.round(years * 12));
  const r = num(annualRate) / 100 / 12;
  if (!months) return num(current);
  if (!r) return num(current) + num(monthly) * months;
  return num(current) * Math.pow(1 + r, months) + num(monthly) * ((Math.pow(1 + r, months) - 1) / r);
}

export default function Wealth({ lang = 'af', showToast }) {
  const af = lang === 'af';
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState({ profile: true, whatif: false, income: false, goals: false, debt: false, retirement: false });

  useEffect(() => {
    let mounted = true;
    apiRequest('/api/wealth')
      .then((res) => {
        if (!mounted) return;
        setData({ ...EMPTY, ...(res?.data || {}), debtPlanner: { ...EMPTY.debtPlanner, ...(res?.data?.debtPlanner || {}) }, whatIf: { ...EMPTY.whatIf, ...(res?.data?.whatIf || {}) }, incomeStreams: Array.isArray(res?.data?.incomeStreams) ? res.data.incomeStreams : [], goals: Array.isArray(res?.data?.goals) ? res.data.goals : [] });
      })
      .catch(() => showToast?.(af ? 'Kon nie jou Welvaart-data laai nie.' : 'Could not load your Wealth data.'))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [af, showToast]);

  const update = (field, value) => setData((d) => ({ ...d, [field]: value }));
  const updateNested = (group, field, value) => setData((d) => ({ ...d, [group]: { ...d[group], [field]: value } }));

  const metrics = useMemo(() => {
    const baseIncome = num(data.monthlyIncome);
    const streamIncome = (data.incomeStreams || []).reduce((s, x) => s + num(x.amount), 0);
    const totalIncome = baseIncome + streamIncome;
    const expenses = num(data.monthlyExpenses);
    const emergencyMonths = expenses ? num(data.emergencyFund) / expenses : 0;
    const monthlySurplus = Math.max(0, totalIncome - expenses);
    const incomeScore = clamp((totalIncome > 0 ? 35 : 0) + (streamIncome > 0 ? 25 : 0) + (monthlySurplus > 0 ? Math.min(40, (monthlySurplus / Math.max(totalIncome, 1)) * 100) : 0));
    const protectionScore = clamp((emergencyMonths / 6) * 100);
    const capitalScore = clamp(expenses ? (num(data.liquidCapital) / (expenses * 6)) * 100 : (data.liquidCapital ? 35 : 0));
    const assetScore = clamp(num(data.assetsValue) ? 30 + Math.min(70, num(data.assetsValue) / Math.max(expenses * 24, 1) * 70) : 0);
    const debtScore = clamp(data.debtBalance ? Math.max(0, 100 - (num(data.debtBalance) / Math.max(totalIncome * 24, 1)) * 100) : 100);
    const years = Math.max(0, num(data.retirementAge) - num(data.age));
    const projected = futureValue(data.retirementSavings, data.retirementMonthlyContribution, years, data.retirementGrowthRate);
    const retirementTarget = expenses * 12 * 20;
    const retirementScore = clamp(retirementTarget ? (projected / retirementTarget) * 100 : (projected ? 25 : 0));
    const pillars = [incomeScore, protectionScore, capitalScore, assetScore, debtScore, retirementScore];
    return { totalIncome, streamIncome, expenses, emergencyMonths, monthlySurplus, projected, retirementTarget, scores: pillars, overall: Math.round(pillars.reduce((a, b) => a + b, 0) / pillars.length) };
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest('/api/wealth', { method: 'PUT', body: JSON.stringify({ data }) });
      showToast?.(af ? 'Jou Welvaart-plan is gestoor. 💗' : 'Your Wealth plan has been saved. 💗');
    } catch (e) {
      showToast?.(e?.message || (af ? 'Kon nie Welvaart stoor nie.' : 'Could not save Wealth data.'));
    } finally { setSaving(false); }
  };

  const addIncome = () => setData((d) => ({ ...d, incomeStreams: [...d.incomeStreams, { id: crypto.randomUUID?.() || Date.now().toString(), name: '', amount: 0 }] }));
  const addGoal = () => setData((d) => ({ ...d, goals: [...d.goals, { id: crypto.randomUUID?.() || Date.now().toString(), name: '', target: 0, saved: 0 }] }));
  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const pillars = [
    { icon: HiCurrencyDollar, title: af ? 'Inkomste' : 'Income', score: metrics.scores[0], desc: af ? 'Kan ek inkomste verdien sonder om van net een persoon of bron afhanklik te wees?' : 'Can I earn without depending on only one person or source?' },
    { icon: HiShieldCheck, title: af ? 'Beskerming' : 'Protection', score: metrics.scores[1], desc: af ? 'Hoe lank kan my huishouding funksioneer as inkomste skielik stop?' : 'How long can my household function if income suddenly stops?' },
    { icon: HiCash, title: af ? 'Kapitaal' : 'Capital', score: metrics.scores[2], desc: af ? 'Het ek beskikbare geld om my volgende stap te finansier?' : 'Do I have accessible money to finance my next step?' },
    { icon: HiHome, title: af ? 'Bates' : 'Assets', score: metrics.scores[3], desc: af ? 'Wat besit ek wat waarde kan behou of oor tyd kan groei?' : 'What do I own that can retain or grow value over time?' },
    { icon: HiTrendingUp, title: af ? 'Skuldvryheid' : 'Debt Freedom', score: metrics.scores[4], desc: af ? 'Bou ek doelbewus ’n lewe met minder skuld?' : 'Am I deliberately building a life with less debt?' },
    { icon: HiClock, title: af ? 'Aftree-Welvaart' : 'Retirement Wealth', score: metrics.scores[5], desc: af ? 'Bou ek nou reeds vir die jare wanneer ek nie meer wil of kan werk nie?' : 'Am I building now for the years when I no longer want or can work?' },
  ];

  const dp = data.debtPlanner;
  const normalMonths = monthsToPay(dp.balance, dp.rate, dp.payment);
  const extraMonths = monthsToPay(dp.balance, dp.rate, num(dp.payment) + num(dp.extra));
  const normalInterest = totalInterest(dp.balance, dp.rate, dp.payment);
  const extraInterest = totalInterest(dp.balance, dp.rate, num(dp.payment) + num(dp.extra));
  const monthsSaved = normalMonths && extraMonths ? Math.max(0, normalMonths - extraMonths) : 0;
  const interestSaved = normalInterest != null && extraInterest != null ? Math.max(0, normalInterest - extraInterest) : 0;

  const scenarioShortfall = Math.max(0, metrics.expenses - Math.max(0, metrics.totalIncome - num(data.whatIf.lostIncome)));
  const reserveMonthsAfterShock = scenarioShortfall ? num(data.emergencyFund) / scenarioShortfall : Infinity;

  return (
    <section className="wealth-page">
      <div className="wealth-hero">
        <div className="wealth-title"><span className="wealth-bag">💰</span><h1>{af ? 'Welvaart' : 'Wealth'}</h1></div>
        <p>{af ? 'Bou jou eie toekoms. Moenie wag vir ’n krisis om uit te vind dat jy niks opgebou het nie.' : 'Build your own future. Do not wait for a crisis to discover that you have built nothing of your own.'}</p>
      </div>

      <div className="wealth-crown-card">
        <div className="wealth-crown">👑</div>
        <h2>{af ? 'Jou Welvaart. Jou Vryheid.' : 'Your Wealth. Your Freedom.'}</h2>
        <p>{af ? 'We-Rise wil hê dat ’n vrou nie eendag moet vra “Wie gaan vir my sorg?” nie — maar met vertroue kan sê: “Ek het vir myself voorsiening gemaak.”' : 'We-Rise wants a woman not to ask one day “Who will take care of me?” — but to say with confidence: “I provided for myself.”'}</p>
      </div>

      <div className="wealth-meter-card">
        <div className="wealth-meter-head"><h2>{af ? 'My Finansiële Veerkrag' : 'My Financial Resilience'}</h2><span>{metrics.overall}%</span></div>
        <div className="wealth-progress"><div style={{ width: `${metrics.overall}%` }} /></div>
        <div className="wealth-meter-foot"><strong>{money(metrics.monthlySurplus)}</strong><span>{af ? 'maandelikse ruimte ná uitgawes' : 'monthly room after expenses'}</span></div>
      </div>

      <div className="wealth-panel">
        <h2>{af ? 'Die 6 Pilare van Welvaart' : 'The 6 Pillars of Wealth'}</h2>
        <p>{af ? 'Bou elke pilaar en jy bou ’n toekoms wat minder van ander afhanklik is.' : 'Build every pillar and you build a future that depends less on others.'}</p>
        <div className="wealth-pillars">
          {pillars.map(({ icon: Icon, title, score, desc }) => <div className="wealth-pillar" key={title}><div className="wealth-pillar-icon"><Icon /></div><div className="wealth-pillar-copy"><div className="wealth-pillar-row"><strong>{title}</strong><span>{Math.round(score)}%</span></div><div className="wealth-mini-progress"><div style={{ width: `${score}%` }} /></div><small>{desc}</small></div></div>)}
        </div>
      </div>

      <div className="wealth-accordion">
        <button className="wealth-accordion-head" onClick={() => toggle('profile')}><span><HiCalculator /> {af ? 'My Finansiële Grondslag' : 'My Financial Foundation'}</span>{open.profile ? <HiChevronUp/> : <HiChevronDown/>}</button>
        {open.profile && <div className="wealth-accordion-body wealth-grid-2">
          <label>{af ? 'Hoof maandelikse inkomste' : 'Main monthly income'}<div className="wealth-money-input"><span>R</span><input type="number" value={data.monthlyIncome || ''} onChange={e => update('monthlyIncome', num(e.target.value))}/></div></label>
          <label>{af ? 'Noodsaaklike maandelikse uitgawes' : 'Essential monthly expenses'}<div className="wealth-money-input"><span>R</span><input type="number" value={data.monthlyExpenses || ''} onChange={e => update('monthlyExpenses', num(e.target.value))}/></div></label>
          <label>{af ? 'Noodfonds' : 'Emergency fund'}<div className="wealth-money-input"><span>R</span><input type="number" value={data.emergencyFund || ''} onChange={e => update('emergencyFund', num(e.target.value))}/></div></label>
          <label>{af ? 'Beskikbare kapitaal / spaargeld' : 'Accessible capital / savings'}<div className="wealth-money-input"><span>R</span><input type="number" value={data.liquidCapital || ''} onChange={e => update('liquidCapital', num(e.target.value))}/></div></label>
          <label>{af ? 'Geskatte waarde van bates' : 'Estimated asset value'}<div className="wealth-money-input"><span>R</span><input type="number" value={data.assetsValue || ''} onChange={e => update('assetsValue', num(e.target.value))}/></div></label>
          <label>{af ? 'Totale uitstaande skuld' : 'Total outstanding debt'}<div className="wealth-money-input"><span>R</span><input type="number" value={data.debtBalance || ''} onChange={e => update('debtBalance', num(e.target.value))}/></div></label>
        </div>}
      </div>

      <div className="wealth-accordion">
        <button className="wealth-accordion-head" onClick={() => toggle('whatif')}><span><HiExclamationCircle /> {af ? 'My “Wat As?”-Toets' : 'My “What If?” Test'}</span>{open.whatif ? <HiChevronUp/> : <HiChevronDown/>}</button>
        {open.whatif && <div className="wealth-accordion-body">
          <p className="wealth-help">{af ? 'Nie om jou bang te maak nie — om jou te wys waar jy vandag staan en wat jy nog kan bou.' : 'Not to frighten you — to show where you stand today and what you can still build.'}</p>
          <label>{af ? 'Scenario' : 'Scenario'}<select value={data.whatIf.scenario} onChange={e => updateNested('whatIf','scenario',e.target.value)}><option value="partner_income">{af ? 'My maat se inkomste val weg' : "My partner's income disappears"}</option><option value="job_loss">{af ? 'Ek verloor my werk' : 'I lose my job'}</option><option value="cannot_work">{af ? 'Ek kan vir ’n tyd nie werk nie' : 'I cannot work for a period'}</option><option value="retirement">{af ? 'Ek moet vroeër aftree' : 'I must retire earlier'}</option></select></label>
          <label>{af ? 'Hoeveel maandelikse inkomste sal in dié scenario wegval?' : 'How much monthly income would disappear in this scenario?'}<div className="wealth-money-input"><span>R</span><input type="number" value={data.whatIf.lostIncome || ''} onChange={e => updateNested('whatIf','lostIncome',num(e.target.value))}/></div></label>
          <div className="wealth-result-grid"><div><small>{af ? 'Maandelikse tekort' : 'Monthly shortfall'}</small><strong>{money(scenarioShortfall)}</strong></div><div><small>{af ? 'Noodfonds kan dek' : 'Emergency fund could cover'}</small><strong>{Number.isFinite(reserveMonthsAfterShock) ? `${reserveMonthsAfterShock.toFixed(1)} ${af ? 'maande' : 'months'}` : (af ? 'Geen tekort' : 'No shortfall')}</strong></div></div>
          <div className="wealth-guidance"><HiLightBulb/><span>{scenarioShortfall > 0 ? (af ? 'Jy het nog tyd. Fokus eers op ’n groter noodbuffer en meer as een inkomste-bron.' : 'You still have time. Focus first on a larger emergency buffer and more than one income source.') : (af ? 'Jou huidige syfers toon geen onmiddellike maandelikse tekort in hierdie scenario nie. Hou aan bou.' : 'Your current figures show no immediate monthly shortfall in this scenario. Keep building.')}</span></div>
        </div>}
      </div>

      <div className="wealth-accordion">
        <button className="wealth-accordion-head" onClick={() => toggle('income')}><span><HiCurrencyDollar /> {af ? 'My Inkomste-bronne' : 'My Income Streams'}</span>{open.income ? <HiChevronUp/> : <HiChevronDown/>}</button>
        {open.income && <div className="wealth-accordion-body">
          {(data.incomeStreams || []).map((item, i) => <div className="wealth-list-row" key={item.id || i}><input placeholder={af ? 'bv. Sybesigheid' : 'e.g. Side business'} value={item.name || ''} onChange={e => setData(d => ({...d, incomeStreams:d.incomeStreams.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))}/><div className="wealth-money-input"><span>R</span><input type="number" value={item.amount || ''} onChange={e => setData(d => ({...d, incomeStreams:d.incomeStreams.map((x,j)=>j===i?{...x,amount:num(e.target.value)}:x)}))}/></div><button className="wealth-delete" onClick={() => setData(d => ({...d,incomeStreams:d.incomeStreams.filter((_,j)=>j!==i)}))}><HiTrash/></button></div>)}
          <button className="wealth-add" onClick={addIncome}><HiPlus/> {af ? 'Voeg inkomste-bron by' : 'Add income stream'}</button>
          <div className="wealth-summary-line"><span>{af ? 'Totale maandelikse inkomste' : 'Total monthly income'}</span><strong>{money(metrics.totalIncome)}</strong></div>
        </div>}
      </div>

      <div className="wealth-accordion">
        <button className="wealth-accordion-head" onClick={() => toggle('goals')}><span><HiTrendingUp /> {af ? 'My Welvaart-doelwitte' : 'My Wealth Goals'}</span>{open.goals ? <HiChevronUp/> : <HiChevronDown/>}</button>
        {open.goals && <div className="wealth-accordion-body">
          {(data.goals || []).map((g,i) => { const pct = clamp(num(g.target) ? num(g.saved)/num(g.target)*100 : 0); return <div className="wealth-goal" key={g.id || i}><div className="wealth-goal-top"><input placeholder={af ? 'Doelwit se naam' : 'Goal name'} value={g.name || ''} onChange={e=>setData(d=>({...d,goals:d.goals.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))}/><button className="wealth-delete" onClick={()=>setData(d=>({...d,goals:d.goals.filter((_,j)=>j!==i)}))}><HiTrash/></button></div><div className="wealth-grid-2"><label>{af?'Reeds opgebou':'Already built'}<div className="wealth-money-input"><span>R</span><input type="number" value={g.saved||''} onChange={e=>setData(d=>({...d,goals:d.goals.map((x,j)=>j===i?{...x,saved:num(e.target.value)}:x)}))}/></div></label><label>{af?'Teiken':'Target'}<div className="wealth-money-input"><span>R</span><input type="number" value={g.target||''} onChange={e=>setData(d=>({...d,goals:d.goals.map((x,j)=>j===i?{...x,target:num(e.target.value)}:x)}))}/></div></label></div><div className="wealth-mini-progress"><div style={{width:`${pct}%`}}/></div><small>{Math.round(pct)}%</small></div> })}
          <button className="wealth-add" onClick={addGoal}><HiPlus/> {af ? 'Voeg doelwit by' : 'Add goal'}</button>
        </div>}
      </div>

      <div className="wealth-accordion">
        <button className="wealth-accordion-head" onClick={() => toggle('debt')}><span><HiCalculator /> {af ? 'Skuldvryheid & Ekstra Betaling' : 'Debt Freedom & Extra Payment'}</span>{open.debt ? <HiChevronUp/> : <HiChevronDown/>}</button>
        {open.debt && <div className="wealth-accordion-body wealth-grid-2">
          <label>{af?'Uitstaande balans':'Outstanding balance'}<div className="wealth-money-input"><span>R</span><input type="number" value={dp.balance||''} onChange={e=>updateNested('debtPlanner','balance',num(e.target.value))}/></div></label>
          <label>{af?'Jaarlikse rentekoers %':'Annual interest rate %'}<input type="number" step="0.1" value={dp.rate||''} onChange={e=>updateNested('debtPlanner','rate',num(e.target.value))}/></label>
          <label>{af?'Huidige maandelikse betaling':'Current monthly payment'}<div className="wealth-money-input"><span>R</span><input type="number" value={dp.payment||''} onChange={e=>updateNested('debtPlanner','payment',num(e.target.value))}/></div></label>
          <label>{af?'Ekstra maandelikse betaling':'Extra monthly payment'}<div className="wealth-money-input"><span>R</span><input type="number" value={dp.extra||''} onChange={e=>updateNested('debtPlanner','extra',num(e.target.value))}/></div></label>
          <div className="wealth-result-grid wealth-span-2"><div><small>{af?'Geskatte tyd gespaar':'Estimated time saved'}</small><strong>{monthsSaved ? `${monthsSaved} ${af?'maande':'months'}` : '—'}</strong></div><div><small>{af?'Geskatte rente gespaar':'Estimated interest saved'}</small><strong>{interestSaved ? money(interestSaved) : '—'}</strong></div></div>
        </div>}
      </div>

      <div className="wealth-accordion">
        <button className="wealth-accordion-head" onClick={() => toggle('retirement')}><span><HiClock /> {af ? 'My Aftree-Welvaart' : 'My Retirement Wealth'}</span>{open.retirement ? <HiChevronUp/> : <HiChevronDown/>}</button>
        {open.retirement && <div className="wealth-accordion-body wealth-grid-2">
          <label>{af?'My ouderdom':'My age'}<input type="number" min="18" max="100" value={data.age||''} onChange={e=>update('age',num(e.target.value))}/></label>
          <label>{af?'Beplande aftree-ouderdom':'Planned retirement age'}<input type="number" min="30" max="100" value={data.retirementAge||''} onChange={e=>update('retirementAge',num(e.target.value))}/></label>
          <label>{af?'Huidige aftree-spaargeld':'Current retirement savings'}<div className="wealth-money-input"><span>R</span><input type="number" value={data.retirementSavings||''} onChange={e=>update('retirementSavings',num(e.target.value))}/></div></label>
          <label>{af?'Maandelikse bydrae':'Monthly contribution'}<div className="wealth-money-input"><span>R</span><input type="number" value={data.retirementMonthlyContribution||''} onChange={e=>update('retirementMonthlyContribution',num(e.target.value))}/></div></label>
          <label>{af?'Opvoedkundige groeiaanname % p.j.':'Educational growth assumption % p.a.'}<input type="number" min="0" max="20" step="0.1" value={data.retirementGrowthRate||''} onChange={e=>update('retirementGrowthRate',num(e.target.value))}/></label>
          <div className="wealth-projection wealth-span-2"><small>{af?'Geskatte toekomstige waarde teen aftrede':'Estimated future value at retirement'}</small><strong>{money(metrics.projected)}</strong><p>{af?'Hierdie is slegs ’n opvoedkundige projeksie en nie ’n gewaarborgde opbrengs nie.':'This is an educational projection only and not a guaranteed return.'}</p></div>
        </div>}
      </div>

      <div className="wealth-education-card"><HiLightBulb/><div><h3>{af?'Bou Jou Inkomste':'Build Your Income'}</h3><p>{af?'Volgende fase: praktiese leerpaaie oor klein besigheid, digitale bemarking, vryskutwerk, aanlyn verkope, begroting, skuld en basiese beleggingskennis.' : 'Next phase: practical learning paths for small business, digital marketing, freelancing, online selling, budgeting, debt and basic investment education.'}</p><span>{af?'We-Rise vir ’n lewe, nie net vir ’n krisis nie.':'We-Rise for a lifetime, not only for a crisis.'}</span></div></div>

      <button className="wealth-save" onClick={save} disabled={saving || loading}><HiSave/> {saving ? (af?'Stoor...':'Saving...') : (af?'Stoor My Welvaart-plan':'Save My Wealth Plan')}</button>
      <p className="wealth-disclaimer">{af ? 'Welvaart verskaf opvoedkundige beplanning en berekeninge. Dit is nie persoonlike finansiële, beleggings-, belasting- of versekeringsadvies nie.' : 'Wealth provides educational planning and calculations. It is not personal financial, investment, tax or insurance advice.'}</p>
    </section>
  );
}
