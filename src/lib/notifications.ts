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
 * Generates an accessible, branded PSU SportsTrack HTML email template.
 */
function renderEmailHtml(payload: { title: string; message: string; link?: string; type: string }): string {
  const { title, message, link } = payload;
  const siteUrl = ((import.meta as unknown as { env: Record<string, string> }).env?.VITE_SITE_URL || 'https://psusportstrack.tech').replace(/\/$/, '');
  const actionUrl = link
    ? link.startsWith('http')
      ? link
      : `${siteUrl}${link.startsWith('/') ? link : `/${link}`}`
    : siteUrl;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
          .container { max-width: 580px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; }
          .header { background: linear-gradient(135deg, #ea580c, #c2410c); padding: 24px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
          .content { padding: 32px 24px; }
          .title { font-size: 18px; font-weight: 800; color: #fdba74; margin-top: 0; margin-bottom: 12px; }
          .message { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
          .button-wrapper { text-align: center; margin-top: 24px; }
          .btn { display: inline-block; background-color: #ea580c; color: #ffffff !important; font-weight: 800; text-decoration: none; padding: 12px 28px; border-radius: 10px; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; }
          .footer { padding: 20px 24px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PSU SportsTrack</h1>
          </div>
          <div class="content">
            <h2 class="title">${title}</h2>
            <p class="message">${message}</p>
            <div class="button-wrapper">
              <a href="${actionUrl}" class="btn">View in SportsTrack</a>
            </div>
          </div>
          <div class="footer">
            Palawan State University • Sports &amp; Athletics Department<br/>
            This is an automated notification from the PSU SportsTrack collegiate sports platform.<br/>
            Sent by &lt;noreply@psusportstrack.tech&gt;
          </div>
        </div>
      </body>
    </html>
  `;
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

    // Secondary fallback: Direct Resend API invocation if key is available in environment
    if (!emailSent) {
      const resendApiKey = env?.VITE_RESEND_API_KEY || 're_omMwtBMB_BSjpwfJVYgi19VReEvnrdgBb';
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
