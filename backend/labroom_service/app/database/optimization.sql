-- Highly optimized indexes for lab requests performance
-- Run this as a database migration

-- First, add necessary extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop existing indexes that might conflict
DROP INDEX IF EXISTS idx_lab_requests_patient_id;
DROP INDEX IF EXISTS idx_lab_requests_doctor_id;
DROP INDEX IF EXISTS idx_lab_requests_technician_id;
DROP INDEX IF EXISTS idx_lab_requests_status;

-- Add specialized covering indexes
CREATE INDEX IF NOT EXISTS idx_lab_requests_optimized ON lab_requests 
(status, priority, test_type, created_at DESC) 
INCLUDE (id, patient_id, doctor_id, technician_id)
WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_lab_requests_technician ON lab_requests 
(technician_id, created_at DESC) 
INCLUDE (status, priority)
WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_lab_requests_created_id ON lab_requests 
(created_at DESC, id DESC) 
INCLUDE (status, priority, test_type)
WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_lab_results_request ON lab_results
(lab_request_id, created_at DESC)
INCLUDE (result_data, conclusion)
WHERE is_deleted = FALSE;

-- Add trigram index for text search
CREATE INDEX IF NOT EXISTS idx_lab_requests_notes_trigram ON lab_requests 
USING gin (notes gin_trgm_ops)
WHERE is_deleted = FALSE;

-- Create a materialized view for common queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_recent_lab_requests AS
SELECT 
    id, patient_id, doctor_id, technician_id, test_type, 
    priority, status, created_at, updated_at
FROM lab_requests
WHERE is_deleted = FALSE
ORDER BY created_at DESC
LIMIT 500;

-- Create index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_recent_lab_requests ON mv_recent_lab_requests(id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_mv_recent_lab_requests()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recent_lab_requests;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh the view on changes
CREATE TRIGGER refresh_mv_recent_lab_requests_trigger
AFTER INSERT OR UPDATE OR DELETE ON lab_requests
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_mv_recent_lab_requests();

-- Add partial indexes for common filters
CREATE INDEX IF NOT EXISTS idx_lab_requests_pending ON lab_requests(created_at DESC)
WHERE status = 'pending' AND is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_lab_requests_high_priority ON lab_requests(created_at DESC)
WHERE priority = 'high' AND is_deleted = FALSE;

-- Composite index for lab results with request info
CREATE INDEX IF NOT EXISTS idx_lab_results_request_id ON lab_results 
(lab_request_id, created_at DESC)
WHERE is_deleted = FALSE;

-- Index on result creation time
CREATE INDEX IF NOT EXISTS idx_lab_results_created_at ON lab_results 
(created_at DESC)
WHERE is_deleted = FALSE;

-- Create index for images
CREATE INDEX IF NOT EXISTS idx_result_images_result_id ON result_images
(result_id, created_at DESC);

-- Update database statistics
ANALYZE lab_requests;
ANALYZE lab_results;