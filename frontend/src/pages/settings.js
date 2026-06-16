import React, { useCallback, useMemo, useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import './Workspace.css';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiEdit3,
  FiPlus,
  FiShield,
  FiTrash2,
  FiUploadCloud,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { resolveStoredAssetUrl } from '../utils/imageUrl';

const Settings = ({ setIsAuthenticated }) => {
  const [subUserEmail, setSubUserEmail] = useState('');
  const [subUserPassword, setSubUserPassword] = useState('');
  const [subUserFullName, setSubUserFullName] = useState('');
  const [subUserRole, setSubUserRole] = useState('user');
  const [subUserProfilePic, setSubUserProfilePic] = useState(null);
  const [subUserPermissions, setSubUserPermissions] = useState({
    voting: true,
    manage: false,
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [subUsers, setSubUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [eventHistory, setEventHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [bufferExpanded, setBufferExpanded] = useState(false);
  const apiUrl = process.env.REACT_APP_API_URL;
  const s3BucketUrl = process.env.REACT_APP_S3_BUCKET_URL;

  const formatActorName = (actor) =>
    actor?.name || actor?.fullName || actor?.email || 'Account admin';

  const formatDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-IN');
  };

  const getHistoryActor = (event) =>
    event.action === 'deleted'
      ? event.deletedBy || event.createdBy
      : event.createdBy;

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

  const visibleHistory = useMemo(() => {
    // Exclude buffer-added entries from the main voting history view
    const filteredHistory = Array.isArray(eventHistory)
      ? eventHistory.filter((e) => e.action !== 'buffer-added')
      : [];

    const list = filteredHistory.flatMap((event) => {
      if (event.action === 'conducted' || !isVotingCompleted(event)) {
        return [event];
      }

      const conductedLog = {
        ...event,
        action: 'conducted',
        status: 'done',
        deletedAt: null,
        historyKey: `${event.eventId}-conducted-${event.resultDate || event.createdAt || event.deletedAt || ''}`,
      };

      return event.action === 'deleted'
        ? [conductedLog, event]
        : [event, conductedLog];
    });

    // Ensure logs are ordered by time (latest first)
    return list.sort((a, b) => {
      const left = new Date(a.deletedAt || a.resultDate || a.createdAt || 0);
      const right = new Date(b.deletedAt || b.resultDate || b.createdAt || 0);
      return right - left;
    });
  }, [eventHistory]);

  const bufferHistoryList = useMemo(() => {
    if (!Array.isArray(eventHistory)) return [];
    return eventHistory.filter((h) => h.action === 'buffer-added');
  }, [eventHistory]);

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

  const fetchEventHistory = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      const response = await fetch(`${apiUrl}/api/event-history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to load voting history');
      }
      setEventHistory(data);
      setHistoryError('');
    } catch (err) {
      setHistoryError(err.message || 'Unable to load voting history.');
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchSubUsers();
    fetchEventHistory();
  }, [fetchEventHistory]);

  const fetchSubUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/sub-users`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = await response.json();
      if (response.ok) {
        setSubUsers(data);
      } else {
        throw new Error(data.message || 'Failed to fetch sub-users');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const resetSubUserForm = () => {
    setSubUserFullName('');
    setSubUserEmail('');
    setSubUserPassword('');
    setSubUserRole('user');
    setSubUserProfilePic(null);
    // Default permissions for a new 'user' role: voting access only
    setSubUserPermissions({ voting: true, manage: false });
  };

  const handleClearSubUserImage = async () => {
    const currentImage =
      subUserProfilePic?.key || subUserProfilePic?.uuid || '';
    if (!currentImage) {
      setSubUserProfilePic(null);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');

      if (editingUserId) {
        const permissions = [];
        if (subUserPermissions.voting) permissions.push('/voting/:eventId');
        if (subUserPermissions.manage) permissions.push('/manage');

        const response = await fetch(
          `${apiUrl}/api/sub-users/${editingUserId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              fullName: subUserFullName,
              email: subUserEmail,
              role: subUserRole,
              profilePic: '',
              permissions,
            }),
          },
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to remove image');
        }

        setSubUsers((prev) =>
          prev.map((user) =>
            user._id === editingUserId ? { ...user, profilePic: '' } : user,
          ),
        );
      }

      setSubUserProfilePic(null);
      toast.success('Profile image removed');
    } catch (err) {
      toast.error(err.message || 'Failed to remove image');
    }
  };

  const handleCreateSubUser = async (e) => {
    e.preventDefault();

    if (!subUserEmail || !subUserPassword || !subUserFullName) {
      toast.error('Full Name, Email, and Password are required');
      return;
    }

    const permissions = [];
    if (subUserPermissions.voting) permissions.push('/voting/:eventId');
    if (subUserPermissions.manage) permissions.push('/manage');

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      let profilePicUrl = '';
      if (subUserProfilePic) {
        profilePicUrl = subUserProfilePic.key || subUserProfilePic.uuid || '';
      }

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/sub-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullName: subUserFullName,
            email: subUserEmail,
            password: subUserPassword,
            role: subUserRole,
            profilePic: profilePicUrl,
            permissions,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create sub-user');
      }

      toast.success('Sub-user created successfully');
      resetSubUserForm();
      setShowCreateForm(false);
      fetchSubUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEditSubUser = (userId) => {
    const user = subUsers.find((u) => u._id === userId);
    if (!user) {
      toast.error('User not found');
      return;
    }
    setSubUserFullName(user.fullName || '');
    setSubUserEmail(user.email || '');
    setSubUserRole(user.role || 'user');
    setSubUserProfilePic(
      user.profilePic
        ? {
            key: user.profilePic,
            url: resolveStoredAssetUrl(user.profilePic, s3BucketUrl, apiUrl),
          }
        : null,
    );
    setSubUserPermissions({
      voting: user.permissions.includes('/voting/:eventId'),
      manage: user.permissions.includes('/manage'),
    });
    setEditingUserId(userId);
    setShowCreateForm(true);
  };

  // Auto-assign permissions when role changes for NEW users.
  // When editing an existing user (editingUserId != null) we preserve stored permissions.
  useEffect(() => {
    if (editingUserId) return; // preserve existing user's permissions while editing

    if (subUserRole === 'admin') {
      setSubUserPermissions({ voting: true, manage: true });
    } else if (subUserRole === 'user') {
      setSubUserPermissions({ voting: true, manage: false });
    }
  }, [subUserRole, editingUserId]);

  const handleUpdateSubUser = async (e) => {
    e.preventDefault();

    if (!subUserEmail || !subUserFullName) {
      toast.error('Full Name and Email are required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      let profilePicUrl = '';
      if (subUserProfilePic) {
        profilePicUrl = subUserProfilePic.key || subUserProfilePic.uuid || '';
      }

      const permissions = [];
      if (subUserPermissions.voting) permissions.push('/voting/:eventId');
      if (subUserPermissions.manage) permissions.push('/manage');

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/sub-users/${editingUserId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullName: subUserFullName,
            email: subUserEmail,
            role: subUserRole,
            profilePic: profilePicUrl,
            permissions,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update sub-user');
      }

      toast.success('Sub-user updated successfully');
      resetSubUserForm();
      setEditingUserId(null);
      setShowCreateForm(false);
      fetchSubUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteSubUser = async (userId) => {
    if (
      !userId ||
      !window.confirm('Are you sure you want to delete this sub-user?')
    )
      return;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/sub-users/${userId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete sub-user');
      }

      toast.success('Sub-user deleted successfully');
      fetchSubUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSaveSubUser = (e) => {
    e.preventDefault();
    if (editingUserId) {
      handleUpdateSubUser(e);
    } else {
      handleCreateSubUser(e);
    }
  };

  const toggleCreateForm = () => {
    setShowCreateForm(!showCreateForm);
    if (showCreateForm) {
      setEditingUserId(null);
      resetSubUserForm();
    }
  };

  return (
    <div className='work-shell'>
      <ToastContainer
        position='top-right'
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        draggable
        pauseOnHover
      />
      <Sidebar setIsAuthenticated={setIsAuthenticated} />
      <main className='work-page'>
        <section className='work-hero work-hero--settings'>
          <div>
            <span className='work-kicker'>
              <FiShield /> Access Settings
            </span>
            <h1>Manage voting team access.</h1>
            <p>
              Create sub-users, assign voting permissions, and control who can
              manage voting events.
            </p>
          </div>
          <button
            className='work-button work-button--light'
            onClick={toggleCreateForm}
          >
            <FiPlus /> Create Sub-User
          </button>
        </section>

        <section className='work-stats-grid'>
          <div className='work-stat-card'>
            <FiUsers />
            <span>Sub-Users</span>
            <strong>{subUsers.length}</strong>
          </div>
          <div className='work-stat-card'>
            <FiShield />
            <span>Voting Access</span>
            <strong>
              {
                subUsers.filter((user) =>
                  user.permissions?.includes('/voting/:eventId'),
                ).length
              }
            </strong>
          </div>
          <div className='work-stat-card'>
            <FiEdit3 />
            <span>Manage Access</span>
            <strong>
              {
                subUsers.filter((user) => user.permissions?.includes('/manage'))
                  .length
              }
            </strong>
          </div>
        </section>

        <section className='work-panel'>
          <div className='work-panel__header work-panel__header--row'>
            <div>
              <span className='work-kicker'>Users</span>
              <h2>Sub-Users</h2>
            </div>
            <button
              className='work-button work-button--primary'
              onClick={toggleCreateForm}
            >
              <FiPlus /> Create Sub-User
            </button>
          </div>

          <div className='work-table-wrap'>
            <table className='work-table'>
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Profile</th>
                  <th>Permissions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subUsers && subUsers.length > 0 ? (
                  subUsers.map((user, index) => (
                    <tr key={user._id || `user-${index}`}>
                      <td>{user.fullName}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className='work-pill'>{user.role}</span>
                      </td>
                      <td>
                        {user.profilePic ? (
                          <img
                            src={resolveStoredAssetUrl(
                              user.profilePic,
                              s3BucketUrl,
                              apiUrl,
                            )}
                            alt='Profile'
                            className='work-avatar'
                          />
                        ) : (
                          <span className='work-avatar work-avatar--empty'>
                            {user.fullName?.charAt(0) || 'U'}
                          </span>
                        )}
                      </td>
                      <td>{user.permissions.join(', ')}</td>
                      <td>
                        <div className='work-icon-actions'>
                          <button
                            className='work-icon-button'
                            onClick={() => handleEditSubUser(user._id)}
                            title='Edit'
                          >
                            <FiEdit3 />
                          </button>
                          <button
                            className='work-icon-button work-icon-button--danger'
                            onClick={() => handleDeleteSubUser(user._id)}
                            title='Delete'
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr key='no-users'>
                    <td colSpan='6'>No sub-users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className='work-panel work-history-panel'>
          <div className='work-panel__header work-panel__header--row'>
            <div>
              <span className='work-kicker'>
                <FiClock /> History
              </span>
              <h2>Voting History</h2>
              <p>
                Review created voting sessions and deleted logs with winner,
                vote count, voting date, result date, and user activity.
              </p>
            </div>
            <button
              className='work-button work-button--light work-history-toggle'
              type='button'
              onClick={() => setHistoryExpanded((current) => !current)}
              aria-expanded={historyExpanded}
            >
              {historyExpanded ? (
                <>
                  <FiChevronUp /> Compress
                </>
              ) : (
                <>
                  <FiChevronDown /> Expand
                </>
              )}
            </button>
          </div>

          {!historyExpanded ? (
            <div className='work-history-collapsed'>
              {visibleHistory.length} history record
              {visibleHistory.length === 1 ? '' : 's'} hidden
            </div>
          ) : historyError ? (
            <div className='work-empty work-empty--error'>{historyError}</div>
          ) : visibleHistory.length === 0 ? (
            <div className='work-empty'>No voting history available yet.</div>
          ) : (
            <div className='work-history-list'>
              {visibleHistory.map((event) => (
                <article
                  className='work-history-item'
                  key={
                    event.historyKey ||
                    `${event.eventId}-${event.action}-${event.status}-${event.deletedAt || event.resultDate || event.createdAt || ''}`
                  }
                >
                  <div className='work-history-item__top'>
                    <div>
                      <h3>{event.name || 'Untitled voting'}</h3>
                      <span className='work-history-date'>
                        Voting Date: {event.date || 'N/A'}
                      </span>
                    </div>
                    <span
                      className={`work-history-status work-history-status--${event.status}`}
                    >
                      {getHistoryStatusLabel(event)}
                    </span>
                  </div>
                  <div className='work-history-details'>
                    <span>
                      {getHistoryActionLabel(event)} By:{' '}
                      {formatActorName(getHistoryActor(event))}
                    </span>
                    <span>
                      Voting Time: {event.startTime || 'N/A'} to{' '}
                      {event.stopTime || 'N/A'}
                    </span>
                    {event.action === 'deleted' && event.deleteReason && (
                      <span>Delete Reason: {event.deleteReason}</span>
                    )}
                    {isVotingCompleted(event) && (
                      <>
                        <span>
                          Winner: {event.winner || 'No votes yet'}
                          {typeof event.winnerVotes === 'number' && (
                            <>
                              &nbsp;({event.winnerVotes} vote
                              {event.winnerVotes === 1 ? '' : 's'})
                            </>
                          )}
                        </span>
                        <span>
                          Result Date:{' '}
                          {event.resultDate
                            ? formatDateTime(event.resultDate)
                            : 'Pending'}
                        </span>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className='work-panel'>
          <div className='work-panel__header work-panel__header--row'>
            <div>
              <span className='work-kicker'>
                <FiClock /> Buffer Additions
              </span>
              <h2>Buffer History</h2>
              <p>
                Recent buffer additions for voting events (minutes added and
                actor).
              </p>
            </div>
            <button
              className='work-button work-button--light work-history-toggle'
              type='button'
              onClick={() => setBufferExpanded((c) => !c)}
              aria-expanded={bufferExpanded}
            >
              {bufferExpanded ? (
                <>
                  <FiChevronUp /> Compress
                </>
              ) : (
                <>
                  <FiChevronDown /> Expand
                </>
              )}
            </button>
          </div>

          {!bufferExpanded ? (
            <div className='work-history-collapsed'>
              {bufferHistoryList.length} buffer record
              {bufferHistoryList.length === 1 ? '' : 's'} hidden
            </div>
          ) : bufferHistoryList.length === 0 ? (
            <div className='work-empty'>No buffer history available.</div>
          ) : (
            <div className='work-table-wrap'>
              <table className='work-table'>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Time</th>
                    <th>Minutes Added</th>
                    <th>Added By</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bufferHistoryList.map((entry, i) => (
                    <tr key={entry._id || `${entry.eventId}-${i}`}>
                      <td>{entry.name || entry.eventId}</td>
                      <td>{formatDateTime(entry.createdAt)}</td>
                      <td>{entry.bufferMinutes || 0}</td>
                      <td>{formatActorName(entry.createdBy)}</td>
                      <td>
                        <span className='work-pill'>Buffer Added</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showCreateForm && (
          <div className='work-modal-overlay'>
            <div className='work-modal-card'>
              <button className='work-modal-close' onClick={toggleCreateForm}>
                <FiX />
              </button>
              <form onSubmit={handleSaveSubUser} className='work-form'>
                <div className='work-panel__header'>
                  <span className='work-kicker'>
                    {editingUserId ? 'Edit Access' : 'New Access'}
                  </span>
                  <h2>{editingUserId ? 'Edit Sub-User' : 'Create Sub-User'}</h2>
                </div>

                <div className='work-form-grid'>
                  <label className='work-field'>
                    <span>Full Name</span>
                    <input
                      type='text'
                      value={subUserFullName}
                      onChange={(e) => setSubUserFullName(e.target.value)}
                      required
                    />
                  </label>
                  <label className='work-field'>
                    <span>Email</span>
                    <input
                      type='email'
                      value={subUserEmail}
                      onChange={(e) => setSubUserEmail(e.target.value)}
                      required
                    />
                  </label>
                  {!editingUserId && (
                    <label className='work-field'>
                      <span>Password</span>
                      <input
                        type='password'
                        value={subUserPassword}
                        onChange={(e) => setSubUserPassword(e.target.value)}
                        required
                      />
                    </label>
                  )}
                  <label className='work-field'>
                    <span>Role</span>
                    <select
                      value={subUserRole}
                      onChange={(e) => setSubUserRole(e.target.value)}
                    >
                      <option value='user'>User</option>
                      <option value='admin'>Admin</option>
                      {/* <option value='moderator'>Moderator</option> */}
                    </select>
                  </label>
                </div>

                <div className='work-check-grid'>
                  <label>
                    <input
                      type='checkbox'
                      checked={subUserPermissions.voting}
                      onChange={() =>
                        setSubUserPermissions((prev) => ({
                          ...prev,
                          voting: !prev.voting,
                        }))
                      }
                    />{' '}
                    Access to Voting
                  </label>
                  <label>
                    <input
                      type='checkbox'
                      checked={subUserPermissions.manage}
                      onChange={() =>
                        setSubUserPermissions((prev) => ({
                          ...prev,
                          manage: !prev.manage,
                        }))
                      }
                    />{' '}
                    Access to Manage
                  </label>
                </div>

                <div className='work-upload-box'>
                  <div>
                    <span>
                      <FiUploadCloud /> Profile Picture
                    </span>
                    <p>Optional square image for the sub-user.</p>
                  </div>
                  <div>
                    <input
                      type='file'
                      accept='image/*'
                      onChange={async (e) => {
                        const f = e.target.files && e.target.files[0];
                        if (!f) return;
                        try {
                          const token = localStorage.getItem('token');
                          const res = await uploadFileToS3(
                            f,
                            token,
                            'sub-user-images',
                          );
                          setSubUserProfilePic({
                            key: res.key,
                            url: res.proxyUrl
                              ? `${apiUrl}${res.proxyUrl}`
                              : res.url,
                          });
                          toast.success('Profile image uploaded');
                        } catch (err) {
                          toast.error(err.message || 'Upload failed');
                        }
                      }}
                    />
                    {subUserProfilePic && subUserProfilePic.url && (
                      <div>
                        <img
                          src={subUserProfilePic.url}
                          alt='preview'
                          style={{
                            width: 48,
                            height: 48,
                            objectFit: 'cover',
                            borderRadius: 4,
                            display: 'block',
                            marginTop: 8,
                            marginBottom: 8,
                          }}
                        />
                        <button
                          type='button'
                          className='work-button work-button--danger work-button--small'
                          onClick={handleClearSubUserImage}
                        >
                          <FiTrash2 /> Remove Image
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type='submit'
                  className='work-button work-button--primary work-button--full'
                >
                  <FiEdit3 />{' '}
                  {editingUserId ? 'Update Sub-User' : 'Create Sub-User'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Settings;
