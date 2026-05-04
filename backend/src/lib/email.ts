import { Resend } from 'resend';
import { config } from '../config';
import { logger } from './logger';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export async function sendPasswordResetEmail(toEmail: string, code: string): Promise<void> {
  if (!resend) {
    logger.warn({ event: 'email_skipped', toEmail }, `[DEV] Password reset code: ${code}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: 'Gymify <onboarding@resend.dev>',
    to: toEmail,
    subject: 'Your Gymify password reset code',
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px;">
        <h2 style="margin-top:0;">Reset your Gymify password</h2>
        <p>Your 6-digit reset code is:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;text-align:center;
                    padding:20px;background:#f4f4f5;border-radius:8px;margin:16px 0;">
          ${code}
        </div>
        <p>This code expires in <strong>15 minutes</strong>.</p>
        <p style="color:#6b7280;font-size:13px;">
          If you didn't request a password reset you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    logger.error({ event: 'email_send_failed', error }, 'Failed to send password reset email');
    throw new Error('Failed to send email');
  }
}

export async function sendGymAdminNotificationEmail(toEmail: string, gymName: string): Promise<void> {
  if (!resend) {
    logger.warn({ event: 'email_skipped', toEmail }, `[DEV] ${toEmail} added as admin of "${gymName}"`);
    return;
  }

  const { error } = await resend.emails.send({
    from: 'Gymify <onboarding@resend.dev>',
    to: toEmail,
    subject: `You're now an admin of ${gymName} on Gymify`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px;">
        <h2 style="margin-top:0;">You've been added as an admin</h2>
        <p>You've been made an admin of <strong>${gymName}</strong> on Gymify.</p>
        <p>Sign in to access your gym dashboard and start managing members.</p>
        <p style="color:#6b7280;font-size:13px;">
          If you weren't expecting this, contact your Gymify platform administrator.
        </p>
      </div>
    `,
  });

  if (error) {
    logger.error({ event: 'email_send_failed', error }, 'Failed to send gym admin notification email');
  }
}
