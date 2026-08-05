import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiDownload,
  FiFileText,
  FiKey,
  FiLogOut,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiClock,
  FiUserCheck,
} from 'react-icons/fi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Admin.css';
import { getSubscriptionStatusInfo } from '../../utils/subscriptionStatus';

const TAX_RATE = 0.18;
const LOW_CREDIT_THRESHOLD = 5;

const formatAmount = (value) =>
  `INR ${(Number(value || 0) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatAmountInput = (value) => {
  if (value === undefined || value === null || value === '') return '';
  return (Number(value || 0) / 100).toFixed(2);
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN');
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-IN');
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

const createManualOrderId = (userId = '') =>
  `ADMIN_PAID_${Date.now()}_${String(userId || '').slice(-6)}`;

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

const getUserId = (user) => String(user?.id || user?._id || '');

const getRemainingCredits = (user) => {
  const total = Number(user?.subscription?.votingCredits || 0);
  const used = Number(user?.subscription?.usedVotingCredits || 0);
  return Math.max(0, total - used);
};

const getUsedCredits = (user) => Number(user?.subscription?.usedVotingCredits || 0);

const getUserStatus = (user) => {
  if (user?.subscription?.isValid) return 'Active';
  if (Number(user?.subscription?.votingCredits || 0) > 0) return 'Expired';
  return 'Inactive';
};

const getPlanOrderId = (plan) => plan.orderId || plan.paymentId || 'N/A';

const getSubscriptionEditStatus = (subscription = {}) => {
  const status = String(subscription.paymentStatus || '')
    .trim()
    .toLowerCase();
  return status || (subscription.isValid === false ? 'inactive' : 'active');
};

const buildFreeCreditsForm = () => ({
  credits: '',
  validityDays: 365,
});

const buildPaidCreditDefaults = (
  startDate = getCurrentLocalDateTimeInput(),
  userId = '',
) => ({
  selectedPlan: 'starter',
  planDuration: 'Starter Voting Credits',
  startDate,
  endDate: getEndDateFromStartAndDays(startDate, 365),
  amount: 1499,
  credits: 5,
  transactionId: '',
  orderId: createManualOrderId(userId),
  validityDays: 365,
  applyTax: true,
  paymentProvider: 'admin_manual',
});

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

const buildSubscriptionEditorDefaults = (subscription = {}) => ({
  planDuration: subscription.planDuration || '',
  status: getSubscriptionEditStatus(subscription),
  startDate: formatDateTimeInput(subscription.startDate),
  endDate: formatDateTimeInput(subscription.endDate),
  amount: formatAmountInput(subscription.amount),
  credits: Number(subscription.votingCredits || 0),
  usedVotingCredits: Number(subscription.usedVotingCredits || 0),
});

const getSubscriptionRecords = (user) => {
  if (!user) return [];

  const records = [];
  if (
    user.subscription?.orderId ||
    user.subscription?.planDuration ||
    user.subscription?.paymentId
  ) {
    records.push({
      ...user.subscription,
      current: true,
      source: 'Current',
    });
  }

  (user.subscriptionHistory || [])
    .slice()
    .reverse()
    .forEach((subscription) => {
      records.push({
        ...subscription,
        current: false,
        source: 'History',
      });
    });

  return records;
};

const getInvoiceRecords = (user) =>
  getSubscriptionRecords(user).filter((record) => record.orderId || record.paymentId);

const getHistoryActionLabel = (event) => {
  if (event.action === 'deleted') return 'Delete Voting';
  if (event.action === 'conducted') return 'Conducted Voting';
  return 'Create Voting';
};

const isVotingCompleted = (event) => {
  if (event.action === 'conducted' || event.status === 'done') return true;
  if (!event.resultDate) return false;

  const resultDate = new Date(event.resultDate);
  const referenceDate = event.deletedAt ? new Date(event.deletedAt) : new Date();

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
      event.date && event.startTime ? new Date(`${event.date}T${event.startTime}`) : null;
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

const formatActorName = (actor) =>
  (actor && (actor.name || actor.fullName || actor.email)) || 'Account admin';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('companyAdminToken');

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [eventHistoryByUser, setEventHistoryByUser] = useState({});
  const [passwordForm, setPasswordForm] = useState('');
  const [freeCreditsForm, setFreeCreditsForm] = useState(buildFreeCreditsForm());
  const [paidCreditsForm, setPaidCreditsForm] = useState(buildPaidCreditDefaults());
  const [subscriptionEditor, setSubscriptionEditor] = useState({
    open: false,
    userId: '',
    orderId: '',
    planLabel: '',
    form: buildSubscriptionEditorDefaults(),
  });
  const eventHistoryCacheRef = useRef({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      if (!apiUrl) {
        throw new Error('API URL is not configured');
      }

      const response = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch users');
      }

      const nextUsers = data.users || [];
      setUsers(nextUsers);
      setSelectedUserId((current) => {
        if (current && nextUsers.some((user) => getUserId(user) === current)) {
          return current;
        }
        return nextUsers[0] ? getUserId(nextUsers[0]) : '';
      });
    } catch (error) {
      if (
        error.message.includes('Invalid') ||
        error.message.includes('required') ||
        error.message.includes('Unauthorized') ||
        error.message.includes('Access')
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

  const fetchUserEvents = useCallback(
    async (userId, options = {}) => {
      if (!userId) return;
      const { force = false } = options;
      const cached = eventHistoryCacheRef.current[userId];
      if (cached?.loaded && !force) {
        return;
      }

      setEventHistoryByUser((current) => ({
        ...current,
        [userId]: {
          loading: true,
          error: null,
          items: cached?.items || [],
          loaded: cached?.loaded || false,
        },
      }));

      try {
        const apiUrl = process.env.REACT_APP_API_URL;
        if (!apiUrl) {
          throw new Error('API URL is not configured');
        }

        const response = await fetch(`${apiUrl}/api/admin/users/${userId}/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load voting events');
        }

        setEventHistoryByUser((current) => ({
          ...current,
          [userId]: {
            loading: false,
            error: null,
            items: data.history || [],
            loaded: true,
          },
        }));
      } catch (error) {
        setEventHistoryByUser((current) => ({
          ...current,
          [userId]: {
            loading: false,
            error: error.message || 'Failed to load voting events',
            items: [],
            loaded: true,
          },
        }));
      }
    },
    [token],
  );

  useEffect(() => {
    eventHistoryCacheRef.current = eventHistoryByUser;
  }, [eventHistoryByUser]);

  useEffect(() => {
    if (!token) {
      navigate('/admin', { replace: true });
      return;
    }
    fetchUsers();
  }, [fetchUsers, navigate, token]);

  useEffect(() => {
    if (!selectedUserId) return;

    const selectedUser = users.find((user) => getUserId(user) === selectedUserId);
    if (!selectedUser) return;

    setPasswordForm('');
    setFreeCreditsForm(buildFreeCreditsForm());
    setPaidCreditsForm(buildPaidCreditDefaults(undefined, selectedUserId));
    setSubscriptionEditor({
      open: false,
      userId: '',
      orderId: '',
      planLabel: '',
      form: buildSubscriptionEditorDefaults(selectedUser.subscription || {}),
    });

    fetchUserEvents(selectedUserId);
  }, [fetchUserEvents, selectedUserId, users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesQuery =
        !query ||
        [
          user.name,
          user.email,
          user.organization,
          user.phone,
          user.contact,
          user.username,
          user.address,
          user.state,
          user.district,
          user.gstNumber,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const status = getUserStatus(user).toLowerCase();
      const remainingCredits = getRemainingCredits(user);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && status === 'active') ||
        (statusFilter === 'inactive' && status !== 'active') ||
        (statusFilter === 'low-credit' &&
          remainingCredits <= LOW_CREDIT_THRESHOLD &&
          Number(user.subscription?.votingCredits || 0) > 0);

      return matchesQuery && matchesStatus;
    });
  }, [search, statusFilter, users]);

  const selectedUser = useMemo(
    () => users.find((user) => getUserId(user) === selectedUserId) || null,
    [selectedUserId, users],
  );

  const selectedUserEvents = eventHistoryByUser[selectedUserId] || {
    loading: false,
    error: null,
    items: [],
    loaded: false,
  };

  const subscriptionRecords = useMemo(
    () => getSubscriptionRecords(selectedUser),
    [selectedUser],
  );

  const invoiceRecords = useMemo(() => getInvoiceRecords(selectedUser), [selectedUser]);

  const totalCredits = users.reduce(
    (sum, user) => sum + getRemainingCredits(user),
    0,
  );
  const activeUsers = users.filter((user) => user.subscription?.isValid).length;
  const lowCreditUsers = users.filter((user) => {
    const remainingCredits = getRemainingCredits(user);
    return remainingCredits > 0 && remainingCredits <= LOW_CREDIT_THRESHOLD;
  }).length;

  const updateUser = (updatedUser) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
    );
  };

  const handleSelectUser = (userId) => {
    setSelectedUserId(userId);
  };

  const resetPassword = async () => {
    if (!selectedUserId) return;
    if (!passwordForm || passwordForm.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      if (!apiUrl) {
        throw new Error('API URL is not configured');
      }

      const response = await fetch(`${apiUrl}/api/admin/users/${selectedUserId}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: passwordForm }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setPasswordForm('');
      toast.success('Password reset successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to reset password');
    }
  };

  const applyPaidPreset = (presetId) => {
    const preset = PAID_CREDIT_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setPaidCreditsForm((current) => ({
      ...current,
      selectedPlan: preset.id,
      planDuration: preset.planDuration,
      credits: preset.credits,
      amount: preset.amount,
      endDate: getEndDateFromStartAndDays(current.startDate, current.validityDays),
    }));
  };

  const addFreeCredits = async () => {
    if (!selectedUserId) return;
    const credits = Number(freeCreditsForm.credits);
    const validityDays = Number(freeCreditsForm.validityDays || 365);

    if (!Number.isFinite(credits) || credits <= 0) {
      toast.error('Credits must be a positive number');
      return;
    }

    if (!Number.isFinite(validityDays) || validityDays <= 0) {
      toast.error('Validity days must be a positive number');
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      if (!apiUrl) {
        throw new Error('API URL is not configured');
      }

      const response = await fetch(
        `${apiUrl}/api/admin/users/${selectedUserId}/free-credits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            credits,
            validityDays,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add free credits');
      }

      updateUser(data.user);
      setFreeCreditsForm(buildFreeCreditsForm());
      toast.success('Free credits added successfully');
      await fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to add free credits');
    }
  };

  const addPaidCredits = async () => {
    if (!selectedUserId) return;

    const credits = Number(paidCreditsForm.credits);
    const amountValue = Number(paidCreditsForm.amount || 0);
    const taxValue = paidCreditsForm.applyTax
      ? Number((amountValue * TAX_RATE).toFixed(2))
      : 0;
    const totalValue = Number((amountValue + taxValue).toFixed(2));
    const validityDays = Number(paidCreditsForm.validityDays || 365);

    if (!Number.isFinite(credits) || credits <= 0) {
      toast.error('Credits must be a positive number');
      return;
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }

    if (!Number.isFinite(validityDays) || validityDays <= 0) {
      toast.error('Validity days must be a positive number');
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      if (!apiUrl) {
        throw new Error('API URL is not configured');
      }

      const response = await fetch(
        `${apiUrl}/api/admin/users/${selectedUserId}/paid-credits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            planDuration: paidCreditsForm.planDuration,
            startDate: paidCreditsForm.startDate,
            endDate: paidCreditsForm.endDate,
            amount: totalValue,
            mrp: amountValue,
            gst: taxValue,
            invoiceBaseAmount: amountValue,
            invoiceTaxAmount: taxValue,
            invoiceTotalAmount: totalValue,
            credits,
            transactionId: paidCreditsForm.transactionId,
            paymentId: paidCreditsForm.transactionId,
            orderId: paidCreditsForm.orderId || createManualOrderId(selectedUserId),
            validityDays,
            paymentProvider: paidCreditsForm.paymentProvider || 'admin_manual',
            applyTax: !!paidCreditsForm.applyTax,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add paid credits');
      }

      updateUser(data.user);
      setPaidCreditsForm(buildPaidCreditDefaults());
      toast.success('Paid credits added successfully');
      await fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to add paid credits');
    }
  };

  const openSubscriptionEditor = (record) => {
    if (!selectedUser) return;

    setSubscriptionEditor({
      open: true,
      userId: selectedUserId,
      orderId: record.current ? 'current' : record.orderId || '',
      planLabel: record.planDuration || 'Voting Subscription',
      form: buildSubscriptionEditorDefaults(record),
    });
  };

  const closeSubscriptionEditor = () => {
    setSubscriptionEditor({
      open: false,
      userId: '',
      orderId: '',
      planLabel: '',
      form: buildSubscriptionEditorDefaults(),
    });
  };

  const updateSubscriptionDetails = async () => {
    if (!subscriptionEditor.userId) return;

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      if (!apiUrl) {
        throw new Error('API URL is not configured');
      }

      const response = await fetch(
        `${apiUrl}/api/admin/users/${subscriptionEditor.userId}/subscriptions/${encodeURIComponent(
          subscriptionEditor.orderId || 'current',
        )}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            planDuration: subscriptionEditor.form.planDuration,
            status: subscriptionEditor.form.status,
            startDate: subscriptionEditor.form.startDate,
            endDate: subscriptionEditor.form.endDate,
            amount: subscriptionEditor.form.amount,
            votingCredits: subscriptionEditor.form.credits,
            usedVotingCredits: subscriptionEditor.form.usedVotingCredits,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update subscription');
      }

      updateUser(data.user);
      toast.success('Subscription details updated successfully');
      closeSubscriptionEditor();
      await fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to update subscription');
    }
  };

  const downloadInvoice = async (orderId) => {
    if (!orderId || orderId === 'N/A') {
      toast.error('Invoice is not available for this record');
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      if (!apiUrl) {
        throw new Error('API URL is not configured');
      }

      const response = await fetch(`${apiUrl}/api/invoice/${orderId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

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

  const selectedUserLabel =
    selectedUser?.name || selectedUser?.email || 'Select a user';

  return (
    <main className='company-admin-dashboard'>
      <ToastContainer position='top-right' autoClose={2400} />

      <header className='company-admin-topbar' id='overview'>
        <div>
          <span className='company-admin-kicker'>
            <FiUserCheck /> Company Admin
          </span>
          <h1>Admin Dashboard</h1>
          <p>
            Select a user to manage subscription records, voting events, invoices,
            password resets, and voting credits from separated sections.
          </p>
        </div>
        <div className='company-admin-topbar__actions'>
          <button onClick={fetchUsers} type='button'>
            <FiRefreshCw /> Refresh
          </button>
          <button onClick={logout} type='button' className='is-secondary'>
            <FiLogOut /> Logout
          </button>
        </div>
      </header>

      <section className='company-admin-stats' aria-label='admin summary'>
        <div>
          <span>Total Users</span>
          <strong>{users.length}</strong>
        </div>
        <div>
          <span>Active Subscriptions</span>
          <strong>{activeUsers}</strong>
        </div>
        <div>
          <span>Low Credit Accounts</span>
          <strong>{lowCreditUsers}</strong>
        </div>
        <div>
          <span>Available Credits</span>
          <strong>{totalCredits}</strong>
        </div>
      </section>

      <section className='company-admin-shell'>
        <aside className='company-admin-panel'>
          <div className='company-admin-toolbar'>
            <label>
              <FiSearch />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='Search users by name, email, org, phone, location'
              />
            </label>
          </div>

          <div className='company-admin-filter-bar' aria-label='user filters'>
            <button
              type='button'
              className={statusFilter === 'all' ? 'is-active' : ''}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              type='button'
              className={statusFilter === 'active' ? 'is-active' : ''}
              onClick={() => setStatusFilter('active')}
            >
              Active
            </button>
            <button
              type='button'
              className={statusFilter === 'inactive' ? 'is-active' : ''}
              onClick={() => setStatusFilter('inactive')}
            >
              Inactive
            </button>
            <button
              type='button'
              className={statusFilter === 'low-credit' ? 'is-active' : ''}
              onClick={() => setStatusFilter('low-credit')}
            >
              Low Credits
            </button>
          </div>

          <div className='company-admin-user-table-wrap'>
            {loading ? (
              <div className='company-admin-empty'>Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className='company-admin-empty'>No users found.</div>
            ) : (
              <table className='company-admin-user-table'>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Organization</th>
                    <th>Email</th>
                    <th>Credits</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const userId = getUserId(user);
                    const isSelected = selectedUserId === userId;
                    const remainingCredits = getRemainingCredits(user);
                    const statusInfo = getSubscriptionStatusInfo(user.subscription || {}, {
                      current: true,
                    });

                    return (
                      <tr
                        key={userId}
                        className={isSelected ? 'company-admin-user-table__row is-selected' : 'company-admin-user-table__row'}
                        onClick={() => handleSelectUser(userId)}
                        role='button'
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleSelectUser(userId);
                          }
                        }}
                      >
                        <td data-label='User'>
                          <strong>{user.name || user.email || 'N/A'}</strong>
                          <span>{user.username || 'No username'}</span>
                        </td>
                        <td data-label='Organization'>
                          <span>{user.organization || 'N/A'}</span>
                          <small>{user.role || 'admin'}</small>
                        </td>
                        <td data-label='Email'>
                          <span>{user.email || 'N/A'}</span>
                          <small>{user.contact || user.phone || 'No contact'}</small>
                        </td>
                        <td data-label='Credits'>
                          <strong>{remainingCredits}</strong>
                          <small>Used {getUsedCredits(user)}</small>
                        </td>
                        <td data-label='Status'>
                          <span className={`company-admin-status is-${statusInfo.tone || 'neutral'}`}>
                            {statusInfo.label || getUserStatus(user)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </aside>

        <section className='company-admin-detail-panel'>
          <div className='company-admin-detail-header'>
            <div>
              <span className='company-admin-kicker'>
                <FiFileText /> Selected User
              </span>
              <h2>{selectedUserLabel}</h2>
              <p>
                All account details are separated below into profile, subscription,
                voting events, invoices, credits, and security actions.
              </p>
            </div>
            <div className='company-admin-detail-header__meta'>
              <span>
                <FiClock /> {selectedUser ? getUserStatus(selectedUser) : 'No user'}
              </span>
              <span>
                <FiShield /> {selectedUser ? selectedUser.role || 'admin' : 'N/A'}
              </span>
            </div>
          </div>

          {selectedUser ? (
            <>
              <nav className='company-admin-detail-nav'>
                <a href='#profile'>Profile</a>
                <a href='#subscription'>Subscription</a>
                <a href='#events'>Voting Events</a>
                <a href='#invoices'>Invoices</a>
                <a href='#credits'>Credits</a>
                <a href='#security'>Security</a>
              </nav>

              <section className='company-admin-detail-card' id='profile'>
                <div className='company-admin-card-heading'>
                  <div>
                    <h3>Profile Details</h3>
                    <p>Basic account and organization details.</p>
                  </div>
                </div>
                <div className='company-admin-info-grid'>
                  <div>
                    <span>Name</span>
                    <strong>{selectedUser.name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{selectedUser.email || 'N/A'}</strong>
                  </div>
                  <div>
                    <span>Username</span>
                    <strong>{selectedUser.username || 'N/A'}</strong>
                  </div>
                  <div>
                    <span>Organization</span>
                    <strong>{selectedUser.organization || 'N/A'}</strong>
                  </div>
                  <div>
                    <span>Contact</span>
                    <strong>{selectedUser.contact || selectedUser.phone || 'N/A'}</strong>
                  </div>
                  <div>
                    <span>Address</span>
                    <strong>
                      {[
                        selectedUser.address,
                        selectedUser.district,
                        selectedUser.state,
                        selectedUser.pincode,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span>GST Number</span>
                    <strong>{selectedUser.gstNumber || 'N/A'}</strong>
                  </div>
                  <div>
                    <span>IP Restriction</span>
                    <strong>
                      {selectedUser.ipRestrictionEnabled ? selectedUser.allowedIp || 'Enabled' : 'Disabled'}
                    </strong>
                  </div>
                </div>
              </section>

              <section className='company-admin-detail-card' id='subscription'>
                <div className='company-admin-card-heading'>
                  <div>
                    <h3>Subscription Records</h3>
                    <p>Current plan plus subscription history, with inline edit and invoice access.</p>
                  </div>
                  <span>{subscriptionRecords.length} record{subscriptionRecords.length === 1 ? '' : 's'}</span>
                </div>

                <div className='company-admin-table-scroll'>
                  <table className='company-admin-record-table'>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Credits</th>
                        <th>Used</th>
                        <th>Amount</th>
                        <th>Order ID</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptionRecords.length === 0 ? (
                        <tr>
                          <td colSpan='10'>
                            <div className='company-admin-empty company-admin-empty--inline'>
                              No subscription records available.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        subscriptionRecords.map((record, index) => {
                          const recordStatus = getSubscriptionStatusInfo(record, {
                            current: !!record.current,
                          });
                          return (
                            <tr key={`${getPlanOrderId(record)}-${index}`}>
                              <td>{record.current ? 'Current' : 'History'}</td>
                              <td>{record.planDuration || 'Voting Subscription'}</td>
                              <td>{recordStatus.label}</td>
                              <td>{formatDate(record.startDate)}</td>
                              <td>{formatDate(record.endDate)}</td>
                              <td>{Number(record.votingCredits || 0)}</td>
                              <td>{Number(record.usedVotingCredits || 0)}</td>
                              <td>{formatAmount(record.amount)}</td>
                              <td>{getPlanOrderId(record)}</td>
                              <td>
                                <div className='company-admin-row-actions'>
                                  <button
                                    type='button'
                                    onClick={() => openSubscriptionEditor(record)}
                                    disabled={!record.current && !record.orderId}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type='button'
                                    className='is-secondary'
                                    onClick={() => downloadInvoice(record.orderId)}
                                    disabled={!record.orderId}
                                  >
                                    <FiDownload /> PDF
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {subscriptionEditor.open && subscriptionEditor.userId === selectedUserId && (
                  <div className='company-admin-inline-editor'>
                    <div className='company-admin-card-heading'>
                      <div>
                        <h4>Edit Subscription</h4>
                        <p>{subscriptionEditor.planLabel}</p>
                      </div>
                      <button type='button' className='company-admin-icon-button' onClick={closeSubscriptionEditor}>
                        ×
                      </button>
                    </div>

                    <div className='company-admin-form-grid'>
                      <label>
                        Plan
                        <input
                          value={subscriptionEditor.form.planDuration}
                          onChange={(event) =>
                            setSubscriptionEditor((current) => ({
                              ...current,
                              form: {
                                ...current.form,
                                planDuration: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Status
                        <select
                          value={subscriptionEditor.form.status}
                          onChange={(event) =>
                            setSubscriptionEditor((current) => ({
                              ...current,
                              form: {
                                ...current.form,
                                status: event.target.value,
                              },
                            }))
                          }
                        >
                          <option value='active'>Active</option>
                          <option value='inactive'>Inactive</option>
                          <option value='pending'>Pending</option>
                          <option value='expired'>Expired</option>
                          <option value='failed'>Failed</option>
                          <option value='paid'>Paid</option>
                          <option value='success'>Success</option>
                        </select>
                      </label>
                      <label>
                        Start Date
                        <input
                          type='datetime-local'
                          value={subscriptionEditor.form.startDate}
                          onChange={(event) =>
                            setSubscriptionEditor((current) => ({
                              ...current,
                              form: {
                                ...current.form,
                                startDate: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        End Date
                        <input
                          type='datetime-local'
                          value={subscriptionEditor.form.endDate}
                          onChange={(event) =>
                            setSubscriptionEditor((current) => ({
                              ...current,
                              form: {
                                ...current.form,
                                endDate: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Total Amount (INR)
                        <input
                          type='number'
                          min='0'
                          step='0.01'
                          value={subscriptionEditor.form.amount}
                          onChange={(event) =>
                            setSubscriptionEditor((current) => ({
                              ...current,
                              form: {
                                ...current.form,
                                amount: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label>
                        Voting Credits
                        <input
                          type='number'
                          min='0'
                          value={subscriptionEditor.form.credits}
                          onChange={(event) =>
                            setSubscriptionEditor((current) => ({
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
                        Used Credits
                        <input
                          type='number'
                          min='0'
                          value={subscriptionEditor.form.usedVotingCredits}
                          onChange={(event) =>
                            setSubscriptionEditor((current) => ({
                              ...current,
                              form: {
                                ...current.form,
                                usedVotingCredits: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className='company-admin-inline-actions'>
                      <button type='button' onClick={updateSubscriptionDetails}>
                        Save Subscription
                      </button>
                      <button
                        type='button'
                        className='is-secondary'
                        onClick={closeSubscriptionEditor}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className='company-admin-detail-card' id='events'>
                <div className='company-admin-card-heading'>
                  <div>
                    <h3>Voting Events</h3>
                    <p>Admin-facing event history for this account.</p>
                  </div>
                  <button
                    type='button'
                    className='is-secondary'
                    onClick={() => fetchUserEvents(selectedUserId, { force: true })}
                  >
                    <FiRefreshCw /> Refresh
                  </button>
                </div>

                {selectedUserEvents.loading ? (
                  <div className='company-admin-empty company-admin-empty--inline'>
                    Loading voting events...
                  </div>
                ) : selectedUserEvents.error ? (
                  <div className='company-admin-empty company-admin-empty--inline is-error'>
                    {selectedUserEvents.error}
                  </div>
                ) : (
                  <div className='company-admin-table-scroll'>
                    <table className='company-admin-record-table'>
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Event</th>
                          <th>Time</th>
                          <th>Winner</th>
                          <th>Result Date</th>
                          <th>Status</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUserEvents.items.length === 0 ? (
                          <tr>
                            <td colSpan='7'>
                              <div className='company-admin-empty company-admin-empty--inline'>
                                No voting events found.
                              </div>
                            </td>
                          </tr>
                        ) : (
                          selectedUserEvents.items.map((event, index) => {
                            const actor =
                              event.action === 'deleted'
                                ? event.deletedBy || event.createdBy
                                : event.createdBy;
                            return (
                              <tr key={`${event.eventId}-${index}`}>
                                <td>{getHistoryActionLabel(event)}</td>
                                <td>
                                  {event.name || 'N/A'}
                                  <small>{event.eventId}</small>
                                </td>
                                <td>
                                  {event.date || '-'}
                                  <small>
                                    {event.startTime
                                      ? `${event.startTime} - ${event.stopTime || 'N/A'}`
                                      : 'No time'}
                                  </small>
                                </td>
                                <td>
                                  {event.winner || 'N/A'}
                                  <small>{Number(event.winnerVotes || 0)} votes</small>
                                </td>
                                <td>{formatDateTime(event.resultDate)}</td>
                                <td>{getHistoryStatusLabel(event)}</td>
                                <td>{formatActorName(actor)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className='company-admin-detail-card' id='invoices'>
                <div className='company-admin-card-heading'>
                  <div>
                    <h3>Invoices</h3>
                    <p>Download invoice PDFs for current and historical subscription records.</p>
                  </div>
                  <span>{invoiceRecords.length} invoice{invoiceRecords.length === 1 ? '' : 's'}</span>
                </div>

                <div className='company-admin-table-scroll'>
                  <table className='company-admin-record-table'>
                    <thead>
                      <tr>
                        <th>Record</th>
                        <th>Plan</th>
                        <th>Order ID</th>
                        <th>Payment ID</th>
                        <th>Base</th>
                        <th>Tax</th>
                        <th>Total</th>
                        <th>Verified</th>
                        <th>Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceRecords.length === 0 ? (
                        <tr>
                          <td colSpan='9'>
                            <div className='company-admin-empty company-admin-empty--inline'>
                              No invoices available for this user.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        invoiceRecords.map((record, index) => (
                          <tr key={`${getPlanOrderId(record)}-${index}`}>
                            <td>{record.current ? 'Current' : 'History'}</td>
                            <td>{record.planDuration || 'Voting Subscription'}</td>
                            <td>{record.orderId || 'N/A'}</td>
                            <td>{record.paymentId || 'N/A'}</td>
                            <td>{record.invoiceBaseAmount !== undefined ? formatAmount(record.invoiceBaseAmount * 100) : formatAmount(record.mrp)}</td>
                            <td>{record.invoiceTaxAmount !== undefined ? formatAmount(record.invoiceTaxAmount * 100) : formatAmount(record.gst || 0)}</td>
                            <td>{record.invoiceTotalAmount !== undefined ? formatAmount(record.invoiceTotalAmount * 100) : formatAmount(record.amount)}</td>
                            <td>{formatDateTime(record.verifiedAt)}</td>
                            <td>
                              <button
                                type='button'
                                className='company-admin-download-button'
                                onClick={() => downloadInvoice(record.orderId)}
                                disabled={!record.orderId}
                              >
                                <FiDownload /> Download
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className='company-admin-detail-card' id='credits'>
                <div className='company-admin-card-heading'>
                  <div>
                    <h3>Credits</h3>
                    <p>Add free or paid voting credits directly from the user detail view.</p>
                  </div>
                </div>

                <div className='company-admin-credit-grid'>
                  <div className='company-admin-credit-card'>
                    <div className='company-admin-card-heading'>
                      <div>
                        <h4>Free Credits</h4>
                        <p>Creates a zero-amount invoice record and extends validity.</p>
                      </div>
                    </div>
                    <div className='company-admin-form-grid'>
                      <label>
                        Credits
                        <input
                          type='number'
                          min='1'
                          value={freeCreditsForm.credits}
                          onChange={(event) =>
                            setFreeCreditsForm((current) => ({
                              ...current,
                              credits: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Validity Days
                        <input
                          type='number'
                          min='1'
                          value={freeCreditsForm.validityDays}
                          onChange={(event) =>
                            setFreeCreditsForm((current) => ({
                              ...current,
                              validityDays: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <button type='button' className='company-admin-primary-button' onClick={addFreeCredits}>
                      Add Free Credits
                    </button>
                  </div>

                  <div className='company-admin-credit-card'>
                    <div className='company-admin-card-heading'>
                      <div>
                        <h4>Paid Credits</h4>
                        <p>Generates a paid invoice with tax controls and preset packages.</p>
                      </div>
                    </div>
                    <div className='company-admin-preset-row'>
                      {PAID_CREDIT_PRESETS.map((preset) => (
                        <button
                          type='button'
                          key={preset.id}
                          className={
                            paidCreditsForm.selectedPlan === preset.id
                              ? 'is-active'
                              : ''
                          }
                          onClick={() => applyPaidPreset(preset.id)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className='company-admin-form-grid'>
                      <label>
                        Plan
                        <input
                          value={paidCreditsForm.planDuration}
                          onChange={(event) =>
                            setPaidCreditsForm((current) => ({
                              ...current,
                              planDuration: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Start Date
                        <input
                          type='datetime-local'
                          value={paidCreditsForm.startDate}
                          onChange={(event) =>
                            setPaidCreditsForm((current) => ({
                              ...current,
                              startDate: event.target.value,
                              endDate: getEndDateFromStartAndDays(
                                event.target.value,
                                current.validityDays,
                              ),
                            }))
                          }
                        />
                      </label>
                      <label>
                        End Date
                        <input
                          type='datetime-local'
                          value={paidCreditsForm.endDate}
                          onChange={(event) =>
                            setPaidCreditsForm((current) => ({
                              ...current,
                              endDate: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Amount (INR)
                        <input
                          type='number'
                          min='0'
                          step='0.01'
                          value={paidCreditsForm.amount}
                          onChange={(event) =>
                            setPaidCreditsForm((current) => ({
                              ...current,
                              amount: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Credits
                        <input
                          type='number'
                          min='1'
                          value={paidCreditsForm.credits}
                          onChange={(event) =>
                            setPaidCreditsForm((current) => ({
                              ...current,
                              credits: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Transaction ID
                        <input
                          value={paidCreditsForm.transactionId}
                          onChange={(event) =>
                            setPaidCreditsForm((current) => ({
                              ...current,
                              transactionId: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Order ID
                        <input
                          value={paidCreditsForm.orderId}
                          onChange={(event) =>
                            setPaidCreditsForm((current) => ({
                              ...current,
                              orderId: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Validity Days
                        <input
                          type='number'
                          min='1'
                          value={paidCreditsForm.validityDays}
                          onChange={(event) =>
                            setPaidCreditsForm((current) => ({
                              ...current,
                              validityDays: event.target.value,
                              endDate: getEndDateFromStartAndDays(
                                current.startDate,
                                event.target.value,
                              ),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <label className='company-admin-checkbox'>
                      <input
                        type='checkbox'
                        checked={paidCreditsForm.applyTax}
                        onChange={(event) =>
                          setPaidCreditsForm((current) => ({
                            ...current,
                            applyTax: event.target.checked,
                          }))
                        }
                      />
                      Apply 18% tax
                    </label>
                    <button type='button' className='company-admin-primary-button' onClick={addPaidCredits}>
                      Add Paid Credits
                    </button>
                  </div>
                </div>
              </section>

              <section className='company-admin-detail-card' id='security'>
                <div className='company-admin-card-heading'>
                  <div>
                    <h3>Security</h3>
                    <p>Reset the selected account password.</p>
                  </div>
                </div>

                <div className='company-admin-security-form'>
                  <label>
                    New Password
                    <input
                      type='password'
                      value={passwordForm}
                      onChange={(event) => setPasswordForm(event.target.value)}
                      placeholder='Minimum 8 characters'
                      autoComplete='new-password'
                    />
                  </label>
                  <button type='button' className='company-admin-primary-button' onClick={resetPassword}>
                    <FiKey /> Reset Password
                  </button>
                </div>
              </section>
            </>
          ) : (
            <div className='company-admin-empty company-admin-empty--large'>
              Select a user from the table to view subscription records, events,
              invoices, and actions.
            </div>
          )}
        </section>
      </section>
    </main>
  );
};

export default AdminDashboard;
