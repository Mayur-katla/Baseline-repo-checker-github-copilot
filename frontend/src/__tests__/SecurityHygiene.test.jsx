import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SecurityHygiene from '../components/scan-details/SecurityHygiene.jsx';

const makeData = () => ({
  insecureApiCalls: [],
  missingPolicies: [
    { title: 'Rate limiting missing in critical routes', severity: 'High', description: 'No rate limiting configured.' },
    { title: 'Permissive CORS configuration', severity: 'Medium', description: 'CORS allows all origins.' },
    { title: 'CSRF protection not enabled', severity: 'Low', description: 'Forms vulnerable to CSRF.' },
  ],
});

describe('SecurityHygiene panel', () => {
  it('renders issues and filters by severity toggles', () => {
    const data = makeData();
    const recommendations = ['Enable CSRF protection', 'Add rate limiting', 'Restrict CORS'];
    render(<SecurityHygiene data={data} recommendations={recommendations} />);

    // Initially, all severities on -> 3 issues with fix buttons
    let fixButtons = screen.getAllByRole('button', { name: /Show Fix Snippet/i });
    expect(fixButtons.length).toBe(3);

    // Disable Medium, should hide the medium issue
    const mediumToggle = screen.getByRole('button', { name: /Medium/ });
    fireEvent.click(mediumToggle);
    fixButtons = screen.getAllByRole('button', { name: /Show Fix Snippet/i });
    expect(fixButtons.length).toBe(2);

    // Disable Low, should leave only High
    const lowToggle = screen.getByRole('button', { name: /Low/ });
    fireEvent.click(lowToggle);
    fixButtons = screen.getAllByRole('button', { name: /Show Fix Snippet/i });
    expect(fixButtons.length).toBe(1);
  });

  it('shows fix snippet code for rate limiting', async () => {
    const data = makeData();
    render(<SecurityHygiene data={data} recommendations={[]} />);

    // Narrow to only High severity to target Rate limiting card
    fireEvent.click(screen.getByRole('button', { name: /Medium/ }));
    fireEvent.click(screen.getByRole('button', { name: /Low/ }));

    const showBtn = await screen.findByRole('button', { name: /Show Fix Snippet/i });
    fireEvent.click(showBtn);

    // Snippet should include express-rate-limit code (assert via limiter usage)
    expect(await screen.findByText(/app\.use\(limiter\);/)).toBeInTheDocument();
  });

  it('renders empty state when no issues or recommendations', () => {
    render(<SecurityHygiene data={{ insecureApiCalls: [], missingPolicies: [] }} recommendations={[]} />);
    expect(screen.getByText(/No security hygiene issues detected/i)).toBeInTheDocument();
  });

  it('renders severity badges on issue rows', () => {
    const data = makeData();
    render(<SecurityHygiene data={data} recommendations={[]} />);
    const badges = screen.getAllByTestId('severity-badge');
    expect(badges.length).toBe(3);
    expect(badges[0]).toHaveTextContent(/High/i);
    expect(badges[1]).toHaveTextContent(/Medium/i);
    expect(badges[2]).toHaveTextContent(/Low/i);
  });
});