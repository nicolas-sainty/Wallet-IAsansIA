-- Migration: Add REWARD to transaction_type enum
-- Date: 2026-03-27

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'REWARD';
