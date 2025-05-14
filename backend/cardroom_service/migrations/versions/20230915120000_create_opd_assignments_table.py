from alembic import op

def upgrade():
    op.execute("""
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        
        -- Patients table
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
            medical_history JSONB DEFAULT '{}',
            allergies TEXT[],
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_deleted BOOLEAN DEFAULT FALSE
        );
        
        -- OPD Assignments
        CREATE TABLE IF NOT EXISTS opd_assignments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            patient_id UUID NOT NULL REFERENCES patients(id),
            doctor_id VARCHAR(255) NOT NULL,
            doctor_name VARCHAR(255) NOT NULL,
            doctor_specialty VARCHAR(255) NOT NULL,
            reason VARCHAR(255) NOT NULL,
            priority VARCHAR(20) DEFAULT 'NORMAL',
            status VARCHAR(20) DEFAULT 'PENDING',
            notes TEXT,
            assigned_by VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_deleted BOOLEAN DEFAULT FALSE
        );
        
        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_opd_patient ON opd_assignments(patient_id);
        CREATE INDEX IF NOT EXISTS idx_opd_doctor ON opd_assignments(doctor_id);
    """)

def downgrade():
    op.execute("""
        DROP INDEX IF EXISTS idx_opd_doctor;
        DROP INDEX IF EXISTS idx_opd_patient;
        DROP TABLE IF EXISTS opd_assignments;
        DROP TABLE IF EXISTS patients;
    """)