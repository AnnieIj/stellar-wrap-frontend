/**
 * @jest-environment node
 */
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('/api/og - locale support', () => {
  const baseUrl = 'http://localhost:3000';
  const baseParams = 'username=TestUser&transactions=100&persona=Network+Pioneer&topVibe=Steady&vibePercentage=75';

  it('should default to English when no locale is provided', async () => {
    const url = `${baseUrl}/api/og?${baseParams}`;
    const req = new NextRequest(url);
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
    expect(response.headers.get('Vary')).toBe('locale');
  });

  it('should accept English locale', async () => {
    const url = `${baseUrl}/api/og?${baseParams}&locale=en`;
    const req = new NextRequest(url);
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
  });

  it('should accept Spanish locale', async () => {
    const url = `${baseUrl}/api/og?${baseParams}&locale=es`;
    const req = new NextRequest(url);
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
  });

  it('should accept French locale', async () => {
    const url = `${baseUrl}/api/og?${baseParams}&locale=fr`;
    const req = new NextRequest(url);
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
  });

  it('should default to English for invalid locale', async () => {
    const url = `${baseUrl}/api/og?${baseParams}&locale=invalid`;
    const req = new NextRequest(url);
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
  });

  it('should normalize locale case', async () => {
    const url = `${baseUrl}/api/og?${baseParams}&locale=ES`;
    const req = new NextRequest(url);
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
  });

  it('should include Vary header for proper cache separation', async () => {
    const url = `${baseUrl}/api/og?${baseParams}&locale=fr`;
    const req = new NextRequest(url);
    const response = await GET(req);

    expect(response.headers.get('Vary')).toBe('locale');
    expect(response.headers.get('Cache-Control')).toContain('public');
  });

  it('should handle locale with whitespace', async () => {
    const url = `${baseUrl}/api/og?${baseParams}&locale=%20es%20`;
    const req = new NextRequest(url);
    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
  });
});
