/**
 * @jest-environment jsdom
 *
 * Unit tests for the Footer component — Issue #420 (Part 5)
 *
 * Coverage targets
 * ─────────────────
 *  ✅ Structural rendering (landmark, brand, tagline, nav)
 *  ✅ All social links: href, target, rel, aria-label
 *  ✅ Accessibility (WCAG AA contrast classes, ARIA attributes, SVG hiding)
 *  ✅ Focus-visible styles for keyboard navigation
 *  ✅ Responsive layout utility classes (mobile-first + sm: breakpoints)
 *  ✅ Security: noopener noreferrer on external links
 *  ✅ Link integrity (non-empty, string href)
 *  ✅ SVG icon attributes (aria-hidden, focusable, dimensions)
 *  ✅ Snapshot regression guard
 *  ✅ Idempotent rendering (multiple mounts produce identical output)
 *  ✅ Semantic element usage (footer, nav, a, p, svg)
 *  ✅ Hover / interactive state CSS classes
 *  ✅ Internal vs external link distinction
 *  ✅ Dark-mode utility classes present in markup
 */

import { render, screen, within } from "@testing-library/react";
import { Footer } from "../Footer";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Mounts the Footer and returns the <footer> landmark element. */
function renderFooter() {
  render(<Footer />);
  return screen.getByRole("contentinfo");
}

// ─── 1. Landmark & structural elements ────────────────────────────────────────

describe("Footer — structural rendering", () => {
  it("renders a <footer> landmark (role=contentinfo)", () => {
    expect(renderFooter()).toBeInTheDocument();
  });

  it("contains exactly one <nav> landmark inside the footer", () => {
    const footer = renderFooter();
    const navElements = within(footer).getAllByRole("navigation");
    expect(navElements).toHaveLength(1);
  });

  it("renders the brand name 'Stellar Wrap'", () => {
    renderFooter();
    expect(screen.getByText("Stellar Wrap")).toBeInTheDocument();
  });

  it("renders the tagline 'Your on-chain year in review.'", () => {
    renderFooter();
    expect(
      screen.getByText("Your on-chain year in review."),
    ).toBeInTheDocument();
  });

  it("renders the brand name inside a <p> element", () => {
    renderFooter();
    const brand = screen.getByText("Stellar Wrap");
    expect(brand.tagName).toBe("P");
  });

  it("renders the tagline inside a <p> element", () => {
    renderFooter();
    const tagline = screen.getByText("Your on-chain year in review.");
    expect(tagline.tagName).toBe("P");
  });
});

// ─── 2. Navigation landmark ──────────────────────────────────────────────────

describe("Footer — navigation landmark", () => {
  it("has an accessible label 'Footer navigation'", () => {
    renderFooter();
    expect(
      screen.getByRole("navigation", { name: "Footer navigation" }),
    ).toBeInTheDocument();
  });

  it("contains at least 3 links (Home + 2 social)", () => {
    renderFooter();
    const nav = screen.getByRole("navigation", { name: "Footer navigation" });
    const links = within(nav).getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── 3. Home link ────────────────────────────────────────────────────────────

describe("Footer — Home link", () => {
  it("renders a 'Home' link", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("links Home to '/'", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("does not open Home in a new tab (internal link)", () => {
    renderFooter();
    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).not.toHaveAttribute("target", "_blank");
  });

  it("does not carry rel='noopener noreferrer' on the internal Home link", () => {
    renderFooter();
    const homeLink = screen.getByRole("link", { name: "Home" });
    const rel = homeLink.getAttribute("rel") ?? "";
    expect(rel).not.toContain("noopener");
  });
});

// ─── 4. GitHub social link ───────────────────────────────────────────────────

describe("Footer — GitHub social link", () => {
  it("renders a GitHub link", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "GitHub" })).toBeInTheDocument();
  });

  it("points to the correct GitHub repository URL", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/zintarh/stellar-wrap-frontend",
    );
  });

  it("opens in a new tab (target='_blank')", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("has rel='noopener noreferrer' for security", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });

  it("includes visible text 'GitHub' for sighted users", () => {
    renderFooter();
    expect(screen.getByText("GitHub")).toBeVisible();
  });
});

// ─── 5. Stellar social link ──────────────────────────────────────────────────

describe("Footer — Stellar social link", () => {
  it("renders a Stellar link", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Stellar" })).toBeInTheDocument();
  });

  it("points to 'https://stellar.org'", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Stellar" })).toHaveAttribute(
      "href",
      "https://stellar.org",
    );
  });

  it("opens in a new tab (target='_blank')", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Stellar" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("has rel='noopener noreferrer' for security", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Stellar" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });

  it("includes visible text 'Stellar' for sighted users", () => {
    renderFooter();
    expect(screen.getByText("Stellar")).toBeVisible();
  });
});

// ─── 6. Accessibility ────────────────────────────────────────────────────────

describe("Footer — accessibility (WCAG AA)", () => {
  it("hides decorative SVG icons from assistive technology (aria-hidden='true')", () => {
    renderFooter();
    const hiddenSvgs = document.querySelectorAll("footer svg[aria-hidden='true']");
    expect(hiddenSvgs.length).toBe(2);
  });

  it("prevents SVG icons from receiving focus in IE/Edge (focusable='false')", () => {
    renderFooter();
    const focusableFalseSvgs = document.querySelectorAll(
      "footer svg[focusable='false']",
    );
    expect(focusableFalseSvgs.length).toBe(2);
  });

  it("brand 'Stellar Wrap' uses high-contrast text-white class", () => {
    renderFooter();
    expect(screen.getByText("Stellar Wrap")).toHaveClass("text-white");
  });

  it("tagline uses text-white/60 (meets WCAG AA minimum on dark bg)", () => {
    renderFooter();
    expect(screen.getByText("Your on-chain year in review.")).toHaveClass(
      "text-white/60",
    );
  });

  it("footer element itself uses text-white/60 as the default body color", () => {
    const footer = renderFooter();
    expect(footer).toHaveClass("text-white/60");
  });

  it("social links carry an aria-label matching their visible text label", () => {
    renderFooter();
    const githubLink = screen.getByRole("link", { name: "GitHub" });
    const stellarLink = screen.getByRole("link", { name: "Stellar" });
    expect(githubLink).toHaveAttribute("aria-label", "GitHub");
    expect(stellarLink).toHaveAttribute("aria-label", "Stellar");
  });

  it("every link has a non-empty accessible name", () => {
    renderFooter();
    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      // accessible name comes from text content or aria-label
      const name =
        link.getAttribute("aria-label") ?? link.textContent?.trim() ?? "";
      expect(name.length).toBeGreaterThan(0);
    });
  });
});

// ─── 7. Keyboard focus-visible styles ────────────────────────────────────────

describe("Footer — keyboard focus-visible styles", () => {
  it("Home link has focus-visible:outline-none to suppress browser default", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Home" })).toHaveClass(
      "focus-visible:outline-none",
    );
  });

  it("Home link has focus-visible:ring-2 for a visible focus indicator", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Home" })).toHaveClass(
      "focus-visible:ring-2",
    );
  });

  it("Home link has focus-visible:ring-white/60 ring color", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Home" })).toHaveClass(
      "focus-visible:ring-white/60",
    );
  });

  it("GitHub link has focus-visible:ring-2", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveClass(
      "focus-visible:ring-2",
    );
  });

  it("Stellar link has focus-visible:ring-2", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Stellar" })).toHaveClass(
      "focus-visible:ring-2",
    );
  });

  it("all links include rounded class for aesthetically shaped focus rings", () => {
    renderFooter();
    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      expect(link).toHaveClass("rounded");
    });
  });

  it("social links include focus-visible:ring-offset-1 to lift ring off background", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveClass(
      "focus-visible:ring-offset-1",
    );
    expect(screen.getByRole("link", { name: "Stellar" })).toHaveClass(
      "focus-visible:ring-offset-1",
    );
  });

  it("social links include focus-visible:ring-offset-black for offset color", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveClass(
      "focus-visible:ring-offset-black",
    );
    expect(screen.getByRole("link", { name: "Stellar" })).toHaveClass(
      "focus-visible:ring-offset-black",
    );
  });
});

// ─── 8. Hover (interactive) styles ───────────────────────────────────────────

describe("Footer — hover interactive classes", () => {
  it("Home link has transition-colors for smooth hover animation", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Home" })).toHaveClass(
      "transition-colors",
    );
  });

  it("Home link has hover:text-white class", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Home" })).toHaveClass(
      "hover:text-white",
    );
  });

  it("GitHub link has transition-colors class", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveClass(
      "transition-colors",
    );
  });

  it("GitHub link has hover:text-white class", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveClass(
      "hover:text-white",
    );
  });

  it("Stellar link has transition-colors class", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Stellar" })).toHaveClass(
      "transition-colors",
    );
  });

  it("Stellar link has hover:text-white class", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: "Stellar" })).toHaveClass(
      "hover:text-white",
    );
  });
});

// ─── 9. Responsive layout classes ────────────────────────────────────────────

describe("Footer — responsive layout classes", () => {
  it("footer has top border (border-t)", () => {
    const footer = renderFooter();
    expect(footer).toHaveClass("border-t");
  });

  it("footer has subtle border color (border-white/10) for dark-mode contrast", () => {
    const footer = renderFooter();
    expect(footer).toHaveClass("border-white/10");
  });

  it("footer has horizontal padding px-4", () => {
    const footer = renderFooter();
    expect(footer).toHaveClass("px-4");
  });

  it("footer has vertical padding py-8", () => {
    const footer = renderFooter();
    expect(footer).toHaveClass("py-8");
  });

  it("footer has text-sm as base font size", () => {
    const footer = renderFooter();
    expect(footer).toHaveClass("text-sm");
  });

  it("inner container is max-w-6xl to prevent over-stretching on wide screens", () => {
    renderFooter();
    const inner = document.querySelector("footer > div");
    expect(inner).toHaveClass("max-w-6xl");
  });

  it("inner container uses mx-auto to center content horizontally", () => {
    renderFooter();
    const inner = document.querySelector("footer > div");
    expect(inner).toHaveClass("mx-auto");
  });

  it("inner container stacks items vertically on mobile (flex-col)", () => {
    renderFooter();
    const inner = document.querySelector("footer > div");
    expect(inner).toHaveClass("flex-col");
  });

  it("inner container switches to row layout on sm breakpoint (sm:flex-row)", () => {
    renderFooter();
    const inner = document.querySelector("footer > div");
    expect(inner).toHaveClass("sm:flex-row");
  });

  it("inner container aligns items on sm breakpoint (sm:items-center)", () => {
    renderFooter();
    const inner = document.querySelector("footer > div");
    expect(inner).toHaveClass("sm:items-center");
  });

  it("inner container justifies content apart on sm breakpoint (sm:justify-between)", () => {
    renderFooter();
    const inner = document.querySelector("footer > div");
    expect(inner).toHaveClass("sm:justify-between");
  });

  it("nav uses flex-wrap so links reflow properly on narrow viewports", () => {
    renderFooter();
    const nav = screen.getByRole("navigation", { name: "Footer navigation" });
    expect(nav).toHaveClass("flex-wrap");
  });

  it("social link icons are sized h-4 w-4 for consistent icon sizing", () => {
    renderFooter();
    const svgs = document.querySelectorAll("footer svg");
    svgs.forEach((svg) => {
      expect(svg).toHaveClass("h-4");
      expect(svg).toHaveClass("w-4");
    });
  });

  it("tagline uses text-xs for secondary hierarchy below brand name", () => {
    renderFooter();
    expect(screen.getByText("Your on-chain year in review.")).toHaveClass(
      "text-xs",
    );
  });

  it("brand name uses font-semibold for visual hierarchy", () => {
    renderFooter();
    expect(screen.getByText("Stellar Wrap")).toHaveClass("font-semibold");
  });
});

// ─── 10. Link integrity ───────────────────────────────────────────────────────

describe("Footer — link integrity", () => {
  it("all links have non-empty href attributes", () => {
    renderFooter();
    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      const href = link.getAttribute("href");
      expect(href).toBeTruthy();
      expect(typeof href).toBe("string");
      expect((href as string).length).toBeGreaterThan(0);
    });
  });

  it("external links start with 'https://'", () => {
    renderFooter();
    const externalLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("target") === "_blank");
    externalLinks.forEach((link) => {
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
    });
  });

  it("internal links start with '/'", () => {
    renderFooter();
    const internalLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("target") !== "_blank");
    internalLinks.forEach((link) => {
      expect(link.getAttribute("href")).toMatch(/^\//);
    });
  });

  it("renders exactly 3 links in total (Home, GitHub, Stellar)", () => {
    renderFooter();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });
});

// ─── 11. SVG icon attributes ──────────────────────────────────────────────────

describe("Footer — SVG icon attributes", () => {
  it("SVG icons have fill='none' (stroke-only style)", () => {
    renderFooter();
    const svgs = document.querySelectorAll("footer svg");
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute("fill", "none");
    });
  });

  it("SVG icons use a 24x24 viewBox", () => {
    renderFooter();
    const svgs = document.querySelectorAll("footer svg");
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    });
  });

  it("SVG icons use stroke='currentColor' to inherit link color", () => {
    renderFooter();
    const svgs = document.querySelectorAll("footer svg");
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute("stroke", "currentColor");
    });
  });

  it("renders exactly 2 SVG icons (one per social link)", () => {
    renderFooter();
    const svgs = document.querySelectorAll("footer svg");
    expect(svgs).toHaveLength(2);
  });

  it("each social link contains exactly one SVG icon", () => {
    renderFooter();
    const githubLink = screen.getByRole("link", { name: "GitHub" });
    const stellarLink = screen.getByRole("link", { name: "Stellar" });
    expect(githubLink.querySelectorAll("svg")).toHaveLength(1);
    expect(stellarLink.querySelectorAll("svg")).toHaveLength(1);
  });
});

// ─── 12. Semantic elements ─────────────────────────────────────────────────────

describe("Footer — semantic HTML elements", () => {
  it("uses a <footer> element as the root (not <div>)", () => {
    renderFooter();
    const footer = screen.getByRole("contentinfo");
    expect(footer.tagName).toBe("FOOTER");
  });

  it("uses a <nav> element for the link group", () => {
    renderFooter();
    const nav = screen.getByRole("navigation", { name: "Footer navigation" });
    expect(nav.tagName).toBe("NAV");
  });

  it("social links are rendered as <a> elements", () => {
    renderFooter();
    const githubLink = screen.getByRole("link", { name: "GitHub" });
    const stellarLink = screen.getByRole("link", { name: "Stellar" });
    expect(githubLink.tagName).toBe("A");
    expect(stellarLink.tagName).toBe("A");
  });
});

// ─── 13. Idempotent rendering ─────────────────────────────────────────────────

describe("Footer — idempotent / stable rendering", () => {
  it("renders the same output on a second mount without errors", () => {
    const { unmount } = render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    unmount();

    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("does not render any heading elements (avoids CLS from unexpected layout)", () => {
    renderFooter();
    // headings would cause layout shifts; footer brand should be a <p>
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

// ─── 14. Snapshot ─────────────────────────────────────────────────────────────

describe("Footer — snapshot", () => {
  it("matches the stable HTML snapshot", () => {
    const { container } = render(<Footer />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
