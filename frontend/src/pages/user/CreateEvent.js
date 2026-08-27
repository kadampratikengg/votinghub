import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './Sidebar';
import Popup from '../../components/Popup';
import Footer from '../../components/Footer';
import {
  FiDownload,
  FiExternalLink,
  FiImage,
  FiPlus,
  FiUploadCloud,
} from 'react-icons/fi';
import { resolveStoredImageUrl } from '../../utils/imageUrl';
import './Workspace.css';

const CreateEvent = ({ setIsAuthenticated, name }) => {
  const [fileData, setFileData] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [checkedRows, setCheckedRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [selectedData, setSelectedData] = useState([]);
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [stopTime, setStopTime] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [ballots, setBallots] = useState([]);
  const [activeBallotId, setActiveBallotId] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [eventCreated, setEventCreated] = useState(false);
  const [candidateImages, setCandidateImages] = useState({});
  const [candidateSelectionError, setCandidateSelectionError] = useState('');
  const [availableCredits, setAvailableCredits] = useState(0);
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  const [showEventForm, setShowEventForm] = useState(true);
  const navigate = useNavigate();

  const apiUrl = process.env.REACT_APP_API_URL;
  const s3BucketUrl = process.env.REACT_APP_S3_BUCKET_URL;

  const getTodayDate = () => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  };

  const getCurrentTime = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const isDateToday = (dateValue) => dateValue === getTodayDate();

  const minStartTime = isDateToday(eventDate) ? getCurrentTime() : undefined;
  const minStopTime = isDateToday(eventDate)
    ? startTime && startTime > getCurrentTime()
      ? startTime
      : getCurrentTime()
    : startTime || undefined;

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

  const createBallotDraft = (overrides = {}) => ({
    ballotId: uuidv4(),
    name: '',
    description: '',
    checkedRows: [],
    selectedData: [],
    candidateImages: {},
    ...overrides,
  });

  const normalizeBallotForForm = (ballot = {}) => ({
    ballotId: ballot.ballotId || ballot.id || uuidv4(),
    name: ballot.name || '',
    description: ballot.description || '',
    checkedRows: Array.isArray(ballot.checkedRows) ? ballot.checkedRows : [],
    selectedData: Array.isArray(ballot.selectedData) ? ballot.selectedData : [],
    candidateImages: ballot.candidateImages || {},
  });

  const buildBallotPayload = (ballot = {}) => {
    const normalized = normalizeBallotForForm(ballot);
    const rows = normalized.checkedRows || [];
    const selected = rows
      .map((rowIndex, selectedIndex) => {
        const row = fileData[rowIndex];
        if (!row) return null;
        const image = normalized.candidateImages[rowIndex];
        return {
          ...row,
          candidateImage: image
            ? {
                key: image.key || image.public_id || image.uuid || '',
                url: image.url || image.cdnUrl || '',
                public_id: image.public_id || image.key || '',
                provider: image.provider || '',
              }
            : null,
          candidateRowIndex: rowIndex,
          candidateSelectionIndex: selectedIndex,
        };
      })
      .filter(Boolean);

    return {
      ballotId: normalized.ballotId,
      name: normalized.name,
      description: normalized.description,
      selectedData: selected,
      candidateImages: rows
        .map((rowIndex, selectedIndex) => {
          const image = normalized.candidateImages[rowIndex];
          if (
            !image ||
            (!image.key && !image.public_id && !image.uuid && !image.url && !image.cdnUrl)
          )
            return null;
          return {
            candidateIndex: rowIndex,
            fileRowIndex: rowIndex,
            selectedIndex,
            key: image.key || image.public_id || image.uuid || null,
            url: image.url || image.cdnUrl || null,
            public_id: image.public_id || image.key || null,
            provider: image.provider || null,
          };
        })
        .filter(Boolean),
    };
  };

  const persistBallot = (ballotId, nextState) => {
    setBallots((prev) =>
      prev.map((ballot) =>
        ballot.ballotId === ballotId ? { ...ballot, ...nextState } : ballot,
      ),
    );
  };

  const syncActiveBallot = (patch = {}) => {
    if (!activeBallotId) return;
    const nextPatch = { ...patch };
    if (Object.prototype.hasOwnProperty.call(nextPatch, 'checkedRows')) {
      nextPatch.selectedData = (nextPatch.checkedRows || [])
        .map((rowIndex, selectedIndex) => {
          const row = fileData[rowIndex];
          if (!row) return null;
          const image = candidateImages[rowIndex];
          return {
            ...row,
            candidateImage: image
              ? {
                  key: image.key || image.public_id || image.uuid || '',
                  url: image.url || image.cdnUrl || '',
                  public_id: image.public_id || image.key || '',
                  provider: image.provider || '',
                }
              : null,
            candidateRowIndex: rowIndex,
            candidateSelectionIndex: selectedIndex,
          };
        })
        .filter(Boolean);
    }
    persistBallot(activeBallotId, {
      ballotId: activeBallotId,
      name: nextPatch.name ?? eventName,
      description: nextPatch.description ?? eventDescription,
      checkedRows: nextPatch.checkedRows ?? checkedRows,
      selectedData: nextPatch.selectedData ?? selectedData,
      candidateImages: nextPatch.candidateImages ?? candidateImages,
    });
  };

  const filteredFileData = useMemo(() => {
    if (!candidateSearch.trim()) return fileData;
    const searchLower = candidateSearch.toLowerCase();
    return fileData.filter((row) => {
      const idNumber = (row['Id Number'] || row.id || row.ID || '').toString().toLowerCase();
      const name = (row.Name || row.name || '').toString().toLowerCase();
      return idNumber.includes(searchLower) || name.includes(searchLower);
    });
  }, [fileData, candidateSearch]);

  const findFileIndexForRow = (row) => {
    return fileData.findIndex((r) => JSON.stringify(r) === JSON.stringify(row));
  };

  const fetchUserSubscription = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to load subscription');
      const data = await response.json();
      setAvailableCredits(data.subscription?.votingCredits || 0);
      setSubscriptionMessage('');
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setSubscriptionMessage('Unable to load subscription details.');
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchUserSubscription();
    setEventDate(getTodayDate());
  }, [fetchUserSubscription]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsedData = XLSX.utils.sheet_to_json(firstSheet);
        setFileData(parsedData);
        setFileName(file.name);
        setCheckedRows([]);
        setCandidateSearch('');
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Error parsing file. Please ensure it is a valid Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCheckboxChange = (index) => {
    setCheckedRows((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else {
        return [...prev, index];
      }
    });
    syncActiveBallot({ checkedRows: checkedRows.includes(index) ? checkedRows.filter((i) => i !== index) : [...checkedRows, index] });
  };

  const handleAddBallot = () => {
    const newBallot = createBallotDraft();
    setBallots((prev) => [...prev, newBallot]);
  };

  const handleSelectBallot = (ballotId) => {
    setActiveBallotId(ballotId);
  };

  const handleImageUpload = async (index, file) => {
    if (!file) return;
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'voting-candidate-images');
      const res = await fetch(`${apiUrl}/api/upload/s3`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Upload failed');
      }
      const result = await res.json();
      setCandidateImages((prevImages) => {
        const nextImages = {
          ...prevImages,
          [index]: {
            key: result.key || result.public_id,
            public_id: result.public_id || result.key,
            url: result.url || result.secure_url || (result.proxyUrl ? `${apiUrl}${result.proxyUrl}` : ''),
            provider: result.provider,
          },
        };
        syncActiveBallot({ candidateImages: nextImages });
        return nextImages;
      });
    } catch (err) {
      console.error('Failed to upload candidate image:', err);
      alert(err.message || 'Failed to upload image.');
    }
  };

  const handleClearImage = async (index) => {
    const image = candidateImages[index];
    if (image && (image.key || image.public_id || image.url || image.uuid)) {
      try {
        const token = localStorage.getItem('token');
        const keyOrUrl = image.key || image.public_id || image.url || image.uuid;
        const response = await fetch(
          `${apiUrl}/api/uploadcare/delete/${encodeURIComponent(keyOrUrl)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn('Image deletion warning:', errorData.message);
        }
      } catch (error) {
        console.error('Error deleting image:', error);
      }
    }
    setCandidateImages((prevImages) => {
      const newImages = { ...prevImages };
      delete newImages[index];
      syncActiveBallot({ candidateImages: newImages });
      return newImages;
    });
  };

  const handleEventFormSubmit = async (e) => {
    e.preventDefault();
    const activeSnapshot = {
      ballotId: activeBallotId || uuidv4(),
      name: eventName,
      description: eventDescription,
      checkedRows,
      selectedData,
      candidateImages,
    };
    const ballotMap = new Map(
      ballots.map((ballot) => [
        ballot.ballotId,
        ballot.ballotId === activeSnapshot.ballotId
          ? { ...ballot, ...activeSnapshot }
          : ballot,
      ]),
    );
    if (!ballotMap.has(activeSnapshot.ballotId)) {
      ballotMap.set(activeSnapshot.ballotId, {
        ...createBallotDraft(activeSnapshot),
      });
    }

    const ballotPayloads = Array.from(ballotMap.values()).map((ballot) =>
      buildBallotPayload(ballot),
    );
    const primaryBallot = ballotPayloads[0];

    if (!primaryBallot?.name || !primaryBallot?.description) {
      setCandidateSelectionError(
        'Add at least one voting post with a name and description.',
      );
      return;
    }

    if (!primaryBallot.selectedData || primaryBallot.selectedData.length === 0) {
      setCandidateSelectionError(
        'Please select at least one candidate before submitting the event.',
      );
      return;
    }

    const incompleteBallot = ballotPayloads.find(
      (ballot) =>
        !ballot.name ||
        !ballot.description ||
        !Array.isArray(ballot.selectedData) ||
        ballot.selectedData.length === 0,
    );
    if (incompleteBallot) {
      setCandidateSelectionError(
        'Every voting post must have a name, description, and at least one candidate.',
      );
      return;
    }

    const missingFields = [];
    if (!eventDate) missingFields.push('date');
    if (!startTime) missingFields.push('startTime');
    if (!stopTime) missingFields.push('stopTime');

    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    const creditsNeeded = ballotPayloads.length;

    if (availableCredits < creditsNeeded) {
      alert(
        `You need ${creditsNeeded} voting credits for ${creditsNeeded} voting posts.`,
      );
      navigate('/planspage');
      return;
    }

    const selectedStart = new Date(`${eventDate}T${startTime}`);
    const selectedStop = new Date(`${eventDate}T${stopTime}`);
    const now = new Date();

    if (selectedStart < now) {
      alert('Start time must be in the future. Please choose a valid date and time.');
      return;
    }
    if (selectedStop < now) {
      alert('Stop time must be in the future. Please choose a valid date and time.');
      return;
    }
    if (selectedStop <= selectedStart) {
      alert('Stop time must be greater than Start time.');
      return;
    }

    const expiryTime = new Date(`${eventDate}T${stopTime}`).getTime();
    const eventId = uuidv4();
    const serializedCandidateImages = primaryBallot.candidateImages;
    const selectedCandidates = primaryBallot.selectedData;

    const formData = new FormData();
    formData.append('id', eventId);
    formData.append('date', eventDate);
    formData.append('startTime', startTime);
    formData.append('stopTime', stopTime);
    formData.append('name', primaryBallot.name);
    formData.append('description', primaryBallot.description);
    formData.append('selectedData', JSON.stringify(selectedCandidates));
    formData.append('fileData', JSON.stringify(fileData));
    formData.append('expiry', expiryTime.toString());
    formData.append('link', `${window.location.origin}/voting/${eventId}`);
    formData.append('candidateImages', JSON.stringify(serializedCandidateImages));
    formData.append('ballots', JSON.stringify(ballotPayloads));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create event');
      }

      await response.json();
      setGeneratedLink(`${window.location.origin}/voting/${eventId}`);
      setEventCreated(true);
      setShowEventForm(false);

      // Reset form after success
      setTimeout(() => {
        setEventCreated(false);
        setFileName('');
        setFileData([]);
        setCheckedRows([]);
        setSelectedData([]);
        setBallots([]);
        setActiveBallotId('');
        setEventDate(getTodayDate());
        setStartTime('');
        setStopTime('');
        setEventName('');
        setEventDescription('');
        setCandidateImages({});
        setCandidateSearch('');
        setCandidateSelectionError('');
        setShowEventForm(true);
      }, 3000);
    } catch (err) {
      console.error('Failed to create event:', err);
      setPopup({
        visible: true,
        title: 'Error',
        message: err.message || 'Failed to create event. Please try again.',
        onConfirm: () => setPopup((p) => ({ ...p, visible: false })),
        hideCancel: true,
      });
    }
  };

  return (
    <div className='work-shell'>
      <Sidebar setIsAuthenticated={setIsAuthenticated} />
      <main className='work-page'>
        
<div className='work-panel work-create-panel'>
            <div className='work-panel__header'>
              <span className='work-kicker'>Builder</span>
              <h2>Create Voting</h2>
              <p>
                Start a new voting configuration, then upload Excel data and
                select candidates.
              </p>
              {subscriptionMessage && (
                <div className='work-empty work-empty--info' style={{ marginTop: 8 }}>
                  {subscriptionMessage}
                </div>
              )}
            </div>

            {!showEventForm ? (
              <div className='work-empty work-empty--action'>
                <FiPlus />
                <strong>No builder open</strong>
                <span>Create a new voting event or edit an existing one.</span>
                <button
                  className='work-button work-button--primary'
                  onClick={() => setShowEventForm(true)}
                >
                  Create Voting
                </button>
              </div>
            ) : (
              <form onSubmit={handleEventFormSubmit} className='work-form'>
                <div className='work-upload-box'>
                  <div>
                    <span>
                      <FiUploadCloud /> Upload Voters Excel File
                    </span>
                    <p>File uploaded: {fileName || 'No file selected'}</p>
                  </div>
                  <input
                    type='file'
                    accept='.xlsx'
                    onChange={handleFileUpload}
                  />
                  <a
                    className='work-link'
                    href='https://ucarecdn.com/fc73b582-f0fa-4069-aec3-d262bcae3236/'
                    target='_blank'
                    rel='noopener noreferrer'
                    download='AllDetailsFile.xlsm'
                  >
                    <FiDownload /> Download sample file
                  </a>
                </div>
                <div className='work-form-grid'>
                  <label className='work-field'>
                    <span>Voting Date</span>
                    <input
                      type='date'
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      min={getTodayDate()}
                      required
                    />
                  </label>
                  <label className='work-field'>
                    <span>Start Time</span>
                    <input
                      type='time'
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      min={minStartTime}
                      required
                    />
                  </label>
                  <label className='work-field'>
                    <span>Stop Time</span>
                    <input
                      type='time'
                      value={stopTime}
                      onChange={(e) => setStopTime(e.target.value)}
                      min={minStopTime}
                      required
                    />
                  </label>
                  <label className='work-field'>
                    <span>Voting Name</span>
                    <input
                      type='text'
                      value={eventName}
                      onChange={(e) => {
                        setEventName(e.target.value);
                        syncActiveBallot({ name: e.target.value });
                      }}
                      required
                    />
                  </label>
                  <label className='work-field work-field--full'>
                    <span>Description</span>
                    <textarea
                      value={eventDescription}
                      onChange={(e) => {
                        setEventDescription(e.target.value);
                        syncActiveBallot({ description: e.target.value });
                      }}
                      required
                    />
                  </label>
                </div>

                {/* <div className='work-upload-box'>
                  <div>
                    <span>
                      <FiUploadCloud /> Upload Voters Excel File
                    </span>
                    <p>File uploaded: {fileName || 'No file selected'}</p>
                  </div>
                  <input
                    type='file'
                    accept='.xlsx'
                    onChange={handleFileUpload}
                  />
                  <a
                    className='work-link'
                    href='https://ucarecdn.com/fc73b582-f0fa-4069-aec3-d262bcae3236/'
                    target='_blank'
                    rel='noopener noreferrer'
                    download='AllDetailsFile.xlsm'
                  >
                    <FiDownload /> Download sample file
                  </a>
                </div> */}

                <div className='work-ballot-controls'>
                  <label className='work-field work-ballot-controls__field'>
                    <span>Voting Post</span>
                    <select
                      value={activeBallotId}
                      onChange={(e) => handleSelectBallot(e.target.value)}
                      disabled={ballots.length === 0}
                    >
                      {ballots.map((ballot, index) => (
                        <option key={ballot.ballotId} value={ballot.ballotId}>
                          {index + 1}. {ballot.name || 'Untitled voting'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type='button'
                    className='work-button work-button--accent'
                    onClick={handleAddBallot}
                  >
                    <FiPlus /> Add Voting
                  </button>
                </div>

                {ballots.length > 0 && (
                  <div className='work-empty work-ballot-list'>
                    <strong>Voting Posts</strong>
                    <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                      {ballots.map((ballot, index) => (
                        <button
                          key={ballot.ballotId}
                          type='button'
                          className='work-link'
                          style={{
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            padding: '8px 12px',
                            border:
                              ballot.ballotId === activeBallotId
                                ? '1px solid #1a7f5a'
                                : '1px solid rgba(0,0,0,0.08)',
                          }}
                          onClick={() => handleSelectBallot(ballot.ballotId)}
                        >
                          <span>
                            {index + 1}. {ballot.name || 'Untitled voting'}
                          </span>
                          <span>
                            {ballot.selectedData?.length || 0} candidates
                          </span>
                        </button>
                      ))}
                    </div>
                    <p style={{ marginTop: 8 }}>
                      Each voting post uses 1 credit. The first post is the
                      default ballot shown to voters.
                    </p>
                  </div>
                )}

                {/* <div className='work-upload-box'>
                  <div>
                    <span>
                      <FiUploadCloud /> Upload Voters Excel File
                    </span>
                    <p>File uploaded: {fileName || 'No file selected'}</p>
                  </div>
                  <input
                    type='file'
                    accept='.xlsx'
                    onChange={handleFileUpload}
                  />
                  <a
                    className='work-link'
                    href='https://ucarecdn.com/fc73b582-f0fa-4069-aec3-d262bcae3236/'
                    target='_blank'
                    rel='noopener noreferrer'
                    download='AllDetailsFile.xlsm'
                  >
                    <FiDownload /> Download sample file
                  </a>
                </div> */}

                {fileData.length > 0 && (
                  <div className='work-table-wrap work-table-wrap--builder'>
                    <div className='work-panel__header'>
                      <span className='work-kicker'>Candidates</span>
                      <h3>
                        Selected Candidates
                        {eventName ? ` for ${eventName}` : ''}
                      </h3>
                    </div>
                    <div style={{ margin: '8px 0 12px' }}>
                      <input
                        type='text'
                        placeholder='Search by Id Number, Name, etc...'
                        value={candidateSearch}
                        onChange={(e) => setCandidateSearch(e.target.value)}
                        style={{
                          padding: '6px 8px',
                          width: '100%',
                          maxWidth: 420,
                        }}
                      />
                    </div>
                    <table className='work-table'>
                      <thead>
                        <tr>
                          <th>Sr.No</th>
                          <th>Select</th>
                          <th>Id Number</th>
                          <th>Name</th>
                          <th>Image</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFileData.map((data, idx) => {
                          const fileIndex = findFileIndexForRow(data);
                          const checked =
                            fileIndex >= 0 && checkedRows.includes(fileIndex);
                          const idNumber =
                            data['Id Number'] || data.id || data.ID || '';
                          const name = data.Name || data.name || '';

                          return (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td>
                                <input
                                  type='checkbox'
                                  checked={checked}
                                  onChange={() =>
                                    handleCheckboxChange(fileIndex)
                                  }
                                />
                              </td>
                              <td>{idNumber}</td>
                              <td>{name}</td>
                              <td>
                                <div className='work-image-upload-cell'>
                                  {checked ? (
                                    <input
                                      type='file'
                                      accept='image/*'
                                      onClick={(e) => {
                                        e.currentTarget.value = '';
                                      }}
                                      onChange={async (e) => {
                                        const file =
                                          e.target.files && e.target.files[0];
                                        if (!file) return;
                                        await handleImageUpload(
                                          fileIndex,
                                          file,
                                        );
                                      }}
                                    />
                                  ) : (
                                    <span className='work-image-upload-placeholder'>
                                      Select candidate first
                                    </span>
                                  )}
                                  {checked && candidateImages[fileIndex] && (
                                    <div className='work-image-preview'>
                                      <img
                                        src={
                                          resolveStoredImageUrl(
                                            candidateImages[fileIndex],
                                            s3BucketUrl,
                                            apiUrl,
                                          ) ||
                                          candidateImages[fileIndex].url ||
                                          ''
                                        }
                                        alt={`Candidate ${fileIndex}`}
                                      />
                                      <button
                                        type='button'
                                        className='work-button work-button--danger work-button--small'
                                        onClick={() =>
                                          handleClearImage(fileIndex)
                                        }
                                      >
                                        <FiImage /> Clear
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div>
                  {candidateSelectionError && (
                    <div
                      className='work-empty work-empty--error'
                      style={{ marginBottom: 8 }}
                    >
                      {candidateSelectionError}
                    </div>
                  )}
                  <button
                    type='submit'
                    className='work-button work-button--primary work-button--full'
                    disabled={!checkedRows || checkedRows.length === 0}
                  >
                    Create Voting Event
                  </button>
                </div>
              </form>
            )}

            {eventCreated && (
              <div className='work-success-box'>
                <h3>
                  Voting Created Successfully
                </h3>
                <a
                  className='work-link'
                  href={generatedLink}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <FiExternalLink /> {generatedLink}
                </a>
              </div>
            )}
          </div>

        <Popup {...popup} setPopup={setPopup} />
        <Footer />
      </main>
    </div>
  );
};

export default CreateEvent;
