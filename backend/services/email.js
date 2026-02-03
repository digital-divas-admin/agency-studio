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

/**
 * Send welcome email to new agency owner after signup
 * @param {Object} agency - Agency object with name and slug
 * @param {Object} user - User object with name and email
 * @returns {Promise<Object>} Resend API response
 */
async function sendWelcomeEmail(agency, user) {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@vixxxen.com';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const agencyUrl = `${frontendUrl}/${agency.slug}`;

    const userName = user.name || 'there';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Agency Studio</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #111827;">
                                Welcome to Agency Studio! 🎉
                            </h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; line-height: 1.6; color: #374151;">
                                Hi ${userName},
                            </p>

                            <p style="margin: 0 0 20px; line-height: 1.6; color: #374151;">
                                Congratulations! Your agency <strong>${agency.name}</strong> has been created successfully.
                            </p>

                            <p style="margin: 0 0 20px; line-height: 1.6; color: #374151;">
                                You're now ready to explore the platform and start generating amazing content for your models.
                            </p>

                            <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 30px 0; border-radius: 4px;">
                                <h3 style="margin: 0 0 10px; font-size: 16px; font-weight: 600; color: #1e40af;">
                                    🚀 Your 7-Day Trial Starts Now
                                </h3>
                                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1e40af;">
                                    Explore all features for free. Add credits anytime to start generating content.
                                </p>
                            </div>

                            <h3 style="margin: 30px 0 15px; font-size: 18px; font-weight: 600; color: #111827;">
                                Quick Start Guide:
                            </h3>

                            <ol style="margin: 0 0 30px; padding-left: 24px; line-height: 1.8; color: #374151;">
                                <li><strong>Complete Onboarding:</strong> Customize your branding and set up your workspace</li>
                                <li><strong>Add Models:</strong> Create profiles for your talent</li>
                                <li><strong>Purchase Credits:</strong> Add credits to start generating content</li>
                                <li><strong>Invite Team:</strong> Collaborate with your team members</li>
                                <li><strong>Start Creating:</strong> Generate images, videos, and more</li>
                            </ol>

                            <!-- CTA Button -->
                            <table role="presentation" style="margin: 30px 0;">
                                <tr>
                                    <td style="border-radius: 6px; background-color: #2563eb;">
                                        <a href="${agencyUrl}"
                                           style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                                            Go to Your Dashboard
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 30px 0 0; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; line-height: 1.6; color: #6b7280;">
                                Need help getting started? Check out our documentation or reach out to our support team.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280; text-align: center;">
                                Welcome to Agency Studio<br>
                                Questions? Just reply to this email.
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
Welcome to Agency Studio! 🎉

Hi ${userName},

Congratulations! Your agency "${agency.name}" has been created successfully.

You're now ready to explore the platform and start generating amazing content for your models.

🚀 Your 7-Day Trial Starts Now
Explore all features for free. Add credits anytime to start generating content.

Quick Start Guide:
1. Complete Onboarding: Customize your branding and set up your workspace
2. Add Models: Create profiles for your talent
3. Purchase Credits: Add credits to start generating content
4. Invite Team: Collaborate with your team members
5. Start Creating: Generate images, videos, and more

Go to your dashboard: ${agencyUrl}

Need help getting started? Check out our documentation or reach out to our support team.

---
Agency Studio
Questions? Just reply to this email.
    `.trim();

    const client = getResendClient();

    if (!client) {
        throw new Error('Email service is not configured. Please set RESEND_API_KEY environment variable.');
    }

    try {
        const response = await client.emails.send({
            from: fromEmail,
            to: user.email,
            subject: `Welcome to Agency Studio - ${agency.name}`,
            html: html,
            text: text
        });

        return response;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        throw new Error(`Failed to send welcome email: ${error.message}`);
    }
}

/**
 * Send team invitation email
 * @param {Object} agency - Agency object with name and slug
 * @param {Object} invitation - Invitation object with email, role, token, expires_at, custom_message
 * @param {Object} inviter - User who sent the invitation
 * @returns {Promise<Object>} Resend API response
 */
async function sendTeamInviteEmail(agency, invitation, inviter) {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@vixxxen.com';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const inviteUrl = `${frontendUrl}/invite/${invitation.token}`;
    const expiresAt = new Date(invitation.expires_at);
    const expiresInDays = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));

    const inviterName = inviter?.name || 'A team member';
    const roleLabel = invitation.role === 'admin' ? 'Admin' : 'Member';

    // Custom message section (if provided)
    const customMessageHtml = invitation.custom_message
        ? `
            <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1e40af; white-space: pre-wrap;">${invitation.custom_message}</p>
            </div>
        `
        : '';

    const customMessageText = invitation.custom_message
        ? `\n\n${invitation.custom_message}\n`
        : '';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Invitation - ${agency.name}</title>
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
                                You're invited to join the team!
                            </h2>

                            <p style="margin: 0 0 20px; line-height: 1.6; color: #374151;">
                                ${inviterName} has invited you to join <strong>${agency.name}</strong> as a <strong>${roleLabel}</strong>.
                            </p>

                            <p style="margin: 0 0 20px; line-height: 1.6; color: #374151;">
                                Accept this invitation to collaborate on content generation and manage models together.
                            </p>

                            ${customMessageHtml}

                            <!-- CTA Button -->
                            <table role="presentation" style="margin: 30px 0;">
                                <tr>
                                    <td style="border-radius: 6px; background-color: #2563eb;">
                                        <a href="${inviteUrl}"
                                           style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                                            Accept Invitation
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
                                This invitation was sent by ${inviterName} from ${agency.name}.<br>
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

${inviterName} has invited you to join ${agency.name} as a ${roleLabel}.

Accept this invitation to collaborate on content generation and manage models together.
${customMessageText}
Accept invitation here:
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
        console.error('Error sending team invitation email:', error);
        throw new Error(`Failed to send team invitation email: ${error.message}`);
    }
}

module.exports = {
    sendModelInviteEmail,
    sendWelcomeEmail,
    sendTeamInviteEmail
};
