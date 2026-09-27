import React from 'react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider } from '../../context/ThemeContext';
import { SettingsForm } from '../SettingsForm';

describe('SettingsForm', () => {
  it('renders accessible theme and preference controls', () => {
    const html = renderToString(
      <ThemeProvider>
        <SettingsForm />
      </ThemeProvider>
    );

    expect(html).toContain('Appearance');
    expect(html).toContain('Dark mode');
    expect(html).toContain('Theme accent');
    expect(html).toContain('Save settings');
    expect(html).toContain('Reset');
  });
});
