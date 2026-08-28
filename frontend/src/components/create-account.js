import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
// Use native file input and backend S3 upload endpoint instead of Uploadcare
import { toast, ToastContainer } from 'react-toastify';
import {
  FiArrowRight,
  FiBriefcase,
  FiHash,
  FiLock,
  FiMail,
  FiMapPin,
  FiPhone,
  FiUploadCloud,
  FiUser,
} from 'react-icons/fi';
import 'react-toastify/dist/ReactToastify.css';
import './LoginPage.css';
import Seo from './site/Seo';
import { resolveStoredAssetUrl } from '../utils/imageUrl';

const CreateAccountPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState({
    name: '',
    organization: '',
    logo: '',
    contact: '',
    phone: '',
    address: '',
    state: '',
    district: '',
    pincode: '',
    gstNumber: '',
  });
  const apiUrl = process.env.REACT_APP_API_URL;

  const uploadFileToS3 = async (file, token, folder) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${apiUrl}/api/upload/s3`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Upload failed');
    }
    return res.json(); // { url, key }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData({ ...userData, [name]: value });
  };

  const handlePincodeChange = async (e) => {
    const pincode = e.target.value.replace(/\D/g, '').slice(0, 6);
    setUserData({ ...userData, pincode });
    if (pincode.length === 6) {
      try {
        const response = await axios.get(
          `https://api.postalpincode.in/pincode/${pincode}`,
        );
        const data = response.data[0];
        if (data.Status === 'Success') {
          const { District, State } = data.PostOffice[0];
          setUserData((prev) => ({
            ...prev,
            district: District,
            state: State,
          }));
        } else {
          toast.error('Invalid pincode');
        }
      } catch (error) {
        toast.error('Error fetching pincode data');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError('');

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setPasswordError('');
    setErrorMessage('');
    setLoading(true);

    try {
      const checkResponse = await axios.post(
        `${process.env.REACT_APP_API_URL}/check-email`,
        { email },
        { withCredentials: true },
      );

      if (checkResponse.data.exists) {
        setEmailError('Email already registered.');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      for (const key in userData) {
        formData.append(key, userData[key]);
      }
      formData.append('email', email);
      formData.append('password', password);
      formData.append('confirmPassword', confirmPassword);

      const createResponse = await axios.post(
        `${process.env.REACT_APP_API_URL}/create-account`,
        formData,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );

      localStorage.setItem('token', createResponse.data.token);
      localStorage.setItem('userId', createResponse.data.userId);
      localStorage.setItem('role', createResponse.data.role || 'admin');
      localStorage.setItem('subUserRole', '');
      localStorage.setItem('permissions', JSON.stringify(['*']));
      localStorage.setItem('isAuthenticated', 'true');

      window.location.href = '/dashboard';
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        'Failed to create account';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setLoading(false);
    }
  };

  return (
    <main className='auth-shell auth-shell--wide auth-shell--single'>
      <Seo
        title='Create Account | PrivateVoting'
        description='Create a PrivateVoting account to start setting up secure online voting for your organization.'
        canonicalPath='/create-account'
        noIndex
      />
      <ToastContainer position='top-right' autoClose={3000} />

      <section className='auth-art-panel auth-art-panel--signup'>
        <span className='auth-badge'>
          <FiBriefcase /> Voting admin setup
        </span>
        <h1>Create your voting management account.</h1>
        <p>
          Add administrator, organization, location, and billing-ready details
          before choosing a voting plan.
        </p>
        <div className='auth-art-card'>
          <strong>Election-ready onboarding</strong>
          <span>
            Your profile supports voting event setup, voter verification, and
            result management.
          </span>
        </div>
      </section>

      <section
        className='auth-card auth-card--large'
        aria-label='Create account form'
      >
        <div className='auth-card__header'>
          <span className='auth-kicker'>Get started</span>
          <h2>Register for Voting</h2>
          <p>
            Enter voting administrator credentials and organization profile
            information.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='auth-form'>
          <div className='auth-form-section'>
            <h3>Voting Account Access</h3>
            <div className='auth-form-grid'>
              <label className='auth-field' htmlFor='ca-email'>
                <span>
                  <FiMail /> Email
                </span>
                <input
                  id='ca-email'
                  name='email'
                  type='email'
                  autoComplete='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='name@example.com'
                  required
                  aria-required='true'
                />
              </label>
              <label className='auth-field' htmlFor='ca-password'>
                <span>
                  <FiLock /> Password
                </span>
                <input
                  id='ca-password'
                  name='password'
                  type='password'
                  autoComplete='new-password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder='Minimum 8 characters'
                  required
                  aria-required='true'
                />
              </label>
              <label className='auth-field' htmlFor='ca-confirm-password'>
                <span>
                  <FiLock /> Confirm Password
                </span>
                <input
                  id='ca-confirm-password'
                  name='confirmPassword'
                  type='password'
                  autoComplete='new-password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder='Repeat password'
                  required
                  aria-required='true'
                />
              </label>
            </div>
            {emailError && <p className='auth-error'>{emailError}</p>}
            {passwordError && <p className='auth-error'>{passwordError}</p>}
          </div>

          <div className='auth-form-section'>
            <h3>Voting Organization Details</h3>
            <div className='auth-form-grid'>
              <label className='auth-field' htmlFor='ca-name'>
                <span>
                  <FiUser /> Full Name
                </span>
                <input
                  id='ca-name'
                  type='text'
                  name='name'
                  autoComplete='name'
                  value={userData.name}
                  onChange={handleInputChange}
                  required
                  aria-required='true'
                />
              </label>
              <label className='auth-field' htmlFor='ca-organization'>
                <span>
                  <FiBriefcase /> Organization
                </span>
                <input
                  id='ca-organization'
                  type='text'
                  name='organization'
                  autoComplete='organization'
                  value={userData.organization}
                  onChange={handleInputChange}
                />
              </label>
              <label className='auth-field' htmlFor='ca-contact'>
                <span>
                  <FiMail /> Contact Email
                </span>
                <input
                  id='ca-contact'
                  type='email'
                  name='contact'
                  autoComplete='email'
                  value={userData.contact}
                  onChange={handleInputChange}
                />
              </label>
              <label className='auth-field' htmlFor='ca-phone'>
                <span>
                  <FiPhone /> Phone Number
                </span>
                <input
                  id='ca-phone'
                  type='tel'
                  name='phone'
                  autoComplete='tel'
                  value={userData.phone}
                  onChange={handleInputChange}
                />
              </label>
              <label className='auth-field auth-field--full' htmlFor='ca-address'>
                <span>
                  <FiMapPin /> Address
                </span>
                <input
                  id='ca-address'
                  type='text'
                  name='address'
                  autoComplete='street-address'
                  value={userData.address}
                  onChange={handleInputChange}
                />
              </label>
              <label className='auth-field' htmlFor='ca-pincode'>
                <span>
                  <FiHash /> Pincode
                </span>
                <input
                  id='ca-pincode'
                  type='text'
                  name='pincode'
                  autoComplete='postal-code'
                  value={userData.pincode}
                  onChange={handlePincodeChange}
                  maxLength='6'
                  inputMode='numeric'
                />
              </label>
              <label className='auth-field' htmlFor='ca-district'>
                <span>
                  <FiMapPin /> District
                </span>
                <input
                  id='ca-district'
                  type='text'
                  name='district'
                  autoComplete='address-level2'
                  value={userData.district}
                  disabled
                />
              </label>
              <label className='auth-field' htmlFor='ca-state'>
                <span>
                  <FiMapPin /> State
                </span>
                <input
                  id='ca-state'
                  type='text'
                  name='state'
                  autoComplete='address-level1'
                  value={userData.state}
                  disabled
                />
              </label>
              <label className='auth-field' htmlFor='ca-gst'>
                <span>
                  <FiHash /> GST Number
                </span>
                <input
                  id='ca-gst'
                  type='text'
                  name='gstNumber'
                  value={userData.gstNumber}
                  onChange={handleInputChange}
                />
              </label>
            </div>
          </div>

          <div className='auth-upload-box'>
            <div>
              <span>
                <FiUploadCloud /> Organization Logo
              </span>
              <p>Optional square logo. Max 2 MB.</p>
            </div>
            <div>
              <input
                type='file'
                accept='image/*'
                onChange={async (e) => {
                  const file = e.target.files && e.target.files[0];
                  if (!file) return;
                  try {
                    const result = await uploadFileToS3(
                      file,
                      null,
                      'organization-images',
                    );
                    // store key for backend and url for preview
                    setUserData((prev) => ({
                      ...prev,
                      logo: result.key,
                      logoPreview: result.proxyUrl
                        ? `${apiUrl}${result.proxyUrl}`
                        : result.url,
                    }));
                    toast.success('Logo uploaded successfully');
                  } catch (err) {
                    toast.error(err.message || 'Logo upload failed');
                  }
                }}
              />
              {userData.logoPreview && (
                <img
                  src={resolveStoredAssetUrl(
                    userData.logoPreview || userData.logo,
                    process.env.REACT_APP_S3_BUCKET_URL,
                    apiUrl,
                  )}
                  alt='Organization Logo'
                  className='auth-logo-preview'
                />
              )}
            </div>
          </div>

          <button
            type='submit'
            className='auth-primary-button'
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Register Voting Account'}{' '}
            <FiArrowRight />
          </button>
          {errorMessage && (
            <p className='auth-error auth-error--block'>{errorMessage}</p>
          )}
        </form>

        <div className='auth-links'>
          <Link to='/'>Already registered? Login to voting</Link>
        </div>
      </section>
    </main>
  );
};

export default CreateAccountPage;
