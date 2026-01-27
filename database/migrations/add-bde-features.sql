-- Migration: Add BDE Features and Event Management
-- Date: 2026-01-23
-- Description: Add user-BDE association, event status enum, and event participation tracking

-- ========================================
-- 1. Add BDE to Users
-- ========================================

-- Add bde_id column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS bde_id UUID REFERENCES groups(group_id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_bde ON users(bde_id);

COMMENT ON COLUMN users.bde_id IS 'BDE (group) the user belongs to';

-- ========================================
-- 2. Event Status Management
-- ========================================

-- Create event status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE event_status AS ENUM ('DRAFT', 'OPEN', 'FULL', 'CLOSED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS max_participants INTEGER,
ADD COLUMN IF NOT EXISTS current_participants INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL;

-- Update existing status values to match enum (if column exists and is text)
DO $$
BEGIN
    -- Check if status column exists and is not already the enum type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'status' 
        AND data_type = 'character varying'
    ) THEN
        -- Update values to match enum
        UPDATE events SET status = 'OPEN' WHERE status IN ('upcoming', 'active') OR status IS NULL;
        UPDATE events SET status = 'CLOSED' WHERE status = 'completed';
        UPDATE events SET status = 'CANCELLED' WHERE status = 'cancelled';
        UPDATE events SET status = 'DRAFT' WHERE status NOT IN ('OPEN', 'CLOSED', 'CANCELLED');
        
        -- Convert column type using explicit cast
        ALTER TABLE events 
        ALTER COLUMN status TYPE event_status 
        USING status::event_status;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'status'
    ) THEN
        -- Column doesn't exist, create it
        ALTER TABLE events ADD COLUMN status event_status DEFAULT 'OPEN';
    END IF;
END $$;

-- Set default for new rows
ALTER TABLE events 
ALTER COLUMN status SET DEFAULT 'OPEN'::event_status;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_events_creator ON events(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

COMMENT ON COLUMN events.max_participants IS 'Maximum number of participants (NULL = unlimited)';
COMMENT ON COLUMN events.current_participants IS 'Current count of registered participants';
COMMENT ON COLUMN events.created_by_user_id IS 'Admin user who created the event';

-- ========================================
-- 3. Event Participants Enhancement
-- ========================================

-- Add status column to event_participants
ALTER TABLE event_participants
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'registered';

-- Possible statuses: registered, attended, cancelled
COMMENT ON COLUMN event_participants.status IS 'Participant status: registered, attended, cancelled';

-- ========================================
-- 4. Trigger for Auto-updating Participant Count
-- ========================================

-- Function to update current_participants count
CREATE OR REPLACE FUNCTION update_event_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment count
        UPDATE events 
        SET current_participants = current_participants + 1
        WHERE event_id = NEW.event_id;
        
        -- Auto-update status to FULL if max reached
        UPDATE events
        SET status = 'FULL'
        WHERE event_id = NEW.event_id
        AND max_participants IS NOT NULL
        AND current_participants >= max_participants
        AND status = 'OPEN';
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement count
        UPDATE events 
        SET current_participants = GREATEST(0, current_participants - 1)
        WHERE event_id = OLD.event_id;
        
        -- Reopen if was FULL and now has space
        UPDATE events
        SET status = 'OPEN'
        WHERE event_id = OLD.event_id
        AND status = 'FULL'
        AND max_participants IS NOT NULL
        AND current_participants < max_participants;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_participant_count ON event_participants;
CREATE TRIGGER trigger_update_participant_count
AFTER INSERT OR DELETE ON event_participants
FOR EACH ROW
EXECUTE FUNCTION update_event_participant_count();

-- ========================================
-- 5. Initialize current_participants for existing events
-- ========================================

-- Update current count for existing events
UPDATE events e
SET current_participants = (
    SELECT COUNT(*)
    FROM event_participants ep
    WHERE ep.event_id = e.event_id
);

-- ========================================
-- Verification Queries
-- ========================================

-- Check users table structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';

-- Check events table structure  
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'events';

-- Check enum values
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'event_status'::regtype ORDER BY enumsortorder;

COMMENT ON TABLE events IS 'Events created by BDE admins with status tracking and participant limits';
COMMENT ON TABLE event_participants IS 'Tracks user participation in events with status';
