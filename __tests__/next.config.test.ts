import { nextConfig } from '../next.config';

describe('next.config.ts', () => {
  it('defines the Permissions-Policy header with expected browser feature restrictions', async () => {
    expect(nextConfig.headers).toBeDefined();
    if (nextConfig.headers) {
      const headersConfig = await nextConfig.headers();
      expect(headersConfig).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: '/:path*',
            headers: expect.arrayContaining([
              {
                key: 'Permissions-Policy',
                value:
                  'camera=(), microphone=(), geolocation=(), usb=(), serial=(), payment=(), accelerometer=(), gyroscope=(), magnetometer=()',
              },
            ]),
          }),
        ])
      );
    }
  });
});
