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

  const senderFrom = `"CTVill Builders Corporation" <${process.env.SMTP_USER || 'estimating@ctvill.com'}>`;
  const formattedCost = estimatedCost ? `₱${Number(estimatedCost).toLocaleString()}` : 'Custom Estimate Pending';
  const formattedWeeks = estimatedWeeks ? `${estimatedWeeks} Weeks Estimated` : 'To be determined';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; color: #f9fafb; margin: 0; padding: 24px; }
        .container { max-width: 620px; margin: 0 auto; background: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; }
        .header { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0; color: #d1fae5; font-size: 13px; font-weight: 500; }
        .content { padding: 28px 24px; }
        .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .card-title { font-size: 14px; font-weight: 700; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; }
        .card-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 13px; }
        .highlight { color: #f59e0b; font-weight: bold; font-size: 16px; }
        .footer { background: #030712; padding: 20px 24px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #1f2937; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>CTVill Builders Corporation</h1>
          <p>Turnkey Design & Interior Fit-Out Specialists</p>
        </div>
        <div class="content">
          <p>Hello <strong>${clientName}</strong>,</p>
          <p>Thank you for inquiring with CTVill Builders Corporation. We have officially logged your commercial fit-out quotation request:</p>
          <div class="card">
            <div class="card-title">Quotation Specifications</div>
            <div class="card-row"><span>Ref Number:</span><strong style="color: #38bdf8;">${quoteId}</strong></div>
            <div class="card-row"><span>Project Scope:</span><strong>${projectScope}</strong></div>
            ${estimatorArea ? `<div class="card-row"><span>Area:</span><strong>${estimatorArea} sqm (${(spaceType || '').toUpperCase()})</strong></div>` : ''}
            <div class="card-row"><span>Estimated Cost:</span><strong class="highlight">${formattedCost}</strong></div>
            <div class="card-row"><span>Target Timeline:</span><strong style="color: #34d399;">${formattedWeeks}</strong></div>
            ${projectNotes ? `<div class="card-row"><span>Notes:</span><strong>${projectNotes}</strong></div>` : ''}
          </div>
          <p style="font-size: 13px; color: #9ca3af;">Our architectural and engineering estimators will review your inquiry and contact you within 24 hours.</p>
        </div>
        <div class="footer">
          CTVill Builders Corporation • Cabuyao, Laguna, Philippines • (049) 544 7724
        </div>
      </div>
    </body>
    </html>
  `;

  const transporter = await getMailTransporter();
  if (transporter) {
    try {
      const clientMailPromise = transporter.sendMail({
        from: senderFrom,
        to: clientEmail,
        subject: `[CTVill Fit-Out] Official Quotation Request Confirmation - ${clientName}`,
        html: htmlContent,
        text: `Hello ${clientName},\n\nThank you for requesting a fit-out quotation with CTVill Builders Corporation.\nRef: ${quoteId}\nScope: ${projectScope}\nEstimated: ${formattedCost}\n\nCTVill Builders Corporation`,
      });

      const adminAlertHtml = `
        <div style="font-family: sans-serif; background: #020617; color: #f8fafc; padding: 24px; border-radius: 12px;">
          <h2 style="color: #f59e0b;">🚨 New Commercial Fit-Out Lead</h2>
          <p><strong>Client:</strong> ${clientName} (${clientEmail}, ${clientPhone || 'N/A'})</p>
          <p><strong>Scope:</strong> ${projectScope}</p>
          <p><strong>Estimated Budget:</strong> ${formattedCost}</p>
          <p><strong>Ref ID:</strong> ${quoteId}</p>
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
