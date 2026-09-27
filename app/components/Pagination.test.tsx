/**
 * Unit tests for Pagination component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  describe('Rendering', () => {
    it('should render pagination controls', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should render page numbers', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      expect(screen.getByRole('button', { name: /go to page 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to page 2/i })).toBeInTheDocument();
    });

    it('should show page info', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument();
    });

    it('should hide page numbers when showPageNumbers is false', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={handlePageChange}
          showPageNumbers={false}
        />
      );

      expect(screen.queryByRole('button', { name: /go to page 1/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={3}
          onPageChange={handlePageChange}
        />
      );

      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Pagination navigation');
    });

    it('should mark active page with aria-current', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      const activePage = screen.getByRole('button', { name: /go to page 2/i });
      expect(activePage).toHaveAttribute('aria-current', 'page');
    });

    it('should disable previous button on first page', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last page', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should have aria-disabled attribute', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should update aria-live region when page changes', async () => {
      const user = userEvent.setup();
      const handlePageChange = jest.fn();

      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      const pageStatus = screen.getByRole('status');
      expect(pageStatus).toHaveAttribute('aria-live', 'polite');

      const page2Button = screen.getByRole('button', { name: /go to page 2/i });
      await user.click(page2Button);

      expect(handlePageChange).toHaveBeenCalledWith(2);
    });
  });

  describe('Interactions', () => {
    it('should call onPageChange when next button is clicked', async () => {
      const user = userEvent.setup();
      const handlePageChange = jest.fn();

      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      expect(handlePageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageChange when prev button is clicked', async () => {
      const user = userEvent.setup();
      const handlePageChange = jest.fn();

      render(
        <Pagination
          currentPage={3}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous/i });
      await user.click(prevButton);

      expect(handlePageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageChange when page number is clicked', async () => {
      const user = userEvent.setup();
      const handlePageChange = jest.fn();

      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      const page3Button = screen.getByRole('button', { name: /go to page 3/i });
      await user.click(page3Button);

      expect(handlePageChange).toHaveBeenCalledWith(3);
    });

    it('should not call onPageChange when already on that page', async () => {
      const user = userEvent.setup();
      const handlePageChange = jest.fn();

      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      const page2Button = screen.getByRole('button', { name: /go to page 2/i });
      await user.click(page2Button);

      expect(handlePageChange).not.toHaveBeenCalled();
    });

    it('should not allow navigation when loading', async () => {
      const user = userEvent.setup();
      const handlePageChange = jest.fn();

      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={handlePageChange}
          isLoading={true}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);

      expect(handlePageChange).not.toHaveBeenCalled();
    });
  });

  describe('Page Range Calculation', () => {
    it('should show ellipsis for large page counts', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={20}
          onPageChange={handlePageChange}
          maxPageButtons={5}
        />
      );

      // Should show ellipsis before and after range
      const ellipses = screen.getAllByText('…');
      expect(ellipses.length).toBeGreaterThan(0);
    });

    it('should handle single page', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={1}
          onPageChange={handlePageChange}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should center current page in visible range', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={10}
          totalPages={20}
          onPageChange={handlePageChange}
          maxPageButtons={5}
        />
      );

      expect(screen.getByRole('button', { name: /go to page 10/i })).toBeInTheDocument();
      // Should show pages around 10
      expect(screen.queryByRole('button', { name: /go to page 1/i })).not.toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should render with custom className', () => {
      const handlePageChange = jest.fn();
      const { container } = render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={handlePageChange}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should respect maxPageButtons prop', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={20}
          onPageChange={handlePageChange}
          maxPageButtons={3}
        />
      );

      // Should show at most 3 pages plus ellipsis
      const pageButtons = screen.getAllByRole('button', { name: /go to page/i });
      expect(pageButtons.length).toBeLessThanOrEqual(5); // 3 pages + 2 arrows
    });
  });

  describe('Dark Mode', () => {
    it('should apply dark mode classes', () => {
      const handlePageChange = jest.fn();
      const { container } = render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('dark:bg-gray-800');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero total pages', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={0}
          onPageChange={handlePageChange}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should handle negative page numbers gracefully', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={-1}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      // Should render without error
      expect(screen.getByText(/page -1 of 5/i)).toBeInTheDocument();
    });

    it('should handle current page > total pages', () => {
      const handlePageChange = jest.fn();
      render(
        <Pagination
          currentPage={10}
          totalPages={5}
          onPageChange={handlePageChange}
        />
      );

      // Should still render
      expect(screen.getByText(/page 10 of 5/i)).toBeInTheDocument();
    });
  });
});
