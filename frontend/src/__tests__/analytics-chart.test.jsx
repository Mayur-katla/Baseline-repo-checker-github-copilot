import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock chart components to avoid Canvas dependencies in JSDOM
vi.mock('react-chartjs-2', () => ({
  Doughnut: () => <div data-testid="doughnut-chart" />,
  Bar: () => <div data-testid="bar-chart" />,
}));

import AnalyticsChart from '../components/scan-details/AnalyticsChart.jsx';

describe('AnalyticsChart component', () => {
  it('renders chart sections and feature lists', () => {
    const analytics = {
      counts: { supported: 3, partial: 1, unsupported: 2, suggested: 4 },
      supportedFeatures: ['fetch', 'async-await', 'TypeScript'],
      partialFeatures: ['AbortController'],
      unsupportedCode: ['XMLHttpRequest', 'document.write'],
      recommendations: ['Use AbortController to cancel in-flight fetch requests'],
    };

    render(<AnalyticsChart analytics={analytics} />);

    expect(screen.getByText(/Compatibility Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/Feature Details/i)).toBeInTheDocument();
    // Presence of mocked chart
    expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
    // Feature list headings
    expect(screen.getByText(/Supported Features/i)).toBeInTheDocument();
    expect(screen.getByText(/Partially Supported/i)).toBeInTheDocument();
    expect(screen.getByText(/Unsupported Code/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommendations/i)).toBeInTheDocument();
  });
});