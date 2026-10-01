import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Footer from '../Footer';

describe('Footer', () => {
  it('renders the footer landmark', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders the copyright notice', () => {
    render(<Footer />);
    expect(
      screen.getByText(/©\s*\d{4}/)
    ).toBeInTheDocument();
  });

  it('renders navigation links with accessible names', () => {
    render(<Footer />);
    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link).toHaveAccessibleName();
    });
  });

  it('renders social links with accessible names', () => {
    render(<Footer />);
    const socialLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('target') === '_blank');
    socialLinks.forEach((link) => {
      expect(link).toHaveAccessibleName();
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });
  });

  it('handles link clicks without throwing', async () => {
    const user = userEvent.setup();
    render(<Footer />);
    const links = screen.getAllByRole('link');
    await user.click(links[0]);
    expect(links[0]).toBeInTheDocument();
  });

  it('supports keyboard focus on interactive elements', async () => {
    const user = userEvent.setup();
    render(<Footer />);
    const links = screen.getAllByRole('link');
    await user.tab();
    expect(links[0]).toHaveFocus();
  });
});
