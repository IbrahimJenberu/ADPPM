-- doctor_service/migrations/add_sync_timestamps.sql
-- Run this on the doctor_db to add last_synced_at column

ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries based on sync time
CREATE INDEX IF NOT EXISTS idx_patients_last_synced 
ON patients(last_synced_at);