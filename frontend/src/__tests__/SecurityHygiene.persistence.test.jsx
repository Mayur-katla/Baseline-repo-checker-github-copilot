import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SecurityHygiene from '../components/scan-details/SecurityHygiene.jsx';

const sampleData = {
  missingPolicies: [
    { title: 'Rate limiting not configured', description: 'Configure request rate limiting with express-rate-limit.', severity: 'High' },
  ],
  insecureApiCalls: [],
};

describe('SecurityHygiene applied persistence', () => {
  it('persists Applied? checkbox state per scanId via localStorage', async () => {
    const user = userEvent.setup();
    const scanIdA = 'scan-123';
    const scanIdB = 'scan-456';

    const { rerender } = render(<SecurityHygiene data={sampleData} recommendations={[]} scanId={scanIdA} />);

    const appliedToggleA = await screen.findByTestId('applied-toggle-0');
    expect(appliedToggleA).toBeInTheDocument();

    await user.click(appliedToggleA);
    expect(appliedToggleA).toBeChecked();

    // Re-render with same scanId should keep checked state
    rerender(<SecurityHygiene data={sampleData} recommendations={[]} scanId={scanIdA} />);
    const appliedToggleA2 = await screen.findByTestId('applied-toggle-0');
    expect(appliedToggleA2).toBeChecked();

    // Switch to a different scanId should have independent state (unchecked)
    rerender(<SecurityHygiene data={sampleData} recommendations={[]} scanId={scanIdB} />);
    const appliedToggleB = await screen.findByTestId('applied-toggle-0');
    expect(appliedToggleB).not.toBeChecked();
  });

  it('shows severity counts next to filter controls', async () => {
    render(<SecurityHygiene data={sampleData} recommendations={[]} scanId={'any'} />);
    expect(await screen.findByText(/High \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Medium \(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/Low \(0\)/)).toBeInTheDocument();
  });
});