import React from 'react';

const Popup = ({
  title,
  message,
  visible,
  onClose,
  onConfirm,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  children,
  hideCancel,
}) => {
  if (!visible) return null;

  return (
    <div className='work-modal-overlay'>
      <div className='work-modal-card'>
        <button className='work-modal-close' onClick={onClose}>
          ×
        </button>
        <div className='work-panel__header'>{title && <h2>{title}</h2>}</div>
        <div style={{ padding: '12px 20px' }}>
          {message && <p style={{ marginBottom: 12 }}>{message}</p>}
          {children}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 20px 20px' }}>
          {!hideCancel && (
            <button
              className='work-button work-button--light'
              onClick={onClose}
            >
              {cancelLabel}
            </button>
          )}
          {onConfirm && (
            <button
              className='work-button work-button--primary'
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Popup;
