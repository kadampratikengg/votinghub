import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiCheckCircle,
  FiShield,
  FiStar,
  FiTrendingDown,
  FiZap,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { initiatePayment } from './razorpay';
import './PlansPage.css';

const PlansPage = () => {
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const formatCurrency = (amount) =>
    `₹${Number(amount).toLocaleString('en-IN')}`;

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

  const handlePlanSelect = (plan) => {
    initiatePayment(
      buildPricedPlan(plan),
      email,
      userId,
      setErrorMessage,
      setLoading,
      navigate,
      () => navigate('/profile'),
      { password, confirmPassword },
    );
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

              <button onClick={() => handlePlanSelect(plan)} disabled={loading}>
                {loading ? 'Processing...' : 'Buy Voting Credits'}
              </button>
            </article>
          );
        })}
      </section>

      {errorMessage && <p className='plans-error'>{errorMessage}</p>}

      {/* WhatsApp floating button (only on PlansPage) */}
      {(() => {
        const waNumber = process.env.REACT_APP_WA_NUMBER;
        const sanitized = waNumber.replace(/[^0-9]/g, '');
        const waUrl = `https://wa.me/${sanitized}`;
        return (
          <a
            href={waUrl}
            target='_blank'
            rel='noopener noreferrer'
            aria-label='Contact on WhatsApp'
            style={{
              position: 'fixed',
              right: 18,
              bottom: 18,
              backgroundColor: '#25D366',
              color: '#fff',
              width: 56,
              height: 56,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 18px rgba(37,211,102,0.24)',
              zIndex: 9999,
              textDecoration: 'none',
            }}
          >
            <FaWhatsapp size={24} />
          </a>
        );
      })()}
    </main>
  );
};

export default PlansPage;
