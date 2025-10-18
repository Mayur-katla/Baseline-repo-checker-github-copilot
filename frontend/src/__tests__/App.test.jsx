import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';

describe('App', () => {
  it('renders the main app', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );
    const header = screen.getByTestId('main-header');
    const heading = within(header).getByRole('heading', { level: 1 });
    const linkElement = within(heading).getByText(/Baseline Autopilot/i);
    expect(linkElement).toBeInTheDocument();
  });
});