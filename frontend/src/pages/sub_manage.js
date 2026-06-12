import React, { useState, useEffect } from 'react';
import './Workspace.css';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Sidebar from './Sidebar';
import {
  FiCalendar,
  FiCheckSquare,
  FiDownload,
  FiEdit3,
  FiExternalLink,
  FiFileText,
  FiImage,
  FiPlus,
  FiTrash2,
  FiTrendingUp,
  FiUploadCloud,
} from 'react-icons/fi';

const Manage = ({ setIsAuthenticated }) => {
  const [activeEvents, setActiveEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [role, setRole] = useState('main');
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [stopTime, setStopTime] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [fileData, setFileData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [candidateImages, setCandidateImages] = useState([]);
  const [checkedRows, setCheckedRows] = useState([]);
  const [eventCreated, setEventCreated] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [bufferForms, setBufferForms] = useState({});
  const [bufferPickerOpen, setBufferPickerOpen] = useState({});
  const navigate = useNavigate();
  const getLocalDateKey = (value = new Date()) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  };

  const isAfterStopSameDay = (event) => {
    try {
      const now = new Date();
      const eventDateKey = getLocalDateKey(event.date);
      const todayKey = getLocalDateKey(now);
      if (!eventDateKey || eventDateKey !== todayKey) return false;

      const originalEnd = event?.votingWindow?.originalEndDateTime
        ? new Date(event.votingWindow.originalEndDateTime)
        : event?.stopTime
          ? new Date(`${event.date}T${event.stopTime}`)
          : null;
      if (!originalEnd || Number.isNaN(originalEnd.getTime())) return false;

      return now > originalEnd;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setRole(decoded.role);
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }
  }, []);

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
        setActiveEvents(events);
      } catch (err) {
        setError('Failed to load events. Please try again later.');
        console.error('Error fetching events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveEvents();
    const interval = setInterval(fetchActiveEvents, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateEvent = () => {
    setShowEventForm(true);
    setEditingEventId(null);
    setEventDate('');
    setStartTime('');
    setStopTime('');
    setEventName('');
    setEventDescription('');
    setFileData([]);
    setFileName('');
    setCandidateImages([]);
    setCheckedRows([]);
    setEventCreated(false);
    setGeneratedLink('');
  };

  const handleEditEvent = async (eventId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const event = await response.json();
      if (!response.ok) {
        throw new Error(event.message || 'Failed to fetch event');
      }
      setEditingEventId(eventId);
      setEventDate(event.date);
      setStartTime(event.startTime);
      setStopTime(event.stopTime);
      setEventName(event.name);
      setEventDescription(event.description);
      setFileData(event.fileData || []);
      setFileName('Uploaded File');
      setCandidateImages(
        event.candidateImages?.map((img) => ({
          candidateIndex: img.candidateIndex,
          dataUrl: `${process.env.REACT_APP_API_URL}${img.imagePath}`,
        })) || [],
      );
      setCheckedRows(event.selectedData?.map((_, index) => index) || []);
      setShowEventForm(true);
      setEventCreated(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/events/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete event');
      }
      setActiveEvents(activeEvents.filter((event) => event.id !== eventId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddBufferTime = async (eventId) => {
    const form = bufferForms[eventId] || { time: '00:30' };
    const [hoursRaw = '0', minutesRaw = '0'] = String(
      form.time || '00:30',
    ).split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    try {
      const token = localStorage.getItem('token');
      if (minutes < 0 || minutes >= 60 || hours < 0) {
        setError('Please choose a valid buffer duration (0 <= minutes < 60)');
        return;
      }

      const payload = { hours, minutes };
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/events/${eventId}/buffer-time`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Failed to add buffer time');
      }

      setActiveEvents((prev) =>
        prev.map((event) =>
          event.id === eventId ? { ...event, ...data.event } : event,
        ),
      );
      setBufferPickerOpen((prev) => ({
        ...prev,
        [eventId]: false,
      }));
      alert('Buffer time added successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setFileData(data);
        setCheckedRows([]);
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleImageUpload = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setCandidateImages((prev) => {
          const newImages = [...prev];
          newImages[index] = {
            candidateIndex: index,
            file,
            dataUrl: evt.target.result,
          };
          return newImages;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = (index) => {
    setCandidateImages((prev) => {
      const newImages = [...prev];
      newImages[index] = null;
      return newImages;
    });
  };

  const handleCheckboxChange = (index) => {
    setCheckedRows((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const handleEventFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('date', eventDate);
      formData.append('startTime', startTime);
      formData.append('stopTime', stopTime);
      formData.append('name', eventName);
      formData.append('description', eventDescription);
      formData.append(
        'selectedData',
        JSON.stringify(fileData.filter((_, i) => checkedRows.includes(i))),
      );
      formData.append('fileData', JSON.stringify(fileData));
      formData.append('expiry', 60 * 60 * 24); // 24 hours
      const eventId = editingEventId || Date.now().toString();
      formData.append('id', eventId);
      formData.append('link', `${window.location.origin}/voting/${eventId}`);
      formData.append(
        'candidateImages',
        JSON.stringify(
          candidateImages
            .filter((img) => img)
            .map((img, i) => ({ candidateIndex: i })),
        ),
      );
      candidateImages
        .filter((img) => img && img.file)
        .forEach((img) => {
          formData.append('images', img.file);
        });

      const url = editingEventId
        ? `${process.env.REACT_APP_API_URL}/api/events/${editingEventId}`
        : `${process.env.REACT_APP_API_URL}/api/events`;
      const method = editingEventId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save event');
      }

      setEventCreated(true);
      setGeneratedLink(data.link);
      setShowEventForm(false);
      setActiveEvents((prev) =>
        editingEventId
          ? prev.map((event) =>
              event.id === editingEventId ? { ...event, ...data } : event,
            )
          : [...prev, data],
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleViewResults = (eventId) => {
    navigate(`/results/${eventId}`);
  };

  return (
    <div className='work-shell'>
      <Sidebar setIsAuthenticated={setIsAuthenticated} />
      <main className='work-page'>
        <section className='work-hero work-hero--manage'>
          <div>
            <span className='work-kicker'>
              <FiCheckSquare /> Sub-User Voting Management
            </span>
            <h1>Manage assigned voting events.</h1>
            <p>
              Review voting sessions, edit allowed events, upload candidate
              data, and open results from one focused view.
            </p>
          </div>
          {role === 'main' && (
            <button
              className='work-button work-button--light'
              onClick={handleCreateEvent}
            >
              <FiPlus /> Create Event
            </button>
          )}
        </section>

        {error && <div className='work-empty work-empty--error'>{error}</div>}

        <section className='work-stats-grid'>
          <div className='work-stat-card'>
            <FiCalendar />
            <span>Events</span>
            <strong>{activeEvents.length}</strong>
          </div>
          <div className='work-stat-card'>
            <FiFileText />
            <span>Excel Rows</span>
            <strong>{fileData.length}</strong>
          </div>
          <div className='work-stat-card'>
            <FiCheckSquare />
            <span>Selected</span>
            <strong>{checkedRows.length}</strong>
          </div>
        </section>

        <section className='work-manage-grid'>
          <div className='work-panel'>
            <div className='work-panel__header work-panel__header--row'>
              <div>
                <span className='work-kicker'>Assigned</span>
                <h2>All Voting Events</h2>
              </div>
              {role === 'main' && (
                <button
                  className='work-button work-button--primary'
                  onClick={handleCreateEvent}
                >
                  <FiPlus /> Create Event
                </button>
              )}
            </div>

            <div className='work-card-list'>
              {loading ? (
                <div className='work-empty'>Loading events...</div>
              ) : activeEvents.length === 0 ? (
                <div className='work-empty'>No voting events available.</div>
              ) : (
                activeEvents.map((event) => (
                  <article key={event.id} className='work-event-card'>
                    <span className='work-pill'>
                      <FiCalendar /> {event.date}
                    </span>
                    <h3>{event.name}</h3>
                    <p>{event.description}</p>
                    <div className='work-event-meta'>
                      <span>Start {event.startTime}</span>
                      <span>Stop {event.stopTime}</span>
                    </div>
                    <div className='work-event-status'>
                      <strong>
                        Status:{' '}
                        {event.votingWindow?.phase === 'before-start'
                          ? 'Voting has not started yet.'
                          : event.votingWindow?.phase === 'closed'
                            ? 'Voting time is over.'
                            : event.votingWindow?.phase === 'buffer'
                              ? 'Buffer period active.'
                              : 'Voting active.'}
                      </strong>
                      {event.votingWindow?.effectiveEndDateTime && (
                        <span>
                          Effective end:{' '}
                          {new Date(
                            event.votingWindow.effectiveEndDateTime,
                          ).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      )}
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
                      {role === 'main' && (
                        <>
                          <button
                            className='work-button work-button--danger'
                            onClick={() => handleDeleteEvent(event.id)}
                          >
                            <FiTrash2 /> Delete
                          </button>
                          {event.votingWindow?.phase === 'closed' && (
                            <button
                              type='button'
                              className='work-button work-button--accent'
                              onClick={() =>
                                setBufferPickerOpen((prev) => ({
                                  ...prev,
                                  [event.id]: !prev[event.id],
                                }))
                              }
                            >
                              Add Buffer Time
                            </button>
                          )}
                          <button
                            className='work-button work-button--accent'
                            onClick={() => handleEditEvent(event.id)}
                          >
                            <FiEdit3 /> Edit
                          </button>
                        </>
                      )}
                      <button
                        className='work-button work-button--primary'
                        onClick={() => handleViewResults(event.id)}
                      >
                        <FiTrendingUp /> Results
                      </button>
                      {role === 'main' &&
                        event.votingWindow?.phase === 'closed' &&
                        bufferPickerOpen[event.id] && (
                          <div className='work-buffer-controls'>
                            <label className='work-field'>
                              <span>Buffer Time</span>
                              <input
                                type='time'
                                value={bufferForms[event.id]?.time || '00:30'}
                                onChange={(e) =>
                                  setBufferForms((prev) => ({
                                    ...prev,
                                    [event.id]: {
                                      ...(prev[event.id] || { time: '00:30' }),
                                      time: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </label>
                            <button
                              type='button'
                              className='work-button work-button--primary'
                              onClick={() => handleAddBufferTime(event.id)}
                            >
                              Apply Buffer
                            </button>
                          </div>
                        )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          {role === 'main' && (
            <div className='work-panel work-create-panel'>
              <div className='work-panel__header'>
                <span className='work-kicker'>Builder</span>
                <h2>{editingEventId ? 'Edit Event' : 'Create Event'}</h2>
                <p>
                  Configure event timing, upload Excel data, and select
                  candidates for voting.
                </p>
              </div>

              {!showEventForm ? (
                <div className='work-empty work-empty--action'>
                  <FiPlus />
                  <strong>No builder open</strong>
                  <span>Create or edit an event to open the builder.</span>
                  <button
                    className='work-button work-button--primary'
                    onClick={handleCreateEvent}
                  >
                    Create Event
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEventFormSubmit} className='work-form'>
                  <div className='work-form-grid'>
                    <label className='work-field'>
                      <span>Event Date</span>
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
                      <span>Event Name</span>
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
                        <FiUploadCloud /> Upload Excel File
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
                      href='../file/AllDetailsFile.xlsx'
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      <FiDownload /> Download sample file
                    </a>
                  </div>

                  {fileData.length > 0 && (
                    <div className='work-table-wrap work-table-wrap--builder'>
                      <table className='work-table'>
                        <thead>
                          <tr>
                            {Object.keys(fileData[0]).map((key) => (
                              <th key={key}>{key}</th>
                            ))}
                            <th>Image</th>
                            <th>Select</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fileData.map((data, index) => (
                            <tr key={index}>
                              {Object.values(data).map((value, i) => (
                                <td key={i}>{value}</td>
                              ))}
                              <td>
                                <div className='work-image-upload-cell'>
                                  <input
                                    type='file'
                                    accept='image/*'
                                    onChange={(e) =>
                                      handleImageUpload(index, e)
                                    }
                                  />
                                  {candidateImages[index] && (
                                    <div className='work-image-preview'>
                                      <img
                                        src={candidateImages[index].dataUrl}
                                        alt={`Candidate ${index}`}
                                      />
                                      <button
                                        type='button'
                                        className='work-button work-button--danger work-button--small'
                                        onClick={() => handleClearImage(index)}
                                      >
                                        <FiImage /> Clear
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <input
                                  type='checkbox'
                                  checked={checkedRows.includes(index)}
                                  onChange={() => handleCheckboxChange(index)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <button
                    type='submit'
                    className='work-button work-button--primary work-button--full'
                  >
                    {editingEventId ? 'Update Event' : 'Create Event'}
                  </button>
                </form>
              )}

              {eventCreated && (
                <div className='work-success-box'>
                  <h3>
                    Event {editingEventId ? 'Updated' : 'Created'} Successfully
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
          )}
        </section>
      </main>
    </div>
  );
};

export default Manage;
