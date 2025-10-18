import React from 'react';
import { Alert, Button, Box, Typography } from '@mui/material';
import { showToast } from '../hooks/useToast.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('UI ErrorBoundary caught an error:', error, info);
    showToast({ message: 'Unexpected error occurred in UI', severity: 'error' });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    try {
      window.location.reload();
    } catch (_) {}
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ m: 2 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Something went wrong
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Please try reloading the page. If the problem persists, check the console.
            </Typography>
          </Alert>
          <Button variant="contained" onClick={this.handleReload}>Reload</Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;