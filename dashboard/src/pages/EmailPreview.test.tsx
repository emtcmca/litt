import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmailPreview } from './EmailPreview';
import { makeBrief } from '../test/briefFixture';

vi.mock('../api', () => ({
  getBrief: vi.fn(),
}));

const api = await import('../api');

describe('EmailPreview', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders an accessible loading state before the closeout email appears', async () => {
    vi.mocked(api.getBrief).mockResolvedValue(makeBrief());

    render(<EmailPreview />);

    expect(screen.getByRole('status')).toHaveTextContent('Preparing daily closeout email preview');
    expect(await screen.findByRole('heading', { name: 'Litt / Strand & Okafor LLP' })).toBeInTheDocument();
  });

  it('renders a useful error state when the email preview cannot load', async () => {
    vi.mocked(api.getBrief).mockRejectedValue(new Error('Backend unavailable'));

    render(<EmailPreview />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend unavailable');
  });
});
