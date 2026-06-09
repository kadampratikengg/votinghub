import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiImage, FiPlay, FiUsers } from 'react-icons/fi';
import './Voting.css';
import { resolveStoredImageUrl } from '../utils/imageUrl';

const Voting = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canStartVoting, setCanStartVoting] = useState(false);
  const [accessInfo, setAccessInfo] = useState(null);
  const s3BucketUrl = process.env.REACT_APP_S3_BUCKET_URL;

  const hiddenCandidateKeys = new Set([
    'candidateImage',
    'candidateRowIndex',
    'candidateSelectionIndex',
    '__candidateImage',
    '__candidateRowIndex',
    '__candidateSelectionIndex',
  ]);

  const getDisplayHeaders = (candidate) =>
    Object.keys(candidate || {}).filter(
      (key) => !hiddenCandidateKeys.has(key) && !key.startsWith('__'),
    );

  const checkVotingTime = useCallback((eventData) => {
    if (eventData.date && eventData.startTime && eventData.stopTime) {
      const [startHours, startMinutes] = eventData.startTime.split(':');
      const [stopHours, stopMinutes] = eventData.stopTime.split(':');
      const startDateTime = new Date(`${eventData.date}T${startHours}:${startMinutes}:00`).getTime();
      const stopDateTime = new Date(`${eventData.date}T${stopHours}:${stopMinutes}:00`).getTime();
      const now = new Date().getTime();
      setCanStartVoting(now >= startDateTime && now <= stopDateTime);
    }
  }, []);

  const fetchEvent = useCallback(async (bypassCache = false) => {
    try {
      if (!bypassCache) {
        const localEvent = JSON.parse(localStorage.getItem(`event-${eventId}`));
        const now = new Date().getTime();
        if (localEvent && localEvent.expiry > now) {
          setEvent(localEvent);
          setAccessInfo(localEvent.votingAccess || null);
          checkVotingTime(localEvent);
          setLoading(false);
          return;
        }
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/events/${eventId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setAccessInfo(errorData.votingAccess || null);
        throw new Error(errorData.message || 'Failed to fetch event');
      }

      const eventData = await response.json();
      eventData.expiry = new Date().getTime() + 60 * 1000;
      setEvent(eventData);
      setAccessInfo(eventData.votingAccess || null);
      localStorage.setItem(`event-${eventId}`, JSON.stringify(eventData));
      checkVotingTime(eventData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [eventId, checkVotingTime]);

  useEffect(() => {
    fetchEvent(true);
    const interval = setInterval(() => fetchEvent(true), 60000);
    return () => clearInterval(interval);
  }, [fetchEvent]);

  if (loading) return <div className="vote-public-shell"><div className="vote-state-card">Loading voting event...</div></div>;
  if (error) {
    return (
      <div className="vote-public-shell">
        <div className="vote-state-card vote-state-card--error">
          <div>Error: {error}</div>
          {accessInfo?.message && <p>{accessInfo.message}</p>}
        </div>
      </div>
    );
  }
  if (!event) return <div className="vote-public-shell"><div className="vote-state-card">Voting event not found.</div></div>;

  const headers = event.selectedData && event.selectedData.length > 0
    ? getDisplayHeaders(event.selectedData[0])
    : [];

  const getCandidateImage = (candidate, images, index) => {
    if (candidate?.candidateImage?.key || candidate?.candidateImage?.url) {
      return candidate.candidateImage;
    }

    if (candidate?.__candidateImage?.key || candidate?.__candidateImage?.url) {
      return candidate.__candidateImage;
    }

    return images?.find(
      (img) =>
        Number(img.selectedIndex) === index ||
        Number(img.candidateIndex) === index ||
        Number(img.fileRowIndex) === index,
    );
  };

  return (
    <main className="vote-public-shell">
      <section className="vote-hero">
        <div>
          <span className="vote-kicker"><FiUsers /> Voting Event</span>
          <h1>{event.name}</h1>
          <p>{event.description}</p>
        </div>
        <div className="vote-hero-card">
          <span><FiCalendar /> {event.date}</span>
          <strong><FiClock /> {event.startTime} - {event.stopTime}</strong>
        </div>
      </section>

      <section
        className={`vote-access-banner ${
          accessInfo?.enabled ? 'vote-access-banner--restricted' : 'vote-access-banner--open'
        }`}
      >
        <div>
          <span className="vote-kicker">
            {accessInfo?.enabled ? 'Restricted access' : 'Open access'}
          </span>
          <strong>
            {accessInfo?.enabled
              ? accessInfo.allowed
                ? 'This voting link is restricted to one IP address.'
                : 'This voting link is restricted from this IP address.'
              : 'This voting link is open to all IP addresses.'}
          </strong>
        </div>
        <p>{accessInfo?.message || 'IP restriction is disabled for this voting link.'}</p>
      </section>

      <section className="vote-summary-grid">
        <div className="vote-summary-card"><FiUsers /><span>Candidates</span><strong>{event.selectedData?.length || 0}</strong></div>
        <div className="vote-summary-card"><FiCalendar /><span>Date</span><strong>{event.date}</strong></div>
        <div className="vote-summary-card"><FiClock /><span>Status</span><strong>{canStartVoting ? 'Open' : 'Closed'}</strong></div>
      </section>

      <section className="vote-card">
        <div className="vote-card-header">
          <div>
            <span className="vote-kicker">Ballot Preview</span>
            <h2>Candidates</h2>
          </div>
          {canStartVoting && (!accessInfo?.enabled || accessInfo.allowed) && (
            <button className="vote-primary-button" onClick={() => navigate(`/voting/${eventId}/start`)}>
              <FiPlay /> Start Voting
            </button>
          )}
        </div>

        {event.selectedData && event.selectedData.length > 0 ? (
          <div className="vote-table-wrap">
            <table className="vote-table">
              <thead>
                <tr>
                  {headers.map((header) => <th key={header}>{header}</th>)}
                  <th>Image</th>
                </tr>
              </thead>
              <tbody>
                {event.selectedData.map((candidate, index) => {
                  const image = getCandidateImage(
                    candidate,
                    event.candidateImages,
                    index,
                  );
                  const imageUrl = resolveStoredImageUrl(
                    image,
                    s3BucketUrl,
                    process.env.REACT_APP_API_URL,
                  );
                  return (
                    <tr key={index}>
                      {headers.map((header) => <td key={header}>{candidate[header]}</td>)}
                      <td>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={`Candidate ${index + 1}`}
                            className="vote-candidate-image"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="vote-no-image"><FiImage /> No image</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="vote-state-card">No candidates available for this voting event.</div>
        )}

        {!canStartVoting && (
          <div className="vote-closed-note">Voting is not available at this time.</div>
        )}
        {accessInfo?.enabled && !accessInfo.allowed && (
          <div className="vote-closed-note vote-closed-note--restricted">
            Only {accessInfo.allowedIp || 'the configured IP'} can open this voting link.
          </div>
        )}
      </section>
    </main>
  );
};

export default Voting;
