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

    const beep = new Audio(
      // 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
      'https://votinghub.s3.us-east-1.amazonaws.com/Beep.wav?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIATQY3A6PUTEXOFP73%2F20260613%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260613T174348Z&X-Amz-Expires=300&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEGoaCXVzLWVhc3QtMSJHMEUCIQDLxpvEcoe%2BtNLplHX7nOdE%2BZTWJxM04aD58Tiy7kB8EAIgTEb2xSvYZxXyhyvHgKh0Z%2F3sADtldwoqz5oCrcvNSO0q2gIIMxAAGgwyNDIxODU0NjY4NTciDL%2FlJ3%2BKU7bIeRMPoCq3AkSj6f%2BEVYr%2BYQ9T13%2FHMHqsLsFVqchKhjSYweECnKmmm6QJvkyBr%2FO4PB9dCWKSe3MD4v44WnTpN04d%2B%2FyPXMFhTXHrxqXrM3yChDyzRMZLfBMiOMEfOLio5IOmU43UbEirZXfAQ3h87W8K0wPYxLT78CgeavXTg%2FjlEV%2BsPvj7L7ef8T6a9McjGP%2F%2FUKL5c1%2B0IWqO86snbEVFlvm6htw4cVVRWQ93y9i54Jyac0nZcvtEzxKLxjJ2DeKVKuet3yGwyP4qwQdttDPylMuJ%2F0XvW5j3eDc4tXFw%2FALUJDXwRvf42d0BcjLQvvv%2FAm%2B8QDrH8xBbLDL9bY%2FbmpUjfrfdoqHNg%2BUf5Sr%2FnQm2NE4d6ztGb3e5V%2BtcQvJl4LM7O0ctKzhMRn9C0Tyz6KDQ44Jk7yC7XU2fML2rttEGOq0CUu5xvLstBoTvLaRONysuIyDhC24bIg6aRDiTVQEcf3hZblDkemti38%2FN7cPqrB9qg9wY%2BHx9rLoDrqYX1%2BvahmUGjJ4c%2FFcvsbAy%2FUynNQmhXUQCzEbxjfN5Vu%2FdCfGaETO876W%2BUHEYo8MQ1zest5YsJE5VU9OZdr8flkMdJwzfyId%2BkuJv%2FYG4jtl%2Fp9bVyNaCsPuhRuSPkyZPIu51dXquOQIy34A0Fcb9ngtcA9IVFzUSux4qOgU1Rvi2x%2BpfamRpfW7d7xQo1MULoH5W3516AddGhDGZrf7piNqXCAyxa%2Fy7mX3r81uxR5zAcbk5ofxjrb1q%2BA8GIqiGlHmdpvS8ACaof2pwkeCOfLZ1UvNS49RAyjQXaF%2FZXoQnCu2LZzCO14tW%2BqlNu%2BEzMw%3D%3D&X-Amz-Signature=95ff36b378ba73046f6cab553c626f3f8d5a19e80e65033d1c8109e33f3cf072&X-Amz-SignedHeaders=host&response-content-disposition=inline',
    );

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

    try {
      beep.play();
      beep.onended = handleVoteSubmission;
    } catch (err) {
      console.error('Error playing beep:', err);
      await handleVoteSubmission();
    }
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
