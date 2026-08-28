import { Link } from 'react-router-dom';

export const Breadcrumbs = ({ items }) => (
  <nav aria-label='Breadcrumb'>
    <ol className='site-breadcrumbs'>
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          {item.to ? <Link to={item.to}>{item.label}</Link> : item.label}
        </li>
      ))}
    </ol>
  </nav>
);

export const SectionHeading = ({ kicker, title, description }) => (
  <div className='site-section__heading'>
    {kicker ? <span className='site-kicker'>{kicker}</span> : null}
    <h2>{title}</h2>
    {description ? <p>{description}</p> : null}
  </div>
);

export const CardGrid = ({ items, className = 'site-grid--features' }) => (
  <div className={`site-grid ${className}`}>
    {items.map((item) => (
      <article key={item.title} className='site-card'>
        {item.icon ? <div className='site-card__icon'>{item.icon}</div> : null}
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        {item.chips ? (
          <div className='site-chip-list'>
            {item.chips.map((chip) => (
              <span key={chip} className='site-chip'>
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </article>
    ))}
  </div>
);

export const StatsGrid = ({ stats }) => (
  <div className='site-grid site-grid--stats'>
    {stats.map((stat) => (
      <article key={stat.label} className='site-stats__item'>
        {stat.icon ? <div className='site-card__icon'>{stat.icon}</div> : null}
        <strong>{stat.value}</strong>
        <span>{stat.label}</span>
      </article>
    ))}
  </div>
);

export const Timeline = ({ steps }) => (
  <div className='site-timeline'>
    {steps.map((step) => (
      <article key={step.title} className='site-timeline__item'>
        <div className='site-timeline__step'>{step.step}</div>
        <div className='site-timeline__content'>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </div>
      </article>
    ))}
  </div>
);

export const LogoCloud = ({ logos }) => (
  <div className='site-trustbar' aria-label='Trusted by'>
    {logos.map((logo) => {
      const label = typeof logo === 'string' ? logo : logo.name;
      const icon = typeof logo === 'object' && logo.icon ? logo.icon : null;

      return (
        <div key={label} className='site-logo-chip'>
          {icon ? <span className='site-logo-chip__icon'>{icon}</span> : null}
          <span>{label}</span>
        </div>
      );
    })}
  </div>
);

export const TestimonialsGrid = ({ testimonials }) => (
  <div className='site-grid site-grid--testimonials'>
    {testimonials.map((item) => (
      <article key={item.name} className='site-card'>
        <p>"{item.quote}"</p>
        <h4>{item.name}</h4>
        <p>{item.role}</p>
      </article>
    ))}
  </div>
);

export const PricingCards = ({ plans }) => (
  <div className='site-grid site-grid--plans'>
    {plans.map((plan) => (
      <article key={plan.name} className='site-card'>
        <h3>{plan.name}</h3>
        <p>{plan.description}</p>
        <div className='site-card__icon'>
          <strong>{plan.price}</strong>
        </div>
        <div className='site-chip-list'>
          {plan.features.map((feature) => (
            <span key={feature} className='site-chip'>
              {feature}
            </span>
          ))}
        </div>
        {plan.cta ? (
          <div className='site-page-hero__actions'>
            <Link to={plan.cta.to} className='site-button'>
              {plan.cta.label}
            </Link>
          </div>
        ) : null}
      </article>
    ))}
  </div>
);

export const ComparisonTable = ({ rows }) => (
  <div className='site-table'>
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Basic</th>
          <th>Professional</th>
          <th>Enterprise</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.feature}>
            <td>{row.feature}</td>
            <td>{row.basic}</td>
            <td>{row.professional}</td>
            <td>{row.enterprise}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const FaqAccordion = ({ items }) => (
  <div className='site-faq'>
    {items.map((item) => (
      <details key={item.question} className='site-faq__item'>
        <summary>
          <span>{item.question}</span>
        </summary>
        <div className='site-faq__body'>{item.answer}</div>
      </details>
    ))}
  </div>
);

export const Callout = ({ title, description, primary, secondary }) => (
  <section className='site-cta'>
    <h2>{title}</h2>
    <p>{description}</p>
    <div className='site-cta__actions'>
      <Link to={primary.to} className='site-button'>
        {primary.label}
      </Link>
      {secondary ? (
        <Link to={secondary.to} className='site-button--ghost'>
          {secondary.label}
        </Link>
      ) : null}
    </div>
  </section>
);

export const PageHero = ({ title, description, image, imageAlt }) => {
  const isCloudinary = image && image.includes('res.cloudinary.com');
  const baseCloudinary = isCloudinary
    ? image.replace(/\/upload\/(?:[a-z0-9_:,]+\/)?/, '/upload/f_auto,q_auto:good,')
    : image;

  const srcSet = isCloudinary
    ? `
        ${baseCloudinary.replace('/upload/f_auto,q_auto:good,', '/upload/f_auto,q_auto:good,w_320/')} 320w,
        ${baseCloudinary.replace('/upload/f_auto,q_auto:good,', '/upload/f_auto,q_auto:good,w_480/')} 480w,
        ${baseCloudinary.replace('/upload/f_auto,q_auto:good,', '/upload/f_auto,q_auto:good,w_600/')} 600w,
        ${baseCloudinary.replace('/upload/f_auto,q_auto:good,', '/upload/f_auto,q_auto:good,w_900/')} 900w,
        ${baseCloudinary.replace('/upload/f_auto,q_auto:good,', '/upload/f_auto,q_auto:good,w_1200/')} 1200w
      `
    : undefined;

  return (
    <section className='site-page-hero'>
      <div className='site-container site-page-hero__grid'>
        <div>
          <span className='site-kicker'>PrivateVoting</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className='site-page-hero__panel'>
          {image ? (
            <img
              className='site-placeholder__image'
              src={baseCloudinary}
              srcSet={srcSet}
              sizes='(max-width: 640px) calc(100vw - 32px), (max-width: 920px) 45vw, 588px'
              alt={imageAlt}
              width={588}
              height={392}
              loading='eager'
              decoding='async'
            />
          ) : (
            <div className='site-placeholder'>{imageAlt}</div>
          )}
        </div>
      </div>
    </section>
  );
};
