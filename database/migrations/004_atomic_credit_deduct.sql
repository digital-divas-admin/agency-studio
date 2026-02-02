-- =============================================
-- Migration: Atomic Credit Deduction
-- Replaces read-check-write credit deduction with atomic operations
-- to prevent race conditions under concurrent workflow runs.
-- =============================================

-- Atomically deduct credits from an agency's pool.
-- Returns the new credit_pool value, or -1 if insufficient credits.
CREATE OR REPLACE FUNCTION deduct_agency_credits(
    p_agency_id UUID,
    p_amount INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    new_pool INTEGER;
BEGIN
    UPDATE agencies
    SET credit_pool = credit_pool - p_amount,
        credits_used_this_cycle = credits_used_this_cycle + p_amount
    WHERE id = p_agency_id
      AND credit_pool >= p_amount
    RETURNING credit_pool INTO new_pool;

    IF NOT FOUND THEN
        RETURN -1;
    END IF;

    RETURN new_pool;
END;
$$;

-- Atomically increment a user's cycle usage.
CREATE OR REPLACE FUNCTION increment_user_credits_used(
    p_user_id UUID,
    p_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE agency_users
    SET credits_used_this_cycle = credits_used_this_cycle + p_amount
    WHERE id = p_user_id;
END;
$$;
