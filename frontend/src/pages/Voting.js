import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiCalendar, FiClock, FiImage, FiPlay, FiUsers } from 'react-icons/fi';
import './Voting.css';
import { resolveStoredImageUrl } from '../utils/imageUrl';

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

const Voting = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessInfo, setAccessInfo] = useState(null);
  const [bufferHistory, setBufferHistory] = useState([]);
  const s3BucketUrl = process.env.REACT_APP_S3_BUCKET_URL;

  const fetchEvent = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/public/events/${eventId}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAccessInfo(data.votingAccess || null);
        throw new Error(data.message || 'Failed to fetch event');
      }

      setEvent(data);
      setAccessInfo(data.votingAccess || null);

      // fetch public buffer history for this event
      try {
        const historyRes = await fetch(
          `${process.env.REACT_APP_API_URL}/api/public/events/${eventId}/history`,
          { headers: { 'Content-Type': 'application/json' } },
        );
        const historyData = await historyRes.json().catch(() => []);
        if (historyRes.ok && Array.isArray(historyData)) {
          setBufferHistory(historyData);
        }
      } catch (err) {
        // ignore history fetch errors for public view
        console.warn('Failed to load buffer history', err);
      }
    } catch (err) {
      setEvent(null);
      setError(err.message || 'Failed to load voting event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const hiddenState = useMemo(
    () => ({
      notStarted: accessInfo?.phase === 'before-start',
      closed: accessInfo?.phase === 'closed',
      open: !!event?.votingWindow?.isOpen && accessInfo?.allowed !== false,
    }),
    [accessInfo, event],
  );

  const headers = useMemo(
    () =>
      event?.selectedData && event.selectedData.length > 0
        ? getDisplayHeaders(event.selectedData[0])
        : [],
    [event],
  );

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

  if (loading) {
    return (
      <div className='vote-public-shell'>
        <div className='vote-state-card'>Loading voting event...</div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className='vote-public-shell'>
        <div className='vote-state-card vote-state-card--error'>
          <div>Error: {error}</div>
          {accessInfo?.message && <p>{accessInfo.message}</p>}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className='vote-public-shell'>
        <div className='vote-state-card'>Voting event not found.</div>
      </div>
    );
  }

  const votingStatus =
    event.votingWindow?.phase === 'before-start'
      ? 'Not started'
      : event.votingWindow?.phase === 'closed'
        ? 'Closed'
        : event.votingWindow?.phase === 'buffer'
          ? 'Buffer'
          : 'Open';

  return (
    <main className='vote-public-shell'>
      <section className='vote-hero'>
        <div>
          <span className='vote-kicker'>
            <FiUsers /> Voting Event
          </span>
          <h1>{event.name}</h1>
          <p>{event.description}</p>
        </div>
        <div className='vote-hero-card'>
          <span>
            <FiCalendar /> {event.date}
          </span>
          <strong>
            <FiClock /> {event.startTime} - {event.stopTime}
          </strong>
        </div>
      </section>

      <section
        className={`vote-access-banner ${
          accessInfo?.enabled
            ? 'vote-access-banner--restricted'
            : 'vote-access-banner--open'
        }`}
      >
        <div>
          <span className='vote-kicker'>
            {hiddenState.notStarted
              ? 'Voting not started'
              : hiddenState.closed
                ? 'Voting closed'
                : accessInfo?.enabled
                  ? 'Restricted access'
                  : 'Open access'}
          </span>
          <strong>
            {hiddenState.notStarted
              ? 'Voting has not started yet.'
              : hiddenState.closed
                ? 'Voting time is over.'
                : accessInfo?.enabled
                  ? accessInfo.allowed
                    ? 'This voting link is restricted to one IP address.'
                    : 'This voting link is restricted from this IP address.'
                  : 'This voting link is open to all IP addresses.'}
          </strong>
        </div>
        <p>
          {accessInfo?.message ||
            (hiddenState.notStarted || hiddenState.closed
              ? 'Voting access is controlled by the configured event window.'
              : 'IP restriction is disabled for this voting link.')}
        </p>
      </section>

      <section className='vote-summary-grid'>
        <div className='vote-summary-card'>
          <FiUsers />
          <span>Candidates</span>
          <strong>{event.selectedData?.length || 0}</strong>
        </div>
        <div className='vote-summary-card'>
          <FiCalendar />
          <span>Date</span>
          <strong>{event.date}</strong>
        </div>
        <div className='vote-summary-card'>
          <FiClock />
          <span>Status</span>
          <strong>{votingStatus}</strong>
        </div>
      </section>

      {bufferHistory && bufferHistory.length > 0 && (
        <section className='vote-card vote-buffer-section'>
          <div className='vote-card-header'>
            <div>
              <span className='vote-kicker'>Buffer Extensions</span>
              <h2>Buffer History</h2>
            </div>
          </div>
          <div className='vote-table-wrap'>
            <table className='vote-table'>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Minutes Added</th>
                  <th>Added By</th>
                </tr>
              </thead>
              <tbody>
                {bufferHistory.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                    <td>{entry.bufferMinutes}</td>
                    <td className='actor-cell'>
                      {entry.createdBy?.name ||
                        entry.createdBy?.email ||
                        'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className='vote-card'>
        <div className='vote-card-header'>
          <div>
            <span className='vote-kicker'>Ballot Preview</span>
            <h2>Candidates</h2>
          </div>
          {hiddenState.open && accessInfo?.allowed !== false && (
            <button
              className='vote-primary-button'
              onClick={() => navigate(`/voting/${eventId}/start`)}
            >
              <FiPlay /> Start Voting
            </button>
          )}
        </div>

        {hiddenState.notStarted && (
          <div className='vote-state-card'>Voting has not started yet.</div>
        )}

        {hiddenState.closed && (
          <div className='vote-state-card'>Voting time is over.</div>
        )}

        {event.selectedData && event.selectedData.length > 0 ? (
          <div className='vote-table-wrap'>
            <table className='vote-table'>
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
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
                      {headers.map((header) => (
                        <td key={header}>{candidate[header]}</td>
                      ))}
                      <td>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={`Candidate ${index + 1}`}
                            className='vote-candidate-image'
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className='vote-no-image'>
                            <FiImage /> No image
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className='vote-state-card'>
            No candidates available for this voting event.
          </div>
        )}

        {hiddenState.open ? (
          <div className='vote-closed-note'>
            Voting is available until{' '}
            {event.votingWindow?.effectiveEndDateTime
              ? new Date(
                  event.votingWindow.effectiveEndDateTime,
                ).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : `${event.date} ${event.stopTime}`}
            .
          </div>
        ) : hiddenState.notStarted ? (
          <div className='vote-closed-note'>Voting has not started yet.</div>
        ) : (
          <div className='vote-closed-note'>Voting time is over.</div>
        )}

        {accessInfo?.enabled && accessInfo.allowed === false && (
          <div className='vote-closed-note vote-closed-note--restricted'>
            Only {accessInfo.allowedIp || 'the configured IP'} can open this
            voting link.
          </div>
        )}
      </section>
    </main>
  );
};

export default Voting;
