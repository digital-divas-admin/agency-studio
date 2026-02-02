const { Resend } = require('resend');

// Lazy initialization to avoid crashes when API key is missing
let resend = null;

function getResendClient() {
    if (!resend && process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

/**
 * Send model invitation email via Resend
 * @param {Object} agency - Agency object with name and slug
 * @param {Object} invitation - Invitation object with email, name, token, expires_at, custom_message
 * @returns {Promise<Object>} Resend API response
 */
async function sendModelInviteEmail(agency, invitation) {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@vixxxen.com';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const inviteUrl = `${frontendUrl}/${agency.slug}/model-invite/${invitation.invite_token}`;
    const expiresAt = new Date(invitation.expires_at);
    const expiresInDays = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));

    const recipientName = invitation.name || 'there';
    const customMessage = invitation.custom_message
        ? `<p style="margin: 20px 0; line-height: 1.6; color: #374151;">${invitation.custom_message.replace(/\n/g, '<br>')}</p>`
        : '';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Model Invitation - ${agency.name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827;">
                                ${agency.name}
                            </h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #111827;">
                                You're invited to join as a model!
                            </h2>

                            <p style="margin: 0 0 20px; line-height: 1.6; color: #374151;">
                                Hi ${recipientName},
                            </p>

                            <p style="margin: 0 0 20px; line-height: 1.6; color: #374151;">
                                You've been invited to create your profile and join ${agency.name}.
                                Complete your profile to get started with content management and portal access.
                            </p>

                            ${customMessage}

                            <!-- CTA Button -->
                            <table role="presentation" style="margin: 30px 0;">
                                <tr>
                                    <td style="border-radius: 6px; background-color: #2563eb;">
                                        <a href="${inviteUrl}"
                                           style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                                            Complete Your Profile
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                                This invitation expires in ${expiresInDays} day${expiresInDays !== 1 ? 's' : ''} (${expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}).
                            </p>

                            <!-- Alternative link -->
                            <p style="margin: 30px 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; line-height: 1.6; color: #6b7280;">
                                If the button doesn't work, copy and paste this link into your browser:<br>
                                <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280; text-align: center;">
                                This invitation was sent by ${agency.name}.<br>
                                If you didn't expect this invitation, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();

    const text = `
You're invited to join ${agency.name}!

Hi ${recipientName},

You've been invited to create your profile and join ${agency.name}. Complete your profile to get started with content management and portal access.

${invitation.custom_message || ''}

Complete your profile here:
${inviteUrl}

This invitation expires in ${expiresInDays} day${expiresInDays !== 1 ? 's' : ''} (${expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}).

If you didn't expect this invitation, you can safely ignore this email.

---
${agency.name}
    `.trim();

    const client = getResendClient();

    if (!client) {
        throw new Error('Email service is not configured. Please set RESEND_API_KEY environment variable.');
    }

    try {
        const response = await client.emails.send({
            from: fromEmail,
            to: invitation.email,
            subject: `You're invited to join ${agency.name}`,
            html: html,
            text: text
        });

        return response;
    } catch (error) {
        console.error('Error sending model invitation email:', error);
        throw new Error(`Failed to send invitation email: ${error.message}`);
    }
}

module.exports = {
    sendModelInviteEmail
};
