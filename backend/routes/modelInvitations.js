const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendModelInviteEmail } = require('../services/email');

/**
 * POST /api/model-invitations
 * Create a new model invitation (admin-only)
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { email, name, custom_message } = req.body;
        const { agency, agencyUser } = req;

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ error: 'Valid email address is required' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if model already exists with this email
        const { data: existingModel, error: modelCheckError } = await supabaseAdmin
            .from('agency_models')
            .select('id, name')
            .eq('agency_id', agency.id)
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (modelCheckError) {
            console.error('Error checking existing model:', modelCheckError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (existingModel) {
            return res.status(409).json({
                error: 'A model with this email already exists',
                modelName: existingModel.name
            });
        }

        // Check if there's already a pending invitation for this email
        const { data: existingInvite, error: inviteCheckError } = await supabaseAdmin
            .from('model_invitations')
            .select('id, status')
            .eq('agency_id', agency.id)
            .eq('email', normalizedEmail)
            .eq('status', 'pending')
            .maybeSingle();

        if (inviteCheckError) {
            console.error('Error checking existing invitation:', inviteCheckError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (existingInvite) {
            return res.status(409).json({
                error: 'A pending invitation already exists for this email'
            });
        }

        // Create invitation
        const { data: invitation, error: createError } = await supabaseAdmin
            .from('model_invitations')
            .insert({
                agency_id: agency.id,
                email: normalizedEmail,
                name: name || null,
                custom_message: custom_message || null,
                invited_by: agencyUser.id
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating invitation:', createError);
            return res.status(500).json({ error: 'Failed to create invitation' });
        }

        // Send invitation email
        try {
            await sendModelInviteEmail(agency, invitation);
        } catch (emailError) {
            console.error('Error sending invitation email:', emailError);
            // Delete the invitation since email failed
            await supabaseAdmin
                .from('model_invitations')
                .delete()
                .eq('id', invitation.id);

            return res.status(500).json({
                error: 'Failed to send invitation email. Please try again.'
            });
        }

        res.status(201).json({
            success: true,
            invitation: {
                id: invitation.id,
                email: invitation.email,
                name: invitation.name,
                status: invitation.status,
                invited_at: invitation.invited_at,
                expires_at: invitation.expires_at
            }
        });

    } catch (error) {
        console.error('Error creating model invitation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/model-invitations
 * List all invitations for the agency (admin-only)
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        const { agency } = req;

        // Build query
        let query = supabaseAdmin
            .from('model_invitations')
            .select(`
                *,
                invited_by_user:agency_users!invited_by(id, name, email),
                model:agency_models(id, name, slug)
            `)
            .eq('agency_id', agency.id)
            .order('invited_at', { ascending: false });

        // Filter by status if provided
        if (status) {
            query = query.eq('status', status);
        }

        const { data: invitations, error: fetchError } = await query;

        if (fetchError) {
            console.error('Error fetching invitations:', fetchError);
            return res.status(500).json({ error: 'Failed to fetch invitations' });
        }

        res.json({ invitations });

    } catch (error) {
        console.error('Error listing invitations:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/model-invitations/validate/:token
 * Validate invitation token (public, no auth required)
 */
router.get('/validate/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Validate token format (UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(token)) {
            return res.status(400).json({
                valid: false,
                error: 'Invalid invitation token format'
            });
        }

        // Fetch invitation with agency details (using admin client for public access)
        const { data: invitation, error: fetchError } = await supabaseAdmin
            .from('model_invitations')
            .select(`
                *,
                agency:agencies(id, name, slug)
            `)
            .eq('invite_token', token)
            .single();

        if (fetchError || !invitation) {
            return res.status(404).json({
                valid: false,
                error: 'Invitation not found'
            });
        }

        // Check if already accepted
        if (invitation.status === 'accepted') {
            return res.status(400).json({
                valid: false,
                error: 'This invitation has already been accepted'
            });
        }

        // Check if cancelled
        if (invitation.status === 'cancelled') {
            return res.status(400).json({
                valid: false,
                error: 'This invitation has been cancelled'
            });
        }

        // Check if expired
        const expiresAt = new Date(invitation.expires_at);
        const now = new Date();
        if (now > expiresAt) {
            // Update status to expired
            await supabaseAdmin
                .from('model_invitations')
                .update({ status: 'expired' })
                .eq('id', invitation.id);

            return res.status(400).json({
                valid: false,
                error: 'This invitation has expired'
            });
        }

        // Invitation is valid
        res.json({
            valid: true,
            invitation: {
                email: invitation.email,
                name: invitation.name,
                custom_message: invitation.custom_message,
                expires_at: invitation.expires_at
            },
            agency: invitation.agency
        });

    } catch (error) {
        console.error('Error validating invitation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/model-invitations/:token/accept
 * Accept invitation and create model profile (public, no auth required)
 */
router.post('/:token/accept', async (req, res) => {
    try {
        const { token } = req.params;
        const {
            name,
            email,
            phone,
            bio,
            instagram,
            twitter,
            tiktok,
            youtube,
            snapchat,
            onlyfans_handle,
            create_auth_account,
            password
        } = req.body;

        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Validate password if creating auth account
        if (create_auth_account) {
            if (!password || password.length < 8) {
                return res.status(400).json({
                    error: 'Password must be at least 8 characters long'
                });
            }
        }

        // Fetch invitation
        const { data: invitation, error: fetchError } = await supabaseAdmin
            .from('model_invitations')
            .select('*, agency:agencies(id, name, slug)')
            .eq('invite_token', token)
            .single();

        if (fetchError || !invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify email matches invitation
        if (normalizedEmail !== invitation.email) {
            return res.status(400).json({
                error: 'Email address does not match invitation'
            });
        }

        // Check if already accepted
        if (invitation.status !== 'pending') {
            return res.status(400).json({
                error: `This invitation has been ${invitation.status}`
            });
        }

        // Check if expired
        const expiresAt = new Date(invitation.expires_at);
        const now = new Date();
        if (now > expiresAt) {
            await supabaseAdmin
                .from('model_invitations')
                .update({ status: 'expired' })
                .eq('id', invitation.id);

            return res.status(400).json({ error: 'This invitation has expired' });
        }

        // Check if model already exists (race condition check)
        const { data: existingModel } = await supabaseAdmin
            .from('agency_models')
            .select('id')
            .eq('agency_id', invitation.agency_id)
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (existingModel) {
            return res.status(409).json({ error: 'A model with this email already exists' });
        }

        // Generate unique slug from name
        const baseSlug = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        let slug = baseSlug;
        let slugCounter = 1;

        while (true) {
            const { data: existingSlug } = await supabaseAdmin
                .from('agency_models')
                .select('id')
                .eq('agency_id', invitation.agency_id)
                .eq('slug', slug)
                .maybeSingle();

            if (!existingSlug) break;

            slug = `${baseSlug}-${slugCounter}`;
            slugCounter++;
        }

        // Build social media object
        const socialMedia = {};
        if (instagram) socialMedia.instagram = instagram;
        if (twitter) socialMedia.twitter = twitter;
        if (tiktok) socialMedia.tiktok = tiktok;
        if (youtube) socialMedia.youtube = youtube;
        if (snapchat) socialMedia.snapchat = snapchat;

        // Create Supabase auth user if requested
        let authUserId = null;
        if (create_auth_account && password) {
            try {
                const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                    email: normalizedEmail,
                    password: password,
                    email_confirm: true, // Auto-confirm email since invitation proves ownership
                    user_metadata: {
                        name: name,
                        role: 'model'
                    }
                });

                if (authError) {
                    console.error('Error creating auth user:', authError);
                    return res.status(500).json({
                        error: 'Failed to create login account. Please try again.'
                    });
                }

                authUserId = authData.user.id;
            } catch (authError) {
                console.error('Error creating auth user:', authError);
                return res.status(500).json({
                    error: 'Failed to create login account. Please try again.'
                });
            }
        }

        // Create model record
        const { data: model, error: modelError } = await supabaseAdmin
            .from('agency_models')
            .insert({
                agency_id: invitation.agency_id,
                name: name,
                email: normalizedEmail,
                phone: phone || null,
                slug: slug,
                bio: bio || null,
                social_media: Object.keys(socialMedia).length > 0 ? socialMedia : null,
                onlyfans_handle: onlyfans_handle || null,
                status: 'active',
                field_visibility: {
                    bio: true,
                    social_media: true,
                    phone: false,
                    email: false,
                    onlyfans_handle: false
                },
                auth_user_id: authUserId
            })
            .select()
            .single();

        if (modelError) {
            console.error('Error creating model:', modelError);

            // Clean up auth user if created
            if (authUserId) {
                await supabaseAdmin.auth.admin.deleteUser(authUserId);
            }

            return res.status(500).json({ error: 'Failed to create model profile' });
        }

        // Update invitation status
        await supabaseAdmin
            .from('model_invitations')
            .update({
                status: 'accepted',
                accepted_at: new Date().toISOString(),
                model_id: model.id
            })
            .eq('id', invitation.id);

        res.status(201).json({
            success: true,
            model: {
                id: model.id,
                name: model.name,
                slug: model.slug,
                portal_token: model.portal_token
            },
            agency: {
                name: invitation.agency.name,
                slug: invitation.agency.slug
            },
            auth_created: create_auth_account && authUserId !== null
        });

    } catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/model-invitations/:id
 * Cancel a pending invitation (admin-only)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { agency } = req;

        // Verify invitation belongs to user's agency and is pending
        const { data: invitation, error: fetchError } = await supabaseAdmin
            .from('model_invitations')
            .select('id, status')
            .eq('id', id)
            .eq('agency_id', agency.id)
            .single();

        if (fetchError || !invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json({
                error: `Cannot cancel invitation with status: ${invitation.status}`
            });
        }

        // Update status to cancelled
        const { error: updateError } = await supabaseAdmin
            .from('model_invitations')
            .update({ status: 'cancelled' })
            .eq('id', id);

        if (updateError) {
            console.error('Error cancelling invitation:', updateError);
            return res.status(500).json({ error: 'Failed to cancel invitation' });
        }

        res.json({ success: true, message: 'Invitation cancelled successfully' });

    } catch (error) {
        console.error('Error cancelling invitation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
