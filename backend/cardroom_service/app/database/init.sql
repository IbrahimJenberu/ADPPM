-- cardroom_service/databse/init.sql
-- Create trigger function
CREATE OR REPLACE FUNCTION log_patient_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        entity_type, 
        entity_id, 
        action, 
        user_id, 
        changes, 
        ip_address
    ) VALUES (
        'patients',
        NEW.id,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'CREATE'
            WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
            WHEN TG_OP = 'DELETE' THEN 'DELETE'
        END,
        current_setting('app.current_user_id', true)::uuid,
        CASE
            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
            WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
        END,
        current_setting('app.client_ip', true)
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;  -- Ensure closing $$ with language specification

-- Create UUID extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; 

ALTER TABLE opd_assignments DROP CONSTRAINT IF EXISTS opd_assignments_doctor_id_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_doctor_id_fkey;

-- To drop the 'reason' column from the opd_assignments table
ALTER TABLE appointments
DROP COLUMN IF EXISTS scheduled_by;


-- Patients table (core entity)
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    blood_group VARCHAR(10),
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    medical_history JSONB DEFAULT '{}'::jsonb,
    allergies JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Create index on patient name for faster search
CREATE INDEX IF NOT EXISTS idx_patient_name ON patients(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_registration_number ON patients(registration_number);

-- Doctors reference table (minimal data needed for the cardroom service)
-- Doctors table remains the same
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(200) NOT NULL,
    department VARCHAR(100) NOT NULL,  
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- OPD Assignments table (NO FK to doctors table)
CREATE TABLE IF NOT EXISTS opd_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID NOT NULL,  -- No FK constraint
    priority VARCHAR(20) DEFAULT 'NORMAL',
    status VARCHAR(20) DEFAULT 'PENDING',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);


-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_opd_patient ON opd_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_opd_doctor ON opd_assignments(doctor_id);

-- Appointments table (NO FK to doctors table)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID NOT NULL,  -- No FK constraint
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    appointment_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT no_overlapping_appointments UNIQUE (doctor_id, appointment_date, duration_minutes)
);


-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointment_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointment_date ON appointments(appointment_date);

-- Audit logs table for tracking all changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- patients, opd_assignments, appointments
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE
    user_id UUID NOT NULL, -- Reference to user ID from auth service
    changes JSONB NOT NULL,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- Create trigger functions for audit logging
CREATE OR REPLACE FUNCTION log_patient_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        entity_type, entity_id, action, user_id, changes, ip_address
    ) VALUES (
        'patients',
        NEW.id,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'CREATE'
            WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
            WHEN TG_OP = 'DELETE' THEN 'DELETE'
        END,
        current_setting('app.current_user_id', true)::uuid,
        CASE
            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
            WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
        END,
        current_setting('app.client_ip', true)
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create similar trigger functions for OPD assignments and appointments
-- (Same pattern as above, just change the entity_type and table references)

-- Notifications table to track all system notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL, -- User ID from auth service
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(50), -- patients, opd_assignments, appointments
    entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);