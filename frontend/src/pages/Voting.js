import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiCalendar, FiClock, FiImage, FiPlay, FiUsers } from 'react-icons/fi';
import './Voting.css';
import { resolveStoredAssetUrl, resolveStoredImageUrl } from '../utils/imageUrl';
import { buildClientIpHeaders } from '../utils/clientIp';

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

const getBallots = (event) =>
  Array.isArray(event?.ballots) && event.ballots.length > 0
    ? event.ballots
    : event?.selectedData && event.selectedData.length > 0
      ? [
          {
            ballotId: 'main',
            name: event.name || 'Voting',
            description: event.description || '',
            selectedData: event.selectedData,
            candidateImages: event.candidateImages || [],
          },
        ]
      : [];

const getOrganizationDetails = (event, currentUser, apiUrl, s3BucketUrl) => {
  const orgObjectSource =
    event?.profile ||
    event?.owner ||
    event?.createdBy ||
    event?.user ||
    currentUser ||
    null;

  const orgName =
    event?.organizationName ||
    event?.orgName ||
    event?.ownerName ||
    (typeof event?.organization === 'string' ? event.organization : '') ||
    orgObjectSource?.organization ||
    orgObjectSource?.organisation ||
    orgObjectSource?.name ||
    '';

  const orgLogoSource =
    orgObjectSource?.logo ||
    orgObjectSource?.organizationLogo ||
    orgObjectSource?.logoPreview ||
    orgObjectSource?.logoPreviewUrl ||
    event?.organizationLogo ||
    event?.logo ||
    currentUser?.logo ||
    null;

  return {
    orgName,
    orgLogo: resolveStoredAssetUrl(orgLogoSource, s3BucketUrl, apiUrl),
  };
};

const Voting = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessInfo, setAccessInfo] = useState(null);
  const [bufferHistory, setBufferHistory] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const s3BucketUrl = process.env.REACT_APP_S3_BUCKET_URL;
  const { orgName, orgLogo } = useMemo(
    () =>
      getOrganizationDetails(
        event,
        currentUser,
        process.env.REACT_APP_API_URL,
        s3BucketUrl,
      ),
    [currentUser, event, s3BucketUrl],
  );

  const fetchEvent = useCallback(async () => {
    try {
      const clientIpHeaders = await buildClientIpHeaders();
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/public/events/${eventId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...clientIpHeaders,
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

      const token = localStorage.getItem('token');
      if (token) {
        try {
          const profileResp = await fetch(
            `${process.env.REACT_APP_API_URL}/api/users`,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            },
          );
          if (profileResp.ok) {
            const profileData = await profileResp.json().catch(() => null);
            if (profileData) setCurrentUser(profileData);
          }
        } catch (err) {
          console.warn('Failed to fetch current user for voting header', err);
        }
      }

      // fetch public buffer history for this event
      try {
        const historyHeaders = await buildClientIpHeaders();
        const historyRes = await fetch(
          `${process.env.REACT_APP_API_URL}/api/public/events/${eventId}/history`,
          {
            headers: {
              'Content-Type': 'application/json',
              ...historyHeaders,
            },
          },
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
      restricted: accessInfo?.enabled && accessInfo?.allowed === false,
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

  const ballots = useMemo(() => getBallots(event), [event]);

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
          <div className='vote-hero-identity'>
            {orgLogo ? (
              <img
                src={orgLogo}
                alt={orgName || 'Organization logo'}
                className='vote-org-logo'
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <span className='vote-image-placeholder'>
                <FiImage />
              </span>
            )}
            <div>
              <span className='vote-kicker'>
                <FiUsers /> Voting Event
              </span>
              <h1>{orgName || event.name}</h1>
            </div>
          </div>
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
          <span>Voting Posts</span>
          <strong>{ballots.length || 0}</strong>
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

        {ballots.length > 0 ? (
          <div className='vote-card-list'>
            {ballots.map((ballot, ballotIndex) => {
              const ballotHeaders =
                ballot?.selectedData && ballot.selectedData.length > 0
                  ? getDisplayHeaders(ballot.selectedData[0])
                  : headers;
              return (
                <article className='vote-card' key={ballot.ballotId || ballotIndex}>
                  <div className='vote-card-header'>
                    <div>
                      <span className='vote-kicker'>Voting Post {ballotIndex + 1}</span>
                      <h3>{ballot.name || `Voting Post ${ballotIndex + 1}`}</h3>
                      <p>{ballot.description}</p>
                    </div>
                    <strong>{ballot.selectedData?.length || 0} candidates</strong>
                  </div>
                  {ballot.selectedData && ballot.selectedData.length > 0 ? (
                    <div className='vote-table-wrap'>
                      <table className='vote-table'>
                        <thead>
                          <tr>
                            {ballotHeaders.map((header) => (
                              <th key={header}>{header}</th>
                            ))}
                            <th>Image</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ballot.selectedData.map((candidate, index) => {
                            const image = getCandidateImage(
                              candidate,
                              ballot.candidateImages,
                              index,
                            );
                            const imageUrl = resolveStoredImageUrl(
                              image,
                              s3BucketUrl,
                              process.env.REACT_APP_API_URL,
                            );
                            return (
                              <tr key={index}>
                                {ballotHeaders.map((header) => (
                                  <td key={header} data-label={header}>
                                    {candidate[header]}
                                  </td>
                                ))}
                                <td data-label='Image'>
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
                      No candidates configured for this voting post.
                    </div>
                  )}
                </article>
              );
            })}
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
        ) : hiddenState.restricted ? (
          <div className='vote-closed-note vote-closed-note--restricted'>
            Voting is restricted from this IP address.
          </div>
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
