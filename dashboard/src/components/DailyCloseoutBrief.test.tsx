import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyCloseoutBrief } from './DailyCloseoutBrief';
import { makeBrief } from '../test/briefFixture';

vi.mock('../api', () => ({
  getBrief: vi.fn(),
  runSweep: vi.fn(),
  resetDemo: vi.fn(),
  confirmDeadline: vi.fn(),
  extendDeadline: vi.fn(),
  dismissDeadline: vi.fn(),
  approveBilling: vi.fn(),
  writeDownBilling: vi.fn(),
  writeOffBilling: vi.fn(),
  dismissAlert: vi.fn(),
  updateNarrative: vi.fn(),
  getScrubber: vi.fn(),
  approveComm: vi.fn(),
  queueComm: vi.fn(),
  dismissComm: vi.fn(),
}));

const api = await import('../api');

describe('DailyCloseoutBrief', () => {
  beforeEach(() => {
    vi.mocked(api.getBrief).mockResolvedValue(makeBrief());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders one consistent decision count across the header and nav', async () => {
    render(<DailyCloseoutBrief />);

    const headerCount = await screen.findByText('5 decisions');
    const nav = screen.getByRole('navigation');

    expect(headerCount).toBeInTheDocument();
    expect(within(nav).getByText((_, element) => (
      element?.textContent === 'Decision docket5'
    ))).toBeInTheDocument();
  });

  it('does not expose the transparent confidence drawer while closed', async () => {
    render(<DailyCloseoutBrief />);

    await screen.findByText('Closeout docket');

    expect(screen.queryByRole('dialog', { name: /source reasoning/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log attorney decision' })).not.toBeInTheDocument();
  });

  it('opens deadline actions as an accessible modal and moves focus inside it', async () => {
    const user = userEvent.setup();
    render(<DailyCloseoutBrief />);

    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    const dialog = screen.getByRole('dialog', { name: 'Confirm deadline' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();

    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });
  });
});
