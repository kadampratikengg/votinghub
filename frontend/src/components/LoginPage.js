import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiLock, FiMail, FiShield } from 'react-icons/fi';
import './LoginPage.css';

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isLocalDevelopment =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  const useGoogleGsi = isLocalDevelopment;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError('');
    setLoading(true);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/login`,
        { email, password },
        { withCredentials: true },
      );

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('userId', response.data.userId);
      localStorage.setItem('role', response.data.role || 'admin');
      localStorage.setItem('subUserRole', response.data.subUserRole || '');
      localStorage.setItem(
        'permissions',
        JSON.stringify(response.data.permissions || []),
      );
      localStorage.setItem('isAuthenticated', 'true');
      onLogin();
      const fallbackPath =
        (response.data.role || 'admin') === 'subuser'
          ? '/dashboard'
          : '/dashboard';
      const redirectPath = location.state?.from?.pathname || fallbackPath;
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || 'An error occurred while logging in',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleResponse = useCallback(
    async (res) => {
      if (!res?.credential) return;
      setLoading(true);
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/auth/google`,
          { credential: res.credential },
          { withCredentials: true },
        );

        localStorage.setItem('token', response.data.token);
        localStorage.setItem('userId', response.data.userId);
        localStorage.setItem('role', response.data.role || 'admin');
        localStorage.setItem('subUserRole', response.data.subUserRole || '');
        localStorage.setItem(
          'permissions',
          JSON.stringify(response.data.permissions || []),
        );
        localStorage.setItem('isAuthenticated', 'true');
        onLogin();
        const fallbackPath =
          (response.data.role || 'admin') === 'subuser'
            ? '/dashboard'
            : '/dashboard';
        const redirectPath = location.state?.from?.pathname || fallbackPath;
        navigate(redirectPath, { replace: true });
      } catch (error) {
        setErrorMessage(
          error.response?.data?.message ||
            'An error occurred while logging in with Google',
        );
      } finally {
        setLoading(false);
      }
    },
    [navigate, location, onLogin],
  );

  useEffect(() => {
    // If the server redirected back with a token in the query string, use it
    const params = new URLSearchParams(window.location.search);
    const serverToken = params.get('token');
    const serverUserId = params.get('userId');
    const serverRole = params.get('role');
    const serverSubUserRole = params.get('subUserRole');
    const serverPermissionsRaw = params.get('permissions');
    let serverPermissions = serverPermissionsRaw;
    if (
      serverPermissionsRaw &&
      (serverPermissionsRaw.startsWith('[') ||
        serverPermissionsRaw.startsWith('{'))
    ) {
      try {
        serverPermissions = JSON.stringify(JSON.parse(serverPermissionsRaw));
      } catch (parseError) {
        serverPermissions = serverPermissionsRaw;
      }
    }
    const serverError = params.get('error');
    const serverErrorDescription = params.get('error_description');

    if (serverError) {
      setErrorMessage(
        serverErrorDescription ||
          'Google sign-in failed. Please try again or use email/password.',
      );
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return;
    }

    if (serverToken) {
      // Store token and info, then clear query params and navigate
      localStorage.setItem('token', serverToken);
      if (serverUserId) localStorage.setItem('userId', serverUserId);
      localStorage.setItem('role', serverRole || 'admin');
      if (serverSubUserRole) localStorage.setItem('subUserRole', serverSubUserRole);
      if (serverPermissions) localStorage.setItem('permissions', serverPermissions);
      localStorage.setItem('isAuthenticated', 'true');
      onLogin();
      // Remove token from URL
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      const fallbackPath = '/dashboard';
      navigate(fallbackPath, { replace: true });
      return;
    }
    const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!googleClientId) return undefined;

    if (!useGoogleGsi) {
      setGoogleLoaded(true);
      return undefined;
    }

    let script = document.querySelector('script[data-google-gsi="true"]');
    const initializeGoogle = () => {
      if (
        window.google &&
        window.google.accounts &&
        window.google.accounts.id
      ) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
        });
        const el = document.getElementById('googleSignInDiv');
        if (el) {
          window.google.accounts.id.renderButton(el, {
            theme: 'outline',
            size: 'large',
            width: '280',
          });
          setGoogleLoaded(true);
        }
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleGsi = 'true';
      script.onload = initializeGoogle;
      document.body.appendChild(script);
    } else {
      initializeGoogle();
    }

    return () => {
      setGoogleLoaded(false);
    };
  }, [handleGoogleResponse, navigate, onLogin, useGoogleGsi]);

  const handleGoogleFallbackClick = () => {
    if (
      useGoogleGsi &&
      window.google &&
      window.google.accounts &&
      window.google.accounts.id
    ) {
      try {
        window.google.accounts.id.prompt();
      } catch (error) {
        setErrorMessage('Google sign-in is not available right now.');
      }
      return;
    }

    const redirectTarget = window.location.origin || 'http://localhost:3000';
    const url = `${process.env.REACT_APP_API_URL}/auth/google?redirect=${encodeURIComponent(
      redirectTarget,
    )}`;
    window.location.href = url;
  };

  return (
    <main className='auth-shell auth-shell--compact'>
      <section className='auth-art-panel'>
        <span className='auth-badge'>
          <FiShield /> Secure voting access
        </span>
        <h1>Manage digital voting with confidence and control.</h1>
        <p>
          Sign in to create voting events, manage voter data, monitor
          participation, and view results from one dashboard.
        </p>
        <div className='auth-art-card'>
          <strong>Voting control room</strong>
          <span>Protected access for election and voting administrators.</span>
        </div>
      </section>

      <section className='auth-card' aria-label='Login form'>
        <div className='auth-card__header'>
          <span className='auth-kicker'>Welcome back</span>
          <h2>Voting Login</h2>
          <p>Use your registered voting administrator account to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className='auth-form'>
          <label className='auth-field'>
            <span>
              <FiMail /> Email
            </span>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='name@example.com'
              required
            />
          </label>
          {emailError && <p className='auth-error'>{emailError}</p>}

          <label className='auth-field'>
            <span>
              <FiLock /> Password
            </span>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='Enter password'
              required
            />
          </label>

          <button
            type='submit'
            className='auth-primary-button'
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Login to Voting'} <FiArrowRight />
          </button>

          {errorMessage && (
            <p className='auth-error auth-error--block'>{errorMessage}</p>
          )}
        </form>

        <div className='auth-divider'>or</div>

        <div className='auth-google'>
          <div id='googleSignInDiv' aria-hidden='true'></div>
          <button
            type='button'
            className='auth-google__btn'
            onClick={handleGoogleFallbackClick}
            disabled={loading}
          >
            <span className='auth-google__icon' aria-hidden>
              <svg
                width='18'
                height='18'
                viewBox='0 0 48 48'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  fill='#EA4335'
                  d='M24 9.5c3.9 0 6.6 1.7 8.1 3.1l6-5.8C35 4 30.9 2 24 2 14.6 2 6.9 7.6 3.6 15.5l7.4 5.7C12.6 15 17.6 9.5 24 9.5z'
                />
                <path
                  fill='#34A853'
                  d='M46.5 24.5c0-1.6-.1-2.7-.4-3.9H24v7.3h12.7c-.6 3.4-2.8 6.2-6 8.1l9.4 7.3C44.4 38.7 46.5 32.1 46.5 24.5z'
                />
                <path
                  fill='#4A90E2'
                  d='M10.9 29.2A14.7 14.7 0 0 1 9.6 24c0-1.8.3-3.5.8-5.2L3 13.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.6 2.6 10.9l8.3-5.7z'
                />
                <path
                  fill='#FBBC05'
                  d='M24 46c6.6 0 12.1-2.2 16.1-6l-9.4-7.3c-2.6 1.7-6 2.8-9.7 2.8-6.4 0-11.6-4.9-12.7-11.3L3.6 34.5C6.9 42.4 14.6 48 24 48z'
                />
                <path fill='none' d='M0 0h48v48H0z' />
              </svg>
            </span>
            <span className='auth-google__text'>Sign in with Google</span>
          </button>
          {useGoogleGsi && !googleLoaded ? (
            <p className='auth-google__hint'>
              Loading Google sign-in...
            </p>
          ) : null}
          <p className='auth-google__hint'>
            Sign in with Google. If you don't exist in our system, an account
            will be created.
          </p>
        </div>

        <div className='auth-links'>
          <Link to='/forgot-password'>Forgot password?</Link>
          <Link to='/create-account'>Create new account</Link>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
