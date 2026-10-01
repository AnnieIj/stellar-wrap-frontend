/**
 * Branded responsive HTML email template renderer.
 *
 * Produces a self-contained HTML email that:
 *   - Works across major email clients (table-based layout)
 *   - Includes a CTA button deep-linking to the user's wrap
 *   - Contains a one-click unsubscribe link (CAN-SPAM / GDPR)
 *   - Shows the physical mailing address in the footer (CAN-SPAM §5)
 */

import type { EmailTemplateData } from "@/app/types/notifications";

/**
 * Escapes characters that have special meaning in HTML to prevent
 * accidental injection when interpolating user-supplied strings.
 */
function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Renders a branded responsive HTML email for the given {@link EmailTemplateData}.
 *
 * @returns A complete HTML document string suitable for sending as an email body.
 */
export function renderEmailTemplate(data: EmailTemplateData): string {
  const { periodLabel, ctaUrl, unsubscribeUrl, physicalAddress } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Your ${escHtml(periodLabel)} Stellar Wrapped is ready!</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #0a0a1a; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .hero-title { font-size: 28px !important; }
      .cta-button { padding: 14px 28px !important; font-size: 15px !important; }
    }
  </style>
</head>
<body>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0a0a1a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">

        <!-- Main container -->
        <table class="container" role="presentation" border="0" cellpadding="0" cellspacing="0" width="600"
               style="background-color:#12122a; border-radius:16px; overflow:hidden; max-width:600px;">

          <!-- Header / hero -->
          <tr>
            <td align="center"
                style="padding: 48px 40px 32px; background: linear-gradient(135deg, #1a1a3e 0%, #2d1b69 100%);">
              <p style="margin:0 0 8px; font-family:Arial,sans-serif; font-size:14px; font-weight:600;
                         letter-spacing:2px; text-transform:uppercase; color:#a78bfa;">
                Stellar Wrapped
              </p>
              <h1 class="hero-title"
                  style="margin:0 0 16px; font-family:Arial,sans-serif; font-size:36px; font-weight:800;
                         line-height:1.2; color:#ffffff;">
                Your ${escHtml(periodLabel)} wrap<br />is ready! 🎉
              </h1>
              <p style="margin:0; font-family:Arial,sans-serif; font-size:17px; line-height:1.6; color:#c4b5fd;">
                See everything that happened in your Stellar activity this ${escHtml(periodLabel.toLowerCase())} — 
                your top dApps, transaction stats, and vibe check.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding: 40px 40px 32px;">
              <a class="cta-button" href="${escHtml(ctaUrl)}"
                 style="display:inline-block; padding:16px 40px; font-family:Arial,sans-serif;
                        font-size:16px; font-weight:700; text-decoration:none; color:#ffffff;
                        background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
                        border-radius:50px; letter-spacing:0.5px;">
                View My ${escHtml(periodLabel)} Wrap →
              </a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border:none; border-top:1px solid #2a2a4a; margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 28px 40px 40px;">
              <p style="margin:0 0 12px; font-family:Arial,sans-serif; font-size:13px;
                         line-height:1.6; color:#6b7280;">
                You are receiving this because you subscribed to ${escHtml(periodLabel.toLowerCase())} wrap
                notifications on Stellar Wrapped.
              </p>
              <p style="margin:0 0 16px; font-family:Arial,sans-serif; font-size:13px;
                         line-height:1.6; color:#6b7280;">
                <a href="${escHtml(unsubscribeUrl)}"
                   style="color:#a78bfa; text-decoration:underline;">
                  Unsubscribe from these notifications
                </a>
              </p>
              <p style="margin:0; font-family:Arial,sans-serif; font-size:12px;
                         line-height:1.6; color:#4b5563;">
                ${escHtml(physicalAddress)}
              </p>
            </td>
          </tr>

        </table>
        <!-- /Main container -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}
