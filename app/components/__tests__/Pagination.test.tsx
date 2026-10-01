/**
 * @jest-environment jsdom
 *
 * Comprehensive unit tests for the Pagination component.
 *
 * Covers rendering, accessibility attributes, page navigation callbacks,
 * disabled/loading states, and edge cases (zero pages, out-of-range current
 * page, single page, custom labels, ellipsis collapsing).
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination, buildPageItems } from "../Pagination";

describe("Pagination", () => {
  let onChange: jest.Mock;

  beforeEach(() => {
    onChange = jest.fn();
  });

  describe("rendering and structure", () => {
    it("renders a navigation region with the default aria-label", () => {
      render(
        <Pagination currentPage={2} totalPages={5} onPageChange={onChange} />,
      );
      const nav = screen.getByRole("navigation", { name: "Pagination" });
      expect(nav).toBeInTheDocument();
    });

    it("uses a custom aria-label when provided", () => {
      render(
        <Pagination
          currentPage={1}
          totalPages={3}
          onPageChange={onChange}
          ariaLabel="Wrap history"
        />,
      );
      expect(
        screen.getByRole("navigation", { name: "Wrap history" }),
      ).toBeInTheDocument();
    });

    it("renders numbered page buttons for a small page count", () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={onChange} />,
      );
      expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Page 5" })).toBeInTheDocument();
    });

    it("marks the current page button with aria-current=page", () => {
      render(
        <Pagination currentPage={3} totalPages={5} onPageChange={onChange} />,
      );
      const current = screen.getByRole("button", { name: "Page 3" });
      expect(current).toHaveAttribute("aria-current", "page");
    });

    it("does not mark non-current pages with aria-current", () => {
      render(
        <Pagination currentPage={3} totalPages={5} onPageChange={onChange} />,
      );
      const other = screen.getByRole("button", { name: "Page 4" });
      expect(other).not.toHaveAttribute("aria-current");
    });

    it("renders first and last shortcut buttons by default", () => {
      render(
        <Pagination currentPage={2} totalPages={5} onPageChange={onChange} />,
      );
      expect(
        screen.getByRole("button", { name: "Go to first page" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Go to last page" }),
      ).toBeInTheDocument();
    });

    it("hides first and last buttons when showFirstLast is false", () => {
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          onPageChange={onChange}
          showFirstLast={false}
        />,
      );
      expect(
        screen.queryByRole("button", { name: "Go to first page" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Go to last page" }),
      ).not.toBeInTheDocument();
    });

    it("announces the current page via a polite live region", () => {
      render(
        <Pagination currentPage={2} totalPages={5} onPageChange={onChange} />,
      );
      expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
    });

    it("marks decorative chevron icons as aria-hidden", () => {
      const { container } = render(
        <Pagination currentPage={2} totalPages={5} onPageChange={onChange} />,
      );
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
      for (const svg of Array.from(svgs)) {
        expect(svg.getAttribute("aria-hidden")).toBe("true");
      }
    });
  });

  describe("ellipsis collapsing", () => {
    it("renders ellipsis separators for a large page count", () => {
      render(
        <Pagination currentPage={5} totalPages={50} onPageChange={onChange} />,
      );
      // With siblingCount=1 and boundaryCount=1, a 50-page range collapses.
      expect(screen.getAllByTestId("pagination-ellipsis").length).toBeGreaterThan(0);
    });

    it("does not render ellipsis when every page fits", () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={onChange} />,
      );
      expect(screen.queryByTestId("pagination-ellipsis")).not.toBeInTheDocument();
    });

    it("buildPageItems returns empty array for zero pages", () => {
      expect(buildPageItems(1, 0)).toEqual([]);
    });
  });

  describe("page navigation callbacks", () => {
    it("calls onPageChange when a numbered page is clicked", () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={onChange} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
      expect(onChange).toHaveBeenCalledWith(3);
    });

    it("calls onPageChange with currentPage - 1 for previous", () => {
      render(
        <Pagination currentPage={3} totalPages={5} onPageChange={onChange} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
      expect(onChange).toHaveBeenCalledWith(2);
    });

    it("calls onPageChange with currentPage + 1 for next", () => {
      render(
        <Pagination currentPage={3} totalPages={5} onPageChange={onChange} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Next page" }));
      expect(onChange).toHaveBeenCalledWith(4);
    });

    it("calls onPageChange with 1 for first", () => {
      render(
        <Pagination currentPage={4} totalPages={5} onPageChange={onChange} />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Go to first page" }),
      );
      expect(onChange).toHaveBeenCalledWith(1);
    });

    it("calls onPageChange with totalPages for last", () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={onChange} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Go to last page" }));
      expect(onChange).toHaveBeenCalledWith(5);
    });

    it("uses custom prev/next labels when provided", () => {
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          onPageChange={onChange}
          prevLabel="Back"
          nextLabel="Forward"
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(onChange).toHaveBeenCalledWith(1);
      fireEvent.click(screen.getByRole("button", { name: "Forward" }));
      expect(onChange).toHaveBeenCalledWith(3);
    });

    it("does not call onPageChange when the current page is clicked", () => {
      render(
        <Pagination currentPage={2} totalPages={5} onPageChange={onChange} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("disabled states", () => {
    it("disables previous and first buttons on the first page", () => {
      render(
        <Pagination currentPage={1} totalPages={5} onPageChange={onChange} />,
      );
      expect(
        screen.getByRole("button", { name: "Previous page" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Go to first page" }),
      ).toBeDisabled();
    });

    it("disables next and last buttons on the last page", () => {
      render(
        <Pagination currentPage={5} totalPages={5} onPageChange={onChange} />,
      );
      expect(
        screen.getByRole("button", { name: "Next page" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Go to last page" }),
      ).toBeDisabled();
    });

    it("enables previous and next buttons in the middle", () => {
      render(
        <Pagination currentPage={3} totalPages={5} onPageChange={onChange} />,
      );
      expect(
        screen.getByRole("button", { name: "Previous page" }),
      ).not.toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Next page" }),
      ).not.toBeDisabled();
    });

    it("disables all interactive buttons when disabled prop is true", () => {
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          onPageChange={onChange}
          disabled={true}
        />,
      );
      screen
        .getAllByRole("button")
        .forEach((button) => expect(button).toBeDisabled());
    });

    it("does not call onPageChange when a disabled page button is clicked", () => {
      render(
        <Pagination
          currentPage={1}
          totalPages={5}
          onPageChange={onChange}
          disabled={true}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("renders a loading indicator in place of the current page number", () => {
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          onPageChange={onChange}
          isLoading={true}
        />,
      );
      expect(screen.getByTestId("pagination-loading")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Page 2" }),
      ).not.toBeInTheDocument();
    });

    it("disables navigation buttons while loading", () => {
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          onPageChange={onChange}
          isLoading={true}
        />,
      );
      screen
        .getAllByRole("button")
        .forEach((button) => expect(button).toBeDisabled());
    });

    it("does not navigate while loading", () => {
      render(
        <Pagination
          currentPage={2}
          totalPages={5}
          onPageChange={onChange}
          isLoading={true}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Page 4" }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("handles totalPages of zero gracefully", () => {
      render(
        <Pagination currentPage={1} totalPages={0} onPageChange={onChange} />,
      );
      expect(screen.getByRole("navigation")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Page 1" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Next page" }),
      ).toBeDisabled();
      expect(screen.getByText("Page 1 of 0")).toBeInTheDocument();
    });

    it("clamps currentPage above totalPages to the last page", () => {
      render(
        <Pagination currentPage={9} totalPages={4} onPageChange={onChange} />,
      );
      expect(
        screen.getByRole("button", { name: "Page 4" }),
      ).toHaveAttribute("aria-current", "page");
      expect(screen.getByText("Page 4 of 4")).toBeInTheDocument();
    });

    it("clamps currentPage below 1 to the first page", () => {
      render(
        <Pagination currentPage={0} totalPages={4} onPageChange={onChange} />,
      );
      expect(
        screen.getByRole("button", { name: "Page 1" }),
      ).toHaveAttribute("aria-current", "page");
    });

    it("handles a single-page range", () => {
      render(
        <Pagination currentPage={1} totalPages={1} onPageChange={onChange} />,
      );
      expect(
        screen.getByRole("button", { name: "Page 1" }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        screen.getByRole("button", { name: "Previous page" }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
      expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    });

    it("respects a boundaryCount of zero", () => {
      render(
        <Pagination
          currentPage={5}
          totalPages={20}
          onPageChange={onChange}
          boundaryCount={0}
        />,
      );
      // First boundary page (1) is not rendered with boundaryCount 0 and a
      // large enough range; ellipsis appears near the start instead.
      const ellipses = screen.getAllByTestId("pagination-ellipsis");
      expect(ellipses.length).toBeGreaterThan(0);
    });

    it("respects a siblingCount of zero", () => {
      render(
        <Pagination
          currentPage={5}
          totalPages={20}
          onPageChange={onChange}
          siblingCount={0}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Page 5" }),
      ).toHaveAttribute("aria-current", "page");
    });
  });
});
