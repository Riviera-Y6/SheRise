import React, { useEffect, useRef, useState } from 'react';
import { HiBookOpen, HiX } from 'react-icons/hi';
import { manifesto } from '../data/manifesto';

export default function Manifesto() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="manifesto-fab"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="we-rise-manifesto"
        title="Open We-Rise Manifesto"
      >
        <span className="manifesto-fab-icon"><HiBookOpen /></span>
        <span className="manifesto-fab-label">Manifesto</span>
      </button>

      {open && (
        <div
          className="manifesto-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            id="we-rise-manifesto"
            className="manifesto-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manifesto-title"
          >
            <div className="manifesto-dialog-header">
              <div className="manifesto-heading-wrap">
                <span className="manifesto-kicker">We-Rise</span>
                <h2 id="manifesto-title">{manifesto.title}</h2>
                <p>{manifesto.tagline}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="manifesto-close"
                onClick={() => setOpen(false)}
                aria-label="Close manifesto"
              >
                <HiX />
              </button>
            </div>

            <div className="manifesto-scroll">
              <div className="manifesto-opening">
                {manifesto.intro.map((paragraph, index) => (
                  <p key={`intro-${index}`}>{paragraph}</p>
                ))}
              </div>

              {manifesto.sections.map((section) => (
                <article className="manifesto-section" key={section.heading}>
                  <h3>{section.heading}</h3>
                  {section.paragraphs?.map((paragraph, index) => (
                    <p key={`${section.heading}-p-${index}`}>{paragraph}</p>
                  ))}

                  {section.features && (
                    <div className="manifesto-feature-list">
                      {section.features.map((feature) => (
                        <p key={feature}>{feature}</p>
                      ))}
                    </div>
                  )}

                  {section.afterFeatures?.map((paragraph, index) => (
                    <p key={`${section.heading}-after-${index}`}>{paragraph}</p>
                  ))}
                </article>
              ))}

              <div className="manifesto-closing">
                {manifesto.closing.map((line) => <strong key={line}>{line}</strong>)}
                <span>{manifesto.signature}</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
