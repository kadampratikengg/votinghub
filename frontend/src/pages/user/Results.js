import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import './Workspace.css';
import {
  FiCalendar,
  FiChevronRight,
  FiClock,
  FiExternalLink,
  FiRefreshCw,
  FiTrendingUp,
} from 'react-icons/fi';

const Results = ({ setIsAuthenticated }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
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
          throw new Error('Failed to fetch voting events');
        }
        const data = await response.json();
        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        setError('Failed to load voting events. Please try again later.');
        console.error('Error fetching events for results:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleViewResults = (eventId) => {
    navigate(`/results/${eventId}`);
  };

  const formatEventDate = (date) => {
    if (!date) return 'Scheduled date';
    const value = String(date);
    const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('en-CA');
  };

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const query = searchQuery.toLowerCase().trim();
    return events.filter(
      (event) =>
        (event.name && event.name.toLowerCase().includes(query)) ||
        (event.description && event.description.toLowerCase().includes(query)) ||
        (event.date && String(event.date).toLowerCase().includes(query)),
    );
  }, [events, searchQuery]);

  return (
    <div className='work-shell'>
      <Sidebar setIsAuthenticated={setIsAuthenticated} />
      <main className='work-page'>
        <section className='work-hero'>
          <div>
            <span className='work-kicker'>Verified Election Results</span>
            <h1>Election Results & Analytics</h1>
            <span className='work-hero-rule' />
            <p>
              Select any voting event below to view its live vote counts, candidate results, and audit reports.
            </p>
          </div>
          <div className='work-hero-art' aria-hidden='true'>
            <div className='work-vote-badge'>
              <span>RESULTS</span>
              <FiTrendingUp />
            </div>
          </div>
        </section>

        <section className='work-panel'>
          <div className='work-panel__header work-panel__header--row'>
            <div>
              <span className='work-kicker'>Select Event</span>
              <h2>All Voting Results</h2>
            </div>
            {events.length > 0 && (
              <div className='work-search-bar'>
                <input
                  type='text'
                  className='work-search-input'
                  placeholder='Search by event name or date...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          {loading ? (
            <div className='work-empty'>
              <FiRefreshCw /> Loading voting events...
            </div>
          ) : error ? (
            <div className='work-empty work-empty--error'>{error}</div>
          ) : filteredEvents.length === 0 ? (
            <div className='work-empty'>
              <FiExternalLink />
              <strong>
                {searchQuery
                  ? 'No voting events match your search.'
                  : 'No voting events available.'}
              </strong>
              <span>
                {searchQuery
                  ? 'Try searching with a different keyword.'
                  : 'All voting results will appear here when events are created.'}
              </span>
            </div>
          ) : (
            <div className='work-results-grid'>
              {filteredEvents.map((event) => (
                <article
                  key={event.id}
                  className='work-event-card work-event-card--clickable'
                  onClick={() => handleViewResults(event.id)}
                  role='button'
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleViewResults(event.id);
                    }
                  }}
                >
                  <div>
                    <div className='work-event-card__top'>
                      <div>
                        <span className='work-pill'>
                          <FiCalendar /> {formatEventDate(event.date)}
                        </span>
                        <h3>{event.name}</h3>
                      </div>

                      <button
                        type='button'
                        className='work-event-arrow'
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewResults(event.id);
                        }}
                        aria-label={`Open ${event.name} results`}
                      >
                        <FiChevronRight />
                      </button>
                    </div>
                    {event.description && <p>{event.description}</p>}
                  </div>

                  <div>
                    <div className='work-event-meta'>
                      <span>
                        <FiClock /> Created on: {formatEventDate(event.createdAt || event.date)}
                      </span>
                      <span>
                        {event.startTime || 'Start time'} - {event.stopTime || 'End time'}
                      </span>
                    </div>
                    {event.link && (
                      <a
                        className='work-link'
                        href={event.link}
                        target='_blank'
                        rel='noopener noreferrer'
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FiExternalLink /> Open voting link
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className='work-copyright'>
          &copy; {new Date().getFullYear()} Private Voting. All rights reserved.
        </p>
      </main>
    </div>
  );
};

export default Results;
