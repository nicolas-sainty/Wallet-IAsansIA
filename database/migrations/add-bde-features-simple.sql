-- Simplified Migration: Add BDE Features
-- This version adds only essential columns without changing existing types

-- ========================================
-- 1. Add BDE to Users
-- ========================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS bde_id UUID REFERENCES groups(group_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_bde ON users(bde_id);

-- ========================================
-- 2. Add Event Management Columns 
-- ========================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS max_participants INTEGER,
ADD COLUMN IF NOT EXISTS current_participants INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_creator ON events(created_by_user_id);

-- ========================================
-- 3. Event Participants Status
-- ========================================

ALTER TABLE event_participants
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'registered';

-- ========================================
-- 4. Initialize Counts
-- ========================================

UPDATE events e
SET current_participants = (
    SELECT COUNT(*)
    FROM event_participants ep
    WHERE ep.event_id = e.event_id
)
WHERE current_participants IS NULL OR current_participants = 0;

-- ========================================
-- 5. Trigger for Auto-updating Participant Count
-- ========================================

CREATE OR REPLACE FUNCTION update_event_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE events 
        SET current_participants = current_participants + 1
        WHERE event_id = NEW.event_id;
        
        -- Auto-update to FULL if max reached (only if status is text-based)
        UPDATE events
        SET status = 'FULL'
        WHERE event_id = NEW.event_id
        AND max_participants IS NOT NULL
        AND current_participants >= max_participants
        AND (status = 'OPEN' OR status = 'upcoming' OR status = 'active');
        
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE events 
        SET current_participants = GREATEST(0, current_participants - 1) 
        WHERE event_id = OLD.event_id;
        
        -- Reopen if was FULL
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

DROP TRIGGER IF EXISTS trigger_update_participant_count ON event_participants;
CREATE TRIGGER trigger_update_participant_count
AFTER INSERT OR DELETE ON event_participants
FOR EACH ROW
EXECUTE FUNCTION update_event_participant_count();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '   - Added bde_id to users';
    RAISE NOTICE '   - Added max_participants, current_participants, created_by_user_id to events';
    RAISE NOTICE '   - Added status to event_participants';
    RAISE NOTICE '   - Created auto-count trigger';
END $$;
