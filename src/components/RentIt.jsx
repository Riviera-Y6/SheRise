import React from 'react';
import {
  HiCash,
  HiCheckCircle,
  HiKey,
  HiLightningBolt,
  HiRefresh,
  HiShieldCheck,
  HiSparkles,
  HiTrendingUp,
  HiUsers,
} from 'react-icons/hi';

export default function RentIt({ lang }) {
  const af = lang === 'af';

  const steps = af
    ? [
        {
          icon: HiKey,
          title: 'Kry jou HuurDit-reg',
          text: 'Jy kry toegang tot die We-Rise HuurDit-besigheidsmodel volgens die geldende voorwaardes en reëls.',
        },
        {
          icon: HiUsers,
          title: 'Vind ’n geldige huurder',
          text: 'Bemark die geleentheid duidelik en eerlik. ’n Verdienste ontstaan eers wanneer ’n geldige R1800.00-huur suksesvol betaal is.',
        },
        {
          icon: HiTrendingUp,
          title: 'Verdien op voltooide huurtransaksies',
          text: 'Op die huidige model ontvang die huurder R1000.00. Die oorblywende R800.00 word volgens die geldende We-Rise verdelingsreëls gedeel.',
        },
      ]
    : [
        {
          icon: HiKey,
          title: 'Get your RentIt right',
          text: 'You receive access to the We-Rise RentIt business model subject to the applicable terms and rules.',
        },
        {
          icon: HiUsers,
          title: 'Find a valid renter',
          text: 'Present the opportunity clearly and honestly. Earnings only arise when a valid R1800.00 rental has been successfully paid.',
        },
        {
          icon: HiTrendingUp,
          title: 'Earn on completed rental transactions',
          text: 'Under the current model, the renter receives R1000.00. The remaining R800.00 is shared according to the applicable We-Rise allocation rules.',
        },
      ];

  const benefits = af
    ? [
        { icon: HiSparkles, title: 'Sleutel-klaar model', text: 'Begin met ’n bestaande We-Rise-struktuur eerder as om alles van nuuts af te bou.' },
        { icon: HiLightningBolt, title: 'Makliker om te begin', text: 'Geen behoefte om jou eie platform, handelsmerk of tegniese stelsel van voor af te ontwikkel nie.' },
        { icon: HiRefresh, title: 'Herhaalbare geleentheid', text: 'Die model is ontwerp sodat geldige huurtransaksies herhaal kan word binne die We-Rise-reëls.' },
        { icon: HiShieldCheck, title: 'We-Rise beskerm die kern', text: 'Die kernplatform, handelsmerk en intellektuele eiendom bly onder We-Rise se beheer.' },
      ]
    : [
        { icon: HiSparkles, title: 'Turnkey model', text: 'Start with an existing We-Rise structure instead of building everything from scratch.' },
        { icon: HiLightningBolt, title: 'Easier to start', text: 'There is no need to build your own platform, brand or technical system from the ground up.' },
        { icon: HiRefresh, title: 'Repeatable opportunity', text: 'The model is designed so valid rental transactions can be repeated within the We-Rise rules.' },
        { icon: HiShieldCheck, title: 'We-Rise protects the core', text: 'The core platform, brand and intellectual property remain under We-Rise control.' },
      ];

  return (
    <section className="rentit-page fade-in">
      <header className="rentit-hero">
        <div className="rentit-hero-icon"><HiKey /></div>
        <div className="eyebrow">{af ? 'WE-RISE HUURDIT' : 'WE-RISE RENTIT'}</div>
        <h2 className="section-title">
          {af ? 'Huur ’n gereed-om-te-gebruik digitale besigheidsgeleentheid' : 'Rent a ready-to-use digital business opportunity'}
        </h2>
        <p className="section-subtitle">
          {af
            ? 'HuurDit gee vroue ’n eenvoudige pad om met ’n bestaande We-Rise-model te begin, sonder om eers ’n volledige digitale besigheid van nuuts af te bou.'
            : 'RentIt gives women a simple way to start with an existing We-Rise model without first building a complete digital business from scratch.'}
        </p>
      </header>

      <article className="rentit-price-card">
        <div className="rentit-price-topline">
          <span>{af ? 'HUURPRYS' : 'RENTAL PRICE'}</span>
          <span className="rentit-upfront-badge">{af ? 'Vooruit betaalbaar' : 'Payable upfront'}</span>
        </div>
        <div className="rentit-price">R1800<span>.00</span></div>
        <p>{af ? 'Die huidige RentIt / HuurDit transaksiewaarde.' : 'The current RentIt / HuurDit transaction value.'}</p>

        <div className="rentit-money-flow" aria-label={af ? 'HuurDit verdeling' : 'RentIt allocation'}>
          <div className="rentit-money-box rentit-money-earned">
            <small>{af ? 'Huurder verdien' : 'Renter earns'}</small>
            <strong>R1000.00</strong>
          </div>
          <div className="rentit-money-operator">+</div>
          <div className="rentit-money-box rentit-money-balance">
            <small>{af ? 'Balans om te deel' : 'Balance to share'}</small>
            <strong>R800.00</strong>
          </div>
          <div className="rentit-money-operator">=</div>
          <div className="rentit-money-box rentit-money-total">
            <small>{af ? 'Totale huur' : 'Total rental'}</small>
            <strong>R1800.00</strong>
          </div>
        </div>

        <div className="rentit-clarifier">
          <HiCheckCircle />
          <p>{af
            ? 'Die R1000.00 is die huidige huurderverdienste op ’n suksesvol voltooide en betaalde huurtransaksie. Die R800.00-balans word volgens die geldende We-Rise-ooreenkoms verdeel. Geen verdienste is gewaarborg sonder ’n voltooide transaksie nie.'
            : 'R1000.00 is the current renter earning on a successfully completed and paid rental transaction. The R800.00 balance is allocated according to the applicable We-Rise agreement. No earnings are guaranteed without a completed transaction.'}</p>
        </div>
      </article>

      <article className="card rentit-how-card">
        <div className="eyebrow">{af ? 'HOE HUURDIT WERK' : 'HOW RENTIT WORKS'}</div>
        <h3>{af ? 'Eenvoudige vloei. Duidelike getalle.' : 'Simple flow. Clear numbers.'}</h3>
        <div className="rentit-steps">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <div className="rentit-step" key={title}>
              <div className="rentit-step-number">{index + 1}</div>
              <div className="rentit-step-icon"><Icon /></div>
              <div><strong>{title}</strong><p>{text}</p></div>
            </div>
          ))}
        </div>
      </article>

      <article className="card rentit-benefits-card">
        <div className="eyebrow">{af ? 'WAAROM HUURDIT?' : 'WHY RENTIT?'}</div>
        <h3>{af ? 'Bou op iets wat reeds bestaan' : 'Build on something that already exists'}</h3>
        <div className="rentit-benefit-grid">
          {benefits.map(({ icon: Icon, title, text }) => (
            <div className="rentit-benefit" key={title}>
              <div className="rentit-benefit-icon"><Icon /></div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="card rentit-rules-card">
        <div className="rentit-rules-heading">
          <div className="rentit-rules-icon"><HiShieldCheck /></div>
          <div>
            <div className="eyebrow">{af ? 'BELANGRIKE REËLS' : 'IMPORTANT RULES'}</div>
            <h3>{af ? 'Die platform en handelsmerk bly beskerm' : 'The platform and brand stay protected'}</h3>
          </div>
        </div>
        <ul>
          <li>{af ? 'We-Rise bly die eienaar van die kernplatform, handelsmerk en intellektuele eiendom.' : 'We-Rise remains the owner of the core platform, brand and intellectual property.'}</li>
          <li>{af ? 'RentIt / HuurDit mag nie vir onwettige inhoud, bedrog of misleidende finansiële beloftes gebruik word nie.' : 'RentIt / HuurDit may not be used for illegal content, fraud or misleading financial promises.'}</li>
          <li>{af ? 'Toegang en verdere gebruik is onderhewig aan die geldende huur- en gebruiksvoorwaardes.' : 'Access and continued use are subject to the applicable rental and usage terms.'}</li>
          <li>{af ? 'Misbruik, ernstige reëlbreuk of wanbetaling kan tot opskorting of beëindiging van toegang lei.' : 'Misuse, serious rule breaches or non-payment may result in suspension or termination of access.'}</li>
          <li>{af ? 'Die presiese verdeling van die R800.00-balans word deur die geldende We-Rise-ooreenkoms bepaal.' : 'The exact allocation of the R800.00 balance is determined by the applicable We-Rise agreement.'}</li>
        </ul>
      </article>

      <div className="rentit-final-note">
        <HiCash />
        <div>
          <strong>{af ? 'Gebou vir praktiese bemagtiging' : 'Built for practical empowerment'}</strong>
          <p>{af
            ? 'HuurDit is ontwerp om ’n werkende digitale geleentheid eenvoudiger toeganklik te maak. Die doel is ’n duidelike, herhaalbare model met vaste reëls en deursigtige pryse.'
            : 'RentIt is designed to make a working digital opportunity easier to access. The goal is a clear, repeatable model with defined rules and transparent pricing.'}</p>
        </div>
      </div>
    </section>
  );
}
