-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== ENUM MIGRATIONS =====

-- ---------- TEST STATUS ENUM ----------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_status') THEN
        CREATE TYPE test_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
    END IF;
END$$;

-- ---------- TEST PRIORITY ENUM ----------
-- Step 1: Remove default before modifying enum
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='lab_requests' AND column_name='priority'
    ) THEN
        ALTER TABLE lab_requests ALTER COLUMN priority DROP DEFAULT;
    END IF;
END$$;

-- Step 2: Rename old enum if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_priority') THEN
        ALTER TYPE test_priority RENAME TO test_priority_old;
    END IF;
END$$;

-- Step 3: Create new test_priority enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_priority') THEN
        CREATE TYPE test_priority AS ENUM ('high', 'medium', 'low');
    END IF;
END$$;

-- Step 4: Convert column to new enum
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='lab_requests' AND column_name='priority'
    ) THEN
        ALTER TABLE lab_requests 
        ALTER COLUMN priority TYPE test_priority 
        USING priority::text::test_priority;
    END IF;
END$$;

-- Step 5: Reapply default value
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='lab_requests' AND column_name='priority'
    ) THEN
        ALTER TABLE lab_requests ALTER COLUMN priority SET DEFAULT 'medium';
    END IF;
END$$;

-- Step 6: Drop old enum
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_priority_old') THEN
        DROP TYPE test_priority_old;
    END IF;
END$$;

-- ---------- TEST TYPE ENUM ----------
-- Step 1: Rename old test_type if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_type') THEN
        ALTER TYPE test_type RENAME TO test_type_old;
    END IF;
END$$;

-- Step 2: Create new test_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_type') THEN
        CREATE TYPE test_type AS ENUM (
            'complete_blood_count',
            'comprehensive_metabolic_panel',
            'lipid_panel',
            'liver_function_test',
            'thyroid_panel',
            'urinalysis',
            'hba1c',
            'chest_xray',
            'ecg',
            'covid19_test',
            'allergy_test',
            'vitamin_d_test'
        );
    END IF;
END$$;

-- Step 3: Convert column to new test_type
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='lab_requests' AND column_name='test_type'
    ) THEN
        ALTER TABLE lab_requests 
        ALTER COLUMN test_type TYPE test_type 
        USING test_type::text::test_type;
    END IF;
END$$;

-- Step 4: Drop old enum
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_type_old') THEN
        DROP TYPE test_type_old;
    END IF;
END$$;

-- ===== TABLE CREATIONS =====

-- ---------- LAB REQUESTS TABLE ----------
CREATE TABLE IF NOT EXISTS lab_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    technician_id UUID,
    test_type test_type NOT NULL,
    priority test_priority NOT NULL DEFAULT 'medium',
    status test_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    diagnosis_notes TEXT,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ---------- LAB RESULTS TABLE ----------
CREATE TABLE IF NOT EXISTS lab_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lab_request_id UUID NOT NULL REFERENCES lab_requests(id) ON DELETE CASCADE,
    result_data JSONB NOT NULL DEFAULT '{}',
    conclusion TEXT,
    image_paths TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ---------- LAB NOTIFICATIONS TABLE ----------
CREATE TABLE IF NOT EXISTS lab_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    lab_request_id UUID REFERENCES lab_requests(id),
    lab_result_id UUID REFERENCES lab_results(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Users table (for reference and foreign keys)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    department VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_lab_requests_patient_id ON lab_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_requests_doctor_id ON lab_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_lab_requests_technician_id ON lab_requests(technician_id);
CREATE INDEX IF NOT EXISTS idx_lab_requests_status ON lab_requests(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_results_lab_request_id ON lab_results(lab_request_id);
CREATE INDEX IF NOT EXISTS idx_lab_notifications_recipient_id ON lab_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_lab_notifications_lab_request_id ON lab_notifications(lab_request_id);

-- Add is_read flag to lab_requests
ALTER TABLE lab_requests ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE lab_requests ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Create lab_request_events table for detailed audit history
CREATE TABLE IF NOT EXISTS lab_request_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lab_request_id UUID NOT NULL REFERENCES lab_requests(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- received, viewed, read, updated, completed, etc.
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id UUID, -- The user who triggered the event (if applicable)
    details JSONB -- Additional event details
);

-- Create analytics_metrics table for real-time analytics
CREATE TABLE IF NOT EXISTS analytics_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(50) NOT NULL, -- total_requests, pending_requests, etc.
    metric_value INTEGER NOT NULL,
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create a table to store generated reports
CREATE TABLE IF NOT EXISTS lab_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type VARCHAR(50) NOT NULL, -- weekly, monthly, custom
    report_format VARCHAR(10) NOT NULL, -- csv, pdf
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    file_path TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_lab_request_events_lab_request_id ON lab_request_events(lab_request_id);
CREATE INDEX IF NOT EXISTS idx_lab_request_events_event_type ON lab_request_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_metric_date ON analytics_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_lab_requests_is_read ON lab_requests(is_read) WHERE is_deleted = FALSE;

-- Indexes for improved performance
CREATE INDEX IF NOT EXISTS idx_lab_requests_created_at ON lab_requests(created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_requests_priority_status ON lab_requests(priority, status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_requests_test_type ON lab_requests(test_type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_requests_patient_doctor ON lab_requests(patient_id, doctor_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_lab_results_created_at ON lab_results(created_at DESC);

-- Composite index for pagination
CREATE INDEX IF NOT EXISTS idx_lab_requests_pagination ON lab_requests(created_at DESC, id DESC) WHERE is_deleted = FALSE;

-- Index for lab results query
CREATE INDEX IF NOT EXISTS idx_lab_results_request_id_created ON lab_results(lab_request_id, created_at DESC) WHERE is_deleted = FALSE;