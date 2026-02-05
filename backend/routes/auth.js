/**
 * Authentication Routes
 * Handles self-serve signup, invitation acceptance, and slug validation
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const {
    provisionAgency,
    generateSlug,
    isSlugAvailable,
    acceptTeamInvitation,
    createTeamInvitation
} = require('../services/agencyProvisioning');
const { sendTeamInviteEmail } = require('../services/email');

/**
 * POST /api/auth/signup-agency
 * Self-serve agency signup
 * Creates agency, owner user, and sends welcome email
 */
router.post('/signup-agency', async (req, res) => {
    try {
        const { agencyName, ownerName, email, password, planId, slug } = req.body;

        // Validation
        if (!agencyName || !ownerName || !email || !password) {
            return res.status(400).json({
                error: 'Missing required fields: agencyName, ownerName, email, password'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password strength (minimum 8 characters)
        if (password.length < 8) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters long'
            });
        }

        // Get plan ID if not provided (default to Starter)
        let selectedPlanId = planId;
        if (!selectedPlanId) {
            const { data: starterPlan } = await supabaseAdmin
                .from('agency_plans')
                .select('id')
                .eq('name', 'Starter')
                .single();

            if (!starterPlan) {
                return res.status(500).json({ error: 'Default plan not found' });
            }

            selectedPlanId = starterPlan.id;
        }

        // Check if email already exists by querying agency_users
        const { data: existingUser } = await supabaseAdmin
            .from('agency_users')
            .select('id')
            .eq('email', email.toLowerCase())
            .single();

        if (existingUser) {
            return res.status(409).json({
                error: 'An account with this email already exists'
            });
        }

        // Provision agency (creates agency, owner, sends email)
        const result = await provisionAgency({
            agencyName,
            ownerName,
            email,
            password,
            planId: selectedPlanId,
            slug
        });

        // Sign in the user server-side and return session tokens
        // This allows the frontend to set the session directly without a separate sign-in call
        let session = null;
        try {
            const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) {
                console.error('Error signing in after signup:', signInError);
                // Don't fail the signup, just log the error - frontend can sign in manually
            } else {
                session = signInData?.session;
            }
        } catch (signInErr) {
            console.error('Exception during post-signup sign-in:', signInErr);
        }

        res.status(201).json({
            message: 'Agency created successfully',
            agency: {
                id: result.agency.id,
                name: result.agency.name,
                slug: result.agency.slug,
                status: result.agency.status,
                trial_ends_at: result.agency.trial_ends_at,
                onboarding_completed: result.agency.onboarding_completed
            },
            user: {
                id: result.authUser.id,
                email: result.authUser.email,
                name: ownerName
            },
            // Return session tokens if sign-in succeeded
            ...(session && { session })
        });
    } catch (error) {
        console.error('Signup error:', error);

        if (error.message.includes('already taken')) {
            return res.status(409).json({ error: error.message });
        }

        res.status(500).json({
            error: 'Failed to create agency',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/auth/check-slug
 * Check if a slug is available and get suggestions
 */
router.post('/check-slug', async (req, res) => {
    try {
        const { slug, agencyName } = req.body;

        if (!slug && !agencyName) {
            return res.status(400).json({
                error: 'Either slug or agencyName is required'
            });
        }

        let slugToCheck = slug;
        if (!slugToCheck && agencyName) {
            slugToCheck = generateSlug(agencyName);
        }

        const available = await isSlugAvailable(slugToCheck);

        // If not available, generate suggestions
        let suggestions = [];
        if (!available) {
            const baseSlug = slugToCheck;
            for (let i = 1; i <= 5; i++) {
                const suggestion = `${baseSlug}-${i}`;
                if (await isSlugAvailable(suggestion)) {
                    suggestions.push(suggestion);
                }
            }
        }

        res.json({
            slug: slugToCheck,
            available,
            suggestions
        });
    } catch (error) {
        console.error('Slug check error:', error);
        res.status(500).json({ error: 'Failed to check slug availability' });
    }
});

/**
 * POST /api/auth/accept-invite
 * Accept a team invitation and create user account
 */
router.post('/accept-invite', async (req, res) => {
    try {
        const { token, name, password } = req.body;

        // Validation
        if (!token || !name || !password) {
            return res.status(400).json({
                error: 'Missing required fields: token, name, password'
            });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters long'
            });
        }

        // Accept invitation
        const result = await acceptTeamInvitation({ token, name, password });

        res.status(200).json({
            message: 'Invitation accepted successfully',
            agency: {
                id: result.agency.id,
                name: result.agency.name,
                slug: result.agency.slug
            },
            user: {
                id: result.authUser.id,
                email: result.authUser.email,
                name: name,
                role: result.agencyUser.role
            }
        });
    } catch (error) {
        console.error('Accept invitation error:', error);

        if (error.message.includes('Invalid') || error.message.includes('expired')) {
            return res.status(400).json({ error: error.message });
        }

        if (error.message.includes('already been accepted')) {
            return res.status(409).json({ error: error.message });
        }

        res.status(500).json({
            error: 'Failed to accept invitation',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/auth/validate-invite/:token
 * Validate an invitation token without accepting it
 */
router.get('/validate-invite/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const { data: invitation, error } = await supabaseAdmin
            .from('invitation_tokens')
            .select('*, agencies(id, name, slug)')
            .eq('token', token)
            .single();

        if (error || !invitation) {
            return res.status(404).json({ error: 'Invalid invitation token' });
        }

        if (invitation.accepted_at) {
            return res.status(400).json({ error: 'This invitation has already been accepted' });
        }

        if (new Date(invitation.expires_at) < new Date()) {
            return res.status(400).json({ error: 'This invitation has expired' });
        }

        res.json({
            valid: true,
            email: invitation.email,
            role: invitation.role,
            agency: {
                name: invitation.agencies.name,
                slug: invitation.agencies.slug
            },
            expires_at: invitation.expires_at
        });
    } catch (error) {
        console.error('Validate invitation error:', error);
        res.status(500).json({ error: 'Failed to validate invitation' });
    }
});

/**
 * GET /api/auth/my-agencies
 * Get agencies the authenticated user belongs to
 * This endpoint doesn't require agency context - used for auto-detection
 */
router.get('/my-agencies', async (req, res) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authorization token required' });
        }

        const token = authHeader.split(' ')[1];

        // Verify token and get user
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Find user's agencies
        const { data: memberships, error: queryError } = await supabaseAdmin
            .from('agency_users')
            .select(`
                role,
                status,
                agencies (
                    id,
                    name,
                    slug,
                    status
                )
            `)
            .eq('auth_user_id', user.id)
            .eq('status', 'active');

        if (queryError) {
            console.error('Error fetching user agencies:', queryError);
            return res.status(500).json({ error: 'Failed to fetch agencies' });
        }

        // Filter to only active/trial agencies and format response
        const agencies = (memberships || [])
            .filter(m => m.agencies && (m.agencies.status === 'active' || m.agencies.status === 'trial'))
            .map(m => ({
                id: m.agencies.id,
                name: m.agencies.name,
                slug: m.agencies.slug,
                role: m.role
            }));

        res.json({ agencies });
    } catch (error) {
        console.error('Get my agencies error:', error);
        res.status(500).json({ error: 'Failed to get agencies' });
    }
});

/**
 * GET /api/auth/plans
 * Get available subscription plans
 */
router.get('/plans', async (req, res) => {
    try {
        const { data: plans, error } = await supabaseAdmin
            .from('agency_plans')
            .select('*')
            .eq('is_active', true)
            .order('price_cents', { ascending: true });

        if (error) {
            throw error;
        }

        res.json({ plans });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
});

module.exports = router;
