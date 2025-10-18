import { Snackbar, Alert } from '@mui/material';
import React, { useEffect, useState } from 'react';

// Simple global toast via window events
export function showToast({ message, severity = 'info', autoHideDuration = 3000 }) {
  const detail = { message, severity, autoHideDuration };
  window.dispatchEvent(new CustomEvent('baseline:toast', { detail }));
}

export function ToastHost() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', severity: 'info', autoHideDuration: 3000 });

  useEffect(() => {
    const handler = (e) => {
      const { message, severity, autoHideDuration } = e.detail || {};
      setToast({ message, severity: severity || 'info', autoHideDuration: autoHideDuration || 3000 });
      setOpen(true);
    };
    window.addEventListener('baseline:toast', handler);
    return () => window.removeEventListener('baseline:toast', handler);
  }, []);

  return (
    <Snackbar open={open} autoHideDuration={toast.autoHideDuration} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert onClose={() => setOpen(false)} severity={toast.severity} sx={{ width: '100%' }}>
        {toast.message}
      </Alert>
    </Snackbar>
  );
}

export default showToast;