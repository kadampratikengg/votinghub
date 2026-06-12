import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  FiAward,
  FiBarChart2,
  FiCalendar,
  FiClock,
  FiDownload,
  FiImage,
  FiPercent,
  FiPieChart,
  FiPrinter,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi';
import './result.css';
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

const getCandidateName = (candidate, index) =>
  candidate.Name ||
  candidate.name ||
  candidate.Candidate ||
  candidate.candidate ||
  `Candidate ${index + 1}`;

const formatPercent = (value) =>
  Number.isFinite(value) ? `${value.toFixed(value >= 10 ? 1 : 2)}%` : '0%';

const chartColors = [
  '#1f7a4d',
  '#f4b44f',
  '#496bba',
  '#b35f3a',
  '#7c5fb3',
  '#2d8b8b',
];

const Result = () => {
  const { eventId } = useParams();
  const resultRef = useRef(null);
  const [event, setEvent] = useState(null);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isVotingComplete, setIsVotingComplete] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [bufferHistory, setBufferHistory] = useState([]);
  const apiUrl = process.env.REACT_APP_API_URL;
  const s3BucketUrl = process.env.REACT_APP_S3_BUCKET_URL;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');

      const eventResponse = await fetch(`${apiUrl}/api/events/${eventId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!eventResponse.ok) {
        const errorData = await eventResponse.json();
        throw new Error(errorData.message || 'Failed to fetch event');
      }

      const eventData = await eventResponse.json();
      setEvent(eventData);

      const stopDateTime = eventData.votingWindow?.effectiveEndDateTime
        ? new Date(eventData.votingWindow.effectiveEndDateTime)
        : new Date(`${eventData.date}T${eventData.stopTime}`);
      const currentDateTime = new Date();
      setIsVotingComplete(currentDateTime >= stopDateTime);

      const votesResponse = await fetch(`${apiUrl}/api/votes/${eventId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!votesResponse.ok) {
        const errorData = await votesResponse.json();
        throw new Error(errorData.message || 'Failed to fetch votes');
      }

      const votesData = await votesResponse.json();
      setVotes(votesData);

      // fetch authenticated history for this event (owner/admin)
      try {
        const historyResponse = await fetch(
          `${apiUrl}/api/events/${eventId}/history`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (historyResponse.ok) {
          const historyData = await historyResponse.json().catch(() => []);
          setBufferHistory(Array.isArray(historyData) ? historyData : []);
        }
      } catch (err) {
        console.warn('Failed to fetch event history', err);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const voteCounts = Array.isArray(votes)
    ? votes.reduce((acc, vote) => {
        acc[vote.candidate] = (acc[vote.candidate] || 0) + 1;
        return acc;
      }, {})
    : votes?.candidateCounts || {};

  const totalVotes = Array.isArray(votes)
    ? votes.length
    : votes?.totalVotes || 0;
  const eligibleVoters = Array.isArray(event?.fileData)
    ? event.fileData.length
    : 0;
  const turnoutPercent =
    eligibleVoters > 0 ? (totalVotes / eligibleVoters) * 100 : 0;

  const candidateResults =
    (
      event?.selectedData?.map((candidate, index) => ({
        name: getCandidateName(candidate, index),
        votes: voteCounts[getCandidateName(candidate, index)] || 0,
        image: resolveStoredImageUrl(
          getCandidateDirectImage(candidate) ||
            getCandidateImage(event?.candidateImages, index),
          s3BucketUrl,
          apiUrl,
        ),
      })) || []
    )
      .map((candidate) => ({
        ...candidate,
        percent: totalVotes > 0 ? (candidate.votes / totalVotes) * 100 : 0,
      }))
      .sort((a, b) => b.percent - a.percent) || [];

  const topVotes = candidateResults[0]?.votes || 0;
  const leadingCandidates =
    topVotes > 0
      ? candidateResults.filter((candidate) => candidate.votes === topVotes)
      : [];
  const hasTieForLead = leadingCandidates.length > 1;
  const winner =
    candidateResults.length > 0 && !hasTieForLead
      ? candidateResults.find((candidate) => candidate.votes === topVotes) ||
        null
      : null;
  const topPercent = totalVotes > 0 ? (topVotes / totalVotes) * 100 : 0;
  const leadingCandidateLabel =
    totalVotes === 0
      ? 'No votes yet'
      : hasTieForLead
        ? `Tie between ${leadingCandidates.length} candidates`
        : winner?.name || 'No votes yet';
  const donutSegments =
    candidateResults.length > 0 && totalVotes > 0
      ? candidateResults
          .map((candidate, index) => {
            const start = candidateResults
              .slice(0, index)
              .reduce((sum, item) => sum + item.percent, 0);
            const end = start + candidate.percent;
            return `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
          })
          .join(', ')
      : '#e5e0d6 0% 100%';

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!resultRef.current || isDownloading) return;

    setIsDownloading(true);
    try {
      const canvas = await html2canvas(resultRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8f5ec',
        onclone: (clonedDocument) => {
          const clonedResult = clonedDocument.querySelector('.result-shell');
          clonedResult?.classList.add('result-pdf-mode');
        },
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 4;
      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;
      const imageRatio = canvas.width / canvas.height;
      let imageWidth = printableWidth;
      let imageHeight = imageWidth / imageRatio;

      if (imageHeight > printableHeight) {
        imageHeight = printableHeight;
        imageWidth = imageHeight * imageRatio;
      }

      const imageX = (pageWidth - imageWidth) / 2;
      const imageY = (pageHeight - imageHeight) / 2;
      const imageData = canvas.toDataURL('image/jpeg', 0.96);
      const safeName = event.name
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();

      pdf.addImage(imageData, 'JPEG', imageX, imageY, imageWidth, imageHeight);
      pdf.save(`${safeName || 'voting'}-result.pdf`);
    } catch (err) {
      console.error('Failed to download result PDF:', err);
      alert(
        'Unable to download PDF. Please check that all candidate images are accessible and try again.',
      );
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading)
    return (
      <div className='result-shell'>
        <div className='result-state-card'>Loading voting results...</div>
      </div>
    );
  if (error)
    return (
      <div className='result-shell'>
        <div className='result-state-card result-state-card--error'>
          Error: {error}
        </div>
      </div>
    );
  if (!event)
    return (
      <div className='result-shell'>
        <div className='result-state-card'>Voting event not found.</div>
      </div>
    );
  if (!isVotingComplete) {
    return (
      <main className='result-shell'>
        <section className='result-hero'>
          <span className='result-kicker'>
            <FiClock /> Results Pending
          </span>
          <h1>{event.name}</h1>
          <p>
            Voting is still running. Results will be available after{' '}
            {event.stopTime} on {event.date}.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className='result-shell' ref={resultRef}>
      <section className='result-hero'>
        <div>
          <span className='result-kicker'>
            <FiTrendingUp /> Voting Results
          </span>
          <h1>{event.name}</h1>
          <p>{event.description}</p>
        </div>
        <div className='result-hero-panel'>
          <div className='result-hero-card'>
            <span>
              <FiCalendar /> {event.date}
            </span>
            <strong>
              <FiClock /> {event.startTime} - {event.stopTime}
            </strong>
          </div>
          <div className='result-actions'>
            <button type='button' onClick={handlePrint}>
              <FiPrinter /> Print
            </button>
            <button
              type='button'
              onClick={handleDownload}
              disabled={isDownloading}
            >
              <FiDownload /> {isDownloading ? 'Preparing...' : 'Download PDF'}
            </button>
          </div>
        </div>
      </section>

      <section className='result-summary-grid'>
        <div className='result-summary-card'>
          <FiPercent />
          <span>Voting Done</span>
          <strong>{formatPercent(turnoutPercent)}</strong>
        </div>
        <div className='result-summary-card'>
          <FiUsers />
          <span>Total Votes Received</span>
          <strong>{totalVotes}</strong>
        </div>
        <div className='result-summary-card'>
          <FiAward />
          <span>Leading Candidate</span>
          <strong>{leadingCandidateLabel}</strong>
        </div>
        <div className='result-summary-card'>
          <FiTrendingUp />
          <span>Lead Share</span>
          <strong>{formatPercent(topPercent)}</strong>
        </div>
      </section>

      {bufferHistory && bufferHistory.length > 0 && (
        <section className='result-card result-buffer-section'>
          <div className='result-card-header'>
            <span className='result-kicker'>
              <FiClock /> Buffer Extensions
            </span>
            <h2>Buffer History</h2>
          </div>
          <div className='result-table-wrap'>
            <table className='result-table'>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Minutes Added</th>
                  <th>Added By</th>
                </tr>
              </thead>
              <tbody>
                {bufferHistory.map((entry) => (
                  <tr key={entry._id || entry.createdAt}>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                    <td>{entry.bufferMinutes || 0}</td>
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

      <section className='result-visual-grid'>
        <div className='result-card result-donut-card'>
          <div className='result-card-header'>
            <span className='result-kicker'>
              <FiPieChart /> Overall Share
            </span>
            <h2>Result Distribution</h2>
          </div>
          <div className='result-donut-wrap'>
            <div
              className='result-donut'
              style={{ background: `conic-gradient(${donutSegments})` }}
              aria-label='Candidate result distribution'
            >
              <div>
                <strong>{formatPercent(topPercent)}</strong>
                <span>Top share</span>
              </div>
            </div>
            <div className='result-distribution-list'>
              {candidateResults.map((candidate, index) => (
                <div className='result-distribution-item' key={candidate.name}>
                  <span
                    className='result-distribution-dot'
                    style={{
                      backgroundColor: chartColors[index % chartColors.length],
                    }}
                  />
                  <strong>{candidate.name}</strong>
                  <span>{candidate.votes} votes</span>
                  <b>{formatPercent(candidate.percent)}</b>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className='result-card result-progress-card'>
          <div className='result-card-header'>
            <span className='result-kicker'>
              <FiUsers /> Participation
            </span>
            <h2>Voting Completion</h2>
          </div>
          <div className='result-turnout-meter'>
            <div style={{ width: `${Math.min(turnoutPercent, 100)}%` }} />
          </div>
          <strong>{formatPercent(turnoutPercent)}</strong>
          <p>
            Based on completed voting against the uploaded eligible voter list.
          </p>
        </div>
      </section>

      <section className='result-card'>
        <div className='result-card-header'>
          <span className='result-kicker'>
            <FiBarChart2 /> Candidate Graph
          </span>
          <h2>Candidate Results</h2>
        </div>

        {candidateResults.length > 0 ? (
          <div className='result-candidate-list'>
            {candidateResults.map((candidate, index) => (
              <article className='result-candidate-row' key={candidate.name}>
                <div className='result-candidate-identity'>
                  {candidate.image ? (
                    <img
                      src={candidate.image}
                      alt={`Candidate ${candidate.name}`}
                      className='result-candidate-image'
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className='result-image-placeholder'>
                      <FiImage />
                    </span>
                  )}
                  <div>
                    <strong>{candidate.name}</strong>
                    <span>
                      {index === 0 && totalVotes > 0
                        ? 'Leading'
                        : 'Final result share'}
                    </span>
                  </div>
                </div>
                <div className='result-candidate-graph'>
                  <span className='result-vote-count'>
                    {candidate.votes} votes received
                  </span>
                  <div className='result-bar-track'>
                    <div
                      style={{ width: `${Math.min(candidate.percent, 100)}%` }}
                    />
                  </div>
                  <strong>{formatPercent(candidate.percent)}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className='result-state-card'>
            No candidates found for this voting event.
          </div>
        )}
      </section>
    </main>
  );
};

export default Result;
