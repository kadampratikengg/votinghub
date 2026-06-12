import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiDownload,
  FiKey,
  FiLogOut,
  FiRefreshCw,
  FiSearch,
  FiUserCheck,
  FiChevronDown,
  FiChevronUp,
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
  const [creditForms, setCreditForms] = useState({});
  const [validityForms, setValidityForms] = useState({});
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
      const stop =
        event.votingWindow?.effectiveEndDateTime
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

  const [openPlans, setOpenPlans] = useState({});
  const [userHistories, setUserHistories] = useState({});

  const togglePlans = (userId) => {
    setOpenPlans((cur) => ({ ...cur, [userId]: !cur[userId] }));
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

  const addFreeCredits = async (userId) => {
    const form = creditForms[userId] || {};

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const response = await fetch(
        `${apiUrl}/api/admin/users/${userId}/free-credits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            credits: form.credits,
            validityDays: form.validityDays || 365,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add free credits');
      }

      updateUser(data.user);
      setCreditForms((forms) => ({
        ...forms,
        [userId]: { credits: '', validityDays: 365 },
      }));
      toast.success('Free credits added with a zero amount invoice');
    } catch (error) {
      toast.error(error.message || 'Failed to add free credits');
    }
  };

  const updateValidity = async (userId, orderId) => {
    const formKey = `${userId}:${orderId}`;
    const endDate = validityForms[formKey] || '';

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const response = await fetch(
        `${apiUrl}/api/admin/users/${userId}/subscriptions/${encodeURIComponent(
          orderId,
        )}/validity`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endDate }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update validity');
      }

      updateUser(data.user);
      setValidityForms((forms) => ({ ...forms, [formKey]: '' }));
      toast.success('Validity updated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to update validity');
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

  return (
    <main className='company-admin-dashboard'>
      <header className='company-admin-topbar'>
        <div>
          <span className='company-admin-kicker'>
            <FiUserCheck /> Company Admin
          </span>
          <h1>User Credit Dashboard</h1>
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

      <section className='company-admin-users'>
        {loading ? (
          <div className='company-admin-empty'>Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className='company-admin-empty'>No users found.</div>
        ) : (
          filteredUsers.map((user) => {
            const creditForm = creditForms[user.id] || {
              credits: '',
              validityDays: 365,
            };
            const planRows = getPlanRows(user);

            return (
              <article className='company-admin-user' key={user.id}>
                <div className='company-admin-user__main'>
                  <div>
                    <h2>{user.name || user.email}</h2>
                    <p>
                      {user.organization || 'No organization'} | {user.email}
                    </p>
                    <p>
                      {user.phone || user.contact || 'No phone'} |{' '}
                      {user.district || 'No district'},{' '}
                      {user.state || 'No state'}
                    </p>
                  </div>
                  <div className='company-admin-credit-box'>
                    <span>Credits</span>
                    <strong>{getCredits(user)}</strong>
                    <small>Used {getUsedCredits(user)}</small>
                  </div>
                </div>

                <div className='company-admin-details'>
                  <span>Plan: {user.subscription?.planDuration || 'N/A'}</span>
                  <span>
                    Status: {user.subscription?.isValid ? 'Active' : 'Inactive'}
                  </span>
                  <span>Start: {formatDate(user.subscription?.startDate)}</span>
                  <span>End: {formatDate(user.subscription?.endDate)}</span>
                  <span>Amount: {formatAmount(user.subscription?.amount)}</span>
                </div>

                <div className='company-admin-plans'>
                  <div className='company-admin-plans__header'>
                    <strong>Plans / Subscription Details</strong>
                    <div
                      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                    >
                      <span>
                        {planRows.length} record
                        {planRows.length === 1 ? '' : 's'}
                      </span>
                      <button
                        type='button'
                        className='company-admin-action-button'
                        onClick={() => togglePlans(user.id)}
                        aria-expanded={!!openPlans[user.id]}
                        title={openPlans[user.id] ? 'Collapse' : 'Expand'}
                      >
                        {openPlans[user.id] ? (
                          <>
                            <FiChevronUp />
                          </>
                        ) : (
                          <>
                            <FiChevronDown />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {!openPlans[user.id] ? null : planRows.length === 0 ? (
                    <div className='company-admin-plan-empty'>
                      No subscription records.
                    </div>
                  ) : (
                    <div className='company-admin-plan-table'>
                      <div className='company-admin-plan-row company-admin-plan-row--head'>
                        <span>Plan</span>
                        <span>Credits</span>
                        <span>Used</span>
                        <span>Validity</span>
                        <span>Amount</span>
                        <span>Invoice</span>
                      </div>
                      {planRows.map((plan, index) => (
                        <div
                          className='company-admin-plan-row'
                          key={`${plan.orderId || plan.paymentId || 'plan'}-${index}`}
                        >
                          <span data-label='Plan'>
                            {plan.planDuration || 'Voting Subscription'}
                            {plan.current && <em>Current</em>}
                          </span>
                          <span data-label='Credits'>
                            {Number(plan.votingCredits || 0)}
                          </span>
                          <span data-label='Used'>
                            {Number(plan.usedVotingCredits || 0)}
                          </span>
                          <span
                            className='company-admin-validity-cell'
                            data-label='Validity'
                          >
                            <small>
                              {formatDate(plan.startDate)} -{' '}
                              {formatDate(plan.endDate)}
                            </small>
                            {plan.orderId && (
                              <span>
                                <input
                                  type='date'
                                  value={
                                    validityForms[
                                      `${user.id}:${plan.orderId}`
                                    ] || ''
                                  }
                                  onChange={(event) =>
                                    setValidityForms((forms) => ({
                                      ...forms,
                                      [`${user.id}:${plan.orderId}`]:
                                        event.target.value,
                                    }))
                                  }
                                />
                                <button
                                  type='button'
                                  onClick={() =>
                                    updateValidity(user.id, plan.orderId)
                                  }
                                >
                                  Save
                                </button>
                              </span>
                            )}
                          </span>
                          <span data-label='Amount'>
                            {formatAmount(plan.amount)}
                          </span>
                          <span data-label='Invoice'>
                            {plan.orderId ? (
                              <button
                                className='company-admin-plan-invoice'
                                type='button'
                                onClick={() => downloadInvoice(plan.orderId)}
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

                  {/* History toggle and display */}
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
                            [user.id]: { ...existing, items: null },
                          }));
                      }}
                    >
                      {userHistories[user.id] && userHistories[user.id].items
                        ? 'Hide History'
                        : 'Show History'}
                    </button>
                    {userHistories[user.id] &&
                      userHistories[user.id].loading && (
                        <div style={{ marginTop: 8 }}>Loading history...</div>
                      )}
                    {userHistories[user.id] && userHistories[user.id].error && (
                      <div style={{ marginTop: 8, color: 'red' }}>
                        {userHistories[user.id].error}
                      </div>
                    )}
                    {userHistories[user.id] && userHistories[user.id].items && (
                      <div style={{ marginTop: 8 }}>
                        {userHistories[user.id].items.length === 0 ? (
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
                                {userHistories[user.id].items.map((h, idx) => {
                                  const actor =
                                    h.action === 'deleted'
                                      ? h.deletedBy || h.createdBy
                                      : h.createdBy;
                                  const actionLabel = getHistoryActionLabel(h);
                                  const statusLabel = getHistoryStatusLabel(h);
                                  return (
                                    <tr key={`${h.eventId}-${idx}`}>
                                      <td>{actionLabel}</td>
                                      <td>{formatActorName(actor)}</td>
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
                                          ? formatDateTime(h.resultDate)
                                          : '-'}
                                      </td>
                                      <td>{statusLabel}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className='company-admin-actions'>
                  <form
                    className='company-admin-action'
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

                  <div className='company-admin-action'>
                    <label>Add Free Credits</label>
                    <div>
                      <input
                        type='number'
                        min='1'
                        value={creditForm.credits}
                        onChange={(event) =>
                          setCreditForms((forms) => ({
                            ...forms,
                            [user.id]: {
                              ...creditForm,
                              credits: event.target.value,
                            },
                          }))
                        }
                        placeholder='Credits'
                      />
                      <input
                        type='number'
                        min='1'
                        value={creditForm.validityDays}
                        onChange={(event) =>
                          setCreditForms((forms) => ({
                            ...forms,
                            [user.id]: {
                              ...creditForm,
                              validityDays: event.target.value,
                            },
                          }))
                        }
                        placeholder='Days'
                      />
                      <button
                        type='button'
                        onClick={() => addFreeCredits(user.id)}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
      <ToastContainer position='top-right' autoClose={3000} />
    </main>
  );
};

export default AdminDashboard;
