import React, { useMemo, useState } from 'react';
import {
  HiCalculator,
  HiCheckCircle,
  HiLightningBolt,
  HiRefresh,
  HiShieldCheck,
  HiUsers,
} from 'react-icons/hi';

const MONTHLY_FEE = 166;
const BACKMI = 10;
const FUEL_BASIS = 33;
const WERISE_REMAINDER = 123;

const money = (value, lang) => new Intl.NumberFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value) || 0);

export default function FuelIt({ lang }) {
  const af = lang === 'af';
  const [members, setMembers] = useState(0);

  const safeMembers = Math.max(0, Math.floor(Number(members) || 0));
  const results = useMemo(() => ({
    fuel: safeMembers * FUEL_BASIS,
    total: safeMembers * MONTHLY_FEE,
    backmi: safeMembers * BACKMI,
    werise: safeMembers * WERISE_REMAINDER,
  }), [safeMembers]);

  const reset = () => setMembers(0);

  return (
    <section className="fuelit-page fade-in">
      <header className="fuelit-hero">
        <div className="fuelit-hero-icon"><HiLightningBolt /></div>
        <div className="eyebrow">{af ? 'WE-RISE BRANDSTOFVERLIGTING' : 'WE-RISE FUEL-IT'}</div>
        <h2 className="section-title">{af ? 'Bereken jou Brandstofverligting-basis' : 'Calculate your Fuel-It basis'}</h2>
        <p>{af
          ? 'Die huidige model koppel kwalifiserende aktiewe betalende lede wat jy verwys aan ’n maandelikse Brandstofverligting-berekeningsbasis.'
          : 'The current model links qualifying active paying members you refer to a monthly Fuel-It calculation basis.'}</p>
      </header>

      <article className="card fuelit-model-card">
        <div className="fuelit-model-heading">
          <div>
            <div className="eyebrow">{af ? 'HUIDIGE MAANDELIKSE MODEL' : 'CURRENT MONTHLY MODEL'}</div>
            <h3>{af ? 'Hoe elke R166 verdeel word' : 'How each R166 is allocated'}</h3>
          </div>
          <div className="fuelit-model-badge"><HiShieldCheck /> {af ? 'Huidige model' : 'Current model'}</div>
        </div>

        <div className="fuelit-model-strip">
          <div className="fuelit-model-item">
            <span>{af ? 'Maandelikse ledegeld' : 'Monthly membership'}</span>
            <strong>R166</strong>
          </div>
          <div className="fuelit-model-item">
            <span>BackMi</span>
            <strong>R10</strong>
          </div>
          <div className="fuelit-model-item fuelit-model-item-primary">
            <span>{af ? 'Brandstofverligting-basis' : 'Fuel-It basis'}</span>
            <strong>R33</strong>
          </div>
          <div className="fuelit-model-item">
            <span>{af ? 'Bly in We-Rise-model' : 'Remains in We-Rise model'}</span>
            <strong>R123</strong>
          </div>
        </div>
        <div className="fuelit-equation">R10 + R33 + R123 = R166</div>
      </article>

      <article className="card fuelit-calculator-card">
        <div className="fuelit-calculator-heading">
          <div>
            <div className="eyebrow"><HiCalculator /> {af ? 'BRANDSTOFVERLIGTINGSAKREKENAAR' : 'FUEL-IT CALCULATOR'}</div>
            <h3>{af ? 'Bereken die huidige maandelikse basis' : 'Calculate the current monthly basis'}</h3>
            <p>{af
              ? 'Tel slegs lede wat jy verwys het, wat suksesvol betaal het en tans aktiewe We-Rise-lede is.'
              : 'Count only members you referred who successfully paid and are currently active We-Rise members.'}</p>
          </div>
          <button type="button" className="fuelit-reset" onClick={reset}><HiRefresh /> {af ? 'Herstel' : 'Reset'}</button>
        </div>

        <label className="fuelit-field">
          <span>{af ? 'Kwalifiserende aktiewe betalende verwysings' : 'Qualifying active paying referrals'}</span>
          <small>{af
            ? 'Hoeveel kwalifiserende aktiewe betalende lede het jy persoonlik verwys?'
            : 'How many qualifying active paying members did you personally refer?'}</small>
          <div className="fuelit-number-wrap"><HiUsers /><input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={members}
            onChange={(event) => setMembers(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
          /></div>
        </label>

        <div className="fuelit-formula-box">
          <small>{af ? 'HUIDIGE FORMULE' : 'CURRENT FORMULA'}</small>
          <strong>{af
            ? 'Kwalifiserende aktiewe verwysings × R33 = maandelikse Brandstofverligting-basis'
            : 'Qualifying active referrals × R33 = monthly Fuel-It basis'}</strong>
        </div>

        <div className="fuelit-results" aria-live="polite">
          <div className="fuelit-result fuelit-result-primary">
            <span>{af ? 'Jou maandelikse Brandstofverligting-basis' : 'Your monthly Fuel-It basis'}</span>
            <strong>{money(results.fuel, lang)}</strong>
            <small>{safeMembers.toLocaleString(af ? 'af-ZA' : 'en-ZA')} × R33</small>
          </div>
          <div className="fuelit-result">
            <span>{af ? 'Totale maandelikse ledegeld' : 'Total monthly membership fees'}</span>
            <strong>{money(results.total, lang)}</strong>
          </div>
          <div className="fuelit-result">
            <span>{af ? 'BackMi-toekenning' : 'BackMi allocation'}</span>
            <strong>{money(results.backmi, lang)}</strong>
          </div>
          <div className="fuelit-result">
            <span>{af ? 'Bly binne We-Rise-model' : 'Remains in We-Rise model'}</span>
            <strong>{money(results.werise, lang)}</strong>
          </div>
          <div className="fuelit-result">
            <span>{af ? 'Kwalifiserende aktiewe lede' : 'Qualifying active members'}</span>
            <strong>{safeMembers.toLocaleString(af ? 'af-ZA' : 'en-ZA')}</strong>
          </div>
        </div>

        <div className="fuelit-examples">
          <div><strong>5 × R33 = R165</strong><span>{af ? 'per maand berekeningsbasis' : 'monthly calculation basis'}</span></div>
          <div><strong>10 × R33 = R330</strong><span>{af ? 'per maand berekeningsbasis' : 'monthly calculation basis'}</span></div>
        </div>
      </article>

      <article className="fuelit-important-note">
        <HiCheckCircle />
        <div>
          <strong>{af ? 'Belangrik' : 'Important'}</strong>
          <p>{af
            ? 'R33 per kwalifiserende aktiewe lid is die huidige berekeningsbasis van die model. Dit is nie ’n gewaarborgde kontantuitbetaling, brandstofkaart of brandstofafslag nie. Die werklike voordeel bly onderhewig aan geverifieerde aktiewe betaalde lidmaatskappe, werklike We-Rise-inkomste, beskikbare fondse en die finansiële volhoubaarheid van die model.'
            : 'R33 per qualifying active member is the current calculation basis of the model. It is not a guaranteed cash payout, fuel card or fuel discount. The actual benefit remains subject to verified active paid memberships, actual We-Rise income, available funds and the financial sustainability of the model.'}</p>
          <p>{af
            ? 'Geen brandstofkwitansies of bewys van literverbruik word vir hierdie berekening benodig nie. Enige moontlike bydrae uit die eenmalige aanvangs-subskripsie is nie by hierdie vaste maandelikse sakrekenaar ingesluit nie.'
            : 'No fuel slips or proof of litres used are required for this calculation. Any possible contribution from the once-off joining subscription is not included in this fixed monthly calculator.'}</p>
        </div>
      </article>
    </section>
  );
}
