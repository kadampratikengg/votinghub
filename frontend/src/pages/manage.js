import React, { useState, useEffect, useMemo } from 'react';
import './Workspace.css';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './Sidebar';
import Popup from '../components/Popup';
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
  const [ballots, setBallots] = useState([]);
  const [activeBallotId, setActiveBallotId] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [eventCreated, setEventCreated] = useState(false);
  const [activeEvents, setActiveEvents] = useState([]);
  const [editingEventId, setEditingEventId] = useState(null);
  const [candidateImages, setCandidateImages] = useState({});
  const [eventId, setEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bufferLoadingId, setBufferLoadingId] = useState(null);
  const [candidateSelectionError, setCandidateSelectionError] = useState('');
  const [availableCredits, setAvailableCredits] = useState(0);
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'admin';

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

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');

  const isSuperAdmin = role === 'admin';
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
                key: image.key || image.uuid || '',
                url: image.url || image.cdnUrl || '',
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
            (!image.key && !image.uuid && !image.url && !image.cdnUrl)
          )
            return null;
          return {
            candidateIndex: rowIndex,
            fileRowIndex: rowIndex,
            selectedIndex,
            key: image.key || image.uuid || null,
            url: image.url || image.cdnUrl || null,
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

  const loadBallotIntoForm = (ballot) => {
    const normalized = normalizeBallotForForm(ballot);
    setActiveBallotId(normalized.ballotId);
    setEventName(normalized.name);
    setEventDescription(normalized.description);
    setCheckedRows(normalized.checkedRows);
    setSelectedData(normalized.selectedData);
    setCandidateImages(normalized.candidateImages);
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
                  key: image.key || image.uuid || '',
                  url: image.url || image.cdnUrl || '',
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

  const handleConfirmAddBuffer = async (eventId) => {
    if (bufferLoadingId === eventId) {
      // prevent opening another confirm while request in-flight
      alert('Buffer add already in progress for this event. Please wait.');
      return;
    }

    setPopup({
      visible: true,
      title: 'Add Buffer Time',
      message:
        'Are you sure you want to add 15 minutes buffer time? Please ensure you have sufficient permission to add buffer time.',
      onConfirm: async () => {
        setPopup((p) => ({ ...p, visible: false }));
        await handleAddBufferTime(eventId);
      },
      confirmLabel: 'Add Buffer',
      cancelLabel: 'Cancel',
      hideCancel: false,
    });
  };

  const apiUrl = process.env.REACT_APP_API_URL;
  const s3BucketUrl = process.env.REACT_APP_S3_BUCKET_URL;

  // (removed unused) previously used helper to check same-day past stop time

  // Show Add Buffer Time button only within 1 hour before the current voting end time
  const shouldShowAddBufferButton = (event) => {
    try {
      const now = new Date();
      const effectiveEnd = event?.votingWindow?.effectiveEndDateTime
        ? new Date(event.votingWindow.effectiveEndDateTime)
        : event?.stopTime && event?.date
          ? new Date(`${event.date}T${event.stopTime}`)
          : null;
      if (!effectiveEnd || Number.isNaN(effectiveEnd.getTime())) return false;

      const oneHourBefore = new Date(effectiveEnd.getTime() - 60 * 60 * 1000);
      return now >= oneHourBefore && now < effectiveEnd;
    } catch (e) {
      return false;
    }
  };

  // Calculate time remaining until the current voting end time
  const getTimeRemaining = (event) => {
    try {
      const now = new Date();
      const effectiveEnd = event?.votingWindow?.effectiveEndDateTime
        ? new Date(event.votingWindow.effectiveEndDateTime)
        : event?.stopTime && event?.date
          ? new Date(`${event.date}T${event.stopTime}`)
          : null;
      if (!effectiveEnd || Number.isNaN(effectiveEnd.getTime())) return null;

      const diffMs = effectiveEnd.getTime() - now.getTime();
      if (diffMs <= 0) return null;

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        return `${hours}h ${minutes}m left`;
      }
      return `${minutes}m left`;
    } catch (e) {
      return null;
    }
  };

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
    setBallots([]);
    setActiveBallotId('');
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
      const nextImage = {
        key: res.key,
        url: res.proxyUrl ? `${apiUrl}${res.proxyUrl}` : res.url,
      };
      setCandidateImages((prevImages) => {
        const nextImages = {
          ...prevImages,
          [index]: nextImage,
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
          syncActiveBallot({ candidateImages: newImages });
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
        syncActiveBallot({ candidateImages: newImages });
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
      setPopup({
        visible: true,
        title: 'Cannot Edit Event',
        message: 'Event has already started and cannot be edited.',
        onConfirm: () => setPopup((p) => ({ ...p, visible: false })),
        hideCancel: true,
      });
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
      const loadedBallots =
        Array.isArray(eventToEdit.ballots) && eventToEdit.ballots.length > 0
          ? eventToEdit.ballots.map((ballot, index) =>
              normalizeBallotForForm({
                ballotId: ballot.ballotId || ballot.id || `ballot-${index + 1}`,
                name: ballot.name,
                description: ballot.description,
                selectedData: ballot.selectedData || [],
                candidateImages: (ballot.candidateImages || []).reduce(
                  (acc, image) => {
                    const imageIndex =
                      image.fileRowIndex ??
                      image.candidateIndex ??
                      image.selectedIndex;
                    if (imageIndex !== undefined && imageIndex !== null) {
                      acc[imageIndex] = image;
                    }
                    return acc;
                  },
                  {},
                ),
                checkedRows: (ballot.selectedData || [])
                  .map(
                    (candidate, selectedIndex) =>
                      candidate?.candidateRowIndex ?? selectedIndex,
                  )
                  .filter((rowIndex) => rowIndex !== null),
              }),
            )
          : [
              normalizeBallotForForm({
                ballotId: 'main',
                name: eventToEdit.name,
                description: eventToEdit.description,
                selectedData: eventToEdit.selectedData || [],
                candidateImages: (eventToEdit.candidateImages || []).reduce(
                  (acc, image) => {
                    const imageIndex =
                      image.fileRowIndex ??
                      image.candidateIndex ??
                      image.selectedIndex;
                    if (imageIndex !== undefined && imageIndex !== null) {
                      acc[imageIndex] = image;
                    }
                    return acc;
                  },
                  {},
                ),
                checkedRows: (eventToEdit.selectedData || []).map(
                  (_, index) => index,
                ),
              }),
            ];
      setBallots(loadedBallots);
      loadBallotIntoForm(loadedBallots[0]);
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
      const candidateSource =
        loadedBallots[0]?.selectedData?.length > 0
          ? loadedBallots[0].selectedData
          : eventToEdit.selectedData || [];
      candidateSource.forEach((candidate, index) => {
        const candidateImage = candidate?.candidateImage;
        const fileRowIndex =
          candidate?.candidateRowIndex ??
          candidate?.candidateSelectionIndex ??
          index;

        if (candidateImage?.key || candidateImage?.url) {
          images[fileRowIndex] = {
            key: candidateImage.key || '',
            url: candidateImage.url || '',
          };
        }
      });

      if (Object.keys(images).length === 0) {
        (eventToEdit.candidateImages || []).forEach((img) => {
          const fileRowIndex =
            img.fileRowIndex ?? img.candidateIndex ?? img.selectedIndex;
          images[fileRowIndex] = img.key
            ? { key: img.key, url: img.url }
            : img.uuid
              ? { uuid: img.uuid, cdnUrl: img.cdnUrl }
              : null;
        });
      }
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
        setCandidateImages({});
        const freshBallot = createBallotDraft();
        setBallots([freshBallot]);
        loadBallotIntoForm(freshBallot);
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
      const nextSelectedData = updatedCheckedRows
        .map((rowIndex, selectedIndex) => {
          const row = fileData[rowIndex];
          if (!row) return null;
          return {
            ...row,
            candidateImage: candidateImages[rowIndex]
              ? {
                  key:
                    candidateImages[rowIndex].key ||
                    candidateImages[rowIndex].uuid ||
                    '',
                  url:
                    candidateImages[rowIndex].url ||
                    candidateImages[rowIndex].cdnUrl ||
                    '',
                }
              : null,
            candidateRowIndex: rowIndex,
            candidateSelectionIndex: selectedIndex,
          };
        })
        .filter(Boolean);
      setSelectedData(nextSelectedData);
      syncActiveBallot({
        checkedRows: updatedCheckedRows,
        selectedData: nextSelectedData,
      });
      return updatedCheckedRows;
    });
  };

  // Removed unused `getCandidateImagePayload` function (was causing ESLint no-unused-vars in CI)

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
    const initialBallot = createBallotDraft();
    setBallots([initialBallot]);
    setShowEventForm(true);
    setEventId(newEventId);
    loadBallotIntoForm(initialBallot);
  };

  const handleAddBallot = () => {
    const currentSnapshot = {
      ballotId: activeBallotId || eventId || uuidv4(),
      name: eventName,
      description: eventDescription,
      checkedRows,
      selectedData,
      candidateImages,
    };
    const nextBallot = createBallotDraft();
    setBallots((prev) => {
      const updated = prev.map((ballot) =>
        ballot.ballotId === currentSnapshot.ballotId
          ? { ...ballot, ...currentSnapshot }
          : ballot,
      );
      return [...updated, nextBallot];
    });
    loadBallotIntoForm(nextBallot);
  };

  const handleSelectBallot = (ballotId) => {
    const currentSnapshot = {
      ballotId: activeBallotId,
      name: eventName,
      description: eventDescription,
      checkedRows,
      selectedData,
      candidateImages,
    };
    setBallots((prev) =>
      prev.map((ballot) =>
        ballot.ballotId === currentSnapshot.ballotId
          ? { ...ballot, ...currentSnapshot }
          : ballot,
      ),
    );
    const nextBallot = ballots.find((ballot) => ballot.ballotId === ballotId);
    if (nextBallot) {
      loadBallotIntoForm(nextBallot);
    }
  };

  const handleDeleteEvent = async (id) => {
    // Open delete-reason modal
    setDeleteTargetId(id);
    setDeleteReason('');
    setDeleteModalVisible(true);
  };

  const performDeleteEvent = async (id, reason) => {
    try {
      const trimmedReason = String(reason || '').trim();
      if (!trimmedReason) {
        setPopup({
          visible: true,
          title: 'Delete Reason Required',
          message: 'Please enter a delete reason before continuing.',
          onConfirm: () => setPopup((p) => ({ ...p, visible: false })),
          hideCancel: true,
        });
        return;
      }

      const apiUrl = process.env.REACT_APP_API_URL;
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/events/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: trimmedReason }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete event');
      }

      setActiveEvents((prevEvents) =>
        prevEvents.filter((event) => event.id !== id),
      );
      fetchUserSubscription();
      setDeleteModalVisible(false);
      setDeleteTargetId(null);
      setDeleteReason('');
    } catch (error) {
      console.error('Error deleting event:', error);
      setPopup({
        visible: true,
        title: 'Delete Failed',
        message:
          (error && error.message) ||
          'There was an error deleting the event. Please try again.',
        onConfirm: () => setPopup((p) => ({ ...p, visible: false })),
        hideCancel: true,
      });
    }
  };

  const handleAddBufferTime = async (targetEventId) => {
    const hours = 0;
    const minutes = 15;
    // mark this event as loading to prevent duplicate requests
    setBufferLoadingId(targetEventId);
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      const token = localStorage.getItem('token');
      const payload = { hours, minutes };

      const response = await fetch(
        `${apiUrl}/api/events/${targetEventId}/buffer-time`,
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
        console.error('Buffer time API error:', data);
        throw new Error(data.message || 'Failed to add buffer time');
      }

      setActiveEvents((prev) =>
        prev.map((event) =>
          event.id === targetEventId ? { ...event, ...data.event } : event,
        ),
      );

      // If the user currently has this event open in the builder (editing or creating),
      // update the form stop time so the selector reflects the new stop time returned by backend.
      const updatedEvent = data && data.event ? data.event : null;
      if (updatedEvent) {
        if (editingEventId === targetEventId || eventId === targetEventId) {
          if (updatedEvent.stopTime) setStopTime(updatedEvent.stopTime);
          if (updatedEvent.startTime) setStartTime(updatedEvent.startTime);
          if (updatedEvent.date) setEventDate(updatedEvent.date);
        }
      }

      setPopup({
        visible: true,
        title: 'Buffer Added',
        message: 'Buffer time added successfully.',
        onConfirm: () => setPopup((p) => ({ ...p, visible: false })),
        hideCancel: true,
      });
    } catch (err) {
      console.error('Failed to add buffer time:', err);
      setPopup({
        visible: true,
        title: 'Buffer Add Failed',
        message: err.message || 'Failed to add buffer time.',
        onConfirm: () => setPopup((p) => ({ ...p, visible: false })),
        hideCancel: true,
      });
    } finally {
      setBufferLoadingId(null);
    }
  };

  const handleEventFormSubmit = async (e) => {
    e.preventDefault();
    const activeSnapshot = {
      ballotId: activeBallotId || eventId || uuidv4(),
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

    if (
      !primaryBallot.selectedData ||
      primaryBallot.selectedData.length === 0
    ) {
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
    if (
      !eventDate ||
      !stopTime ||
      !new Date(`${eventDate}T${stopTime}`).getTime()
    ) {
      missingFields.push('expiry');
    }
    if (!window.location.origin) missingFields.push('link');

    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    if (!editingEventId && availableCredits < ballotPayloads.length) {
      alert(
        `You need ${ballotPayloads.length} voting credits for ${ballotPayloads.length} voting posts.`,
      );
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

    const serializedCandidateImages = primaryBallot.candidateImages;
    const selectedCandidates = primaryBallot.selectedData;

    const formData = new FormData();
    formData.append('id', currentEventId);
    formData.append('date', eventDate);
    formData.append('startTime', startTime);
    formData.append('stopTime', stopTime);
    formData.append('name', primaryBallot.name);
    formData.append('description', primaryBallot.description);
    formData.append('selectedData', JSON.stringify(selectedCandidates));
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
    formData.append('ballots', JSON.stringify(ballotPayloads));

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
        name: primaryBallot.name,
        description: primaryBallot.description,
        selectedData: selectedCandidates,
        fileData,
        expiry: expiryTime,
        link:
          result.link || `${window.location.origin}/voting/${currentEventId}`,
        candidateImages: serializedCandidateImages,
        ballots: ballotPayloads,
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
        setAvailableCredits((prev) =>
          Math.max(0, prev - ballotPayloads.length),
        );
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
                      <button
                        className='work-button work-button--danger'
                        onClick={() => handleDeleteEvent(event.id)}
                      >
                        <FiTrash2 /> Delete
                      </button>
                      {isSuperAdmin && shouldShowAddBufferButton(event) && (
                        <button
                          type='button'
                          className='work-button work-button--accent'
                          onClick={() => handleConfirmAddBuffer(event.id)}
                          title='Add 15 minutes to voting time'
                          disabled={bufferLoadingId === event.id}
                        >
                          {bufferLoadingId === event.id
                            ? `Adding... (${getTimeRemaining(event) || ''})`
                            : `Add Buffer Time (${getTimeRemaining(event)})`}
                        </button>
                      )}
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

                <div
                  className='work-ballot-controls'
                  style={{
                    marginBottom: 16,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <label
                    className='work-field'
                    style={{ maxWidth: 420, flex: 1 }}
                  >
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
                  <div className='work-empty' style={{ marginBottom: 16 }}>
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
                      <h2>
                        Selected Candidates
                        {eventName ? ` for ${eventName}` : ''}
                      </h2>
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
        <Popup
          visible={popup.visible}
          title={popup.title}
          message={popup.message}
          onClose={() => setPopup((p) => ({ ...p, visible: false }))}
          onConfirm={popup.onConfirm}
          confirmLabel={popup.confirmLabel}
          cancelLabel={popup.cancelLabel}
          hideCancel={popup.hideCancel}
        >
          {popup.children}
        </Popup>

        <Popup
          visible={deleteModalVisible}
          title='Delete Voting Event'
          message={null}
          onClose={() => setDeleteModalVisible(false)}
          onConfirm={() => performDeleteEvent(deleteTargetId, deleteReason)}
          confirmLabel='Delete'
          cancelLabel='Cancel'
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label>
              Enter reason for deleting this voting event:
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={4}
                style={{ width: '100%', marginTop: 8 }}
              />
            </label>
          </div>
        </Popup>
      </main>
    </div>
  );
};

export default Dashboard;
