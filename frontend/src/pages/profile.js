import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import {
  FiBriefcase,
  FiCalendar,
  FiCreditCard,
  FiDownload,
  FiHash,
  FiLock,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSave,
  FiShield,
  FiUploadCloud,
  FiUser,
} from 'react-icons/fi';
import './Profile.css';
import { resolveStoredAssetUrl } from '../utils/imageUrl';

const Profile = ({ setIsAuthenticated }) => {
  const [userData, setUserData] = useState({
    username: '',
    name: '',
    organization: '',
    logo: '',
    contact: '',
    email: '',
    phone: '',
    address: '',
    state: '',
    district: '',
    pincode: '',
    gstNumber: '',
    ipRestrictionEnabled: false,
    allowedIp: '',
    subscription: {},
    subscriptionHistory: [],
  });
  const [autoDetectingIp, setAutoDetectingIp] = useState(false);
  const [ipWasAutoDetected, setIpWasAutoDetected] = useState(false);
  const [savingIpRestriction, setSavingIpRestriction] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [updatingLogo, setUpdatingLogo] = useState(false);
  const apiUrl = process.env.REACT_APP_API_URL;
  const s3BucketUrl = process.env.REACT_APP_S3_BUCKET_URL;
  const ipRestrictionDraftRef = useRef({
    ipRestrictionEnabled: false,
    allowedIp: '',
  });

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
      throw new Error(
        [err.message, err.error, err.code].filter(Boolean).join(': ') ||
          'Upload failed',
      );
    }
    return res.json(); // { url, key }
  };
  const navigate = useNavigate();

  const formatDate = (date) => {
    if (!date) return 'Not set';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const isExpiredByDate = (date) => {
    if (!date) return false;
    const endDate = new Date(date);
    if (Number.isNaN(endDate.getTime())) return false;
    endDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate <= today;
  };

  const getSubscriptionStatus = (sub, isCurrentSubscription = false) => {
    if (isCurrentSubscription && !isExpiredByDate(sub.endDate)) {
      return 'Active until';
    }
    return isExpiredByDate(sub.endDate) ? 'Expired' : 'Active';
  };

  const formatAmount = (amount) => {
    if (!amount && amount !== 0) return 'INR 0';
    return `INR ${Number(amount / 100).toLocaleString('en-IN')}`;
  };

  const handleDownloadInvoice = async (sub) => {
    if (!sub?.orderId) {
      toast.error('Invoice is not available for this subscription');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${apiUrl}/api/invoice/${encodeURIComponent(sub.orderId)}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'blob',
        },
      );

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${sub.orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded successfully');
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to download invoice',
      );
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          setMessage('No authentication token found. Redirecting to login...');
          setTimeout(() => navigate('/'), 2000);
          return;
        }
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/users`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setUserData((prev) => ({
          ...prev,
          ...response.data,
          ipRestrictionEnabled:
            response.data.ipRestrictionEnabled ??
            prev.ipRestrictionEnabled ??
            false,
          allowedIp: response.data.allowedIp ?? prev.allowedIp ?? '',
        }));
        ipRestrictionDraftRef.current = {
          ipRestrictionEnabled: response.data.ipRestrictionEnabled ?? false,
          allowedIp: response.data.allowedIp ?? '',
        };
        setMessage('');
      } catch (error) {
        setMessage(
          error.response?.status === 401
            ? 'Unauthorized access. Redirecting to login...'
            : error.response?.status === 404
              ? 'Profile endpoint not found. Please check the backend server.'
              : 'Error fetching user data',
        );
        if (error.response?.status === 401) {
          setTimeout(() => navigate('/'), 2000);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [navigate]);

  const detectIpAddress = async () => {
    // Require the user to enable IP restriction before detecting
    if (!userData.ipRestrictionEnabled) {
      toast.info('Please enable IP restriction first');
      return;
    }
    try {
      setAutoDetectingIp(true);
      const res = await axios.get('https://api.ipify.org?format=json');
      const ip = res.data && res.data.ip ? res.data.ip : '';
      if (!ip) throw new Error('Unable to detect IP');
      ipRestrictionDraftRef.current = {
        ...ipRestrictionDraftRef.current,
        allowedIp: ip,
      };
      setUserData((prev) => ({ ...prev, allowedIp: ip }));
      setIpWasAutoDetected(true);
      toast.success('Detected IP address');
    } catch (err) {
      toast.error(err.message || 'Failed to detect IP address');
    } finally {
      setAutoDetectingIp(false);
    }
  };

  const saveIpRestriction = async (ipEnabled, allowedIpValue) => {
    try {
      setSavingIpRestriction(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      const payload = { ipRestrictionEnabled: ipEnabled };
      if (typeof allowedIpValue !== 'undefined') {
        payload.allowedIp = String(allowedIpValue || '').trim();
      }
      const response = await axios.put(`${apiUrl}/api/users`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const profileResponse = await axios.get(`${apiUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUserData((prev) => ({
        ...prev,
        ...profileResponse.data,
        ipRestrictionEnabled:
          profileResponse.data.ipRestrictionEnabled ??
          response.data.ipRestrictionEnabled ??
          ipEnabled,
        allowedIp:
          profileResponse.data.allowedIp ??
          response.data.allowedIp ??
          String(allowedIpValue || '').trim(),
      }));
      ipRestrictionDraftRef.current = {
        ipRestrictionEnabled:
          profileResponse.data.ipRestrictionEnabled ??
          response.data.ipRestrictionEnabled ??
          ipEnabled,
        allowedIp:
          profileResponse.data.allowedIp ??
          response.data.allowedIp ??
          String(allowedIpValue || '').trim(),
      };
      toast.success('IP restriction configuration saved');
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          'Failed to save IP restriction',
      );
    } finally {
      setSavingIpRestriction(false);
    }
  };

  const handleToggleIpRestriction = (checked) => {
    ipRestrictionDraftRef.current = {
      ...ipRestrictionDraftRef.current,
      ipRestrictionEnabled: checked,
    };
    setUserData((prev) => ({ ...prev, ipRestrictionEnabled: checked }));
    if (!checked) {
      setIpWasAutoDetected(false);
    }
  };

  const handleSaveIpRestriction = async () => {
    const draftEnabled =
      ipRestrictionDraftRef.current.ipRestrictionEnabled ??
      userData.ipRestrictionEnabled;
    const draftAllowedIp =
      ipRestrictionDraftRef.current.allowedIp ?? userData.allowedIp;

    if (draftEnabled && !String(draftAllowedIp || '').trim()) {
      toast.error('Please enter an allowed IP address before saving');
      return;
    }
    await saveIpRestriction(!!draftEnabled, draftAllowedIp);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // If user edits the allowedIp manually, mark it as not auto-detected
    if (name === 'allowedIp') {
      setIpWasAutoDetected(false);
      ipRestrictionDraftRef.current = {
        ...ipRestrictionDraftRef.current,
        allowedIp: value,
      };
    }
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
          setMessage('');
        } else {
          setMessage('Invalid pincode');
        }
      } catch (error) {
        setMessage('Error fetching pincode data');
      }
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setSavingPassword(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/change-password`,
        {
          newPassword,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status !== 200) {
        throw new Error(response.data.message || 'Failed to change password');
      }

      toast.success('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || 'Error changing password',
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/users`,
        userData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        },
      );
      setUserData(response.data);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const persistLogo = async (nextLogo, nextLogoPreview = '') => {
    const response = await axios.put(
      `${apiUrl}/api/users`,
      { logo: nextLogo },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      },
    );

    setUserData((prev) => ({
      ...prev,
      ...response.data,
      logoPreview: nextLogoPreview,
    }));
  };

  const handleLogoDelete = async () => {
    const currentLogo = userData.logo;
    if (!currentLogo || updatingLogo) return;

    try {
      setUpdatingLogo(true);
      const token = localStorage.getItem('token');
      await fetch(
        `${apiUrl}/api/uploadcare/delete/${encodeURIComponent(currentLogo)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      ).then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to delete logo');
        }
      });

      await persistLogo('', '');
      toast.success('Logo deleted successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to delete logo');
    } finally {
      setUpdatingLogo(false);
    }
  };

  const handleSubscriptionUpdate = () => {
    navigate('/planspage', {
      state: { email: userData.email, userId: localStorage.getItem('userId') },
    });
  };

  const organizationLogoUrl = resolveStoredAssetUrl(
    userData.logoPreview || userData.logo,
    s3BucketUrl,
    apiUrl,
  );

  const currentSubscription = userData.subscription || {};
  // Support both shapes: `subscription.votingCredits` (primary) or a legacy/top-level `votingCredits`.
  const availableCredits =
    currentSubscription?.votingCredits ?? userData?.votingCredits ?? 0;
  const pendingActivationMessage =
    !currentSubscription.isValid && currentSubscription.activationDate
      ? `Free credits will activate on ${formatDate(currentSubscription.activationDate)}`
      : '';
  const allSubscriptions = [
    ...(userData.subscription &&
    (userData.subscription.orderId || userData.subscription.planDuration)
      ? [userData.subscription]
      : []),
    ...(userData.subscriptionHistory || []),
  ];

  return (
    <div className='work-shell profile-shell'>
      <ToastContainer
        position='top-right'
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        draggable
        pauseOnHover
      />
      <Sidebar setIsAuthenticated={setIsAuthenticated} />

      <main className='work-page profile-page'>
        <section className='profile-hero'>
          <div className='profile-hero__content'>
            <span className='profile-eyebrow'>
              <FiShield /> Account Control Center
            </span>
            <h1>Profile</h1>
            <p>
              Manage your account identity, organization details, security, and
              subscription records.
            </p>
          </div>
          <div className='profile-hero__card'>
            <div className='profile-avatar'>
              {organizationLogoUrl ? (
                <img src={organizationLogoUrl} alt='Organization Logo' />
              ) : (
                <FiBriefcase />
              )}
            </div>
            <div>
              <strong>{userData.organization || 'Organization not set'}</strong>
              <span>{userData.name || userData.email || 'Profile owner'}</span>
            </div>
          </div>
        </section>

        {loading && (
          <div className='profile-alert profile-alert--info'>
            Loading profile...
          </div>
        )}
        {message && (
          <div className='profile-alert profile-alert--error'>{message}</div>
        )}
        {pendingActivationMessage && (
          <div className='profile-alert profile-alert--info'>
            {pendingActivationMessage}
          </div>
        )}

        <section className='profile-stats-grid'>
          <div className='profile-stat-card'>
            <FiUser />
            <span>Username</span>
            <strong>{userData.username || 'Not set'}</strong>
          </div>
          <div className='profile-stat-card'>
            <FiCreditCard />
            <span>Available Credits</span>
            <strong>{availableCredits}</strong>
          </div>
          <div className='profile-stat-card'>
            <FiCalendar />
            <span>Valid Till</span>
            <strong>{formatDate(currentSubscription.endDate)}</strong>
          </div>
        </section>

        <section className='profile-layout'>
          <form
            onSubmit={handleSubmit}
            className='profile-card profile-card--wide'
          >
            <div className='profile-card__header'>
              <div>
                <span className='profile-section-kicker'>Identity</span>
                <h2>Business Profile</h2>
              </div>
              <button
                type='submit'
                className='profile-icon-button profile-icon-button--primary'
                disabled={savingProfile || loading}
              >
                <FiSave />
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>

            <div className='profile-form-grid'>
              <label className='profile-field'>
                <span>
                  <FiUser /> Username
                </span>
                <input type='text' value={userData.username} disabled />
              </label>
              <label className='profile-field'>
                <span>
                  <FiUser /> Full Name
                </span>
                <input
                  type='text'
                  name='name'
                  value={userData.name}
                  onChange={handleInputChange}
                  required
                />
              </label>
              <label className='profile-field'>
                <span>
                  <FiBriefcase /> Organization
                </span>
                <input
                  type='text'
                  name='organization'
                  value={userData.organization}
                  onChange={handleInputChange}
                />
              </label>
              <label className='profile-field'>
                <span>
                  <FiMail /> Contact Email
                </span>
                <input
                  type='email'
                  name='email'
                  value={userData.email}
                  onChange={handleInputChange}
                />
              </label>
              <label className='profile-field'>
                <span>
                  <FiPhone /> Phone Number
                </span>
                <input
                  type='tel'
                  name='phone'
                  value={userData.phone}
                  onChange={handleInputChange}
                />
              </label>
              <label className='profile-field'>
                <span>
                  <FiMapPin /> Address
                </span>
                <input
                  type='text'
                  name='address'
                  value={userData.address}
                  onChange={handleInputChange}
                />
              </label>
              <label className='profile-field'>
                <span>
                  <FiHash /> Pincode
                </span>
                <input
                  type='text'
                  name='pincode'
                  value={userData.pincode}
                  onChange={handlePincodeChange}
                  maxLength='6'
                  inputMode='numeric'
                />
              </label>
              <label className='profile-field'>
                <span>
                  <FiMapPin /> District
                </span>
                <input
                  type='text'
                  name='district'
                  value={userData.district}
                  onChange={handleInputChange}
                  disabled
                />
              </label>
              <label className='profile-field'>
                <span>
                  <FiMapPin /> State
                </span>
                <input
                  type='text'
                  name='state'
                  value={userData.state}
                  onChange={handleInputChange}
                  disabled
                />
              </label>
              <label className='profile-field'>
                <span>
                  <FiCreditCard /> GST Number
                </span>
                <input
                  type='text'
                  name='gstNumber'
                  value={userData.gstNumber}
                  onChange={handleInputChange}
                />
              </label>
            </div>

            <div className='profile-upload-panel'>
              <div>
                <span className='profile-section-kicker'>Brand Asset</span>
                <h3>Organization Logo</h3>
                <p>Upload a square logo for better display in account areas.</p>
              </div>
              <div className='profile-upload-action'>
                <FiUploadCloud />
                <div>
                  <input
                    type='file'
                    accept='image/*'
                    disabled={updatingLogo}
                    onChange={async (e) => {
                      const file = e.target.files && e.target.files[0];
                      if (!file) return;
                      try {
                        setUpdatingLogo(true);
                        const token = localStorage.getItem('token');
                        const result = await uploadFileToS3(
                          file,
                          token,
                          'organization-images',
                        );
                        const logoPreview = result.proxyUrl
                          ? `${apiUrl}${result.proxyUrl}`
                          : result.url;
                        await persistLogo(result.key, logoPreview);
                        toast.success('Logo uploaded successfully');
                      } catch (err) {
                        toast.error(err.message || 'Logo upload failed');
                      } finally {
                        setUpdatingLogo(false);
                      }
                    }}
                  />
                  {organizationLogoUrl && (
                    <div className='profile-logo-tools'>
                      <img
                        src={organizationLogoUrl}
                        alt='Organization logo preview'
                        className='profile-logo-preview'
                      />
                      <button
                        type='button'
                        className='profile-icon-button profile-icon-button--danger'
                        onClick={handleLogoDelete}
                        disabled={updatingLogo}
                      >
                        {updatingLogo ? 'Working...' : 'Delete Logo'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>

          <aside className='profile-side-stack'>
            <form onSubmit={handlePasswordChange} className='profile-card'>
              <div className='profile-card__header profile-card__header--stacked'>
                <span className='profile-section-kicker'>Security</span>
                <h2>Change Password</h2>
                <p>Use a strong password with at least 8 characters.</p>
              </div>
              <label className='profile-field'>
                <span>
                  <FiLock /> New Password
                </span>
                <input
                  type='password'
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength='8'
                />
              </label>
              <label className='profile-field'>
                <span>
                  <FiLock /> Confirm Password
                </span>
                <input
                  type='password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength='8'
                />
              </label>
              <button
                type='submit'
                className='profile-icon-button profile-icon-button--dark'
                disabled={savingPassword}
              >
                <FiLock />
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <div className='profile-card profile-subscription-card'>
              <div className='profile-card__header profile-card__header--stacked'>
                <span className='profile-section-kicker'>Plan</span>
                <h2>Subscription</h2>
                <p>
                  {currentSubscription.planDuration ||
                    'No active subscription plan found.'}
                </p>
                <p>
                  Available credits: <strong>{availableCredits}</strong>
                </p>
              </div>
              <button
                onClick={handleSubscriptionUpdate}
                className='profile-icon-button profile-icon-button--accent'
              >
                <FiCreditCard /> Update Subscription
              </button>
            </div>
          </aside>
        </section>

        <section className='profile-card profile-security-card profile-security-card--fullwidth'>
          <div className='profile-card__header profile-card__header--stacked'>
            <div className='profile-security-card__top'>
              <div>
                <span className='profile-section-kicker'>Security</span>
                <h2>IP Restriction</h2>
                <p>
                  Configure the single IP address that can open voting links for
                  this account.
                </p>
              </div>
              <span
                className={`profile-status-pill ${
                  userData.ipRestrictionEnabled
                    ? 'profile-status-pill--on'
                    : 'profile-status-pill--off'
                }`}
              >
                {userData.ipRestrictionEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className='profile-security-card__notice'>
            {userData.ipRestrictionEnabled ? (
              <strong>
                Only {userData.allowedIp || 'the configured IP'} can open this
                voting link.
              </strong>
            ) : (
              <strong>Voting links are open from any IP address.</strong>
            )}
            <span>
              Disabled by default. Save the restriction after choosing the
              allowed IP address.
            </span>
          </div>

          <div className='profile-security-card__controls'>
            <div className='profile-field profile-field--inline'>
              <span>
                <FiShield /> Restrict Voting Links to IP
              </span>
              <label className='profile-switch'>
                <input
                  type='checkbox'
                  name='ipRestrictionEnabled'
                  checked={!!userData.ipRestrictionEnabled}
                  onChange={(e) => handleToggleIpRestriction(e.target.checked)}
                />
                <span className='profile-switch__track'>
                  <span className='profile-switch__thumb' />
                </span>
                <span className='profile-switch__label'>
                  {userData.ipRestrictionEnabled ? 'On' : 'Off'}
                </span>
              </label>
            </div>

            <label className='profile-field'>
              <span>
                <FiMapPin /> Allowed IP Address
              </span>
              <input
                type='text'
                name='allowedIp'
                value={userData.allowedIp}
                onChange={handleInputChange}
                placeholder='203.0.113.5'
                disabled={!userData.ipRestrictionEnabled}
              />
            </label>

            <div className='profile-security-card__actions'>
              <button
                type='button'
                className='profile-icon-button profile-icon-button--ghost'
                onClick={detectIpAddress}
                disabled={autoDetectingIp || !userData.ipRestrictionEnabled}
              >
                {autoDetectingIp ? 'Detecting...' : 'Auto-detect IP'}
              </button>
              <button
                type='button'
                className='profile-icon-button profile-icon-button--dark'
                onClick={handleSaveIpRestriction}
                disabled={savingIpRestriction}
              >
                <FiSave />
                {savingIpRestriction ? 'Saving...' : 'Save Restriction'}
              </button>
            </div>

            <p className='profile-security-card__hint'>
              When enabled, only the configured IP address may open voting links
              for your account.
            </p>
            <div className='profile-security-card__meta'>
              {userData.allowedIp ? (
                <span>
                  Current IP: {userData.allowedIp}
                  {ipWasAutoDetected ? ' (auto-detected)' : ''}
                </span>
              ) : (
                <span>No IP configured yet.</span>
              )}
            </div>
          </div>
        </section>
{/*  */}
        <section className='profile-card profile-history-card'>
          <div className='profile-card__header'>
            <div>
              <span className='profile-section-kicker'>Billing</span>
              <h2>Subscription History</h2>
            </div>
          </div>
          <div className='profile-history-grid'>
            {allSubscriptions.length > 0 ? (
              allSubscriptions.map((sub, index) => (
                <article
                  key={`${sub.paymentId || 'subscription'}-${index}`}
                  className='profile-subscription-item'
                >
                  <div className='profile-subscription-item__top'>
                    <span>{sub.planDuration || 'Subscription'}</span>
                    <strong
                      className={
                        !isExpiredByDate(sub.endDate)
                          ? 'is-active'
                          : 'is-expired'
                      }
                    >
                      {getSubscriptionStatus(
                        sub,
                        sub === userData.subscription,
                      )}
                    </strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Start</dt>
                      <dd>{formatDate(sub.startDate)}</dd>
                    </div>
                    <div>
                      <dt>End</dt>
                      <dd>{formatDate(sub.endDate)}</dd>
                    </div>
                    <div>
                      <dt>Amount</dt>
                      <dd>{formatAmount(sub.amount)}</dd>
                    </div>
                    <div>
                      <dt>Credits</dt>
                      <dd>{sub.votingCredits || 0}</dd>
                    </div>
                    <div>
                      <dt>Used</dt>
                      <dd>{sub.usedVotingCredits || 0}</dd>
                    </div>
                    <div>
                      <dt>Payment ID</dt>
                      <dd>{sub.paymentId || 'Not set'}</dd>
                    </div>
                    <div>
                      <dt>Order ID</dt>
                      <dd>{sub.orderId || 'Not set'}</dd>
                    </div>
                  </dl>
                  <button
                    onClick={() => handleDownloadInvoice(sub)}
                    className='profile-icon-button profile-icon-button--ghost'
                  >
                    <FiDownload /> Download Invoice
                  </button>
                </article>
              ))
            ) : (
              <div className='profile-empty-state'>
                No subscription history available.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Profile;
