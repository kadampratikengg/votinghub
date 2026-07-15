import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCreditCard,
  FiDownload,
  FiKey,
  FiLogOut,
  FiRefreshCw,
  FiSearch,
  FiUserCheck,
  FiChevronDown,
  FiChevronUp,
  FiX,
} from 'react-icons/fi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Admin.css';

const getCredits = (user) => Number(user.subscription?.votingCredits || 0);
const getUsedCredits = (user) =>
  Number(user.subscription?.usedVotingCredits || 0);
const formatAmount = (value) =>
  `INR ${(Number(value || 0) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN');
};

const formatDateTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getCurrentLocalDateTimeInput = () => formatDateTimeInput(new Date());

const getEndDateFromStartAndDays = (startValue, daysValue) => {
  const startDate = startValue ? new Date(startValue) : new Date();
  const days = Number(daysValue || 0);

  if (Number.isNaN(startDate.getTime())) {
    return '';
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (Number.isFinite(days) ? days : 0));
  return formatDateTimeInput(endDate);
};

const getPlanStatusLabel = (plan) => {
  const status = String(plan.paymentStatus || '').trim();
  if (!status) return plan.isValid === false ? 'Inactive' : 'Active';

  const normalized = status.toLowerCase();
  if (
    normalized === 'success' ||
    normalized === 'paid' ||
    normalized === 'active'
  ) {
    return 'Active';
  }
  if (
    normalized === 'inactive' ||
    normalized === 'expired' ||
    normalized === 'failed'
  ) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
};

const getPlanOrderId = (plan) => plan.orderId || plan.paymentId || 'N/A';

const PAID_CREDIT_PRESETS = [
  {
    id: 'starter',
    label: 'Starter Voting Credits',
    credits: 5,
    amount: 1499,
    planDuration: 'Starter Voting Credits',
  },
  {
    id: 'standard',
    label: 'Standard Voting Credits',
    credits: 15,
    amount: 3999,
    planDuration: 'Standard Voting Credits',
  },
  {
    id: 'governance',
    label: 'Governance Voting Credits',
    credits: 40,
    amount: 9999,
    planDuration: 'Governance Voting Credits',
  },
  {
    id: 'custom',
    label: 'Custom Credits',
    credits: '',
    amount: '',
    planDuration: 'Custom Voting Credits',
  },
];

const TAX_RATE = 0.18;

const createManualOrderId = (userId) =>
  `ADMIN_PAID_${Date.now()}_${String(userId || '').slice(-6)}`;

const buildPaidCreditDefaults = (
  startDate = getCurrentLocalDateTimeInput(),
) => ({
  selectedPlan: 'starter',
  planDuration: 'Starter Voting Credits',
  startDate,
  endDate: getEndDateFromStartAndDays(startDate, 365),
  amount: 1499,
  credits: 5,
  transactionId: '',
  orderId: '',
  validityDays: 365,
  applyTax: true,
  paymentProvider: 'admin_manual',
});

const buildCreditsModalDefaults = (mode = 'free') =>
  mode === 'paid'
    ? { ...buildPaidCreditDefaults() }
    : { credits: '', validityDays: 365 };

const getPlanRows = (user) => {
  const rows = [];
  if (user.subscription?.orderId || user.subscription?.planDuration) {
    rows.push({ ...user.subscription, current: true });
  }

  return rows.concat(
    (user.subscriptionHistory || [])
      .slice()
      .reverse()
      .map((subscription) => ({ ...subscription, current: false })),
  );
};

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [passwordForms, setPasswordForms] = useState({});
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [creditsModal, setCreditsModal] = useState({
    open: false,
    userId: null,
    userName: '',
    mode: 'free',
    form: buildCreditsModalDefaults('free'),
  });
  const navigate = useNavigate();

  const token = localStorage.getItem('companyAdminToken');

  const fetchUsers = useCallback(async () => {
    setLoading(true);

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const response = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch users');
      }

      setUsers(data.users || []);
    } catch (error) {
      if (
        error.message.includes('Invalid') ||
        error.message.includes('required')
      ) {
        localStorage.removeItem('companyAdminToken');
        navigate('/admin', { replace: true });
        return;
      }
      toast.error(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [navigate, token]);

  useEffect(() => {
    if (!token) {
      navigate('/admin', { replace: true });
      return;
    }
    fetchUsers();
  }, [fetchUsers, navigate, token]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) =>
      [
        user.name,
        user.email,
        user.organization,
        user.phone,
        user.contact,
        user.username,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, users]);

  const totalCredits = users.reduce((sum, user) => sum + getCredits(user), 0);
  const activeUsers = users.filter((user) => user.subscription?.isValid).length;

  const updateUser = (updatedUser) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    );
  };

  const formatActorName = (actor) =>
    (actor && (actor.name || actor.fullName || actor.email)) || 'Account admin';

  const formatDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-IN');
  };

  const getHistoryActionLabel = (event) => {
    if (event.action === 'deleted') return 'Delete Voting';
    if (event.action === 'conducted') return 'Conducted Voting';
    return 'Create Voting';
  };

  const isVotingCompleted = (event) => {
    if (event.action === 'conducted' || event.status === 'done') return true;
    if (!event.resultDate) return false;

    const resultDate = new Date(event.resultDate);
    const referenceDate = event.deletedAt
      ? new Date(event.deletedAt)
      : new Date();

    return (
      !Number.isNaN(resultDate.getTime()) &&
      !Number.isNaN(referenceDate.getTime()) &&
      referenceDate >= resultDate
    );
  };

  const getHistoryStatusLabel = (event) => {
    if (event.action === 'conducted') return 'Voting Done';

    if (event.action === 'deleted') {
      const deletedAt = event.deletedAt ? new Date(event.deletedAt) : null;
      const start =
        event.date && event.startTime
          ? new Date(`${event.date}T${event.startTime}`)
          : null;
      const stop = event.votingWindow?.effectiveEndDateTime
        ? new Date(event.votingWindow.effectiveEndDateTime)
        : event.date && event.stopTime
          ? new Date(`${event.date}T${event.stopTime}`)
          : null;
      const resultDate = event.resultDate ? new Date(event.resultDate) : stop;

      if (
        deletedAt &&
        resultDate &&
        !Number.isNaN(deletedAt.getTime()) &&
        !Number.isNaN(resultDate.getTime()) &&
        deletedAt > resultDate
      ) {
        return 'Delete After Voting Done';
      }

      if (
        deletedAt &&
        start &&
        !Number.isNaN(deletedAt.getTime()) &&
        !Number.isNaN(start.getTime()) &&
        deletedAt < start
      ) {
        return 'Delete Before Start';
      }

      if (
        deletedAt &&
        start &&
        stop &&
        !Number.isNaN(deletedAt.getTime()) &&
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(stop.getTime()) &&
        deletedAt >= start &&
        deletedAt <= stop
      ) {
        return 'Delete In Between Voting';
      }

      return 'Delete After Start';
    }

    if (isVotingCompleted(event)) return 'Voting Done';
    return 'Voting Not Done';
  };

  const [userHistories, setUserHistories] = useState({});

  const openCreditsModal = (user, mode = 'free') => {
    const isPaid = mode === 'paid';
    setCreditsModal({
      open: true,
      userId: user.id,
      userName: user.name || user.email || 'User',
      mode,
      form: isPaid
        ? {
            ...buildCreditsModalDefaults(mode),
            orderId: createManualOrderId(user.id),
          }
        : buildCreditsModalDefaults(mode),
    });
  };

  const closeCreditsModal = () => {
    setCreditsModal({
      open: false,
      userId: null,
      userName: '',
      mode: 'free',
      form: buildCreditsModalDefaults('free'),
    });
  };

  const applyPaidPreset = (presetId) => {
    const preset = PAID_CREDIT_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    if (preset.id === 'custom') {
      setCreditsModal((current) => ({
        ...current,
        form: {
          ...current.form,
          selectedPlan: preset.id,
          planDuration: preset.planDuration,
          credits: '',
          amount: '',
          endDate: getEndDateFromStartAndDays(
            current.form.startDate,
            current.form.validityDays,
          ),
        },
      }));
      return;
    }

    setCreditsModal((current) => ({
      ...current,
      form: {
        ...current.form,
        selectedPlan: preset.id,
        planDuration: preset.planDuration,
        credits: preset.credits,
        amount: preset.amount,
        endDate: getEndDateFromStartAndDays(
          current.form.startDate,
          current.form.validityDays,
        ),
      },
    }));
  };

  const fetchUserHistory = async (userId) => {
    setUserHistories((h) => ({
      ...h,
      [userId]: { loading: true, error: null, items: null },
    }));
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const res = await fetch(`${apiUrl}/api/admin/users/${userId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load history');
      setUserHistories((h) => ({
        ...h,
        [userId]: { loading: false, error: null, items: data.history || [] },
      }));
    } catch (err) {
      setUserHistories((h) => ({
        ...h,
        [userId]: { loading: false, error: err.message || 'Error', items: [] },
      }));
    }
  };

  const resetPassword = async (userId) => {
    const password = passwordForms[userId] || '';

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const response = await fetch(
        `${apiUrl}/api/admin/users/${userId}/password`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ password }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setPasswordForms((forms) => ({ ...forms, [userId]: '' }));
      toast.success('Password reset successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to reset password');
    }
  };

  const addFreeCredits = async (userId, form) => {
    const resolvedForm = form || buildCreditsModalDefaults('free');

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      if (!apiUrl) {
        throw new Error('API URL is not configured');
      }
      const response = await fetch(
        `${apiUrl}/api/admin/users/${userId}/free-credits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            credits: resolvedForm.credits,
            validityDays: resolvedForm.validityDays || 365,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add free credits');
      }

      updateUser(data.user);
      toast.success('Free credits added with a zero amount invoice');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to add free credits');
      return false;
    }
  };

  const addPaidCredits = async (userId, form) => {
    const resolvedForm = form || buildPaidCreditDefaults();

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      if (!apiUrl) {
        throw new Error('API URL is not configured');
      }
      const response = await fetch(
        `${apiUrl}/api/admin/users/${userId}/paid-credits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            planDuration: resolvedForm.planDuration,
            startDate: resolvedForm.startDate,
            endDate: resolvedForm.endDate,
            amount: paidTotalValue,
            mrp: paidAmountValue,
            gst: paidTaxValue,
            invoiceBaseAmount: paidAmountValue,
            invoiceTaxAmount: paidTaxValue,
            invoiceTotalAmount: paidTotalValue,
            credits: resolvedForm.credits,
            transactionId: resolvedForm.transactionId,
            paymentId: resolvedForm.transactionId,
            orderId: resolvedForm.orderId,
            validityDays: resolvedForm.validityDays || 365,
            paymentProvider: resolvedForm.paymentProvider || 'admin_manual',
            applyTax: !!resolvedForm.applyTax,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add paid credits');
      }

      updateUser(data.user);
      toast.success('Paid credits added and invoice record created');
      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to add paid credits');
      return false;
    }
  };

  const downloadInvoice = async (orderId) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const response = await fetch(
        `${apiUrl}/api/invoice/${orderId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to download invoice');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice_${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message || 'Failed to download invoice');
    }
  };

  const logout = () => {
    localStorage.removeItem('companyAdminToken');
    navigate('/admin', { replace: true });
  };

  const selectedCreditsUser = creditsModal.userId
    ? users.find((user) => user.id === creditsModal.userId)
    : null;
  const paidAmountValue = Number(creditsModal.form.amount || 0);
  const paidTaxValue = creditsModal.form.applyTax
    ? Number((paidAmountValue * TAX_RATE).toFixed(2))
    : 0;
  const paidTotalValue = Number((paidAmountValue + paidTaxValue).toFixed(2));

  return (
    <main className='company-admin-dashboard'>
      <header className='company-admin-topbar' id='overview'>
        <div>
          <span className='company-admin-kicker'>
            <FiUserCheck /> Company Admin
          </span>
          <h2>Dashboard Overview</h2>
          <p>
            Click a user row to open all details, then use the Add Credits popup
            for free or paid credits.
          </p>
        </div>
        <div className='company-admin-topbar__actions'>
          <button onClick={fetchUsers} type='button'>
            <FiRefreshCw /> Refresh
          </button>
          <button onClick={logout} type='button'>
            <FiLogOut /> Logout
          </button>
        </div>
      </header>

      <section className='company-admin-stats'>
        <div>
          <span>Total Users</span>
          <strong>{users.length}</strong>
        </div>
        <div>
          <span>Active Subscriptions</span>
          <strong>{activeUsers}</strong>
        </div>
        <div>
          <span>Available Credits</span>
          <strong>{totalCredits}</strong>
        </div>
      </section>

      <section className='company-admin-toolbar'>
        <label>
          <FiSearch />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search users, email, company, phone'
          />
        </label>
      </section>

      <section className='company-admin-users' id='users'>
        {loading ? (
          <div className='company-admin-empty'>Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className='company-admin-empty'>No users found.</div>
        ) : (
          <div className='company-admin-user-table-wrap'>
            <table className='company-admin-user-table'>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Organization</th>
                  <th>Contact</th>
                  <th>Credits</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const planRows = getPlanRows(user);
                  const isExpanded = expandedUserId === user.id;

                  return (
                    <React.Fragment key={user.id}>
                      <tr
                        className='company-admin-user-table__row'
                        onClick={() =>
                          setExpandedUserId((current) =>
                            current === user.id ? null : user.id,
                          )
                        }
                        role='button'
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedUserId((current) =>
                              current === user.id ? null : user.id,
                            );
                          }
                        }}
                      >
                        <td data-label='User'>
                          <strong>{user.name || user.email}</strong>
                          <span>{user.email}</span>
                        </td>
                        <td data-label='Organization'>
                          {user.organization || 'N/A'}
                        </td>
                        <td data-label='Contact'>
                          <span>{user.phone || user.contact || 'N/A'}</span>
                          <small>
                            {user.district || 'N/A'}, {user.state || 'N/A'}
                          </small>
                        </td>
                        <td data-label='Credits'>
                          <strong>{getCredits(user)}</strong>
                          <small>Used {getUsedCredits(user)}</small>
                        </td>
                        <td data-label='Status'>
                          {user.subscription?.isValid ? 'Active' : 'Inactive'}
                        </td>
                        <td data-label='Plan'>
                          {user.subscription?.planDuration || 'N/A'}
                        </td>
                        <td data-label='Actions'>
                          <button
                            type='button'
                            className='company-admin-action-button'
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedUserId((current) =>
                                current === user.id ? null : user.id,
                              );
                            }}
                          >
                            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className='company-admin-user-table__details-row'>
                          <td colSpan={7}>
                            <div className='company-admin-user-details'>
                              <div className='company-admin-user-details__grid'>
                                <div>
                                  <span>Plan</span>
                                  <strong>
                                    {user.subscription?.planDuration || 'N/A'}
                                  </strong>
                                </div>
                                <div>
                                  <span>Status</span>
                                  <strong>
                                    {getPlanStatusLabel(
                                      user.subscription || {},
                                    )}
                                  </strong>
                                </div>
                                <div>
                                  <span>Start</span>
                                  <strong>
                                    {formatDate(user.subscription?.startDate)}
                                  </strong>
                                </div>
                                <div>
                                  <span>End</span>
                                  <strong>
                                    {formatDate(user.subscription?.endDate)}
                                  </strong>
                                </div>
                                <div>
                                  <span>Amount</span>
                                  <strong>
                                    {formatAmount(user.subscription?.amount)}
                                  </strong>
                                </div>
                                <div>
                                  <span>Transaction ID</span>
                                  <strong>
                                    {user.subscription?.paymentId || 'N/A'}
                                  </strong>
                                </div>
                                <div>
                                  <span>Order ID</span>
                                  <strong>
                                    {user.subscription?.orderId || 'N/A'}
                                  </strong>
                                </div>
                                <div>
                                  <span>Payment</span>
                                  <strong>
                                    {getPlanStatusLabel(
                                      user.subscription || {},
                                    )}
                                  </strong>
                                </div>
                              </div>

                              <div className='company-admin-user-details__actions'>
                                <form
                                  className='company-admin-user-details__password'
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    resetPassword(user.id);
                                  }}
                                >
                                  <label>Reset Password</label>
                                  <div>
                                    <input
                                      type='password'
                                      value={passwordForms[user.id] || ''}
                                      onChange={(event) =>
                                        setPasswordForms((forms) => ({
                                          ...forms,
                                          [user.id]: event.target.value,
                                        }))
                                      }
                                      placeholder='New password'
                                      autoComplete='new-password'
                                    />
                                    <button type='submit'>
                                      <FiKey /> Reset
                                    </button>
                                  </div>
                                </form>

                                <button
                                  type='button'
                                  className='company-admin-user-details__credits-button'
                                  onClick={() => openCreditsModal(user, 'paid')}
                                >
                                  <FiCreditCard /> Add Credits
                                </button>
                              </div>

                              <div className='company-admin-plans'>
                                <div className='company-admin-plans__header'>
                                  <strong>Plans / Subscription Details</strong>
                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: 8,
                                      alignItems: 'center',
                                    }}
                                  >
                                    <span>
                                      {planRows.length} record
                                      {planRows.length === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                </div>

                                {planRows.length === 0 ? (
                                  <div className='company-admin-plan-empty'>
                                    No subscription records.
                                  </div>
                                ) : (
                                  <div className='company-admin-plan-table'>
                                    <div className='company-admin-plan-row company-admin-plan-row--head'>
                                      <span>Plan</span>
                                      <span>Status</span>
                                      <span>Start</span>
                                      <span>End</span>
                                      <span>Amount</span>
                                      <span>Credits</span>
                                      <span>Used</span>
                                      <span>Order ID</span>
                                      <span>Invoice</span>
                                    </div>
                                    {planRows.map((plan, index) => (
                                      <div
                                        className='company-admin-plan-row'
                                        key={`${getPlanOrderId(plan)}-${index}`}
                                      >
                                        <span data-label='Plan'>
                                          {plan.planDuration ||
                                            'Voting Subscription'}
                                          {plan.current && <em>Current</em>}
                                        </span>
                                        <span data-label='Status'>
                                          {getPlanStatusLabel(plan)}
                                        </span>
                                        <span data-label='Start'>
                                          {formatDate(plan.startDate)}
                                        </span>
                                        <span data-label='End'>
                                          {formatDate(plan.endDate)}
                                        </span>
                                        <span data-label='Amount'>
                                          {formatAmount(plan.amount)}
                                        </span>
                                        <span data-label='Credits'>
                                          {Number(plan.votingCredits || 0)}
                                        </span>
                                        <span data-label='Used'>
                                          {Number(plan.usedVotingCredits || 0)}
                                        </span>
                                        <span data-label='Order ID'>
                                          {getPlanOrderId(plan)}
                                        </span>
                                        <span data-label='Invoice'>
                                          {plan.orderId ? (
                                            <button
                                              className='company-admin-plan-invoice'
                                              type='button'
                                              onClick={() =>
                                                downloadInvoice(plan.orderId)
                                              }
                                            >
                                              <FiDownload /> PDF
                                            </button>
                                          ) : (
                                            'N/A'
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div style={{ marginTop: 12 }}>
                                <button
                                  type='button'
                                  className='company-admin-action-button'
                                  onClick={() => {
                                    const existing = userHistories[user.id];
                                    if (!existing || !existing.items)
                                      fetchUserHistory(user.id);
                                    else
                                      setUserHistories((h) => ({
                                        ...h,
                                        [user.id]: {
                                          ...existing,
                                          items: null,
                                        },
                                      }));
                                  }}
                                >
                                  {userHistories[user.id] &&
                                  userHistories[user.id].items
                                    ? 'Hide History'
                                    : 'Show History'}
                                </button>
                                {userHistories[user.id] &&
                                  userHistories[user.id].loading && (
                                    <div style={{ marginTop: 8 }}>
                                      Loading history...
                                    </div>
                                  )}
                                {userHistories[user.id] &&
                                  userHistories[user.id].error && (
                                    <div style={{ marginTop: 8, color: 'red' }}>
                                      {userHistories[user.id].error}
                                    </div>
                                  )}
                                {userHistories[user.id] &&
                                  userHistories[user.id].items && (
                                    <div style={{ marginTop: 8 }}>
                                      {userHistories[user.id].items.length ===
                                      0 ? (
                                        <div className='company-admin-plan-empty'>
                                          No history records.
                                        </div>
                                      ) : (
                                        <div className='company-admin-history-table-wrap'>
                                          <table className='company-admin-history-table'>
                                            <thead>
                                              <tr>
                                                <th>Action</th>
                                                <th>By</th>
                                                <th>Voting Time</th>
                                                <th>Winner (votes)</th>
                                                <th>Result Date</th>
                                                <th>Status</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {userHistories[user.id].items.map(
                                                (h, idx) => {
                                                  const actor =
                                                    h.action === 'deleted'
                                                      ? h.deletedBy ||
                                                        h.createdBy
                                                      : h.createdBy;
                                                  const actionLabel =
                                                    getHistoryActionLabel(h);
                                                  const statusLabel =
                                                    getHistoryStatusLabel(h);
                                                  return (
                                                    <tr
                                                      key={`${h.eventId}-${idx}`}
                                                    >
                                                      <td>{actionLabel}</td>
                                                      <td>
                                                        {formatActorName(actor)}
                                                      </td>
                                                      <td>
                                                        {h.date || '-'}
                                                        {h.startTime
                                                          ? ` | ${h.startTime} - ${h.stopTime || 'N/A'}`
                                                          : ''}
                                                      </td>
                                                      <td>
                                                        {h.winner || 'N/A'} (
                                                        {h.winnerVotes || 0})
                                                      </td>
                                                      <td>
                                                        {h.resultDate
                                                          ? formatDateTime(
                                                              h.resultDate,
                                                            )
                                                          : '-'}
                                                      </td>
                                                      <td>{statusLabel}</td>
                                                    </tr>
                                                  );
                                                },
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creditsModal.open && selectedCreditsUser && (
        <div
          className='company-admin-modal__backdrop'
          role='dialog'
          aria-modal='true'
        >
          <section className='company-admin-modal'>
            <div className='company-admin-modal__header'>
              <div>
                <p className='company-admin-modal__eyebrow'>Add Credits</p>
                <h3>{creditsModal.userName}</h3>
              </div>
              <button
                type='button'
                className='company-admin-modal__close'
                onClick={closeCreditsModal}
                aria-label='Close add credits popup'
              >
                <FiX />
              </button>
            </div>

            <div className='company-admin-modal__tabs'>
              <button
                type='button'
                className={creditsModal.mode === 'free' ? 'is-active' : ''}
                onClick={() =>
                  setCreditsModal((current) => ({
                    ...current,
                    mode: 'free',
                    form: buildCreditsModalDefaults('free'),
                  }))
                }
              >
                Free Credits
              </button>
              <button
                type='button'
                className={creditsModal.mode === 'paid' ? 'is-active' : ''}
                onClick={() =>
                  setCreditsModal((current) => ({
                    ...current,
                    mode: 'paid',
                    form: buildCreditsModalDefaults('paid'),
                  }))
                }
              >
                Paid Credits
              </button>
            </div>

            {creditsModal.mode === 'free' ? (
              <div className='company-admin-modal__form'>
                <label>
                  Credits
                  <input
                    type='number'
                    min='1'
                    value={creditsModal.form.credits}
                    onChange={(event) =>
                      setCreditsModal((current) => ({
                        ...current,
                        form: {
                          ...current.form,
                          credits: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Validity Days
                  <input
                    type='number'
                    min='1'
                    value={creditsModal.form.validityDays}
                    onChange={(event) =>
                      setCreditsModal((current) => ({
                        ...current,
                        form: {
                          ...current.form,
                          validityDays: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <button
                  type='button'
                  className='company-admin-modal__submit'
                  onClick={async () => {
                    const success = await addFreeCredits(
                      selectedCreditsUser.id,
                      creditsModal.form,
                    );
                    if (success) {
                      closeCreditsModal();
                    }
                  }}
                >
                  Add Free Credits
                </button>
              </div>
            ) : (
              <div className='company-admin-modal__form company-admin-modal__form--paid'>
                <label>
                  Plan
                  <select
                    value={creditsModal.form.selectedPlan}
                    onChange={(event) => {
                      const selectedPlan = event.target.value;
                      setCreditsModal((current) => ({
                        ...current,
                        form: {
                          ...current.form,
                          selectedPlan,
                        },
                      }));
                      applyPaidPreset(selectedPlan);
                    }}
                  >
                    {PAID_CREDIT_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start
                  <input
                    type='datetime-local'
                    value={formatDateTimeInput(creditsModal.form.startDate)}
                    onChange={(event) =>
                      setCreditsModal((current) => ({
                        ...current,
                        form: {
                          ...current.form,
                          startDate: event.target.value,
                          endDate: getEndDateFromStartAndDays(
                            event.target.value,
                            current.form.validityDays,
                          ),
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  End
                  <input
                    type='datetime-local'
                    value={formatDateTimeInput(creditsModal.form.endDate)}
                    readOnly
                  />
                  <span className='company-admin-modal__hint'>
                    End date is calculated from Start + Validity Days.
                  </span>
                </label>
                <label>
                  Amount (INR)
                  <input
                    type='number'
                    min='1'
                    step='0.01'
                    value={creditsModal.form.amount}
                    readOnly={creditsModal.form.selectedPlan !== 'custom'}
                    onChange={(event) =>
                      setCreditsModal((current) => ({
                        ...current,
                        form: {
                          ...current.form,
                          amount: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <div className='company-admin-modal__checkbox'>
                  <label>
                    <input
                      type='checkbox'
                      checked={creditsModal.form.applyTax}
                      onChange={(event) =>
                        setCreditsModal((current) => ({
                          ...current,
                          form: {
                            ...current.form,
                            applyTax: event.target.checked,
                          },
                        }))
                      }
                    />
                    Apply tax (18%)
                  </label>
                </div>
                <label>
                  Credits
                  <input
                    type='number'
                    min='1'
                    value={creditsModal.form.credits}
                    readOnly={creditsModal.form.selectedPlan !== 'custom'}
                    onChange={(event) =>
                      setCreditsModal((current) => ({
                        ...current,
                        form: {
                          ...current.form,
                          credits: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Transaction ID
                  <input
                    type='text'
                    value={creditsModal.form.transactionId}
                    onChange={(event) =>
                      setCreditsModal((current) => ({
                        ...current,
                        form: {
                          ...current.form,
                          transactionId: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Order ID
                  <div className='company-admin-modal__inline-field'>
                    <input
                      type='text'
                      value={creditsModal.form.orderId}
                      readOnly
                      onChange={(event) =>
                        setCreditsModal((current) => ({
                          ...current,
                          form: {
                            ...current.form,
                            orderId: event.target.value,
                          },
                        }))
                      }
                    />
                    <button
                      type='button'
                      className='company-admin-modal__inline-button'
                      onClick={() =>
                        setCreditsModal((current) => ({
                          ...current,
                          form: {
                            ...current.form,
                            orderId: createManualOrderId(
                              selectedCreditsUser.id,
                            ),
                          },
                        }))
                      }
                    >
                      New
                    </button>
                  </div>
                  <span className='company-admin-modal__hint'>
                    Order ID is auto-generated for invoice tracking.
                  </span>
                </label>
                <label>
                  Validity Days
                  <input
                    type='number'
                    min='1'
                    value={creditsModal.form.validityDays}
                    onChange={(event) =>
                      setCreditsModal((current) => ({
                        ...current,
                        form: {
                          ...current.form,
                          validityDays: event.target.value,
                          endDate: getEndDateFromStartAndDays(
                            current.form.startDate,
                            event.target.value,
                          ),
                        },
                      }))
                    }
                  />
                </label>
                <button
                  type='button'
                  className='company-admin-modal__submit'
                  onClick={async () => {
                    const success = await addPaidCredits(
                      selectedCreditsUser.id,
                      creditsModal.form,
                    );
                    if (success) {
                      closeCreditsModal();
                    }
                  }}
                >
                  Add Paid Credits
                </button>
                <div className='company-admin-modal__summary company-admin-modal__hint--full'>
                  <div>
                    <span>Tax 18%</span>
                    <strong>{formatAmount(paidTaxValue * 100)}</strong>
                  </div>
                  <div>
                    <span>Total Payable</span>
                    <strong>{formatAmount(paidTotalValue * 100)}</strong>
                  </div>
                </div>
                {creditsModal.form.selectedPlan === 'custom' && (
                  <p className='company-admin-modal__hint company-admin-modal__hint--full'>
                    Custom mode lets you enter your own amount and credit count.
                    Use the generated order ID for invoice tracking.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
      <ToastContainer position='top-right' autoClose={3000} />
    </main>
  );
};

export default AdminDashboard;
