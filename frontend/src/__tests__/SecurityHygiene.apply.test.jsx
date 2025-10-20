import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios client used by applyScanChanges
vi.mock('../api/client.js', () => {
  const post = vi.fn();
  return { default: { post } };
});
import client from '../api/client.js';

import SecurityHygiene from '../components/scan-details/SecurityHygiene.jsx';

const makeData = () => ({
  insecureApiCalls: [],
  missingPolicies: [
    { title: 'Rate limiting missing in critical routes', severity: 'High', description: 'No rate limiting configured.' },
  ],
});

describe('SecurityHygiene Apply CTA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues apply job and shows success feedback', async () => {
    client.post.mockResolvedValueOnce({ status: 200, data: { jobId: 'job-1' } });

    const data = makeData();
    const scanId = 'scan-777';
    render(<SecurityHygiene data={data} recommendations={[]} scanId={scanId} />);

    const showBtn = await screen.findByRole('button', { name: /Show Fix Snippet/i });
    fireEvent.click(showBtn);

    const applyBtn = await screen.findByRole('button', { name: /Apply in server/i });
    fireEvent.click(applyBtn);

    await waitFor(() => expect(screen.getByText(/Apply job queued/i)).toBeInTheDocument());
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith(`/scans/${scanId}/apply`, expect.objectContaining({ changes: expect.objectContaining({ type: 'security_hygiene' }) }));
  });

  it('shows error feedback when apply fails', async () => {
    client.post.mockRejectedValueOnce(new Error('Network fail'));

    const data = makeData();
    const scanId = 'scan-888';
    render(<SecurityHygiene data={data} recommendations={[]} scanId={scanId} />);

    const showBtn = await screen.findByRole('button', { name: /Show Fix Snippet/i });
    fireEvent.click(showBtn);

    const applyBtn = await screen.findByRole('button', { name: /Apply in server/i });
    fireEvent.click(applyBtn);

    await waitFor(() => expect(screen.getByText(/Network fail/i)).toBeInTheDocument());
    expect(client.post).toHaveBeenCalledTimes(1);
  });
});