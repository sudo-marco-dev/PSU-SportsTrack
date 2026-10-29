import { supabase } from '@/lib/supabase';

export interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: 'coach_invite' | 'verification_approved' | 'verification_rejected' | 'system';
  link?: string;
  recipientEmail?: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Generates an accessible, branded PSU SportsTrack HTML email template,
 * fully consistent with the official authentication mail templates.
 */
function renderEmailHtml(payload: { title: string; message: string; link?: string; type: string; recipientEmail?: string }): string {
  const { title, message, link, recipientEmail } = payload;
  const siteUrl = ((import.meta as unknown as { env: Record<string, string> }).env?.VITE_SITE_URL || 'https://psusportstrack.tech').replace(/\/$/, '');
  const actionUrl = link
    ? link.startsWith('http')
      ? link
      : `${siteUrl}${link.startsWith('/') ? link : `/${link}`}`
    : siteUrl;

  const emailTarget = recipientEmail || 'your registered account';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <!-- Preheader text (hidden in body, visible in inbox preview) -->
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">
    ${title} — Official athletic notification from Palawan State University SportsTrack.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1120; padding: 36px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 540px; background-color: #0f172a; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);">
          <!-- Top Accent Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #ea580c 0%, #f97316 50%, #f59e0b 100%);"></td>
          </tr>

          <!-- Header / Branding -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="padding: 10px 18px; background-color: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.25); border-radius: 9999px;">
                    <span style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #fb923c; text-transform: uppercase;">
                      Palawan State University
                    </span>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 16px 0 4px 0; font-size: 26px; font-weight: 900; font-style: italic; text-transform: uppercase; letter-spacing: -0.5px; color: #ffffff;">
                PSU <span style="color: #f97316;">SportsTrack</span>
              </h1>
              <p style="margin: 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8;">
                Official University Athletic Portal
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="border-top: 1px solid rgba(255, 255, 255, 0.08);"></div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 32px 32px 32px; text-align: center;">
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.3px; color: #ffffff;">
                ${title}
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1; max-width: 440px; margin-left: auto; margin-right: auto;">
                ${message}
              </p>

              <!-- One-Click Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 28px auto 12px auto;">
                <tr>
                  <td align="center" style="border-radius: 12px; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); box-shadow: 0 4px 16px rgba(249, 115, 22, 0.35);">
                    <a href="${actionUrl}" target="_blank" style="display: inline-block; padding: 15px 36px; font-size: 13px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #ffffff; text-decoration: none; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.15);">
                      View in SportsTrack
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                Button not working? Copy and paste this link into your browser:<br>
                <a href="${actionUrl}" style="color: #fb923c; text-decoration: underline; word-break: break-all; font-size: 11px;">
                  ${actionUrl}
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0b1120; border-top: 1px solid rgba(255, 255, 255, 0.06); padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 11px; line-height: 1.5; color: #64748b;">
                This email was sent to <strong style="color: #94a3b8;">${emailTarget}</strong>. Registration on PSU SportsTrack is strictly restricted to official Palawan State University accounts (<span style="color: #fb923c;">@psu.palawan.edu.ph</span>).
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; Palawan State University Sports Governance Board. All rights reserved.<br/>
                Sent by &lt;noreply@psusportstrack.tech&gt;
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Dispatches an in-app database notification and sends an email via Resend if configured.
 */
export async function sendNotification(payload: NotificationPayload): Promise<{ success: boolean; inAppSaved: boolean; emailSent: boolean }> {
  let inAppSaved = false;
  let emailSent = false;

  // 1. Save in-app notification to Supabase database
  try {
    const { error: dbError } = await supabase.from('notifications').insert({
      user_id: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      link: payload.link || null,
      is_read: false,
    });

    if (!dbError) {
      inAppSaved = true;
    } else {
      console.warn('[Notifications] Failed to insert in-app notification:', dbError);
    }
  } catch (err) {
    console.warn('[Notifications] Error writing in-app notification:', err);
  }

  // 2. Dispatch email notification if recipient email is available
  if (payload.recipientEmail) {
    const env = (import.meta as unknown as { env: Record<string, string> }).env;
    const fromAddress = env?.VITE_EMAIL_FROM || 'PSU SportsTrack <noreply@psusportstrack.tech>';

    // Primary delivery: Invoke deployed Supabase Edge Function 'send-email'
    // Server-side execution completely bypasses browser CORS restrictions
    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('send-email', {
        body: {
          to: payload.recipientEmail,
          subject: payload.title,
          html: renderEmailHtml(payload),
          from: fromAddress,
        },
      });

      if (!edgeError && edgeData?.success) {
        emailSent = true;
      } else if (edgeError) {
        console.warn('[Notifications] Edge function email dispatch error:', edgeError);
      }
    } catch (edgeErr) {
      console.warn('[Notifications] Exception calling send-email edge function:', edgeErr);
    }

    // Secondary fallback: Direct Resend API invocation if custom key is in environment
    if (!emailSent) {
      const resendApiKey = env?.VITE_RESEND_API_KEY;
      if (resendApiKey) {
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromAddress,
              to: [payload.recipientEmail],
              subject: payload.title,
              html: renderEmailHtml(payload),
            }),
          });

          if (response.ok) {
            emailSent = true;
          } else {
            const errText = await response.text();
            console.warn('[Notifications] Resend API error response:', errText);
          }
        } catch (emailErr) {
          console.warn('[Notifications] Failed to dispatch email via Resend direct fetch:', emailErr);
        }
      }
    }
  }

  return { success: inAppSaved || emailSent, inAppSaved, emailSent };
}

/**
 * Sends a recruitment invite notification to an athlete from a coach.
 */
export async function notifyCoachInvite(
  athleteUserId: string,
  athleteEmail: string | undefined,
  teamName: string,
  sportName: string,
  coachName: string
) {
  return sendNotification({
    userId: athleteUserId,
    recipientEmail: athleteEmail,
    type: 'coach_invite',
    title: `New Squad Recruitment Invite: ${teamName}`,
    message: `Coach ${coachName} has invited you to join the official team roster for ${teamName} (${sportName}). Visit your athletic hub to review and accept the invitation.`,
    link: '/athletics',
  });
}

/**
 * Sends an approval notification when an admin approves credentials.
 */
export async function notifyVerificationApproved(
  userId: string,
  email: string | undefined,
  fullName: string,
  role: string
) {
  const formattedRole = role ? role.replace('player_', '').toUpperCase() : 'ATHLETE';
  return sendNotification({
    userId,
    recipientEmail: email,
    type: 'verification_approved',
    title: 'Athletic Credential Verification Approved!',
    message: `Congratulations ${fullName || 'Collegiate Athlete'}! Your credential verification has been approved by the sports administration. Your account is now fully active with official ${formattedRole} status.`,
    link: '/profile',
  });
}

/**
 * Sends a rejection notification with clear reason when credentials are rejected.
 */
export async function notifyVerificationRejected(
  userId: string,
  email: string | undefined,
  fullName: string,
  _role: string,
  reason?: string
) {
  return sendNotification({
    userId,
    recipientEmail: email,
    type: 'verification_rejected',
    title: 'Credential Verification Update: Action Required',
    message: `Hello ${fullName || 'Collegiate Athlete'}, your submitted verification document could not be approved by the sports administration. ${reason ? `Reason: ${reason}` : 'Please re-upload a clear, valid official document.'}`,
    link: '/profile',
  });
}
