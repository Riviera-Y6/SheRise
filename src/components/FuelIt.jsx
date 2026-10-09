import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HiCalculator,
  HiCheckCircle,
  HiLightningBolt,
  HiRefresh,
  HiShieldCheck,
  HiUsers,
} from 'react-icons/hi';
import { apiRequest } from '../lib/api';

const MONTHLY_FEE = 166;
const BACKMI = 10;
const FUEL_BASIS = 33;
const WERISE_REMAINDER = 123;
const BREAK_EVEN_MEMBERS = Math.ceil(MONTHLY_FEE / FUEL_BASIS);

const money = (value, lang) => new Intl.NumberFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

function calculate(members) {
  const count = Math.max(0, Math.floor(Number(members) || 0));
  const grossCredit = count * FUEL_BASIS;
  const platformCredit = Math.min(MONTHLY_FEE, grossCredit);
  const effectiveFee = Math.max(0, MONTHLY_FEE - grossCredit);
  const excessCredit = Math.max(0, grossCredit - MONTHLY_FEE);
  return {
    count,
    grossCredit,
    platformCredit,
    effectiveFee,
    excessCredit,
    totalMembership: count * MONTHLY_FEE,
    backmi: count * BACKMI,
    werise: count * WERISE_REMAINDER,
  };
}

export default function FuelIt({ lang }) {
  const af = lang === 'af';
  const [members, setMembers] = useState(0);
  const [live, setLive] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);

  const results = useMemo(() => calculate(members), [members]);

  const loadLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const data = await apiRequest('/api/fuelit/status');
      setLive(data);
    } catch {
      setLive(null);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => { loadLive(); }, [loadLive]);

  const reset = () => setMembers(0);
  const useLive = () => setMembers(Number(live?.qualifying_active_referrals || 0));

  return (
    <section className="fuelit-page fade-in">
      <header className="fuelit-hero">
        <div className="fuelit-hero-icon"><HiLightningBolt /></div>
        <div className="eyebrow">{af ? 'WE-RISE VULDIT · BRANDSTOFBESPARING' : 'WE-RISE FUEL-IT · FUEL RELIEF'}</div>
        <h2 className="section-title">{af ? 'VulDit — laat jou netwerk jou platformkoste help dra' : 'Fuel-It — let your network help cover your platform cost'}</h2>
        <p>{af
          ? 'Elke kwalifiserende aktiewe betalende lid wat korrek aan jou verwysing gekoppel is, skep tans ’n R33 maandelikse Brandstofbesparing-krediet.'
          : 'Each qualifying active paying member correctly attributed to your referral currently creates a R33 monthly Fuel-It credit.'}</p>
      </header>

      <article className="card fuelit-model-card">
        <div className="fuelit-model-heading">
          <div><div className="eyebrow">{af ? 'HUIDIGE MAANDELIKSE MODEL' : 'CURRENT MONTHLY MODEL'}</div><h3>{af ? 'Hoe elke R166 verdeel word' : 'How each R166 is allocated'}</h3></div>
          <div className="fuelit-model-badge"><HiShieldCheck /> {af ? 'Kirsten-model' : 'Kirsten model'}</div>
        </div>
        <div className="fuelit-model-strip">
          <div className="fuelit-model-item"><span>{af ? 'Maandelikse ledegeld' : 'Monthly membership'}</span><strong>R166</strong></div>
          <div className="fuelit-model-item"><span>BackMi</span><strong>R10</strong></div>
          <div className="fuelit-model-item fuelit-model-item-primary"><span>{af ? 'VulDit-kredietbasis' : 'Fuel-It credit basis'}</span><strong>R33</strong></div>
          <div className="fuelit-model-item"><span>{af ? 'We-Rise infrastruktuur' : 'We-Rise infrastructure'}</span><strong>R123</strong></div>
        </div>
        <div className="fuelit-equation">R10 + R33 + R123 = R166</div>
      </article>

      <article className="card fuelit-live-card">
        <div className="fuelit-live-heading">
          <div><div className="eyebrow">{af ? 'JOU WERKLIKE STATUS' : 'YOUR LIVE STATUS'}</div><h3>{af ? 'Gebaseer op jou huidige aktiewe verwysings' : 'Based on your current active referrals'}</h3></div>
          <button type="button" className="fuelit-reset" onClick={loadLive}><HiRefresh /> {af ? 'Verfris' : 'Refresh'}</button>
        </div>
        {liveLoading ? <p className="muted-copy">{af ? 'Laai jou VulDit-status…' : 'Loading your Fuel-It status…'}</p> : live ? (
          <>
            <div className="fuelit-results">
              <div className="fuelit-result fuelit-result-primary"><span>{af ? 'Kwalifiserende aktiewe verwysings' : 'Qualifying active referrals'}</span><strong>{Number(live.qualifying_active_referrals || 0).toLocaleString()}</strong></div>
              <div className="fuelit-result"><span>{af ? 'Bruto maandelikse VulDit-krediet' : 'Gross monthly Fuel-It credit'}</span><strong>{money(live.gross_monthly_credit_zar, lang)}</strong></div>
              <div className="fuelit-result"><span>{af ? 'Krediet teen jou R166 platformfooi' : 'Credit against your R166 platform fee'}</span><strong>{money(live.platform_fee_credit_zar, lang)}</strong></div>
              <div className="fuelit-result"><span>{af ? 'Effektiewe platformfooi ná krediet' : 'Effective platform fee after credit'}</span><strong>{money(live.effective_platform_fee_zar, lang)}</strong></div>
              <div className="fuelit-result"><span>{af ? 'Oorskot Brandstofbesparing' : 'Excess Fuel-It credit'}</span><strong>{money(live.excess_credit_zar, lang)}</strong></div>
            </div>
            <button type="button" className="btn btn-secondary btn-full" onClick={useLive}><HiCalculator /> {af ? 'Gebruik hierdie getal in die sakrekenaar' : 'Use this number in the calculator'}</button>
          </>
        ) : <p className="muted-copy">{af ? 'Jou lewendige status kon nie nou gelaai word nie. Die sakrekenaar hieronder werk steeds.' : 'Your live status could not be loaded right now. The calculator below still works.'}</p>}
      </article>

      <article className="card fuelit-calculator-card">
        <div className="fuelit-calculator-heading">
          <div>
            <div className="eyebrow"><HiCalculator /> {af ? 'VULDIT-SAKREKENAAR' : 'FUEL-IT CALCULATOR'}</div>
            <h3>{af ? 'Bereken die werklike nuwe model' : 'Calculate the real current model'}</h3>
            <p>{af ? 'Die eerste R166 van jou maandelikse R33-krediete dek jou eie platformfooi. Enigiets bo R166 word as oorskot Brandstofbesparing aangedui.' : 'The first R166 of your monthly R33 credits covers your own platform fee. Anything above R166 is shown as excess Fuel-It credit.'}</p>
          </div>
          <button type="button" className="fuelit-reset" onClick={reset}><HiRefresh /> {af ? 'Herstel' : 'Reset'}</button>
        </div>

        <label className="fuelit-field">
          <span>{af ? 'Kwalifiserende aktiewe betalende verwysings' : 'Qualifying active paying referrals'}</span>
          <small>{af ? 'Hoeveel aktiewe betalende lede is tans korrek aan jou verwysing gekoppel?' : 'How many active paying members are currently correctly attributed to your referral?'}</small>
          <div className="fuelit-number-wrap"><HiUsers /><input type="number" inputMode="numeric" min="0" step="1" value={members} onChange={(e) => setMembers(Math.max(0, Math.floor(Number(e.target.value) || 0)))} /></div>
        </label>

        <div className="fuelit-formula-box">
          <small>{af ? 'FORMULE' : 'FORMULA'}</small>
          <strong>{af ? 'Aktiewe verwysings × R33 = bruto VulDit-krediet' : 'Active referrals × R33 = gross Fuel-It credit'}</strong>
          <span>{af ? 'Krediet dek eers jou R166 platformfooi; die balans daarna is oorskot.' : 'Credit covers your R166 platform fee first; the balance after that is excess.'}</span>
        </div>

        <div className="fuelit-results" aria-live="polite">
          <div className="fuelit-result fuelit-result-primary"><span>{af ? 'Bruto maandelikse VulDit-krediet' : 'Gross monthly Fuel-It credit'}</span><strong>{money(results.grossCredit, lang)}</strong><small>{results.count} × R33</small></div>
          <div className="fuelit-result"><span>{af ? 'Teen jou platformfooi verreken' : 'Applied against your platform fee'}</span><strong>{money(results.platformCredit, lang)}</strong></div>
          <div className="fuelit-result"><span>{af ? 'Effektiewe R166 platformfooi oor' : 'Effective R166 platform fee remaining'}</span><strong>{money(results.effectiveFee, lang)}</strong></div>
          <div className="fuelit-result"><span>{af ? 'Oorskot Brandstofbesparing-krediet' : 'Excess Fuel-It credit'}</span><strong>{money(results.excessCredit, lang)}</strong></div>
          <div className="fuelit-result"><span>{af ? 'BackMi uit dié lede' : 'BackMi from those members'}</span><strong>{money(results.backmi, lang)}</strong></div>
          <div className="fuelit-result"><span>{af ? 'We-Rise infrastruktuur uit dié lede' : 'We-Rise infrastructure from those members'}</span><strong>{money(results.werise, lang)}</strong></div>
        </div>

        <div className="fuelit-examples">
          <div><strong>5 × R33 = R165</strong><span>{af ? 'R1 van jou R166 platformfooi bly oor' : 'R1 of your R166 platform fee remains'}</span></div>
          <div><strong>6 × R33 = R198</strong><span>{af ? 'R166 fooi gedek + R32 oorskot' : 'R166 fee covered + R32 excess'}</span></div>
          <div><strong>{BREAK_EVEN_MEMBERS} {af ? 'lede' : 'members'}</strong><span>{af ? 'huidige minimum om die R166 basis ten volle te dek' : 'current minimum to fully cover the R166 base fee'}</span></div>
        </div>
      </article>

      <article className="fuelit-important-note">
        <HiCheckCircle />
        <div>
          <strong>{af ? 'Belangrik' : 'Important'}</strong>
          <p>{af ? 'VulDit / Brandstofbesparing is ’n gemeenskapskredietmodel, nie ’n belegging, gewaarborgde opbrengs, brandstofkaart of afslag by ’n vulstasie nie. Slegs geverifieerde aktiewe betaalde lede tel.' : 'Fuel-It is a community-credit model, not an investment, guaranteed return, fuel card or filling-station discount. Only verified active paid members count.'}</p>
          <p>{af ? 'Geen brandstofkwitansies word vereis nie. Oorskotkrediete bly onderhewig aan die toepaslike uitbetalingsproses, beskikbare fondse en We-Rise se finansiële volhoubaarheid.' : 'No fuel slips are required. Excess credits remain subject to the applicable payout process, available funds and We-Rise financial sustainability.'}</p>
        </div>
      </article>
    </section>
  );
}
