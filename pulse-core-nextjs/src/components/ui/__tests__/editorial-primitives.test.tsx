/**
 * Tests for Claude-inspired editorial UI primitives.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { SectionHeader } from '../SectionHeader';
import { AnnouncementCard } from '../AnnouncementCard';

describe('SectionHeader', () => {
  it('renders title, eyebrow, description, and actions', () => {
    render(
      <SectionHeader
        eyebrow="Offline AI"
        title="Local clinical rules are active"
        description="Decision support runs on-device until connectivity returns."
        actions={<button>Review</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: /local clinical rules are active/i })).toBeInTheDocument();
    expect(screen.getByText(/offline ai/i)).toBeInTheDocument();
    expect(screen.getByText(/decision support runs on-device/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review/i })).toBeInTheDocument();
  });

  it('respects the `as` prop for heading level', () => {
    render(<SectionHeader title="Top-level section" as="h1" />);
    expect(screen.getByRole('heading', { level: 1, name: /top-level section/i })).toBeInTheDocument();
  });
});

describe('AnnouncementCard', () => {
  it('renders title, eyebrow, body, and action with status role', () => {
    render(
      <AnnouncementCard
        tone="ai-safety"
        eyebrow="Human review required"
        title="Offline AI suggestions are advisory"
        action={<a href="#review">Open review</a>}
      >
        Confirm every recommendation against your clinical judgment before acting.
      </AnnouncementCard>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/human review required/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /offline ai suggestions are advisory/i })).toBeInTheDocument();
    expect(screen.getByText(/confirm every recommendation/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open review/i })).toBeInTheDocument();
  });

  it('applies the requested ARIA role override', () => {
    render(
      <AnnouncementCard role="alert" tone="caution" title="Connectivity unstable" />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('omits the icon when explicitly disabled', () => {
    const { container } = render(
      <AnnouncementCard tone="info" title="No icon" icon={null} />,
    );
    expect(container.querySelectorAll('svg').length).toBe(0);
  });
});
