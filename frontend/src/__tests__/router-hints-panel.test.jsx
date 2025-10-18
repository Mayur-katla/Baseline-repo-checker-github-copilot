import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RouterHintsPanel from '../components/router/RouterHintsPanel.jsx';

describe('RouterHintsPanel', () => {
  it('renders ranked frameworks, languages, and ml libraries', () => {
    const hints = {
      rankedFrameworks: [
        { name: 'Next.js', score: 5 },
        { name: 'Vue', score: 2 }
      ],
      rankedLanguages: [
        { name: 'TypeScript', score: 4 },
        { name: 'JavaScript', score: 3 }
      ],
      rankedMl: [
        { name: 'PyTorch', score: 3 },
        { name: 'TensorFlow', score: 2 }
      ],
      allowFrameworks: new Set(['Next.js']),
      allowLanguages: new Set(['TypeScript']),
      rationale: [{ label: 'deps', detail: 'next in package.json' }]
    };

    render(<RouterHintsPanel hints={hints} />);

    expect(screen.getByText('Detector Router Hints')).toBeInTheDocument();
    expect(screen.getByText(/Next.js/)).toBeInTheDocument();
    expect(screen.getByText(/Vue/)).toBeInTheDocument();
    expect(screen.getByText(/TypeScript/)).toBeInTheDocument();
    expect(screen.getByText(/JavaScript/)).toBeInTheDocument();
    expect(screen.getByText(/PyTorch/)).toBeInTheDocument();
    expect(screen.getByText(/TensorFlow/)).toBeInTheDocument();
    expect(screen.getByText(/next in package\.json/)).toBeInTheDocument();
  });
});