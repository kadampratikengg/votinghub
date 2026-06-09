import React, { useState } from 'react';
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
  const s3BucketUrl = process.env.REACT_APP_S3_BUCKET_URL;

  const fetchEventData = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/events/${eventId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch event data');
      }
      const data = await response.json();
      setEventData(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleVerifyId = async () => {
    setError('');
    setVerificationResult(null);
    setVoteSubmitted(false);
    setSelectedCandidate('');
    setHighlightedCandidate(null);
    setIsSubmitting(false);
    setShowVoterDetails(true);
    setShowVotePopup(false);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/verify-id/${eventId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: idInput }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Verification failed');
      }

      const result = await response.json();
      console.log('Verification Result:', result);
      setVerificationResult(result);

      if (result.verified && !result.hasVoted) {
        await fetchEventData();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCandidateSelect = async (candidateName, index) => {
    if (isSubmitting || voteSubmitted) return;

    setIsSubmitting(true);
    setSelectedCandidate(candidateName);
    setHighlightedCandidate(index);

    // const beep = new Audio('https://www.soundjay.com/buttons/beep-01a.mp3');
    const beep = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");


    const handleVoteSubmission = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/vote/${eventId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voterId: idInput,
            candidate: candidateName,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to submit vote');
        }

        setVoteSubmitted(true);
        setError('');

        // Reset back to ID verification view
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
        setError(err.message);
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
    if (verificationResult?.hasVoted) {
      console.warn('Attempted to open vote popup for voter who already voted');
      return;
    }
    setShowVoterDetails(false);
    setShowVotePopup(true);
  };

  return (
    <div className="voting-start-container">
      {showVoterDetails && (
        <>
          <div className="id-verification">
            <h3>Verify Your ID</h3>
            <input
              type="text"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              placeholder="Enter your ID"
              className="id-input"
            />
            <button onClick={handleVerifyId} className="verify-button">
              Verify ID
            </button>
          </div>

          {error && <p className="error-message">{error}</p>}

          {verificationResult && (
            <div className="verification-result">
              <h3>
                Verification Status: {verificationResult.verified ? 'Verified' : 'Not Verified'}
              </h3>
              {verificationResult.verified && verificationResult.hasVoted && (
                <p className="already-voted-message">
                  Already voted
                </p>
              )}
              {verificationResult.verified && verificationResult.rowData ? (
                <div className="row-details">
                  <h4>Voter Details:</h4>
                  <table>
                    <thead>
                      <tr>
                        {getPreferredEntries(verificationResult.rowData).map(([key]) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {getPreferredEntries(verificationResult.rowData).map(([key, value]) => (
                          <td key={key}>{value}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                  {verificationResult.verified && !verificationResult.hasVoted && (
                    <button onClick={handleGoForVote} className="go-vote-button">
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

      {showVotePopup && verificationResult?.verified && !verificationResult.hasVoted && eventData?.selectedData && (
        <div className="vote-popup">
          <div className="vote-popup-content">
            <h3>Select a Candidate to Vote</h3>
            <div className="candidates-list-horizontal">
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
                    <div className="candidate-image-container candidate-image-container--row">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={`Candidate ${index + 1}`}
                          className="candidate-image-large"
                          onError={(e) => {
                            console.error(`Failed to load image for candidate ${index + 1}`);
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <p>No image</p>
                      )}
                    </div>
                    <div className="candidate-row-details">
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
        <p className="success-message">Your vote has been successfully submitted!</p>
      )}
    </div>
  );
};

export default Start;
