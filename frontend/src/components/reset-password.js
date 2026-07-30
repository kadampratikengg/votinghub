import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiLock, FiShield, FiCheckCircle } from 'react-icons/fi';
import './LoginPage.css';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const apiUrl = process.env.REACT_APP_API_URL || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const verifyToken = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/reset-password/verify/${token}`);
        const data = await response.json().catch(() => ({}));

        if (!isMounted) return;

        if (response.ok) {
          setTokenValid(true);
          setError('');
        } else {
          setTokenValid(false);
          setError(data.message || 'Link expired. Please try again.');
        }
      } catch (requestError) {
        if (!isMounted) return;
        setTokenValid(false);
        setError('Unable to verify reset link. Please try again.');
      } finally {
        if (isMounted) setVerifying(false);
      }
    };

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, [apiUrl, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!tokenValid) {
      setError('Link expired. Please try again.');
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/reset-password/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: password,
          confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setMessage(data.message || 'Password updated successfully.');
        setTimeout(() => navigate('/'), 1800);
      } else if (response.status === 410) {
        setTokenValid(false);
        setError(data.message || 'Link expired. Please try again.');
      } else {
        setError(data.message || 'Failed to reset password.');
      }
    } catch (requestError) {
      setError('Server error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell auth-shell--compact">
      <section className="auth-art-panel auth-art-panel--reset">
        <span className="auth-badge">
          <FiShield /> Secure password reset
        </span>
        <h1>Create a new password for your voting account.</h1>
        <p>The reset link is valid for 10 minutes. After that, request a fresh link from the recovery page.</p>
        <div className="auth-art-card">
          <strong>Password update</strong>
          <span>Your new password is written to the database immediately after submission.</span>
        </div>
      </section>

      <section className="auth-card" aria-label="Reset password form">
        <div className="auth-card__header">
          <span className="auth-kicker">Recovery</span>
          <h2>Set New Password</h2>
          <p>{verifying ? 'Checking your reset link...' : 'Enter and confirm the new password for your account.'}</p>
        </div>

        {verifying ? (
          <p className="auth-message">Verifying reset link...</p>
        ) : !tokenValid ? (
          <>
            <p className="auth-error auth-error--block">{error}</p>
            <div className="auth-links">
              <Link to="/forgot-password">
                <FiArrowLeft /> Request a new reset link
              </Link>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field">
              <span>
                <FiLock /> New Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter a new password"
                autoComplete="new-password"
                required
              />
            </label>

            <label className="auth-field">
              <span>
                <FiLock /> Confirm Password
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm the new password"
                autoComplete="new-password"
                required
              />
            </label>

            <button type="submit" className="auth-primary-button" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'} <FiCheckCircle />
            </button>

            {message && <p className="auth-message">{message}</p>}
            {error && <p className="auth-error auth-error--block">{error}</p>}
          </form>
        )}

        <div className="auth-links">
          <Link to="/forgot-password">
            <FiArrowLeft /> Back to recovery
          </Link>
        </div>
      </section>
    </main>
  );
};

export default ResetPasswordPage;
