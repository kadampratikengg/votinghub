import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiCheckCircle,
  FiCreditCard,
  FiShield,
  FiStar,
  FiTrendingDown,
  FiX,
  FiZap,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { initiatePayment } from './razorpay';
import './PlansPage.css';

const PlansPage = () => {
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const navigate = useNavigate();
  const { state } = useLocation();

  const email = state?.email || '';
  const userId = state?.userId || '';
  const password = state?.password || '';
  const confirmPassword = state?.confirmPassword || '';

  const plans = [
    {
      id: 'starter-credits',
      name: 'Starter Voting Credits',
      credits: 5,
      mrp: 2500,
      amount: 1499,
      description:
        'Best for small societies, committees, and one-time voting events.',
      badge: 'Entry Pack',
    },
    {
      id: 'standard-credits',
      name: 'Standard Voting Credits',
      credits: 15,
      mrp: 7500,
      amount: 3999,
      description:
        'Recommended for regular voting activity with stronger per-vote savings.',
      badge: 'Best Price',
      featured: true,
    },
    {
      id: 'governance-credits',
      name: 'Governance Voting Credits',
      credits: 40,
      mrp: 20000,
      amount: 9999,
      description:
        'Designed for high-volume government-standard voting operations.',
      badge: 'Maximum Discount',
    },
  ];

  const formatCurrency = (amount) => `INR ${Number(amount).toLocaleString('en-IN')}`;

  const buildPricedPlan = (plan) => {
    const discount = plan.mrp - plan.amount;
    const discountPercent = Math.round((discount / plan.mrp) * 100);
    const gst = plan.amount * 0.18;
    const total = plan.amount + gst;

    return {
      ...plan,
      duration: `${plan.credits} Voting Credits`,
      planDuration: `${plan.credits} Voting Credits`,
      validityDays: 365,
      votingCredits: plan.credits,
      discount,
      discountPercent,
      gst,
      txCharge: 0,
      total,
    };
  };

  const startCheckout = (gateway) => {
    if (!selectedPlan) return;

    const pricedPlan = buildPricedPlan(selectedPlan);
    setSelectedPlan(null);
    initiatePayment(
      pricedPlan,
      email,
      userId,
      setErrorMessage,
      setLoading,
      navigate,
      null,
      { password, confirmPassword },
      gateway,
    );
  };

  const handlePlanSelect = (plan) => {
    setErrorMessage('');
    setSelectedPlan(plan);
  };

  return (
    <main className='plans-page'>
      <section className='plans-hero'>
        <div>
          <span className='plans-kicker'>
            <FiShield /> Voting Credit Plans
          </span>
          <h1>Pay per voting Post, not per month.</h1>
          <p>
            Buy voting credits as needed. One credit creates one voting Post
            with government-standard workflow support.
          </p>
        </div>
        <div className='plans-free-card'>
          <FiZap />
          <strong>Flexible Credits</strong>
          <span>Buy credits as needed: 1 credit = 1 voting Post.</span>
        </div>
      </section>

      <section className='plans-container'>
        {plans.map((plan) => {
          const pricedPlan = buildPricedPlan(plan);
          const pricePerVoting = pricedPlan.amount / pricedPlan.credits;

          return (
            <article
              key={plan.id}
              className={`plan-card ${plan.featured ? 'plan-card--featured' : ''}`}
            >
              <div className='plan-card__badge'>
                {plan.featured ? <FiStar /> : <FiTrendingDown />}
                {plan.badge}
              </div>

              <h2>{plan.name}</h2>
              <p className='plan-credits'>{plan.credits} Voting Credits</p>
              <p className='plan-description'>{plan.description}</p>

              <div className='plan-price-box'>
                <span className='plan-mrp'>MRP {formatCurrency(plan.mrp)}</span>
                <strong>{formatCurrency(pricedPlan.amount)}</strong>
                <span className='plan-discount'>
                  Save {formatCurrency(pricedPlan.discount)} (
                  {pricedPlan.discountPercent}% OFF)
                </span>
              </div>

              <div className='plan-breakdown'>
                <div>
                  <span>Best price after discount</span>
                  <strong>{formatCurrency(pricedPlan.amount)}</strong>
                </div>
                <div>
                  <span>GST 18%</span>
                  <strong>{formatCurrency(pricedPlan.gst)}</strong>
                </div>
                <div className='plan-breakdown__total'>
                  <span>Total payable</span>
                  <strong>{formatCurrency(pricedPlan.total)}</strong>
                </div>
                <div>
                  <span>Effective per voting Post</span>
                  <strong>{formatCurrency(pricePerVoting)}</strong>
                </div>
              </div>

              <ul className='plan-features'>
                <li>
                  <FiCheckCircle /> 1 credit = 1 voting Post
                </li>
                <li>
                  <FiCheckCircle /> Credits valid for 365 days
                </li>
                <li>
                  <FiCheckCircle /> Suitable for compliant voting workflows
                </li>
              </ul>

              <button
                type='button'
                className='plan-card__button'
                onClick={() => handlePlanSelect(plan)}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Choose Payment Method'}
              </button>
            </article>
          );
        })}
      </section>

      {selectedPlan && (
        <div className='gateway-modal__backdrop' role='dialog' aria-modal='true'>
          <section className='gateway-modal'>
            <div className='gateway-modal__header'>
              <div>
                <p className='gateway-modal__eyebrow'>Select Gateway</p>
                <h3>{selectedPlan.name}</h3>
              </div>
              <button
                type='button'
                className='gateway-modal__close'
                onClick={() => setSelectedPlan(null)}
                aria-label='Close payment gateway modal'
                disabled={loading}
              >
                <FiX />
              </button>
            </div>

            <div className='gateway-modal__price'>
              <span>Total payable</span>
              <strong>{formatCurrency(buildPricedPlan(selectedPlan).total)}</strong>
            </div>
{/* 
            <div className='gateway-modal__actions'>
              <button
                type='button'
                className='gateway-modal__button'
                onClick={() => startCheckout('razorpay')}
                disabled={loading}
              >
                <FiCreditCard /> Pay with Razorpay
              </button>
              <button
                type='button'
                className='gateway-modal__button gateway-modal__button--secondary'
                onClick={() => startCheckout('cashfree')}
                disabled={loading}
              >
                <FiShield /> Pay with Cashfree
              </button>
            </div>

            <p className='gateway-modal__note'>
              Razorpay is recommended for instant card and UPI checkout. Cashfree
              is available for customers who prefer its hosted payment page.
            </p> */}
            <div className='gateway-modal__temporary'>
  
  <h4>Online Payment is Temporarily Unavailable</h4>

  <p>
    We are currently upgrading our payment gateway. To complete your
    subscription, please contact us on WhatsApp. We'll share a secure
    payment link and activate your plan immediately.
  </p>

  {(() => {
    const waNumber = process.env.REACT_APP_WA_NUMBER || '';
    const sanitized = waNumber.replace(/[^0-9]/g, '');

    if (!sanitized) {
      return null;
    }

    const plan = buildPricedPlan(selectedPlan);

    const message = encodeURIComponent(
      `Hello,\n\nI want to purchase the "${selectedPlan.name}" plan.\nTotal Amount: ${formatCurrency(
        plan.total
      )}\n\nPlease share the payment details.`
    );

    const waUrl = `https://wa.me/${sanitized}?text=${message}`;

    return (
      <a
        href={waUrl}
        target='_blank'
        rel='noopener noreferrer'
        className='gateway-modal__whatsapp-button'
      >
        <FaWhatsapp size={22} />
        Contact on WhatsApp
      </a>
    );
  })()}

  <p className='gateway-modal__note'>
    Sorry for the inconvenience. Online payment will be available again soon.
  </p>
</div>
          </section>
          
        </div>

      )}

      {errorMessage && <p className='plans-error'>{errorMessage}</p>}

      {loading && (
        <div className='gateway-loading-overlay'>
          <div className='gateway-loading-card'>
            <div className='gateway-loading-spinner' />
            <strong>Opening payment gateway</strong>
            <p>Wait while the checkout page loads.</p>
          </div>
        </div>
      )}

      {(() => {
        const waNumber = process.env.REACT_APP_WA_NUMBER || '';
        const sanitized = waNumber.replace(/[^0-9]/g, '');
        if (!sanitized) {
          return null;
        }
        const waUrl = `https://wa.me/${sanitized}`;
        return (
          <a
            href={waUrl}
            target='_blank'
            rel='noopener noreferrer'
            aria-label='Contact on WhatsApp'
            className='whatsapp-float-button'
          >
            <FaWhatsapp size={24} />
          </a>
        );
      })()}
    </main>
  );
};

export default PlansPage;
