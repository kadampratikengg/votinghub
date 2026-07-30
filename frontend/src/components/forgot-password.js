import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiMail, FiSend, FiShield } from 'react-icons/fi';
import './LoginPage.css';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const apiUrl = process.env.REACT_APP_API_URL || '';

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailError('');
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Server error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell auth-shell--compact">
      <section className="auth-art-panel auth-art-panel--reset">
        <span className="auth-badge"><FiShield /> Voting account recovery</span>
        <h1>Restore access to your voting dashboard.</h1>
        <p>Enter your registered voting administrator email and we will send password reset instructions.</p>
        <div className="auth-art-card">
          <strong>Voting password reset</strong>
          <span>Use the same email connected to your voting administrator account.</span>
        </div>
      </section>

      <section className="auth-card" aria-label="Forgot password form">
        <div className="auth-card__header">
          <span className="auth-kicker">Recovery</span>
          <h2>Reset Voting Password</h2>
          <p>We will send a reset link if the voting account email is registered.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field">
            <span><FiMail /> Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </label>
          {emailError && <p className="auth-error">{emailError}</p>}

          <button type="submit" className="auth-primary-button" disabled={loading}>
            {loading ? 'Sending...' : 'Send Voting Reset Link'} <FiSend />
          </button>

          {message && <p className="auth-message">{message}</p>}
          {error && <p className="auth-error auth-error--block">{error}</p>}
        </form>

        <div className="auth-links">
          <Link to="/"><FiArrowLeft /> Back to voting login</Link>
        </div>
      </section>
    </main>
  );
};

export default ForgotPasswordPage;
