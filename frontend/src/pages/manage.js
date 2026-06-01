import React, { useState, useEffect, useMemo } from 'react';
import './Workspace.css';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './Sidebar';
import {
  FiCalendar,
  FiCheckSquare,
  FiCreditCard,
  FiDownload,
  FiEdit3,
  FiExternalLink,
  FiImage,
  FiPlus,
  FiTrash2,
  FiTrendingUp,
  FiUploadCloud,
} from 'react-icons/fi';
const Dashboard = ({ setIsAuthenticated, name }) => {
  const [fileData, setFileData] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [checkedRows, setCheckedRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedData, setSelectedData] = useState([]);
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [stopTime, setStopTime] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [eventCreated, setEventCreated] = useState(false);
  const [activeEvents, setActiveEvents] = useState([]);
  const [editingEventId, setEditingEventId] = useState(null);
  const [candidateImages, setCandidateImages] = useState({});
  const [eventId, setEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [candidateSelectionError, setCandidateSelectionError] = useState('');
  const [availableCredits, setAvailableCredits] = useState(0);
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  const navigate = useNavigate();

  const apiUrl = process.env.REACT_APP_API_URL;
  const s3BucketUrl = process.env.REACT_APP_S3_BUCKET_URL;

  const uploadFileToS3 = async (file, token, folder) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${apiUrl}/api/upload/s3`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        [err.message, err.error, err.code].filter(Boolean).join(': ') ||
          'Upload failed',
      );
    }
    return res.json(); // { url, key }
  };

  const resetForm = () => {
    setFileName('');
    setFileData([]);
    setCheckedRows([]);
    setSelectedData([]);
    setShowEventForm(false);
    setEventDate('');
    setStartTime('');
    setStopTime('');
    setEventName('');
    setEventDescription('');
    setGeneratedLink('');
    setEventCreated(false);
    setEditingEventId(null);
    setCandidateImages({});
    setEventId(null);
  };

  const handleImageUpload = async (index, file) => {
    if (!file) return;
    try {
      const token = localStorage.getItem('token');
      const res = await uploadFileToS3(file, token, 'voting-candidate-images');
      setCandidateImages((prevImages) => ({
        ...prevImages,
        [index]: {
          key: res.key,
          url: res.proxyUrl ? `${apiUrl}${res.proxyUrl}` : res.url,
        },
      }));
    } catch (err) {
      console.error('Failed to upload candidate image:', err);
      alert(err.message || 'Failed to upload image.');
    }
  };

  const handleClearImage = async (index) => {
    const image = candidateImages[index];
    if (image && (image.key || image.uuid)) {
      try {
        const token = localStorage.getItem('token');
        const keyOrUrl = image.key || image.uuid;
        const response = await fetch(
          `${apiUrl}/api/uploadcare/delete/${encodeURIComponent(keyOrUrl)}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to delete image');
        }
        setCandidateImages((prevImages) => {
          const newImages = { ...prevImages };
          delete newImages[index];
          return newImages;
        });
      } catch (error) {
        console.error('Error deleting image:', error);
        alert(error.message || 'Failed to delete image. Please try again.');
      }
    } else {
      setCandidateImages((prevImages) => {
        const newImages = { ...prevImages };
        delete newImages[index];
        return newImages;
      });
    }
  };

  const fetchUserSubscription = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to load subscription details');
      }
      const data = await response.json();
      setAvailableCredits(data.subscription?.votingCredits || 0);
      setSubscriptionMessage('');
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setSubscriptionMessage('Unable to load subscription details.');
    }
  };

  useEffect(() => {
    const fetchActiveEvents = async () => {
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
    fetchUserSubscription();
    const interval = setInterval(() => {
      fetchActiveEvents();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleEditEvent = async (eventId, event) => {
    const eventStartTime = new Date(`${event.date}T${event.startTime}`);
    const currentTime = new Date();

    if (eventStartTime <= currentTime) {
      alert('Event has already started and cannot be edited.');
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/events/${eventId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch event');
      const eventToEdit = await response.json();

      setEventDate(eventToEdit.date);
      setStartTime(eventToEdit.startTime);
      setStopTime(eventToEdit.stopTime);
      setEventName(eventToEdit.name);
      setEventDescription(eventToEdit.description);
      setSelectedData(eventToEdit.selectedData);
      setFileData(eventToEdit.fileData || []);
      setCheckedRows(
        eventToEdit.fileData
          ? eventToEdit.fileData
              .map((data, index) =>
                eventToEdit.selectedData.some((selected) =>
                  Object.keys(data).every((key) => selected[key] === data[key]),
                )
                  ? index
                  : null,
              )
              .filter((index) => index !== null)
          : [],
      );
      setShowEventForm(true);
      setEditingEventId(eventId);
      setEventId(eventId);

      const images = {};
      (eventToEdit.candidateImages || []).forEach((img) => {
        const fileRowIndex =
          img.fileRowIndex ?? img.candidateIndex ?? img.selectedIndex;
        images[fileRowIndex] = img.key
          ? { key: img.key, url: img.url }
          : img.uuid
            ? { uuid: img.uuid, cdnUrl: img.cdnUrl }
            : null;
      });
      setCandidateImages(images);
    } catch (error) {
      console.error('Error fetching event for edit:', error);
      alert('Failed to load event for editing');
    }
  };

  const handleViewResults = (eventId) => {
    navigate(`/results/${eventId}`);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setFileData(jsonData);
        setCheckedRows([]);
        setSelectedData([]);
      };
      reader.readAsBinaryString(file);
    } else {
      alert('Please upload a valid Excel (.xlsx) file.');
    }
  };

  const handleCheckboxChange = (index) => {
    setCheckedRows((prevCheckedRows) => {
      let updatedCheckedRows;
      if (prevCheckedRows.includes(index)) {
        updatedCheckedRows = prevCheckedRows.filter(
          (rowIndex) => rowIndex !== index,
        );
      } else {
        updatedCheckedRows = [...prevCheckedRows, index];
      }
      setSelectedData(updatedCheckedRows.map((rowIndex) => fileData[rowIndex]));
      return updatedCheckedRows;
    });
  };

  const filteredFileData = useMemo(() => {
    if (!candidateSearch || candidateSearch.trim() === '') return fileData;
    const q = candidateSearch.trim().toLowerCase();
    return fileData.filter((row) =>
      Object.values(row)
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [fileData, candidateSearch]);

  const findFileIndexForRow = (row) => {
    return fileData.findIndex(
      (fd) => JSON.stringify(fd) === JSON.stringify(row),
    );
  };

  const handleCreateEvent = () => {
    if (availableCredits <= 0) {
      alert('No voting credits available. Redirecting to purchase page.');
      navigate('/planspage');
      return;
    }
    const newEventId = uuidv4();
    setShowEventForm(true);
    setEventId(newEventId);
  };

  const handleDeleteEvent = async (id) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/events/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete event');
      }

      setActiveEvents((prevEvents) =>
        prevEvents.filter((event) => event.id !== id),
      );
      fetchUserSubscription();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert(
        error.message ||
          'There was an error deleting the event. Please try again.',
      );
    }
  };

  const handleEventFormSubmit = async (e) => {
    e.preventDefault();
    // Require at least one candidate selected (checkedRows)
    if (!checkedRows || checkedRows.length === 0) {
      setCandidateSelectionError(
        'Please select at least one candidate before submitting the event.',
      );
      return;
    }
    setCandidateSelectionError('');

    const missingFields = [];
    if (!eventId && !editingEventId) missingFields.push('eventId');
    if (!eventDate) missingFields.push('date');
    if (!startTime) missingFields.push('startTime');
    if (!stopTime) missingFields.push('stopTime');
    if (!eventName) missingFields.push('name');
    if (!eventDescription) missingFields.push('description');
    if (
      !selectedData ||
      !Array.isArray(selectedData) ||
      selectedData.length === 0
    )
      missingFields.push('selectedData');
    if (
      !eventDate ||
      !stopTime ||
      !new Date(`${eventDate}T${stopTime}`).getTime()
    )
      missingFields.push('expiry');
    if (!window.location.origin) missingFields.push('link');

    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    if (!editingEventId && availableCredits <= 0) {
      alert('No voting credits available. Redirecting to purchase page.');
      navigate('/planspage');
      return;
    }

    const start = new Date(`${eventDate}T${startTime}`);
    const stop = new Date(`${eventDate}T${stopTime}`);

    if (stop <= start) {
      alert('Stop time must be greater than Start time.');
      return;
    }
    const expiryTime = new Date(`${eventDate}T${stopTime}`).getTime();
    const currentEventId = editingEventId || eventId;

    const serializedCandidateImages = checkedRows
      .map((rowIndex, selectedIndex) => {
        const image = candidateImages[rowIndex];
        return {
          candidateIndex: rowIndex,
          fileRowIndex: rowIndex,
          selectedIndex,
          key: image ? image.key || image.uuid : null,
          url: image ? image.url || image.cdnUrl : null,
        };
      })
      .filter((img) => img.key && img.url);

    const formData = new FormData();
    formData.append('id', currentEventId);
    formData.append('date', eventDate);
    formData.append('startTime', startTime);
    formData.append('stopTime', stopTime);
    formData.append('name', eventName);
    formData.append('description', eventDescription);
    formData.append('selectedData', JSON.stringify(selectedData));
    formData.append('fileData', JSON.stringify(fileData));
    formData.append('expiry', expiryTime.toString());
    formData.append(
      'link',
      `${window.location.origin}/voting/${currentEventId}`,
    );
    formData.append(
      'candidateImages',
      JSON.stringify(serializedCandidateImages),
    );

    try {
      const isEditing = !!editingEventId;
      const apiUrl = process.env.REACT_APP_API_URL;
      const token = localStorage.getItem('token');
      const url = isEditing
        ? `${apiUrl}/api/events/${editingEventId}`
        : `${apiUrl}/api/events`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to ${isEditing ? 'update' : 'create'} event: ${errorText}`,
        );
      }

      const result = await response.json();

      const eventDetails = {
        id: currentEventId,
        date: eventDate,
        startTime,
        stopTime,
        name: eventName,
        description: eventDescription,
        selectedData,
        fileData,
        expiry: expiryTime,
        link:
          result.link || `${window.location.origin}/voting/${currentEventId}`,
        candidateImages: serializedCandidateImages,
      };

      setActiveEvents((prev) => {
        let updatedEvents;
        if (isEditing) {
          updatedEvents = prev.map((event) =>
            event.id === currentEventId ? eventDetails : event,
          );
        } else {
          updatedEvents = [...prev, eventDetails];
        }
        return updatedEvents.sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.startTime}`);
          const dateB = new Date(`${b.date}T${b.startTime}`);
          return dateB - dateA;
        });
      });

      setGeneratedLink(result.link || eventDetails.link);
      setEventCreated(true);
      if (!editingEventId) {
        setAvailableCredits((prev) => Math.max(0, prev - 1));
      }
      fetchUserSubscription();
      resetForm();
    } catch (error) {
      console.error(
        `Error ${editingEventId ? 'updating' : 'creating'} event:`,
        error,
      );
      alert(
        error.message ||
          `Error ${editingEventId ? 'updating' : 'creating'} the event. Please try again.`,
      );
    }
  };

  return (
    <div className='work-shell'>
      <Sidebar setIsAuthenticated={setIsAuthenticated} />
      <main className='work-page'>
        <section className='work-hero work-hero--manage'>
          <div>
            <span className='work-kicker'>
              <FiCheckSquare /> Voting Management
            </span>
            <h1>Create and manage voting sessions.</h1>
            <p>
              Upload voter/candidate data, configure schedules, attach candidate
              images, and publish secure voting links.
            </p>
          </div>
          {/* <button
            className='work-button work-button--light'
            onClick={handleCreateEvent}
            disabled={availableCredits <= 0}
          >
            <FiPlus /> {availableCredits > 0 ? 'Create Voting' : 'Buy Credits'}
          </button> */}
        </section>

        <section className='work-stats-grid'>
          <div className='work-stat-card'>
            <FiCalendar />
            <span>Events</span>
            <strong>{activeEvents.length}</strong>
          </div>
          <div className='work-stat-card'>
            <FiCreditCard />
            <span>Available Credits</span>
            <strong>{availableCredits}</strong>
          </div>
        </section>
        {availableCredits <= 0 && (
          <div className='work-empty work-empty--error'>
            No voting credits are available. You cannot create a new voting
            event until you purchase credits.
          </div>
        )}
        {subscriptionMessage && (
          <div className='work-empty work-empty--error'>
            {subscriptionMessage}
          </div>
        )}

        <section className='work-manage-grid'>
          <div className='work-panel'>
            <div className='work-panel__header work-panel__header--row'>
              <div>
                <span className='work-kicker'>Configured</span>
                <h2>Voting Events</h2>
              </div>
              {/* <button
                className='work-button work-button--primary'
                onClick={handleCreateEvent}
                disabled={availableCredits <= 0}
              >
                <FiPlus /> {availableCredits > 0 ? 'New Voting' : 'Buy Credits'}
              </button> */}
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

          <div className='work-panel work-create-panel'>
            <div className='work-panel__header'>
              <span className='work-kicker'>Builder</span>
              <h2>{editingEventId ? 'Edit Voting' : 'Create Voting'}</h2>
              <p>
                Start a new voting configuration, then upload Excel data and
                select candidates.
              </p>
            </div>

            {!showEventForm ? (
              <div className='work-empty work-empty--action'>
                <FiPlus />
                <strong>No builder open</strong>
                <span>Create a new voting event or edit an existing one.</span>
                <button
                  className='work-button work-button--primary'
                  onClick={handleCreateEvent}
                >
                  Create Voting
                </button>
              </div>
            ) : (
              <form onSubmit={handleEventFormSubmit} className='work-form'>
                <div className='work-form-grid'>
                  <label className='work-field'>
                    <span>Voting Date</span>
                    <input
                      type='date'
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      required
                    />
                  </label>
                  <label className='work-field'>
                    <span>Start Time</span>
                    <input
                      type='time'
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </label>
                  <label className='work-field'>
                    <span>Stop Time</span>
                    <input
                      type='time'
                      value={stopTime}
                      onChange={(e) => setStopTime(e.target.value)}
                      required
                    />
                  </label>
                  <label className='work-field'>
                    <span>Voting Name</span>
                    <input
                      type='text'
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      required
                    />
                  </label>
                  <label className='work-field work-field--full'>
                    <span>Description</span>
                    <textarea
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      required
                    />
                  </label>
                </div>

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

                {fileData.length > 0 && (
                  <div className='work-table-wrap work-table-wrap--builder'>
                    <div className='work-panel__header'>
                      <span className='work-kicker'>Candidates</span>
                      <h2>Selected Candidates</h2>
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
                          const fileIndex = fileData.findIndex(
                            (fd) => JSON.stringify(fd) === JSON.stringify(data),
                          );
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
                                          candidateImages[fileIndex].url
                                            ? candidateImages[fileIndex].url
                                            : s3BucketUrl &&
                                                candidateImages[fileIndex].uuid
                                              ? `${s3BucketUrl}/${candidateImages[fileIndex].uuid}`
                                              : candidateImages[fileIndex]
                                                  .cdnUrl
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
                    {editingEventId
                      ? 'Update Voting Event'
                      : 'Create Voting Event'}
                  </button>
                </div>
              </form>
            )}

            {eventCreated && (
              <div className='work-success-box'>
                <h3>
                  Voting {editingEventId ? 'Updated' : 'Created'} Successfully
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
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
