const { supabaseAdmin } = require('./supabase');

/**
 * Generate a URL-safe slug from agency name
 * @param {string} name - Agency name
 * @returns {string} URL-safe slug
 */
function generateSlug(name) {
    if (!name || typeof name !== 'string') {
        throw new Error('Agency name must be a non-empty string');
    }

    const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')      // Replace spaces with hyphens
        .replace(/-+/g, '-')       // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '');    // Remove leading/trailing hyphens

    // Validate slug is not empty and not too long
    if (slug.length === 0) {
        throw new Error('Agency name must contain at least one alphanumeric character');
    }
    if (slug.length > 63) {
        return slug.substring(0, 63);
    }

    return slug;
}

/**
 * Check if a slug is available
 * @param {string} slug - Slug to check
 * @returns {Promise<boolean>} True if available
 */
async function isSlugAvailable(slug) {
    const { data, error } = await supabaseAdmin
        .from('agencies')
        .select('id')
        .eq('slug', slug)
        .single();

    // Slug is available if no record found
    return error?.code === 'PGRST116' || !data;
}

/**
 * Generate a unique slug by appending numbers if needed
 * @param {string} baseSlug - Base slug to start with
 * @param {number} maxIterations - Maximum attempts to find unique slug
 * @returns {Promise<string>} Unique slug
 */
async function generateUniqueSlug(baseSlug, maxIterations = 100) {
    let slug = baseSlug;
    let counter = 1;

    while (!(await isSlugAvailable(slug))) {
        if (counter > maxIterations) {
            throw new Error(`Unable to generate unique slug after ${maxIterations} attempts. Please choose a different agency name.`);
        }
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    return slug;
}

/**
 * Get default settings for a new agency
 * @param {string} agencyName - Name of the agency
 * @param {string} planName - Plan name (Starter, Professional, Enterprise)
 * @returns {Object} Default settings object
 */
function getDefaultSettings(agencyName, planName) {
    const isPremium = planName === 'Professional' || planName === 'Enterprise';

    return {
        branding: {
            logo_url: null,
            favicon_url: null,
            app_name: agencyName,
            primary_color: '#6366f1',
            secondary_color: '#10b981'
        },
        features: {
            image_gen: true,
            video_gen: true,
            editing: true,
            chat: true,
            nsfw_enabled: true,
            models_allowed: ['seedream', 'nanoBanana', 'qwen', 'kling', 'wan', 'veo']
        },
        defaults: {
            default_model: 'seedream',
            default_credits_per_user: null
        }
    };
}

/**
 * Create a new agency with default settings
 * @param {Object} params - Agency creation parameters
 * @param {string} params.name - Agency name
 * @param {string} params.slug - Optional custom slug (will be generated if not provided)
 * @param {string} params.planId - Plan ID from agency_plans table
 * @param {string} params.signupSource - 'self-serve' or 'sales-led'
 * @returns {Promise<Object>} Created agency record
 */
async function createAgency({ name, slug, planId, signupSource = 'self-serve' }) {
    // Input validation
    if (!name || typeof name !== 'string') {
        throw new Error('Agency name is required and must be a string');
    }
    if (name.length > 100) {
        throw new Error('Agency name must be less than 100 characters');
    }
    if (!planId) {
        throw new Error('Plan ID is required');
    }
    if (!['self-serve', 'sales-led'].includes(signupSource)) {
        throw new Error('Invalid signup source');
    }
    // Generate slug if not provided
    if (!slug) {
        const baseSlug = generateSlug(name);
        slug = await generateUniqueSlug(baseSlug);
    } else {
        // Validate custom slug is available
        if (!(await isSlugAvailable(slug))) {
            throw new Error(`Slug "${slug}" is already taken`);
        }
    }

    // Get plan details to set initial credits and settings
    const { data: plan, error: planError } = await supabaseAdmin
        .from('agency_plans')
        .select('*')
        .eq('id', planId)
        .single();

    if (planError || !plan) {
        throw new Error('Invalid plan ID');
    }

    // Calculate trial end date (7 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    // Create agency record
    const { data: agency, error: agencyError } = await supabaseAdmin
        .from('agencies')
        .insert({
            name,
            slug,
            status: 'trial',
            subscription_status: 'trial',
            plan_id: planId,
            monthly_credit_allocation: plan.monthly_credits,
            credit_pool: 0, // Start with 0 credits - they must purchase to generate
            credits_used_this_cycle: 0,
            signup_source: signupSource,
            trial_ends_at: trialEndsAt.toISOString(),
            onboarding_completed: false,
            settings: getDefaultSettings(name, plan.name)
        })
        .select()
        .single();

    if (agencyError) {
        console.error('Error creating agency:', agencyError);
        throw new Error(`Failed to create agency: ${agencyError.message}`);
    }

    return agency;
}

/**
 * Create agency owner user and link to agency
 * @param {Object} params - User creation parameters
 * @param {string} params.email - User email
 * @param {string} params.password - User password
 * @param {string} params.name - User full name
 * @param {string} params.agencyId - Agency ID to link to
 * @returns {Promise<Object>} Created user with auth and agency_users records
 */
async function createAgencyOwner({ email, password, name, agencyId }) {
    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email for self-serve signups
        user_metadata: {
            name,
            agency_id: agencyId
        }
    });

    if (authError) {
        console.error('Error creating auth user:', authError);
        throw new Error(`Failed to create user account: ${authError.message}`);
    }

    // Create agency_users link
    const { data: agencyUser, error: agencyUserError } = await supabaseAdmin
        .from('agency_users')
        .insert({
            agency_id: agencyId,
            auth_user_id: authData.user.id,
            email,
            name,
            role: 'owner',
            status: 'active',
            joined_at: new Date().toISOString()
        })
        .select()
        .single();

    if (agencyUserError) {
        // Rollback: delete the auth user if agency_users creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        console.error('Error creating agency user link:', agencyUserError);
        throw new Error(`Failed to create user profile: ${agencyUserError.message}`);
    }

    return {
        authUser: authData.user,
        agencyUser
    };
}

/**
 * Complete agency signup flow (create agency + owner + send welcome email)
 * @param {Object} params - Signup parameters
 * @param {string} params.agencyName - Agency name
 * @param {string} params.ownerName - Owner full name
 * @param {string} params.email - Owner email
 * @param {string} params.password - Owner password
 * @param {string} params.planId - Plan ID
 * @param {string} params.slug - Optional custom slug
 * @returns {Promise<Object>} Created agency and user data
 */
async function provisionAgency({ agencyName, ownerName, email, password, planId, slug }) {
    let createdAgency = null;
    let createdAuthUser = null;

    try {
        // Step 1: Create agency
        createdAgency = await createAgency({
            name: agencyName,
            slug,
            planId,
            signupSource: 'self-serve'
        });

        // Step 2: Create owner user
        const { authUser, agencyUser } = await createAgencyOwner({
            email,
            password,
            name: ownerName,
            agencyId: createdAgency.id
        });
        createdAuthUser = authUser;

        // Step 3: Send welcome email (non-blocking)
        const { sendWelcomeEmail } = require('./email');
        sendWelcomeEmail(createdAgency, { name: ownerName, email })
            .catch(err => console.error('Failed to send welcome email:', err));

        return {
            agency: createdAgency,
            authUser,
            agencyUser
        };
    } catch (error) {
        console.error('Error provisioning agency:', error);

        // Rollback: Clean up created resources
        if (createdAuthUser) {
            console.error('Rolling back: Deleting auth user', createdAuthUser.id);
            await supabaseAdmin.auth.admin.deleteUser(createdAuthUser.id)
                .catch(err => console.error('Failed to delete auth user during rollback:', err));
        }
        if (createdAgency) {
            console.error('Rolling back: Deleting agency', createdAgency.id);
            try {
                await supabaseAdmin.from('agencies').delete().eq('id', createdAgency.id);
            } catch (err) {
                console.error('Failed to delete agency during rollback:', err);
            }
        }

        throw error;
    }
}

/**
 * Create a team invitation token
 * @param {Object} params - Invitation parameters
 * @param {string} params.agencyId - Agency ID
 * @param {string} params.email - Invitee email
 * @param {string} params.role - Role (admin or member)
 * @param {string} params.invitedBy - User ID of inviter
 * @param {string} params.customMessage - Optional custom message (max 500 chars)
 * @param {Array<string>} params.assignedModels - Optional array of model IDs to assign
 * @returns {Promise<Object>} Created invitation token
 */
async function createTeamInvitation({ agencyId, email, role = 'member', invitedBy, customMessage, assignedModels = [] }) {
    // Validate custom message length
    if (customMessage && customMessage.length > 500) {
        throw new Error('Custom message must be 500 characters or less');
    }

    // Check if user already exists in this agency
    const { data: existingUser } = await supabaseAdmin
        .from('agency_users')
        .select('id, status')
        .eq('agency_id', agencyId)
        .eq('email', email)
        .single();

    if (existingUser) {
        if (existingUser.status === 'active') {
            throw new Error('User is already a member of this agency');
        } else if (existingUser.status === 'invited') {
            throw new Error('User has already been invited to this agency');
        }
    }

    // Generate invitation token using database function
    const { data: tokenData, error: tokenError } = await supabaseAdmin
        .rpc('generate_invitation_token');

    if (tokenError || !tokenData) {
        throw new Error('Failed to generate invitation token');
    }

    const token = tokenData;

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation record
    const insertData = {
        agency_id: agencyId,
        email,
        token,
        role,
        invited_by: invitedBy,
        expires_at: expiresAt.toISOString()
    };

    // Add optional fields
    if (customMessage) {
        insertData.custom_message = customMessage;
    }
    if (assignedModels.length > 0) {
        insertData.assigned_models = assignedModels;
    }

    const { data: invitation, error: invitationError } = await supabaseAdmin
        .from('invitation_tokens')
        .insert(insertData)
        .select()
        .single();

    if (invitationError) {
        console.error('Error creating invitation:', invitationError);
        throw new Error(`Failed to create invitation: ${invitationError.message}`);
    }

    return invitation;
}

/**
 * Accept a team invitation
 * @param {Object} params - Acceptance parameters
 * @param {string} params.token - Invitation token
 * @param {string} params.name - User full name
 * @param {string} params.password - User password
 * @returns {Promise<Object>} Created user and agency info
 */
async function acceptTeamInvitation({ token, name, password }) {
    // Find invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
        .from('invitation_tokens')
        .select('*, agencies(id, name, slug)')
        .eq('token', token)
        .single();

    if (inviteError || !invitation) {
        throw new Error('Invalid or expired invitation');
    }

    // Check if already accepted
    if (invitation.accepted_at) {
        throw new Error('This invitation has already been accepted');
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
        throw new Error('This invitation has expired');
    }

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
        user_metadata: {
            name,
            agency_id: invitation.agency_id
        }
    });

    if (authError) {
        console.error('Error creating auth user:', authError);
        throw new Error(`Failed to create user account: ${authError.message}`);
    }

    // Get default permissions for role
    const { data: defaultPermissions } = await supabaseAdmin
        .rpc('get_default_permissions', { user_role: invitation.role });

    // Create agency_users link
    const { data: agencyUser, error: agencyUserError } = await supabaseAdmin
        .from('agency_users')
        .insert({
            agency_id: invitation.agency_id,
            auth_user_id: authData.user.id,
            email: invitation.email,
            name,
            role: invitation.role,
            status: 'active',
            invited_at: invitation.created_at,
            joined_at: new Date().toISOString(),
            permissions: defaultPermissions || undefined
        })
        .select()
        .single();

    if (agencyUserError) {
        // Rollback: delete the auth user
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        console.error('Error creating agency user link:', agencyUserError);
        throw new Error(`Failed to create user profile: ${agencyUserError.message}`);
    }

    // If models were assigned in invitation, create assignments
    if (invitation.assigned_models && invitation.assigned_models.length > 0) {
        const assignments = invitation.assigned_models.map(modelId => ({
            user_id: agencyUser.id,
            model_id: modelId,
            assigned_by: invitation.invited_by
        }));

        const { error: assignmentError } = await supabaseAdmin
            .from('user_model_assignments')
            .insert(assignments);

        if (assignmentError) {
            console.error('Error creating model assignments:', assignmentError);
            // Don't fail the whole operation, just log it
        }
    }

    // Mark invitation as accepted (with check for race condition)
    const { error: updateError } = await supabaseAdmin
        .from('invitation_tokens')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)
        .is('accepted_at', null); // Only update if not already accepted

    // If update affected 0 rows, someone else accepted it
    if (updateError) {
        console.error('Race condition detected: invitation already accepted');
    }

    // Log team activity
    const { logTeamActivity } = require('../middleware/permissions');
    await logTeamActivity({
        agencyId: invitation.agency_id,
        actorId: agencyUser.id,
        action: 'user_joined',
        targetUserId: agencyUser.id,
        metadata: { role: invitation.role, invited_by: invitation.invited_by }
    });

    return {
        authUser: authData.user,
        agencyUser,
        agency: invitation.agencies,
        assignedModels: invitation.assigned_models || []
    };
}

/**
 * Mark agency onboarding as completed
 * @param {string} agencyId - Agency ID
 * @returns {Promise<Object>} Updated agency
 */
async function completeOnboarding(agencyId) {
    const { data: agency, error } = await supabaseAdmin
        .from('agencies')
        .update({ onboarding_completed: true })
        .eq('id', agencyId)
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to complete onboarding: ${error.message}`);
    }

    return agency;
}

module.exports = {
    generateSlug,
    isSlugAvailable,
    generateUniqueSlug,
    createAgency,
    createAgencyOwner,
    provisionAgency,
    createTeamInvitation,
    acceptTeamInvitation,
    completeOnboarding
};
