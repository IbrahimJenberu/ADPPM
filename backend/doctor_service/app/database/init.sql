-- doctor_service/databse/init.sql
-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Execute this SQL on the doctor_db to allow NULL password_hash
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE lab_requests 
DROP CONSTRAINT IF EXISTS lab_requests_doctor_id_fkey;

-- Drop the existing phone_number column and add contact_number
-- Drop existing constraints

-- Lab Request Files
CREATE TABLE IF NOT EXISTS lab_request_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lab_request_id UUID NOT NULL REFERENCES lab_requests(id),
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    description TEXT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lab Request History
CREATE TABLE IF NOT EXISTS lab_request_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lab_request_id UUID NOT NULL REFERENCES lab_requests(id),
    action VARCHAR(50) NOT NULL,
    action_by UUID NOT NULL REFERENCES users(id),
    action_by_role VARCHAR(50) NOT NULL,
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    details JSONB NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lab Request Comments
CREATE TABLE IF NOT EXISTS lab_request_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lab_request_id UUID NOT NULL REFERENCES lab_requests(id),
    user_id UUID NOT NULL REFERENCES users(id),
    comment TEXT NOT NULL,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_request_files ON lab_request_files(lab_request_id);
CREATE INDEX IF NOT EXISTS idx_lab_request_history ON lab_request_history(lab_request_id);
CREATE INDEX IF NOT EXISTS idx_lab_request_comments ON lab_request_comments(lab_request_id);
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


-- First, drop any constraints from other tables that reference patients.id
-- This SQL script will drop and recreate the patients table with the correct structure
-- and configure the JSON fields properly

-- First drop any constraints from other tables that reference patients
DO $$
DECLARE
    constraint_rec RECORD;
BEGIN
    FOR constraint_rec IN
        SELECT conname, conrelid::regclass AS table_name
        FROM pg_constraint
        WHERE confrelid = 'patients'::regclass::oid
    LOOP
        EXECUTE 'ALTER TABLE ' || constraint_rec.table_name || 
                ' DROP CONSTRAINT ' || constraint_rec.conname;
    END LOOP;
END $$;

-- Drop the existing patients table
DROP TABLE IF EXISTS patients CASCADE;

-- Create the patients table with the correct schema to match cardroom_service
CREATE TABLE patients (
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
    is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for better performance
CREATE INDEX idx_patients_registration_number ON patients(registration_number);
CREATE INDEX idx_patients_name ON patients(first_name, last_name);
-- Restore any foreign key references that other tables might need
-- You'll need to manually add back any foreign key constraints that were dropped
-- Example: ALTER TABLE medical_records ADD CONSTRAINT fk_patient FOREIGN KEY (patient_id) REFERENCES patients(id);


-- Patient-Doctor assignments
CREATE TABLE IF NOT EXISTS patient_doctor_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT NULL,
    UNIQUE(patient_id, doctor_id, is_active)
);

-- Medical records
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID NOT NULL REFERENCES users(id),
    diagnosis TEXT NOT NULL,
    treatment TEXT NULL,
    notes TEXT NULL,
    medications TEXT[] NULL,
    vital_signs JSONB NULL,
    follow_up_date DATE NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID NOT NULL REFERENCES users(id),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    reason TEXT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    notes TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lab Requests
CREATE TABLE IF NOT EXISTS lab_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID NOT NULL REFERENCES users(id),
    test_type VARCHAR(100) NOT NULL,
    urgency VARCHAR(20) NOT NULL,
    notes TEXT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    result TEXT NULL,
    result_date TIMESTAMP WITH TIME ZONE NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medical Reports
CREATE TABLE IF NOT EXISTS medical_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    doctor_id UUID NOT NULL REFERENCES users(id),
    diagnosis TEXT NOT NULL,
    treatment TEXT NOT NULL,
    prescriptions TEXT[] NOT NULL,
    observations TEXT NULL,
    recommendations TEXT NULL,
    format_type VARCHAR(10) DEFAULT 'pdf',
    report_content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update Notifications Table


ALTER TABLE notifications ALTER COLUMN notification_type DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN message DROP NOT NULL;


-- Final Table Structure
CREATE TABLE IF NOT EXISTS notifications (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     recipient_id UUID NOT NULL REFERENCES users(id),
     message TEXT NOT NULL,
     notification_type VARCHAR(50) NOT NULL,
     entity_type VARCHAR(50),
     entity_id UUID,
     is_read BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     read_at TIMESTAMP WITH TIME ZONE
 );




-- Create indexes
--CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(first_name, last_name);
--CREATE INDEX IF NOT EXISTS idx_patient_doctor ON patient_doctor_assignments(patient_id, doctor_id);
--CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id);
--CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
--CREATE INDEX IF NOT EXISTS idx_lab_requests_doctor ON lab_requests(doctor_id);
--CREATE INDEX IF NOT EXISTS idx_lab_requests_patient ON lab_requests(patient_id);
--CREATE INDEX IF NOT EXISTS idx_medical_reports_patient ON medical_reports(patient_id);
--CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
