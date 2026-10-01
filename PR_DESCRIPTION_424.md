## Description

This PR completes the SettingsForm implementation for the frontend and brings the new UI in line with the project’s established design system, theming model, and accessibility expectations.

The work includes restoring the app shell so the global theme styling is applied correctly, creating a reusable responsive SettingsForm component, and validating the component in a way that matches the repo’s conventions.

### What was implemented
- Added a reusable `SettingsForm` component with a responsive layout for mobile, tablet, and desktop screens.
- Integrated the existing dark/light mode and accent color theming via the app’s centralized theme system.
- Applied project-standard styling patterns using theme variables and utility classes rather than inline styles.
- Added keyboard-friendly, accessible controls with proper labels, focus states, and clear enable/disable behavior.
- Included reset and save actions consistent with the product’s UI patterns.
- Restored the root app shell so `globals.css` is loaded and the theme provider stack is active, which fixes the missing visual styling issue.
- Added a focused test to validate the component renders the expected accessible controls.

## Type of Change

- [x] Bug fix
- [x] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [x] Tested locally
- [x] Added unit tests
- [ ] Tested on Stellar Testnet (for wallet/contract changes)

## Screenshots (if applicable)

N/A for this UI-only update.

## Related Issues

Closes #424
