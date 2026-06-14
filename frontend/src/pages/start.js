import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import './start.css';
import { resolveStoredImageUrl } from '../utils/imageUrl';

const getCandidateImage = (images, index) =>
  images?.find(
    (img) =>
      Number(img.selectedIndex) === index ||
      Number(img.candidateIndex) === index ||
      Number(img.fileRowIndex) === index,
  );

const getCandidateDirectImage = (candidate) =>
  candidate?.candidateImage?.key || candidate?.candidateImage?.url
    ? candidate.candidateImage
    : candidate?.__candidateImage?.key || candidate?.__candidateImage?.url
      ? candidate.__candidateImage
      : null;

const getPreferredEntries = (record) => {
  if (!record || typeof record !== 'object') return [];

  const entries = Object.entries(record).filter(
    ([key]) =>
      !['candidateImage', 'candidateRowIndex', 'candidateSelectionIndex'].includes(
        key,
      ) && !key.startsWith('__'),
  );
  const findEntry = (patterns) =>
    entries.find(([key]) =>
      patterns.some((pattern) => key.toLowerCase().includes(pattern)),
    );

  const nameEntry = findEntry(['name']);
  const idEntry = findEntry(['id number', 'id', 'voter id']);

  return [idEntry, nameEntry].filter(Boolean);
};

const Start = () => {
  const { eventId } = useParams();

  const [idInput, setIdInput] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [eventData, setEventData] = useState(null);
  const [showVoterDetails, setShowVoterDetails] = useState(true);
  const [highlightedCandidate, setHighlightedCandidate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVotePopup, setShowVotePopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const s3BucketUrl = process.env.REACT_APP_S3_BUCKET_URL;

  const fetchEventData = useCallback(async () => {
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
        throw new Error(data.message || 'Failed to fetch event data');
      }

      setEventData(data);
      setError('');
    } catch (err) {
      setEventData(null);
      setError(err.message || 'Failed to load event data');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const canVote = useMemo(
    () => !!eventData?.votingWindow?.isOpen && eventData?.votingAccess?.allowed !== false,
    [eventData],
  );

  const votingMessage = useMemo(() => {
    if (!eventData) return error;
    if (eventData.votingWindow?.phase === 'before-start') {
      return 'Voting has not started yet.';
    }
    if (eventData.votingWindow?.phase === 'closed') {
      return 'Voting time is over.';
    }
    if (eventData.votingAccess?.allowed === false) {
      return eventData.votingAccess.message || 'Voting access is restricted.';
    }
    return '';
  }, [error, eventData]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  const handleVerifyId = async () => {
    if (!canVote) {
      setError(votingMessage || 'Voting is not available right now.');
      return;
    }

    setError('');
    setVerificationResult(null);
    setVoteSubmitted(false);
    setSelectedCandidate('');
    setHighlightedCandidate(null);
    setIsSubmitting(false);
    setShowVoterDetails(true);
    setShowVotePopup(false);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/verify-id/${eventId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: idInput }),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      setVerificationResult(data);

      if (data.verified && !data.hasVoted) {
        await fetchEventData();
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
    }
  };

  const handleCandidateSelect = async (candidateName, index) => {
    if (isSubmitting || voteSubmitted || !canVote) return;

    setIsSubmitting(true);
    setSelectedCandidate(candidateName);
    setHighlightedCandidate(index);

    const handleVoteSubmission = async () => {
      try {
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/vote/${eventId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              voterId: idInput,
              candidate: candidateName,
            }),
          },
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || 'Failed to submit vote');
        }

        setVoteSubmitted(true);
        setError('');

        setTimeout(() => {
          setIdInput('');
          setVerificationResult(null);
          setVoteSubmitted(false);
          setSelectedCandidate('');
          setHighlightedCandidate(null);
          setShowVoterDetails(true);
          setShowVotePopup(false);
          setIsSubmitting(false);
        }, 1000);
      } catch (err) {
        setError(err.message || 'Failed to submit vote');
        setIsSubmitting(false);
        setHighlightedCandidate(null);
      }
    };

    // Try to play a beep sound, but don't block voting if it fails
    const playBeepAndContinue = async () => {
      try {
        // Use Web Audio API for better cross-browser support
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800; // 800 Hz beep
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + 0.1,
        );

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);

        // Wait for beep to finish before submitting vote
        setTimeout(() => handleVoteSubmission(), 100);
      } catch (beepError) {
        console.warn('Beep sound unavailable, proceeding with vote submission:', beepError);
        // Continue with vote submission even if beep fails
        await handleVoteSubmission();
      }
    };

    playBeepAndContinue();
  };

  const handleGoForVote = () => {
    if (verificationResult?.hasVoted || !canVote) {
      return;
    }
    setShowVoterDetails(false);
    setShowVotePopup(true);
  };

  if (loading) {
    return (
      <div className='voting-start-container'>
        <div className='vote-state-card'>Loading voting event...</div>
      </div>
    );
  }

  if (error && !eventData) {
    return (
      <div className='voting-start-container'>
        <div className='vote-state-card vote-state-card--error'>{error}</div>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className='voting-start-container'>
        <div className='vote-state-card'>Voting event not found.</div>
      </div>
    );
  }

  const votingLocked = !canVote;

  return (
    <div className='voting-start-container'>
      {/* <section className='vote-state-card'>
        <h1>{eventData.name}</h1>
        <p>{eventData.description}</p>
        <p>
          {votingMessage ||
            `Voting is available from ${eventData.startTime} to ${eventData.stopTime} on ${eventData.date}.`}
        </p>
      </section> */}

      {votingLocked ? (
        <div className='vote-state-card vote-state-card--error'>
          {votingMessage || 'Voting is not available right now.'}
        </div>
      ) : (
        <>
          {showVoterDetails && (
            <>
              <div className='id-verification'>
                <h3>Verify Your ID</h3>
                <input
                  type='text'
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  placeholder='Enter your ID'
                  className='id-input'
                />
                <button onClick={handleVerifyId} className='verify-button'>
                  Verify ID
                </button>
              </div>

              {error && <p className='error-message'>{error}</p>}

              {verificationResult && (
                <div className='verification-result'>
                  <h3>
                    Verification Status:{' '}
                    {verificationResult.verified ? 'Verified' : 'Not Verified'}
                  </h3>
                  {verificationResult.verified && verificationResult.hasVoted && (
                    <p className='already-voted-message'>Already voted</p>
                  )}
                  {verificationResult.verified && verificationResult.rowData ? (
                    <div className='row-details'>
                      <h4>Voter Details:</h4>
                      <table>
                        <thead>
                          <tr>
                            {getPreferredEntries(verificationResult.rowData).map(
                              ([key]) => (
                                <th key={key}>{key}</th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {getPreferredEntries(verificationResult.rowData).map(
                              ([key, value]) => (
                                <td key={key}>{value}</td>
                              ),
                            )}
                          </tr>
                        </tbody>
                      </table>
                      {verificationResult.verified &&
                        !verificationResult.hasVoted && (
                          <button onClick={handleGoForVote} className='go-vote-button'>
                            Go for Vote
                          </button>
                        )}
                    </div>
                  ) : (
                    <p>No matching ID found in the Excel data.</p>
                  )}
                </div>
              )}
            </>
          )}

          {showVotePopup &&
            verificationResult?.verified &&
            !verificationResult.hasVoted &&
            eventData?.selectedData && (
              <div className='vote-popup'>
                <div className='vote-popup-content'>
                  <h3>Select a Candidate to Vote</h3>
                  <div className='candidates-list-horizontal'>
                    {eventData.selectedData.map((candidate, index) => {
                      const image =
                        getCandidateDirectImage(candidate) ||
                        getCandidateImage(eventData.candidateImages, index);
                      const imageUrl = resolveStoredImageUrl(
                        image,
                        s3BucketUrl,
                        process.env.REACT_APP_API_URL,
                      );
                      const candidateLabel =
                        candidate.Name ||
                        candidate.name ||
                        candidate.Candidate ||
                        candidate.candidate ||
                        `Candidate ${index + 1}`;

                      return (
                        <div
                          key={index}
                          className={`candidate-row ${
                            selectedCandidate === candidateLabel ? 'selected' : ''
                          } ${highlightedCandidate === index ? 'highlighted' : ''}`}
                          onClick={() =>
                            handleCandidateSelect(candidateLabel, index)
                          }
                        >
                          <div className='candidate-image-container candidate-image-container--row'>
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={`Candidate ${index + 1}`}
                                className='candidate-image-large'
                                onError={(e) => {
                                  console.error(
                                    `Failed to load image for candidate ${index + 1}`,
                                  );
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <p>No image</p>
                            )}
                          </div>
                          <div className='candidate-row-details'>
                            {getPreferredEntries(candidate).map(([key, value]) => (
                              <p key={key}>
                                <strong>{key}:</strong> {value}
                              </p>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

          {voteSubmitted && (
            <p className='success-message'>
              Your vote has been successfully submitted!
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default Start;
