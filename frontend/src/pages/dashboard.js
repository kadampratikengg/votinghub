import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import './Workspace.css';
import Popup from '../components/Popup';
import { useNavigate } from 'react-router-dom';
import {
  FiCalendar,
  FiChevronRight,
  FiClock,
  FiExternalLink,
  FiList,
  FiLock,
  FiPieChart,
  FiRefreshCw,
  FiShield,
  FiTrash2,
  FiTrendingUp,
  FiUserPlus,
} from 'react-icons/fi';

const Dashboard = ({ setIsAuthenticated }) => {
  const [activeEvents, setActiveEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'admin';
  const subUserRole = localStorage.getItem('subUserRole') || '';
  const permissions = JSON.parse(localStorage.getItem('permissions') || '[]');
  const canManage =
    role === 'admin' ||
    (role === 'subuser' &&
      (subUserRole === 'admin' || permissions.includes('/manage')));

  useEffect(() => {
    const fetchActiveEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = process.env.REACT_APP_API_URL;
        const token = localStorage.getItem('token');
        const response = await fetch(`${apiUrl}/api/events`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        const events = await response.json();
        setActiveEvents(events);
      } catch (err) {
        setError('Failed to load voting events. Please try again later.');
        console.error('Error fetching events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveEvents();
    const interval = setInterval(fetchActiveEvents, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleViewResults = (eventId) => {
    navigate(`/results/${eventId}`);
  };

  // Delete flow: open popup to collect reason, then confirm deletion
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');

  const requestDeleteEvent = (id) => {
    setDeletingEventId(id);
    setDeleteReason('');
    setShowDeletePopup(true);
  };

  const handleConfirmDelete = async () => {
    try {
      const trimmedReason = (deleteReason || '').trim();
      if (!trimmedReason) {
        alert('Please enter a delete reason before continuing.');
        return;
      }

      const apiUrl = process.env.REACT_APP_API_URL;
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/events/${deletingEventId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: trimmedReason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete voting event');
      }

      setActiveEvents((prevEvents) =>
        prevEvents.filter((event) => event.id !== deletingEventId),
      );
      setShowDeletePopup(false);
      setDeletingEventId(null);
      setDeleteReason('');
    } catch (error) {
      console.error('Error deleting event:', error);
      alert(
        error.message ||
          'There was an error deleting the voting event. Please try again.',
      );
    }
  };

  const formatEventDate = (date) => {
    if (!date) return 'Scheduled date';
    const value = String(date);
    const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('en-CA');
  };

  const renderEvents = (events, sectionTitle, emptyCopy) => {
    if (loading) {
      return (
        <div className='work-empty'>
          <FiRefreshCw /> Loading voting events...
        </div>
      );
    }
    if (error) {
      return <div className='work-empty work-empty--error'>{error}</div>;
    }
    if (events.length === 0) {
      return (
        <div className='work-empty'>
          <FiExternalLink />
          <strong>{emptyCopy || `No ${sectionTitle.toLowerCase()} available.`}</strong>
          <span>All events will appear here when scheduled.</span>
        </div>
      );
    }
    return events.map((event) => (
      <article key={event.id} className='work-event-card'>
        <div className='work-event-card__top'>
          <div>
            <span className='work-pill'>
              <FiCalendar /> {formatEventDate(event.date)}
            </span>
            <h3>{event.name}</h3>
          </div>
         
          <button
            className='work-event-arrow'
            onClick={() => canManage && handleViewResults(event.id)}
            aria-label={`Open ${event.name}`}
          >
            <FiChevronRight />
          </button>
        </div>
        {event.description && <p>{event.description}</p>}
        <div className='work-event-meta'>
          <span>
            <FiClock /> Created on: {formatEventDate(event.createdAt || event.date)}
          </span>
          <span>{event.startTime || 'Start time'} - {event.stopTime || 'End time'}</span>
        </div>
        {event.link && (
          <a
            className='work-link'
            href={event.link}
            target='_blank'
            rel='noopener noreferrer'
          >
            <FiExternalLink /> Open voting link
          </a>
        )}
        <div className='work-actions'>
          {canManage && (
            <button
              className='work-button work-button--danger'
              onClick={() => requestDeleteEvent(event.id)}
            >
              <FiTrash2 /> Delete
            </button>
          )}
          {canManage && (
            <button
              className='work-button work-button--primary'
              onClick={() => handleViewResults(event.id)}
            >
              <FiTrendingUp /> Results
            </button>
          )}
        </div>
      </article>
    ));
  };

  const today = new Date().toISOString().split('T')[0];
  const todayEvents = activeEvents.filter((event) => event.date === today);
 
  const featureHighlights = [
    {
      icon: <FiLock />,
      title: 'Secure & Encrypted',
      copy: 'End-to-end encryption ensures complete vote security.',
    },
    {
      icon: <FiUserPlus />,
      title: 'Anonymous Voting',
      copy: 'Voter identity remains private and anonymous.',
    },
    {
      icon: <FiShield />,
      title: 'Tamper Proof',
      copy: 'Blockchain technology ensures transparent and tamper-proof results.',
    },
    {
      icon: <FiPieChart />,
      title: 'Real-time Results',
      copy: 'Get instant results and detailed analytics.',
    },
  ];

  return (
    <div className='work-shell'>
      <Sidebar setIsAuthenticated={setIsAuthenticated} />
      <main className='work-page'>
        <header className='work-topbar'>
          
        </header>

        <section className='work-hero'>
          <div>
            <span className='work-kicker'>Secure Digital Voting Platform</span>
            <h1>Monitor voting activity in one place.</h1>
            <span className='work-hero-rule' />
            <p>
              Track today&apos;s voting events, review all configured voting
              sessions, and open result views quickly.
            </p>
          </div>
          <div className='work-hero-art' aria-hidden='true'>
            <div className='work-vote-badge'>
              <span>VOTE</span>
              <FiTrendingUp />
            </div>
          </div>
        </section>

        <section className='work-stats-grid'>
          <div className='work-stat-card'>
            <span className='work-stat-card__icon'><FiCalendar /></span>
            <div>
              <span>Today</span>
              <strong>{todayEvents.length}</strong>
              <p>Voting events today</p>
            </div>
          </div>
          <div className='work-stat-card'>
            <span className='work-stat-card__icon'><FiList /></span>
            <div>
              <span>All Voting</span>
              <strong>{activeEvents.length}</strong>
              <p>Total voting events</p>
            </div>
          </div>
          <div className='work-stat-card'>
            <span className='work-stat-card__icon'><FiShield /></span>
            <div>
              <span>Status</span>
              <strong>{loading ? 'Syncing' : 'Ready'}</strong>
              <p>System is ready to vote</p>
            </div>
          </div>
        </section>

        <section className='work-two-column'>
          <div className='work-panel'>
            <div className='work-panel__header'>
              <span className='work-kicker'>Today</span>
              <h2>Today&apos;s Voting</h2>
            </div>
            <div className='work-card-list'>
              {renderEvents(
                todayEvents,
                'voting today',
                'No voting events scheduled for today.',
              )}
            </div>
          </div>

          <div className='work-panel'>
            <div className='work-panel__header'>
              <span className='work-kicker'>All Events</span>
              <h2>All Voting</h2>
            </div>
            <div className='work-card-list'>
              {renderEvents(activeEvents, 'voting events')}
            </div>
          </div>
        </section>

        <section className='work-feature-strip'>
          {featureHighlights.map((item) => (
            <article key={item.title} className='work-feature'>
              <span>{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </section>

        <Popup
          title='Delete Voting Event'
          visible={showDeletePopup}
          onClose={() => setShowDeletePopup(false)}
          onConfirm={handleConfirmDelete}
          confirmLabel='Delete'
          cancelLabel='Cancel'
        >
          <p>Please enter a reason for deleting this event.</p>
          <textarea
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            style={{ width: '100%', minHeight: 80 }}
          />
        </Popup>
        <p className='work-copyright'>
          &copy; {new Date().getFullYear()} Private Voting. All rights reserved.
        </p>
      </main>
    </div>
  );
};

export default Dashboard;
