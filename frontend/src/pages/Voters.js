import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Popup from '../components/Popup';
import Footer from '../components/Footer';
import {
  FaUsers,
} from 'react-icons/fa';
import {
  FiCalendar,
  FiEdit3,
  FiExternalLink,
  FiTrash2,
  FiTrendingUp,
} from 'react-icons/fi';
import './Workspace.css';

const Voters = ({ setIsAuthenticated, name }) => {
  const [activeEvents, setActiveEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popup, setPopup] = useState({
    visible: false,
    title: '',
    message: '',
    onConfirm: null,
    hideCancel: false,
    confirmLabel: 'OK',
    cancelLabel: 'Cancel',
    children: null,
  });
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const navigate = useNavigate();
  const apiUrl = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const fetchActiveEvents = async () => {
      setLoading(true);
      setError(null);
      try {
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
        const sortedEvents = events.sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.startTime}`);
          const dateB = new Date(`${b.date}T${b.startTime}`);
          return dateB - dateA;
        });
        setActiveEvents(sortedEvents);
      } catch (err) {
        setError('Failed to load events. Please try again later.');
        console.error('Error fetching events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveEvents();
    const interval = setInterval(() => {
      fetchActiveEvents();
    }, 60000);
    return () => clearInterval(interval);
  }, [apiUrl]);



  const handleDeleteEvent = (eventId) => {
    setDeleteTargetId(eventId);
    setDeleteReason('');
    setDeleteModalVisible(true);
  };

  const performDeleteEvent = async (eventId, reason) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete event');
      }

      setActiveEvents((prev) => prev.filter((event) => event.id !== eventId));
      setDeleteModalVisible(false);
      setDeleteTargetId(null);
      setDeleteReason('');

      setPopup({
        visible: true,
        title: 'Deleted',
        message: 'The voting event has been deleted successfully.',
        onConfirm: () => setPopup((p) => ({ ...p, visible: false })),
        hideCancel: true,
      });
    } catch (err) {
      console.error('Failed to delete event:', err);
      setPopup({
        visible: true,
        title: 'Error',
        message: err.message || 'Failed to delete event.',
        onConfirm: () => setPopup((p) => ({ ...p, visible: false })),
        hideCancel: true,
      });
    }
  };

  const handleEditEvent = (eventId, event) => {
    navigate('/manage', { state: { editEventId: eventId } });
  };

  const handleViewResults = (eventId) => {
    navigate('/results', { state: { eventId } });
  };

  return (
    <div className='work-shell'>
      <Sidebar setIsAuthenticated={setIsAuthenticated} />
      <main className='work-page'>
        <section className='work-hero work-hero--manage'>
          <div>
            <span className='work-kicker'>
              <FaUsers /> Voters Management
            </span>
            <h1>Voters</h1>
            <p>
              Manage voter records and eligibility through the event management workspace.
            </p>
          </div>
        </section>

        <section className='work-manage-grid'>
          <div className='work-panel'>
            <div className='work-panel__header work-panel__header--row'>
              <div>
                <span className='work-kicker'>Configured</span>
                <h2>Voting Events</h2>
              </div>
            </div>

            <div className='work-card-list'>
              {loading ? (
                <div className='work-empty'>Loading voting events...</div>
              ) : error ? (
                <div className='work-empty work-empty--error'>{error}</div>
              ) : activeEvents.length === 0 ? (
                <div className='work-empty'>
                  No voting events yet. Create one to get started.
                </div>
              ) : (
                activeEvents.map((event) => (
                  <article key={event.id} className='work-event-card'>
                    <div className='work-event-card__top'>
                      <div>
                        <span className='work-pill'>
                          <FiCalendar /> {event.date}
                        </span>
                        <h3>{event.name}</h3>
                      </div>
                    </div>
                    <p>{event.description}</p>
                    <div className='work-event-meta'>
                      <span>Start {event.startTime}</span>
                      <span>Stop {event.stopTime}</span>
                    </div>
                    <div className='work-event-status'>
                      <strong>
                        Status:{' '}
                        {event.votingWindow?.phase === 'before-start'
                          ? 'Voting has not started yet.'
                          : event.votingWindow?.phase === 'closed'
                            ? 'Voting time is over.'
                            : event.votingWindow?.phase === 'buffer'
                              ? 'Buffer period active.'
                              : 'Voting active.'}
                      </strong>
                      {event.votingWindow?.effectiveEndDateTime && (
                        <span>
                          Effective end:{' '}
                          {new Date(
                            event.votingWindow.effectiveEndDateTime,
                          ).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      )}
                    </div>
                    <a
                      className='work-link'
                      href={event.link}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      <FiExternalLink /> Open voting link
                    </a>
                    <div className='work-actions'>
                      <button
                        className='work-button work-button--danger'
                        onClick={() => handleDeleteEvent(event.id)}
                      >
                        <FiTrash2 /> Delete
                      </button>
                      <button
                        className='work-button work-button--accent'
                        onClick={() => handleEditEvent(event.id, event)}
                      >
                        <FiEdit3 /> Edit
                      </button>
                      <button
                        className='work-button work-button--primary'
                        onClick={() => handleViewResults(event.id)}
                      >
                        <FiTrendingUp /> Results
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <Popup
          visible={popup.visible}
          title={popup.title}
          message={popup.message}
          onClose={() => setPopup((p) => ({ ...p, visible: false }))}
          onConfirm={popup.onConfirm}
          confirmLabel={popup.confirmLabel}
          cancelLabel={popup.cancelLabel}
          hideCancel={popup.hideCancel}
        >
          {popup.children}
        </Popup>

        <Popup
          visible={deleteModalVisible}
          title='Delete Voting Event'
          message={null}
          onClose={() => setDeleteModalVisible(false)}
          onConfirm={() => performDeleteEvent(deleteTargetId, deleteReason)}
          confirmLabel='Delete'
          cancelLabel='Cancel'
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label>
              Enter reason for deleting this voting event:
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={4}
                style={{ width: '100%', marginTop: 8 }}
              />
            </label>
          </div>
        </Popup>
        <Footer />
      </main>
    </div>
  );
};

export default Voters;
