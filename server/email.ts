/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export async function getMailTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  if (user && pass) {
    if (host.includes('gmail') || user.includes('@gmail.com')) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    }
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  return null;
}

export async function sendFitOutQuotationEmail(params: {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  projectScope: string;
  estimatedCost: number;
  estimatedWeeks: number;
  estimatorArea?: number;
  spaceType?: string;
  finishTier?: string;
  projectNotes?: string;
  quoteId: string;
}) {
  const {
    clientName, clientEmail, clientPhone, projectScope,
    estimatedCost, estimatedWeeks, estimatorArea,
    spaceType, finishTier, projectNotes, quoteId
  } = params;

  const senderFrom = `"CTVill Design & Construction" <${process.env.SMTP_USER || 'projectmanagementsytem@gmail.com'}>`;
  const formattedCost = estimatedCost ? `₱${Number(estimatedCost).toLocaleString()}` : 'Custom Estimate Pending';
  const formattedWeeks = estimatedWeeks ? `${estimatedWeeks} Weeks Estimated` : 'To be determined';

  const htmlContent = `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>CTVill Fit-Out Quotation Confirmation</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      
      <!-- Wrapper Table -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f1f5f9" style="background-color: #f1f5f9; padding: 24px 12px;">
        <tr>
          <td align="center">
            
            <!-- Email Container Card -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              
              <!-- Header Banner -->
              <tr>
                <td align="center" bgcolor="#0f172a" style="background-color: #0f172a; padding: 32px 24px; border-bottom: 4px solid #f59e0b;">
                  <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase;">
                    CTVill Design &amp; Construction
                  </h1>
                  <p style="margin: 6px 0 0 0; color: #cbd5e1; font-size: 13px; font-weight: 500;">
                    Turnkey Commercial Fit-Out &amp; Engineering Contractors
                  </p>
                </td>
              </tr>

              <!-- Main Content Body -->
              <tr>
                <td style="padding: 32px 28px; background-color: #ffffff;">
                  
                  <p style="margin: 0 0 14px 0; font-size: 16px; color: #0f172a; font-weight: 700;">
                    Hello ${clientName},
                  </p>
                  
                  <p style="margin: 0 0 20px 0; font-size: 14px; color: #334155; line-height: 1.6;">
                    Thank you for reaching out to <strong>CTVill Design &amp; Construction</strong>. We have officially registered your commercial fit-out quotation inquiry in our engineering system:
                  </p>

                  <!-- Specifications Table -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 0 0 24px 0;">
                    <tr>
                      <td colspan="2" bgcolor="#f1f5f9" style="background-color: #f1f5f9; padding: 12px 18px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.8px;">
                        Quotation Specifications &amp; Project Overview
                      </td>
                    </tr>
                    
                    <tr>
                      <td width="38%" style="padding: 11px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
                        Reference No:
                      </td>
                      <td width="62%" style="padding: 11px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0284c7; font-weight: 800; font-family: monospace;">
                        ${quoteId}
                      </td>
                    </tr>

                    <tr>
                      <td style="padding: 11px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
                        Project Scope:
                      </td>
                      <td style="padding: 11px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 700;">
                        ${projectScope}
                      </td>
                    </tr>

                    ${estimatorArea ? `
                    <tr>
                      <td style="padding: 11px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
                        Estimated Area:
                      </td>
                      <td style="padding: 11px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 700;">
                        ${estimatorArea} sqm (${(spaceType || 'Commercial').toUpperCase()})
                      </td>
                    </tr>
                    ` : ''}

                    <tr>
                      <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">
                        Preliminary Budget:
                      </td>
                      <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; font-size: 18px; color: #d97706; font-weight: 800;">
                        ${formattedCost}
                      </td>
                    </tr>

                    <tr>
                      <td style="padding: 11px 18px; ${projectNotes ? 'border-bottom: 1px solid #e2e8f0;' : ''} font-size: 13px; color: #64748b; font-weight: 600;">
                        Target Timeline:
                      </td>
                      <td style="padding: 11px 18px; ${projectNotes ? 'border-bottom: 1px solid #e2e8f0;' : ''} font-size: 13px; color: #059669; font-weight: 700;">
                        ${formattedWeeks}
                      </td>
                    </tr>

                    ${projectNotes ? `
                    <tr>
                      <td style="padding: 11px 18px; font-size: 13px; color: #64748b; font-weight: 600; vertical-align: top;">
                        Client Notes:
                      </td>
                      <td style="padding: 11px 18px; font-size: 13px; color: #334155; line-height: 1.5;">
                        ${projectNotes}
                      </td>
                    </tr>
                    ` : ''}
                  </table>

                  <!-- Information Callout Box -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f0fdf4" style="background-color: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; margin: 0 0 20px 0;">
                    <tr>
                      <td style="padding: 14px 16px;">
                        <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.5;">
                          <strong>⚡ What Happens Next:</strong> Our Laguna estimating engineering desk is currently reviewing your specifications. An assigned estimator will contact you within <strong>24 business hours</strong> to discuss CAD drawings, material finishes, and arrange a site ocular inspection if required.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                    If you have existing architectural blueprints or lease guidelines to share, feel free to reply directly to this email or send them to <a href="mailto:estimate@ctvill.com" style="color: #0284c7; text-decoration: none; font-weight: 600;">estimate@ctvill.com</a>.
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.6;">
                  <p style="margin: 0 0 4px 0; font-weight: 700; color: #334155;">
                    CTVill Design &amp; Construction
                  </p>
                  <p style="margin: 0 0 6px 0; color: #64748b;">
                    Laguna Directorate &bull; Cabuyao &amp; Biñan, Laguna, Philippines &bull; Tel: (049) 544 7724 &bull; 0933-827-8885
                  </p>
                  <p style="margin: 0; color: #94a3b8; font-size: 10px;">
                    &copy; ${new Date().getFullYear()} CTVill Design &amp; Construction. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>

    </body>
    </html>
  `;

  const transporter = await getMailTransporter();
  if (transporter) {
    try {
      const clientMailPromise = transporter.sendMail({
        from: senderFrom,
        to: clientEmail,
        replyTo: 'estimate@ctvill.com',
        subject: `[CTVill Fit-Out] Official Quotation Request Confirmation - ${clientName}`,
        html: htmlContent,
        text: `Hello ${clientName},\n\nThank you for requesting a fit-out quotation with CTVill Design & Construction.\n\nRef: ${quoteId}\nProject Scope: ${projectScope}\nEstimated Cost: ${formattedCost}\nTarget Timeline: ${formattedWeeks}\n\nOur architectural and engineering estimators will review your inquiry and contact you within 24 hours.\n\nCTVill Design & Construction\nCabuyao, Laguna, Philippines | (049) 544 7724`,
      });

      const adminAlertHtml = `
        <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; color: #0f172a; max-width: 500px;">
          <h2 style="color: #d97706; margin-top: 0;">🚨 New Commercial Fit-Out Lead</h2>
          <p><strong>Client:</strong> ${clientName} (${clientEmail}, ${clientPhone || 'N/A'})</p>
          <p><strong>Scope:</strong> ${projectScope}</p>
          <p><strong>Area:</strong> ${estimatorArea ? `${estimatorArea} sqm` : 'N/A'}</p>
          <p><strong>Estimated Budget:</strong> <span style="color: #059669; font-weight: bold;">${formattedCost}</span></p>
          <p><strong>Ref ID:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${quoteId}</code></p>
          ${projectNotes ? `<p><strong>Notes:</strong> ${projectNotes}</p>` : ''}
        </div>
      `;

      const adminMailPromise = transporter.sendMail({
        from: senderFrom,
        to: 'davematthewreglos@gmail.com',
        subject: `🚨 [NEW FIT-OUT LEAD] Quotation: ${clientName} (${projectScope})`,
        html: adminAlertHtml,
      }).catch(err => console.error('Admin quotation notification error:', err));

      const [info] = await Promise.all([clientMailPromise, adminMailPromise]);
      return {
        success: true,
        delivered: true,
        messageId: info.messageId,
        mode: 'GMAIL_SMTP',
      };
    } catch (err: any) {
      console.error('Error in sendFitOutQuotationEmail:', err);
      return {
        success: false,
        delivered: false,
        error: err.message,
      };
    }
  }

  return {
    success: true,
    delivered: false,
    mode: 'NO_TRANSPORTER',
  };
}
