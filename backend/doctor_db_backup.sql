--
-- PostgreSQL database dump
--

-- Dumped from database version 15.12 (Debian 15.12-1.pgdg120+1)
-- Dumped by pg_dump version 15.12 (Debian 15.12-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: doctor_user
--

CREATE TABLE public.appointments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    appointment_date date NOT NULL,
    appointment_time time without time zone NOT NULL,
    duration_minutes integer DEFAULT 30,
    reason text,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.appointments OWNER TO doctor_user;

--
-- Name: lab_request_comments; Type: TABLE; Schema: public; Owner: doctor_user
--

CREATE TABLE public.lab_request_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lab_request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    comment text NOT NULL,
    is_private boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_request_comments OWNER TO doctor_user;

--
-- Name: lab_request_files; Type: TABLE; Schema: public; Owner: doctor_user
--

CREATE TABLE public.lab_request_files (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lab_request_id uuid NOT NULL,
    filename character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size integer NOT NULL,
    description text,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_request_files OWNER TO doctor_user;

--
-- Name: lab_request_history; Type: TABLE; Schema: public; Owner: doctor_user
--

CREATE TABLE public.lab_request_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lab_request_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    action_by uuid NOT NULL,
    action_by_role character varying(50) NOT NULL,
    previous_status character varying(20),
    new_status character varying(20),
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_request_history OWNER TO doctor_user;

--
-- Name: lab_requests; Type: TABLE; Schema: public; Owner: doctor_user
--

CREATE TABLE public.lab_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    test_type character varying(100) NOT NULL,
    urgency character varying(20) NOT NULL,
    notes text,
    status character varying(20) DEFAULT 'pending'::character varying,
    result text,
    result_date timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.lab_requests OWNER TO doctor_user;

--
-- Name: medical_records; Type: TABLE; Schema: public; Owner: doctor_user
--

CREATE TABLE public.medical_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    diagnosis text NOT NULL,
    treatment text,
    notes text,
    medications text[],
    vital_signs jsonb,
    follow_up_date date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.medical_records OWNER TO doctor_user;

--
-- Name: medical_reports; Type: TABLE; Schema: public; Owner: doctor_user
--

CREATE TABLE public.medical_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    diagnosis text NOT NULL,
    treatment text NOT NULL,
    prescriptions text[] NOT NULL,
    observations text,
    recommendations text,
    format_type character varying(10) DEFAULT 'pdf'::character varying,
    report_content text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.medical_reports OWNER TO doctor_user;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: doctor_user
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    recipient_id uuid NOT NULL,
    notification_type character varying(50),
    entity_id uuid,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    message text DEFAULT ''::text,
    entity_type character varying(50),
    read_at timestamp with time zone
);


ALTER TABLE public.notifications OWNER TO doctor_user;

--
-- Name: patient_doctor_assignments; Type: TABLE; Schema: public; Owner: doctor_user
--

CREATE TABLE public.patient_doctor_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    notes text
);


ALTER TABLE public.patient_doctor_assignments OWNER TO doctor_user;

--
-- Name: patients; Type: TABLE; Schema: public; Owner: doctor_user
--

CREATE TABLE public.patients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    registration_number character varying(50) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    date_of_birth date NOT NULL,
    gender character varying(20) NOT NULL,
    blood_group character varying(10),
    phone_number character varying(20) NOT NULL,
    email character varying(100),
    address text,
    emergency_contact_name character varying(100),
    emergency_contact_phone character varying(20),
    medical_history jsonb DEFAULT '{}'::jsonb,
    allergies jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


ALTER TABLE public.patients OWNER TO doctor_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: doctor_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    full_name character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    patient_id uuid,
    specialization character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    department character varying(255)
);


ALTER TABLE public.users OWNER TO doctor_user;

--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: doctor_user
--

COPY public.appointments (id, patient_id, doctor_id, appointment_date, appointment_time, duration_minutes, reason, status, notes, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lab_request_comments; Type: TABLE DATA; Schema: public; Owner: doctor_user
--

COPY public.lab_request_comments (id, lab_request_id, user_id, comment, is_private, created_at) FROM stdin;
d328e5e9-20d7-4193-a3ce-40f3fa16cac1	8206e078-14f0-4e49-af13-91e4b7fdfb22	722421d7-e863-46cd-9f55-35c992839c8a	new	f	2025-04-14 16:31:46.133986+00
c0e61df6-d7c0-461f-b2e6-4264fd3bc783	8206e078-14f0-4e49-af13-91e4b7fdfb22	722421d7-e863-46cd-9f55-35c992839c8a	new	f	2025-04-15 17:06:26.012643+00
7fd51049-fc71-4f32-80a5-3b47c94a9b8e	840cb0e9-bf81-4f61-89e1-2e7b78c1d4a5	722421d7-e863-46cd-9f55-35c992839c8a	fegahdjf	f	2025-04-15 17:11:50.339144+00
\.


--
-- Data for Name: lab_request_files; Type: TABLE DATA; Schema: public; Owner: doctor_user
--

COPY public.lab_request_files (id, lab_request_id, filename, file_type, file_size, description, uploaded_by, created_at) FROM stdin;
63c2ea94-8664-4bc2-884e-44e049cc1758	840cb0e9-bf81-4f61-89e1-2e7b78c1d4a5	DAA ch4 (2).pdf	application/pdf	632777	\N	722421d7-e863-46cd-9f55-35c992839c8a	2025-04-15 17:23:46.669619+00
9b162299-754f-4526-82f3-d8527f4ec2f6	489ed4e0-81b1-4854-a486-93c81874f8f4	1)Micro-service and AI-based Hospital Management System (MAHMS).pdf	application/pdf	82592	\N	722421d7-e863-46cd-9f55-35c992839c8a	2025-05-19 14:19:51.566244+00
\.


--
-- Data for Name: lab_request_history; Type: TABLE DATA; Schema: public; Owner: doctor_user
--

COPY public.lab_request_history (id, lab_request_id, action, action_by, action_by_role, previous_status, new_status, details, created_at) FROM stdin;
1675bb15-1d94-4f0e-a168-12de9d5a91f6	8206e078-14f0-4e49-af13-91e4b7fdfb22	cancelled	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	cancelled	{"details": "Doctor cancelled lab request", "cancellation_reason": "No reason provided"}	2025-04-14 16:30:16.512591+00
252e4c9e-9c28-49d8-8919-a5ff3ccbecb0	8206e078-14f0-4e49-af13-91e4b7fdfb22	updated	722421d7-e863-46cd-9f55-35c992839c8a	doctor	cancelled	cancelled	{"details": "Doctor updated lab request", "updated_fields": ["notes", "urgency"]}	2025-04-14 16:31:13.315576+00
e3a46e72-e60d-4798-a03d-220d83c81f03	840cb0e9-bf81-4f61-89e1-2e7b78c1d4a5	updated	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	pending	{"details": "Doctor updated lab request", "updated_fields": ["notes"]}	2025-04-14 17:52:01.144116+00
dd31ba22-c4ae-4535-a789-4a118af9d481	840cb0e9-bf81-4f61-89e1-2e7b78c1d4a5	updated	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	pending	{"details": "Doctor updated lab request", "updated_fields": ["notes"]}	2025-04-15 17:01:40.633512+00
cde9f435-af77-4fd0-a01d-6090084e88c1	840cb0e9-bf81-4f61-89e1-2e7b78c1d4a5	updated	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	pending	{"details": "Doctor updated lab request", "updated_fields": ["urgency"]}	2025-04-15 17:03:23.541194+00
e3003835-6ddc-4a5b-85f4-3db9537548f6	840cb0e9-bf81-4f61-89e1-2e7b78c1d4a5	file_uploaded	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	pending	{"file_id": "63c2ea94-8664-4bc2-884e-44e049cc1758", "filename": "DAA ch4 (2).pdf", "file_size": 632777, "file_type": "application/pdf", "description": null}	2025-04-15 17:23:46.677378+00
816748f7-d376-46d2-84b0-fe45dfb66fe2	51183afb-c8d4-41df-9ead-61a96bdad68c	cancelled	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	cancelled	{"details": "Doctor cancelled lab request", "cancellation_reason": "no"}	2025-04-29 05:38:30.82488+00
0d463edb-ab68-47bb-98c6-f4bb174321a6	7609d3bc-2e15-4a4e-b6b7-c440574091c9	cancelled	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	cancelled	{"details": "Doctor cancelled lab request", "cancellation_reason": "no"}	2025-04-29 05:38:52.053666+00
2529e3b7-bf42-48e9-a9d0-7c31545e81a8	474ae4e2-420f-403b-a5ba-f0ad77a9e80a	cancelled	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	cancelled	{"details": "Doctor cancelled lab request", "cancellation_reason": "no"}	2025-04-30 09:44:03.369449+00
c50fe1e8-1b6b-49fd-bd44-560d4acaa455	474ae4e2-420f-403b-a5ba-f0ad77a9e80a	cancelled	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	cancelled	{"details": "Doctor cancelled lab request", "cancellation_reason": "no"}	2025-04-30 09:44:03.136484+00
8049acb9-9b54-4e12-874e-2d7ec5385334	474ae4e2-420f-403b-a5ba-f0ad77a9e80a	cancelled	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	cancelled	{"details": "Doctor cancelled lab request", "cancellation_reason": "no"}	2025-04-30 09:44:04.873212+00
d1cec1f6-2b30-4966-a9ba-863a21da2e5c	c62e6f77-d50c-4415-b46d-e10cd1d12f10	cancelled	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	cancelled	{"details": "Doctor cancelled lab request", "cancellation_reason": "no"}	2025-05-02 08:06:46.719298+00
ec912a92-4177-4629-8a63-6118bd7364fa	489ed4e0-81b1-4854-a486-93c81874f8f4	file_uploaded	722421d7-e863-46cd-9f55-35c992839c8a	doctor	pending	pending	{"file_id": "9b162299-754f-4526-82f3-d8527f4ec2f6", "filename": "1)Micro-service and AI-based Hospital Management System (MAHMS).pdf", "file_size": 82592, "file_type": "application/pdf", "description": null}	2025-05-19 14:19:51.641263+00
\.


--
-- Data for Name: lab_requests; Type: TABLE DATA; Schema: public; Owner: doctor_user
--

COPY public.lab_requests (id, patient_id, doctor_id, test_type, urgency, notes, status, result, result_date, is_active, created_at, updated_at) FROM stdin;
9ac15498-cca7-4f04-bcd1-b2fc0dffd4d6	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	thyroid_panel	high	ya	pending	\N	\N	t	2025-04-24 09:46:38.360744+00	2025-04-24 09:46:38.360744+00
8206e078-14f0-4e49-af13-91e4b7fdfb22	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	string	urgent	yes	cancelled	\N	\N	t	2025-04-14 16:14:06.479589+00	2025-04-14 16:31:13.315576+00
0a885b2a-ea66-435f-a121-603e5eb3bb62	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	ecg	high	new	pending	\N	\N	t	2025-04-24 10:16:39.210989+00	2025-04-24 10:16:39.210989+00
6a287bff-39b4-4610-8374-daecf47a6512	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	hba1c	high	new	pending	\N	\N	t	2025-04-24 10:30:45.375867+00	2025-04-24 10:30:45.375867+00
840cb0e9-bf81-4f61-89e1-2e7b78c1d4a5	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	string	stat	new	pending	\N	\N	t	2025-04-14 16:29:03.47876+00	2025-04-15 17:03:23.541194+00
79567a7e-c504-48f7-9931-bbf5e39e1ac8	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	string	medium	string	pending	\N	\N	t	2025-04-16 14:02:05.835589+00	2025-04-16 14:02:05.835589+00
cc8093eb-5026-437d-a436-bcb18c4cce30	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	Comprehensive Metabolic Panel	medium	xdf	pending	\N	\N	t	2025-04-16 17:10:20.723672+00	2025-04-16 17:10:20.723672+00
2ce7838a-5b01-41f2-8088-a950ee83714c	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	Comprehensive Metabolic Panel	medium	 vb	pending	\N	\N	t	2025-04-16 17:41:15.437031+00	2025-04-16 17:41:15.437031+00
994bffe3-4ccb-4103-a720-2ef3e1812eff	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	Complete Blood Count	medium	new	pending	\N	\N	t	2025-04-17 07:03:06.608482+00	2025-04-17 07:03:06.608482+00
00cf9692-c42b-440a-b171-d7bd28264320	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	Lipid Panel	low	trial1	pending	\N	\N	t	2025-04-17 07:24:18.011692+00	2025-04-17 07:24:18.011692+00
72a47ed7-b468-4bba-934b-e1b541ac85e7	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	Complete Blood Count	low	trial3	pending	\N	\N	t	2025-04-17 07:25:29.787585+00	2025-04-17 07:25:29.787585+00
733a7341-4710-4dac-a810-565d478cc413	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	COVID-19 Test	low	tadiyas adiss	pending	\N	\N	t	2025-04-17 08:58:16.619895+00	2025-04-17 08:58:16.619895+00
82d123af-ca37-4690-96c5-635ba5c94f0c	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	Complete Blood Count	low	nice	pending	\N	\N	t	2025-04-17 09:24:34.297207+00	2025-04-17 09:24:34.297207+00
8aa9cb28-83c1-4039-9c3f-aed18e5f81fc	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	Complete Blood Count	low	enenja	pending	\N	\N	t	2025-04-17 09:38:23.983609+00	2025-04-17 09:38:23.983609+00
4e0f66e7-90d5-42da-8dc6-8d90e940ea17	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	Urinalysis	medium	new day	pending	\N	\N	t	2025-04-17 09:43:54.268968+00	2025-04-17 09:43:54.268968+00
8965265a-75f1-421c-a39f-ef29ff4cd5e4	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	Urinalysis	medium	trial and	pending	\N	\N	t	2025-04-17 09:46:04.130831+00	2025-04-17 09:46:04.130831+00
7f9ce584-d952-402c-a1b3-b7a82b591821	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	COVID-19 Test	medium	newly	pending	\N	\N	t	2025-04-17 10:01:50.867728+00	2025-04-17 10:01:50.867728+00
2d12f7bb-37ec-41a8-8419-4487245d264b	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	Complete Blood Count	medium	new month	pending	\N	\N	t	2025-04-17 10:21:00.47505+00	2025-04-17 10:21:00.47505+00
7b9ce078-c378-445a-8029-3c4578ad8929	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	Complete Blood Count	medium	newlyyyyyyyy	pending	\N	\N	t	2025-04-17 10:31:14.676947+00	2025-04-17 10:31:14.676947+00
a6f3825d-29bf-493d-805d-da7786178ed9	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	Vitamin D Test	medium	new merge	pending	\N	\N	t	2025-04-17 10:41:27.932297+00	2025-04-17 10:41:27.932297+00
d9c9a5b0-02a1-45e2-ac5c-2e08443fae3e	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	low	new	pending	\N	\N	t	2025-04-17 13:11:46.381777+00	2025-04-17 13:11:46.381777+00
4348d8d5-c40c-4dc5-9d91-1e38e7202c2c	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	low	info	pending	\N	\N	t	2025-04-17 13:30:19.321706+00	2025-04-17 13:30:19.321706+00
a2b51fa7-fa02-4f47-b7b0-b10d0b3e94ba	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	low	yada	pending	\N	\N	t	2025-04-17 13:55:00.517815+00	2025-04-17 13:55:00.517815+00
123399cd-73f3-4a3b-a5ee-1e8eca8796a8	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	low	mukera1	pending	\N	\N	t	2025-04-17 14:27:15.310481+00	2025-04-17 14:27:15.310481+00
eea4aee9-80b4-4dfc-ab19-b2427baef690	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	comprehensive_metabolic_panel	medium	newles	pending	\N	\N	t	2025-04-17 19:28:34.375357+00	2025-04-17 19:28:34.375357+00
2ab442d0-7194-468b-b957-f9a231a7d52d	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	medium	trial5	pending	\N	\N	t	2025-04-18 05:10:07.937239+00	2025-04-18 05:10:07.937239+00
b4b01294-b650-4ad0-9dce-d6554927472b	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	medium	new	pending	\N	\N	t	2025-04-19 14:17:31.822797+00	2025-04-19 14:17:31.822797+00
9de73000-ae23-4237-958f-719e86df5bf8	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	medium	new	pending	\N	\N	t	2025-04-20 12:41:27.451345+00	2025-04-20 12:41:27.451345+00
745a4553-eae0-42d4-a6a8-d8d3af7a1fa8	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	low	lala	pending	\N	\N	t	2025-04-20 13:18:07.197179+00	2025-04-20 13:18:07.197179+00
b14a652d-fb65-4353-99d5-991372cd9539	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	low	what	pending	\N	\N	t	2025-04-20 13:29:21.97802+00	2025-04-20 13:29:21.97802+00
aa0d37a7-fd66-4e8b-b850-f57e790b3f17	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	medium	new	pending	\N	\N	t	2025-04-20 13:40:18.054566+00	2025-04-20 13:40:18.054566+00
4c9366ec-02fd-41fe-9dd1-7fe7cc67b401	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	chest_xray	low	mukera1	pending	\N	\N	t	2025-04-22 15:49:50.698+00	2025-04-22 15:49:50.698+00
5a444286-d295-4df6-86fb-9d2aefb48816	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	covid19_test	medium	mukera2	pending	\N	\N	t	2025-04-22 15:54:29.290699+00	2025-04-22 15:54:29.290699+00
6f3a9990-c401-4067-abbf-00265ac7fd0e	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	ecg	medium	mukera 3	pending	\N	\N	t	2025-04-22 15:55:27.661436+00	2025-04-22 15:55:27.661436+00
a43688a2-fc64-4aa7-871b-03374c99ee9e	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	allergy_test	medium	rr	pending	\N	\N	t	2025-04-22 16:32:24.145064+00	2025-04-22 16:32:24.145064+00
df6fdb9b-9239-442c-8ff8-b11952173253	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	medium	new	pending	\N	\N	t	2025-04-24 06:23:00.186599+00	2025-04-24 06:23:00.186599+00
39293a7c-a9de-445d-a7b4-0f4897498b36	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	hba1c	low	new	pending	\N	\N	t	2025-04-24 06:33:13.847631+00	2025-04-24 06:33:13.847631+00
12c6417e-319d-40a3-93a8-729e11c020f4	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	vitamin_d_test	medium	socket	pending	\N	\N	t	2025-04-24 08:14:25.158954+00	2025-04-24 08:14:25.158954+00
42f18f34-9ed2-41c5-a5ec-6d4c3fb5f094	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	urinalysis	low	socket2	pending	\N	\N	t	2025-04-24 08:14:59.846298+00	2025-04-24 08:14:59.846298+00
2062f5a4-10fb-49ab-bcaa-8cdf2eb01941	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	ecg	high	socket3	pending	\N	\N	t	2025-04-24 08:15:55.001581+00	2025-04-24 08:15:55.001581+00
2be72d56-dcf9-4565-8331-9da3e4cafdc5	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	chest_xray	medium	socket4	pending	\N	\N	t	2025-04-24 08:29:13.025787+00	2025-04-24 08:29:13.025787+00
0ae71324-4fbf-46a2-8a5a-8d5acebcdf17	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	covid19_test	low	socket6	pending	\N	\N	t	2025-04-24 08:32:51.424345+00	2025-04-24 08:32:51.424345+00
47627328-be51-4900-89de-3fb62494db74	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	allergy_test	medium	socket7	pending	\N	\N	t	2025-04-24 08:49:12.217949+00	2025-04-24 08:49:12.217949+00
595ee596-afdb-41f4-ae32-5ae1b9791ff2	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	medium	trial7	pending	\N	\N	t	2025-04-24 08:50:43.648417+00	2025-04-24 08:50:43.648417+00
78a0f371-70b1-4fd3-b386-ab4574bf7bf1	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	comprehensive_metabolic_panel	low	trial2	pending	\N	\N	t	2025-04-24 08:52:27.8683+00	2025-04-24 08:52:27.8683+00
8c7102cc-e689-4dad-9d18-c640ad26393f	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	high	hi	pending	\N	\N	t	2025-04-24 08:53:31.795002+00	2025-04-24 08:53:31.795002+00
6958e700-fcfb-47ee-aace-8f335b180a2a	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	hba1c	low	check	pending	\N	\N	t	2025-04-24 09:03:54.859674+00	2025-04-24 09:03:54.859674+00
22191d66-cb42-45e3-946d-13289b5827ea	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	ecg	high	ttt	pending	\N	\N	t	2025-04-24 09:17:59.842926+00	2025-04-24 09:17:59.842926+00
4688e64b-a1e3-47b8-9d1f-3c58b2bb4d52	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	comprehensive_metabolic_panel	medium	trial	pending	\N	\N	t	2025-04-24 09:30:33.044278+00	2025-04-24 09:30:33.044278+00
d4a39d28-c18e-46c9-aab8-702704d0ffc1	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	urinalysis	high	kexa	pending	\N	\N	t	2025-04-24 09:41:38.313126+00	2025-04-24 09:41:38.313126+00
adbdb433-9b78-4ff3-a478-a66bfc5b2f54	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	medium	new\n	pending	\N	\N	t	2025-04-24 10:40:43.229649+00	2025-04-24 10:40:43.229649+00
d2aaba59-318f-4772-9941-61e2c6dea845	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	covid19_test	low	new	pending	\N	\N	t	2025-04-24 11:59:08.251504+00	2025-04-24 11:59:08.251504+00
0f390a53-a290-4612-9c54-bae3afdc3aad	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	thyroid_panel	low	ne	pending	\N	\N	t	2025-04-24 13:15:18.953988+00	2025-04-24 13:15:18.953988+00
8168b190-a73f-4712-8d56-1acbd44a1811	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	medium	n	pending	\N	\N	t	2025-04-24 13:16:53.461454+00	2025-04-24 13:16:53.461454+00
06c3d2f2-5d0e-4094-ae99-f921ce716bd1	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	vitamin_d_test	medium	tap	pending	\N	\N	t	2025-04-24 13:31:41.008396+00	2025-04-24 13:31:41.008396+00
80f85965-4428-49e5-a561-663f11c91730	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	high	la	pending	\N	\N	t	2025-04-24 13:34:10.177526+00	2025-04-24 13:34:10.177526+00
3c829b62-c289-422e-8258-1d2afee2cd31	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	urinalysis	medium	nskz	pending	\N	\N	t	2025-04-24 13:41:26.199367+00	2025-04-24 13:41:26.199367+00
e68d9080-5ef0-411b-82c8-356ab79402e0	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	chest_xray	medium	bdzx	pending	\N	\N	t	2025-04-24 13:50:55.172285+00	2025-04-24 13:50:55.172285+00
5a6f36f5-e06f-4559-804c-1ef10ea8535a	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	hba1c	high	tial notification	pending	\N	\N	t	2025-04-24 14:51:24.09334+00	2025-04-24 14:51:24.09334+00
01dea266-7266-4b00-980f-9c79554c8594	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	high		pending	\N	\N	t	2025-04-24 14:53:22.3428+00	2025-04-24 14:53:22.3428+00
8076c86d-9867-45a6-ab12-7d6461a55b55	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	low	jskla	pending	\N	\N	t	2025-04-24 15:56:44.585332+00	2025-04-24 15:56:44.585332+00
227f773e-4c32-4297-9ea7-cd46d56db515	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	thyroid_panel	high	yess	pending	\N	\N	t	2025-04-24 16:04:31.700682+00	2025-04-24 16:04:31.700682+00
98d1fb80-2da7-4212-902f-e96e45bbe51a	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	urinalysis	high	nz	pending	\N	\N	t	2025-04-24 16:19:45.737266+00	2025-04-24 16:19:45.737266+00
51183afb-c8d4-41df-9ead-61a96bdad68c	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	medium	new\n\nCancellation reason: no	cancelled	\N	\N	t	2025-04-27 06:02:25.603939+00	2025-04-29 05:38:30.82488+00
7609d3bc-2e15-4a4e-b6b7-c440574091c9	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	covid19_test	low	new\n\nCancellation reason: no	cancelled	\N	\N	t	2025-04-24 16:37:24.853326+00	2025-04-29 05:38:52.053666+00
b186b70c-b8b1-4ed2-8673-a82355a3c80a	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	Compelet	high		pending	\N	\N	t	2025-04-29 05:45:17.298483+00	2025-04-29 05:45:17.298483+00
7c42f795-a31b-4207-83b3-406bccee2efa	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	COVID 19 TEST	medium	NM	pending	\N	\N	t	2025-04-29 05:53:04.569682+00	2025-04-29 05:53:04.569682+00
d706a395-509a-4198-a4f2-c4cceb478330	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	Comprehensive Metabolic Panel	high		pending	\N	\N	t	2025-04-29 06:29:12.515753+00	2025-04-29 06:29:12.515753+00
93e34c24-b094-490e-ba35-b6f9e7a8afbb	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	comprehensive_metabolic_panel	medium	trial 7	pending	\N	\N	t	2025-05-06 10:38:24.84521+00	2025-05-06 10:38:24.84521+00
02e2ce19-c715-4798-8be0-013ae843ebc5	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	covid19_test	medium	labrequest delivery check	pending	\N	\N	t	2025-05-06 12:07:52.723595+00	2025-05-06 12:07:52.723595+00
474ae4e2-420f-403b-a5ba-f0ad77a9e80a	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	hba1c	high	low\n\nCancellation reason: no\n\nCancellation reason: no\n\nCancellation reason: no	cancelled	\N	\N	t	2025-04-24 15:41:57.941246+00	2025-04-30 09:44:04.873212+00
c62e6f77-d50c-4415-b46d-e10cd1d12f10	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	Lipid Panel	medium	hdn\n\nCancellation reason: no	cancelled	\N	\N	t	2025-05-02 08:05:17.111674+00	2025-05-02 08:06:46.719298+00
85fc38a8-c018-478d-bd0c-a66a9d1257e4	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	CHEST X-ray	medium	test it up	pending	\N	\N	t	2025-05-02 19:43:45.19084+00	2025-05-02 19:43:45.19084+00
57de1221-d48f-44b5-9682-5dec8b30ed9f	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	Complete Blood Count	low	try	pending	\N	\N	t	2025-05-02 20:05:10.198292+00	2025-05-02 20:05:10.198292+00
4524d774-ca9c-4f01-9855-58880326d785	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	Liver Function Test	high	trial	pending	\N	\N	t	2025-05-02 20:46:28.521258+00	2025-05-02 20:46:28.521258+00
579f06b7-489c-4897-9403-cc45b5d5382c	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	CHEST X-ray	high	ui	pending	\N	\N	t	2025-05-02 20:49:14.222802+00	2025-05-02 20:49:14.222802+00
67c2c7b2-4611-4348-bd32-6042d1b5a7e3	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	Liver Function Test	medium	yoo	pending	\N	\N	t	2025-05-02 21:03:13.786932+00	2025-05-02 21:03:13.786932+00
bc15440d-a4d3-474b-8475-2ca5c9ba4d7b	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	COVID 19 TEST	medium	yo	pending	\N	\N	t	2025-05-02 21:11:02.694891+00	2025-05-02 21:11:02.694891+00
5355dd43-e40b-4861-a9a6-53dc3b2b6b14	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	Liver Function Test	medium	kezas	pending	\N	\N	t	2025-05-02 21:23:36.119138+00	2025-05-02 21:23:36.119138+00
2cd8e0db-ba02-4829-a5f4-0851fa5abe87	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	high	ehh	pending	\N	\N	t	2025-05-02 21:34:45.893405+00	2025-05-02 21:34:45.893405+00
22288dab-eb5e-4bde-b521-ca083e43f151	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	comprehensive_metabolic_panel	high	yo	pending	\N	\N	t	2025-05-02 21:50:41.438765+00	2025-05-02 21:50:41.438765+00
c1825154-ca03-42e3-8511-3abdbea93f7b	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	medium	jol;	pending	\N	\N	t	2025-05-02 22:15:36.384503+00	2025-05-02 22:15:36.384503+00
d409f3a9-b302-495b-a30b-e8792c6e1e15	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	ecg	medium	socket trial	pending	\N	\N	t	2025-05-03 07:47:03.845516+00	2025-05-03 07:47:03.845516+00
c05b5fcb-6100-4da5-9bd7-8e9b694804ac	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	low	new	pending	\N	\N	t	2025-05-03 07:49:06.920859+00	2025-05-03 07:49:06.920859+00
c4bdf16a-b8a0-4ba9-ad51-b6bf7da5dbe5	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	hba1c	low	kl	pending	\N	\N	t	2025-05-03 08:07:04.558716+00	2025-05-03 08:07:04.558716+00
78cd9800-0d7c-40be-a5c5-dae4c57436f4	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	covid19_test	high	nm	pending	\N	\N	t	2025-05-03 08:12:28.728115+00	2025-05-03 08:12:28.728115+00
fdd71039-eb10-4a01-a64b-eb43e73b2f11	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	vitamin_d_test	low	nm	pending	\N	\N	t	2025-05-03 08:18:47.86826+00	2025-05-03 08:18:47.86826+00
559963b7-848c-41df-8812-aa5df5b6bf5a	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	urinalysis	medium	new 	pending	\N	\N	t	2025-05-03 09:12:39.187342+00	2025-05-03 09:12:39.187342+00
ecd9d9bd-513e-4aad-98ce-a99e859bb7eb	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	thyroid_panel	high	trial 1	pending	\N	\N	t	2025-05-03 09:20:14.434814+00	2025-05-03 09:20:14.434814+00
5a2455f9-ed04-4d3b-8461-9af24dd4afed	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	high	low	pending	\N	\N	t	2025-05-03 09:38:58.582037+00	2025-05-03 09:38:58.582037+00
47c4a564-2576-472e-a594-80f721d528c4	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	comprehensive_metabolic_panel	high	ty	pending	\N	\N	t	2025-05-03 09:51:17.393601+00	2025-05-03 09:51:17.393601+00
f0511d82-c455-4dcd-8566-ab3324d90b62	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	high	last	pending	\N	\N	t	2025-05-03 09:57:25.305049+00	2025-05-03 09:57:25.305049+00
086c6d5f-6320-4c4b-8373-4ca822ffdcc6	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	ecg	low	advance	pending	\N	\N	t	2025-05-03 12:29:12.739022+00	2025-05-03 12:29:12.739022+00
c765ad74-00f3-4643-b8f9-56e7a0c6672f	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	comprehensive_metabolic_panel	medium	trial 7	pending	\N	\N	t	2025-05-03 13:01:56.667168+00	2025-05-03 13:01:56.667168+00
be3da0f7-65a7-416e-8d01-bf797dadc8f7	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	thyroid_panel	low	try\n	pending	\N	\N	t	2025-05-03 13:26:14.186488+00	2025-05-03 13:26:14.186488+00
ecc0c0a2-913d-4d78-b23f-1b133926299e	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	urinalysis	high	notification end	pending	\N	\N	t	2025-05-03 14:51:57.430187+00	2025-05-03 14:51:57.430187+00
861f53fc-a942-4405-a05c-49da7305c95e	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	chest_xray	medium	last	pending	\N	\N	t	2025-05-03 15:32:26.302176+00	2025-05-03 15:32:26.302176+00
c2c5b812-4992-441b-a5b6-0b1e3b9561d3	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	medium	try note	pending	\N	\N	t	2025-05-06 06:17:42.98544+00	2025-05-06 06:17:42.98544+00
66461580-e747-4144-96ed-9561541d3e4d	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	low	trial one	pending	\N	\N	t	2025-05-06 06:22:01.959195+00	2025-05-06 06:22:01.959195+00
1729d057-0342-4f1d-9210-b7ef4e4a0eac	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	urinalysis	medium	request trial 1	pending	\N	\N	t	2025-05-06 07:39:54.133382+00	2025-05-06 07:39:54.133382+00
f00a3004-1e60-4950-a3b3-f5c6ab452c3b	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	chest_xray	low	request delivery test 1	pending	\N	\N	t	2025-05-06 08:07:08.485794+00	2025-05-06 08:07:08.485794+00
0fc544ed-68f3-4f6e-916d-81bef9135ebb	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	hba1c	medium	request trail 2	pending	\N	\N	t	2025-05-06 08:42:17.928989+00	2025-05-06 08:42:17.928989+00
e863f3bd-31c7-4e69-8edf-01267e4e5b1f	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	covid19_test	medium	test on browser	pending	\N	\N	t	2025-05-06 09:03:42.750381+00	2025-05-06 09:03:42.750381+00
ff1143af-079b-4e46-8514-2203c9a4ed50	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	medium	i am tired	pending	\N	\N	t	2025-05-06 09:10:11.608678+00	2025-05-06 09:10:11.608678+00
ed49e04e-69a1-4037-b652-2887a26060b1	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	medium	soket check	pending	\N	\N	t	2025-05-06 09:52:57.320254+00	2025-05-06 09:52:57.320254+00
87068984-c1ff-4b92-a535-7044b9597c9f	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	thyroid_panel	medium	socket check	pending	\N	\N	t	2025-05-06 10:25:01.77146+00	2025-05-06 10:25:01.77146+00
f3ce8d41-faef-4c1f-b702-2a9f675bc97f	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	comprehensive_metabolic_panel	medium	check lab request on frontend	pending	\N	\N	t	2025-05-06 12:59:55.834411+00	2025-05-06 12:59:55.834411+00
bc9379e4-764b-4b04-b326-ad95c95c0fbe	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	urinalysis	medium	try	pending	\N	\N	t	2025-05-06 13:14:41.614416+00	2025-05-06 13:14:41.614416+00
eccb14a1-5889-4370-8365-55a47349fd49	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	vitamin_d_test	low	truo	pending	\N	\N	t	2025-05-06 13:33:48.120896+00	2025-05-06 13:33:48.120896+00
34ece074-611b-4b3b-8eab-cea2ffea04b8	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	thyroid_panel	high	new	pending	\N	\N	t	2025-05-06 14:42:06.537675+00	2025-05-06 14:42:06.537675+00
d6176f81-49e2-4911-9c94-c18fcba57fd1	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	medium	trmmm	pending	\N	\N	t	2025-05-06 15:01:27.073894+00	2025-05-06 15:01:27.073894+00
abebadbc-1eb1-492e-abce-50e8871d173e	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	thyroid_panel	medium	notes 1	pending	\N	\N	t	2025-05-07 08:32:13.079139+00	2025-05-07 08:32:13.079139+00
60988a19-375d-434b-a974-43d7eb53e03e	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	high	trial 2	pending	\N	\N	t	2025-05-07 08:33:15.94903+00	2025-05-07 08:33:15.94903+00
4e524d28-05e0-4570-b31a-f1f993b9b613	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	chest_xray	high	hiiii	pending	\N	\N	t	2025-05-07 08:59:23.075353+00	2025-05-07 08:59:23.075353+00
cc62bf26-8921-4e9c-af6e-3a62408bf7c5	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	medium	new	pending	\N	\N	t	2025-05-07 13:37:53.670035+00	2025-05-07 13:37:53.670035+00
d84c7242-9c55-4295-8806-f86eecc83b97	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	medium	new	pending	\N	\N	t	2025-05-07 13:37:54.994756+00	2025-05-07 13:37:54.994756+00
3a431b00-801e-499f-8b87-1c78d79f5463	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	chest_xray	medium	check socket	pending	\N	\N	t	2025-05-07 14:16:23.698136+00	2025-05-07 14:16:23.698136+00
7105687e-a098-493f-b19e-d0b37c45e6b8	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	low	websocket check	pending	\N	\N	t	2025-05-07 14:47:53.609164+00	2025-05-07 14:47:53.609164+00
c599d84d-1edd-43f2-982f-4ab3208f65a8	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	ecg	medium	websocket trial 2	pending	\N	\N	t	2025-05-07 15:01:35.791129+00	2025-05-07 15:01:35.791129+00
1101c9d6-8058-4529-88cf-c25e1b772bff	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	comprehensive_metabolic_panel	high	traing web socket	pending	\N	\N	t	2025-05-07 15:06:11.31971+00	2025-05-07 15:06:11.31971+00
595bf1a0-4f63-4c28-8ad4-68e95a807e7b	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	vitamin_d_test	low	check socket	pending	\N	\N	t	2025-05-07 15:18:25.742496+00	2025-05-07 15:18:25.742496+00
5606c667-6bb9-4b3d-971b-617255af84e5	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	covid19_test	medium	checkup websocket	pending	\N	\N	t	2025-05-07 15:28:35.827142+00	2025-05-07 15:28:35.827142+00
41f12377-5d97-4c78-84af-6283afaddc9c	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	covid19_test	high	try socket	pending	\N	\N	t	2025-05-07 15:32:17.441175+00	2025-05-07 15:32:17.441175+00
12bf170b-1072-453c-a682-e73cc936b153	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	urinalysis	high	check socket delivery	pending	\N	\N	t	2025-05-07 15:44:15.35648+00	2025-05-07 15:44:15.35648+00
664edecb-8419-48b6-aae2-f9f89684b073	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	chest_xray	medium	new	pending	\N	\N	t	2025-05-07 16:27:03.874992+00	2025-05-07 16:27:03.874992+00
4360252a-dc4e-443c-b7b7-4ff5a7d7a5da	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	high	try	pending	\N	\N	t	2025-05-07 20:10:40.950614+00	2025-05-07 20:10:40.950614+00
025401c2-b1a7-4b10-888c-c11714ce70d6	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	high	try	pending	\N	\N	t	2025-05-07 20:13:11.463185+00	2025-05-07 20:13:11.463185+00
b201654e-8825-43be-b08a-a635ee9aff41	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	thyroid_panel	medium	yes	pending	\N	\N	t	2025-05-07 20:16:24.621176+00	2025-05-07 20:16:24.621176+00
7e4f7509-b43d-4f07-9bb1-f90357315e13	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	urinalysis	medium	yes	pending	\N	\N	t	2025-05-07 20:17:07.956082+00	2025-05-07 20:17:07.956082+00
162a5d14-478b-48db-a4ff-8c1698c98b8a	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	comprehensive_metabolic_panel	high	try\n	pending	\N	\N	t	2025-05-07 22:32:02.958166+00	2025-05-07 22:32:02.958166+00
9061712d-4532-4bea-8293-ad35c96711a4	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	thyroid_panel	medium	try socket	pending	\N	\N	t	2025-05-08 07:40:20.135313+00	2025-05-08 07:40:20.135313+00
d45986f3-9c10-42eb-a25b-8b81f7f94f06	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	ecg	high	nj	pending	\N	\N	t	2025-05-08 07:59:37.730497+00	2025-05-08 07:59:37.730497+00
118bff6f-e5d1-4d7a-8e94-03e47d13db96	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	chest_xray	high	you	pending	\N	\N	t	2025-05-08 08:02:12.424431+00	2025-05-08 08:02:12.424431+00
a2f5cc1a-ea45-4cc5-bea4-32febb5a462e	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	high	mk	pending	\N	\N	t	2025-05-08 08:13:36.650651+00	2025-05-08 08:13:36.650651+00
5fc07be1-e69e-447a-ac62-25ff0c52b9fb	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	high	vb	pending	\N	\N	t	2025-05-08 08:24:35.843629+00	2025-05-08 08:24:35.843629+00
c9e66efd-d28a-4ed1-888d-b34e37b6e24c	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	medium	new	pending	\N	\N	t	2025-05-08 11:52:02.790284+00	2025-05-08 11:52:02.790284+00
870b9a7a-cb30-4eb7-87f1-6fa78c6e9b59	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	medium	test	pending	\N	\N	t	2025-05-08 11:56:52.518605+00	2025-05-08 11:56:52.518605+00
de8fcdd8-2b24-4afa-af8d-3ccec04bbf88	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	medium	test	pending	\N	\N	t	2025-05-08 12:00:01.849648+00	2025-05-08 12:00:01.849648+00
8ee59c04-6c6a-4c9d-9e53-7c1359c758b4	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	urinalysis	medium	what	pending	\N	\N	t	2025-05-08 12:40:15.672706+00	2025-05-08 12:40:15.672706+00
2ec07788-21f0-44eb-ac9f-1cd3af1858fb	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	medium	tes	pending	\N	\N	t	2025-05-08 12:45:11.011123+00	2025-05-08 12:45:11.011123+00
ab2edc8d-ed3c-401a-99a6-f7127436facd	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	allergy_test	medium	new	pending	\N	\N	t	2025-05-08 12:52:36.122514+00	2025-05-08 12:52:36.122514+00
f3147558-d389-4243-acfd-bbe593634ce9	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	medium	tese	pending	\N	\N	t	2025-05-08 13:31:57.431544+00	2025-05-08 13:31:57.431544+00
04c82fba-c354-467f-8d34-81093aff8dcc	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	chest_xray	high	edsadz	pending	\N	\N	t	2025-05-08 13:34:30.338804+00	2025-05-08 13:34:30.338804+00
bf5653a8-3d0d-4042-9a30-1f3229a31495	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	ecg	low	4ere	pending	\N	\N	t	2025-05-08 13:45:29.430641+00	2025-05-08 13:45:29.430641+00
6308fd08-c140-4dfd-8662-4ed1b257ee29	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	allergy_test	low	ghjk	pending	\N	\N	t	2025-05-08 13:56:52.511541+00	2025-05-08 13:56:52.511541+00
132a8cc9-ff07-4016-813a-2e0870ba8e4f	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	high	sds	pending	\N	\N	t	2025-05-08 13:59:18.305536+00	2025-05-08 13:59:18.305536+00
becde712-a11d-435e-bbc6-5c3416e7cd10	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	comprehensive_metabolic_panel	low	saz	pending	\N	\N	t	2025-05-08 14:00:37.846334+00	2025-05-08 14:00:37.846334+00
77adaa46-f9ec-48c0-ab04-be7d84a7a7f7	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	lipid_panel	medium	as\\	pending	\N	\N	t	2025-05-08 14:02:33.299038+00	2025-05-08 14:02:33.299038+00
0441338d-072e-4ff7-b193-7cf841699052	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	high	ssd	pending	\N	\N	t	2025-05-08 14:04:07.795133+00	2025-05-08 14:04:07.795133+00
726007ce-6f86-4398-9c80-63014e9b97ad	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	high	sds	pending	\N	\N	t	2025-05-08 14:25:16.777407+00	2025-05-08 14:25:16.777407+00
2964896a-b54e-4818-b9e6-8f56c4a4e2e3	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	thyroid_panel	low	rrr	pending	\N	\N	t	2025-05-08 14:44:49.980926+00	2025-05-08 14:44:49.980926+00
f937f850-c4bc-470d-a4a6-d7246595097f	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	covid19_test	high	please	pending	\N	\N	t	2025-05-08 15:14:10.762987+00	2025-05-08 15:14:10.762987+00
57c65bc3-17a8-43e9-ba72-19bbb765c517	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	medium	k	pending	\N	\N	t	2025-05-08 15:16:10.642216+00	2025-05-08 15:16:10.642216+00
3b2e693e-5e8f-4d64-8206-1e6070680150	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	liver_function_test	high	ddf	pending	\N	\N	t	2025-05-08 15:38:12.238647+00	2025-05-08 15:38:12.238647+00
ebab1734-1187-4360-a93c-f5cb252d68ff	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	allergy_test	low	eeee	pending	\N	\N	t	2025-05-08 16:17:59.477939+00	2025-05-08 16:17:59.477939+00
489ed4e0-81b1-4854-a486-93c81874f8f4	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	complete_blood_count	high	new	pending	\N	\N	t	2025-05-09 14:33:00.784815+00	2025-05-09 14:33:00.784815+00
\.


--
-- Data for Name: medical_records; Type: TABLE DATA; Schema: public; Owner: doctor_user
--

COPY public.medical_records (id, patient_id, doctor_id, diagnosis, treatment, notes, medications, vital_signs, follow_up_date, is_active, created_at, updated_at) FROM stdin;
ac9e137b-a450-42ea-818d-6d79714841ca	96aad0ba-6d8d-4736-b6da-c24ee7f0810b	722421d7-e863-46cd-9f55-35c992839c8a	gvbhnm	vhjm,	tfjk,	\N	null	\N	t	2025-04-10 20:15:19.138668+00	2025-04-10 20:15:19.138668+00
188ede33-79af-4623-a926-b7a53b2eb15a	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	string	string	string	{string}	{"height": 0.0, "weight": 0.0, "heart_rate": 0, "temperature": 0.0, "blood_pressure": "string", "respiratory_rate": 0, "oxygen_saturation": 0.0}	2025-04-12	t	2025-04-12 13:37:56.036927+00	2025-04-12 13:37:56.036927+00
00d5c108-39eb-499f-942f-df3354f9e620	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	v bnm,	fhgjk	gvhj	\N	null	\N	t	2025-04-12 13:40:57.300013+00	2025-04-12 13:40:57.300013+00
b056a1f6-ca96-4998-962b-32f2fd1fd8cc	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	sxz	sc	asc	\N	null	\N	t	2025-04-12 13:42:29.374872+00	2025-04-12 13:42:29.374872+00
075c797d-2304-48f8-910f-c9ab114b6529	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	string	string	string	{string}	{"height": 0.0, "weight": 0.0, "heart_rate": 0, "temperature": 0.0, "blood_pressure": "string", "respiratory_rate": 0, "oxygen_saturation": 0.0}	2025-04-12	t	2025-04-12 22:03:25.28267+00	2025-04-12 22:03:25.28267+00
012c5825-7e87-4883-828e-467c6c3c72b7	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	hm	fgv	ghjn	\N	null	\N	t	2025-04-12 22:06:15.952029+00	2025-04-12 22:06:15.952029+00
f241c8b5-df3a-416c-95bf-713aba39c72f	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	yes	no	bay	{the}	{"height": 40.0, "weight": 40.0, "heart_rate": 20, "temperature": 30.0, "blood_pressure": "way", "respiratory_rate": 30, "oxygen_saturation": 40.0}	2025-05-12	t	2025-04-12 22:27:24.381758+00	2025-04-12 23:52:31.444021+00
353644a2-af23-4189-8667-bcccd27f477a	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	new	new	new	{new}	{"height": 20.0, "weight": 20.0, "heart_rate": 20, "temperature": 20.0, "blood_pressure": "20", "respiratory_rate": 20, "oxygen_saturation": 20.0}	2026-04-14	t	2025-04-14 09:22:55.056251+00	2025-04-14 09:22:55.056251+00
f078fcb9-bfba-4cc4-af3e-edc66f9b7db9	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	gsjhdsj	dhvjdvn	fghj	{}	{"height": null, "weight": null, "heart_rate": 78, "temperature": 34.0, "blood_pressure": "678", "respiratory_rate": 16, "oxygen_saturation": 33.0}	2025-12-31	t	2025-04-16 14:33:14.442281+00	2025-04-16 14:33:14.442281+00
de4085ea-1da4-4194-be01-c96789640e49	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	cfgh	cghj	vbn	{}	{"height": null, "weight": null, "heart_rate": 67, "temperature": 76.0, "blood_pressure": "98", "respiratory_rate": 16, "oxygen_saturation": 33.0}	2025-04-18	t	2025-04-16 18:04:13.009447+00	2025-04-16 18:04:13.009447+00
6fff8cbe-6e8a-4a2a-96d8-9cf226ac1029	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	lets him happiest	yes	enenja	{}	{"height": null, "weight": null, "heart_rate": 67, "temperature": 76.0, "blood_pressure": "98", "respiratory_rate": 33, "oxygen_saturation": 99.0}	2025-05-10	t	2025-04-30 09:33:37.994105+00	2025-04-30 09:34:10.999172+00
ef72d7ad-2b07-4a51-91d5-b086bb868365	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	yes	done	lvbhjnm	{string}	{"height": 10.0, "weight": 10.0, "heart_rate": 80, "temperature": 10.0, "blood_pressure": "yes", "respiratory_rate": 10, "oxygen_saturation": 10.0}	2025-04-10	t	2025-04-10 18:12:58.001382+00	2025-04-16 18:05:21.211678+00
57239d12-1764-41ae-a875-0a487a75769c	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	yes	yes	yes	{}	{"height": null, "weight": null, "heart_rate": 78, "temperature": 34.0, "blood_pressure": "678", "respiratory_rate": 16, "oxygen_saturation": 10.0}	2025-05-10	t	2025-04-16 20:29:16.385881+00	2025-04-16 20:30:21.191958+00
9224b805-f935-474b-abec-65f1a64ee64f	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	secondly 	secondly 	secondly 	{}	{"height": null, "weight": null, "heart_rate": 80, "temperature": 35.0, "blood_pressure": "34", "respiratory_rate": 88, "oxygen_saturation": 33.0}	2025-04-26	t	2025-04-16 20:31:34.581993+00	2025-04-21 06:22:09.61764+00
84515d3a-10b2-45ad-853f-abc444b8af2e	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	new	new	new	{}	{"height": null, "weight": null, "heart_rate": 90, "temperature": 37.0, "blood_pressure": "90", "respiratory_rate": 77, "oxygen_saturation": 98.0}	2025-05-23	t	2025-05-13 07:56:38.402017+00	2025-05-13 07:57:38.644832+00
fa2e48f6-92c3-4aad-bb25-2dac513e6fb6	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	newly thesis 1	heal	keep it up	{}	{"height": null, "weight": null, "heart_rate": 72, "temperature": 76.0, "blood_pressure": "98", "respiratory_rate": 16, "oxygen_saturation": 99.0}	2025-05-10	t	2025-04-30 08:50:05.857692+00	2025-04-30 08:51:44.192453+00
51e2c7b2-1697-4c42-b400-0135e8f5576b	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	string	string	string	{string}	{"height": 0.0, "weight": 0.0, "heart_rate": 0, "temperature": 0.0, "blood_pressure": "string", "respiratory_rate": 0, "oxygen_saturation": 0.0}	2025-05-13	t	2025-05-13 09:35:43.80719+00	2025-05-13 09:35:43.80719+00
548716c7-1485-49e1-a64a-64b1afca143f	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	new	yui	ty	{}	{"height": null, "weight": null, "heart_rate": 33, "temperature": 34.0, "blood_pressure": "55", "respiratory_rate": 33, "oxygen_saturation": 33.0}	2025-05-23	t	2025-05-13 09:37:44.133829+00	2025-05-21 11:47:06.466005+00
\.


--
-- Data for Name: medical_reports; Type: TABLE DATA; Schema: public; Owner: doctor_user
--

COPY public.medical_reports (id, patient_id, doctor_id, diagnosis, treatment, prescriptions, observations, recommendations, format_type, report_content, is_active, created_at, updated_at) FROM stdin;
996cf4b3-5d41-45f8-8e75-53d7a195b803	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	string	string	{string}	string	string	pdf	Placeholder report content - to be generated	t	2025-04-16 14:59:09.812114+00	2025-04-16 14:59:09.812114+00
fcc58a62-e1c8-402d-aa8a-7cd97625b110	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	string	string	{string}	string	string	pdf	Placeholder report content - to be generated	t	2025-04-16 15:48:36.370638+00	2025-04-16 15:48:36.370638+00
cdc08a5e-424f-42b9-be86-f9573fbe208b	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	ghjk	hjnm	{Nonegn}	drfgh	gjnm	pdf	Placeholder report content - to be generated	t	2025-04-16 16:06:27.743655+00	2025-04-16 16:06:27.743655+00
fa4d88cb-d345-4a64-84a7-f4202637eb79	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	kezas	kezas	{kezas}	kezas	kezas	pdf	Placeholder report content - to be generated	t	2025-04-16 21:56:30.790306+00	2025-04-16 21:56:30.790306+00
4138485e-9b74-4f97-a44d-95338a51b308	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	here it is	here it is	{"here it is"}	here it is	here it is	text	Placeholder report content - to be generated	f	2025-04-17 05:11:41.796022+00	2025-04-29 06:13:22.922747+00
419e8088-9434-4a3f-b5d0-a6b37bca52a9	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	wow	wow	{wow}	wow	wow	pdf	Placeholder report content - to be generated	f	2025-04-16 21:02:15.06787+00	2025-04-29 06:14:18.372288+00
ed747c41-f599-497e-97d4-050467d42518	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	new	new	{new}	new	new	pdf	Placeholder report content - to be generated	f	2025-04-16 20:26:10.544437+00	2025-04-30 09:45:43.494435+00
4d4ce31d-1a6e-464d-8fd5-9ed5041504a8	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	hjkl	drtfgyhj	{Nonecfh}	gvjkl	fghj	pdf	Placeholder report content - to be generated	f	2025-04-16 16:07:30.915085+00	2025-04-30 14:00:55.587288+00
d8ec358d-e46b-4c89-ab5e-25c5d57645a6	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	string	string	{string}	string	string	pdf	Placeholder report content - to be generated	f	2025-04-14 11:13:53.947843+00	2025-04-30 14:01:18.773855+00
f6e6d644-12c1-4d87-acaf-2c443fb5e3b1	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	string	string	{string}	string	string	pdf	Placeholder report content - to be generated	f	2025-04-15 15:45:31.36817+00	2025-04-30 14:01:40.064113+00
2dc4e237-70c0-46ee-9b27-b3bba5e50dec	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	string	string	{string}	string	string	pdf	Placeholder report content - to be generated	f	2025-04-15 15:52:20.859772+00	2025-04-30 14:01:58.635706+00
854e1493-516d-4fde-9df2-a38162546067	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	hera	therapy	{new}	lab fining	follow up	pdf	Placeholder report content - to be generated	t	2025-05-02 08:10:04.990224+00	2025-05-02 08:10:04.990224+00
175be732-7b72-4be5-8d9f-be7adf41cfb4	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	new	new	{New}	new	new	pdf	Placeholder report content - to be generated	t	2025-05-19 15:55:32.114483+00	2025-05-19 15:55:32.114483+00
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: doctor_user
--

COPY public.notifications (id, recipient_id, notification_type, entity_id, is_read, created_at, message, entity_type, read_at) FROM stdin;
05d2381d-2d59-45ed-a3c2-6cd91db20e9f	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-04-16 13:35:35.978904+00	\N	\N	\N
0144d76a-5fd1-4a8a-b14b-70638bb44824	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	b14a652d-fb65-4353-99d5-991372cd9539	f	2025-04-20 14:03:56.062284+00	Lab Result Ready: Lab result for test lipid_panel is now available	\N	\N
9269ef96-d52b-4c2b-9f40-d7c1dea18c26	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	b14a652d-fb65-4353-99d5-991372cd9539	f	2025-04-20 15:24:52.950666+00	Lab Result Ready: Lab result for test lipid_panel is now available	\N	\N
8d443345-be92-4e3d-b828-cc9f2e04f6a9	722421d7-e863-46cd-9f55-35c992839c8a	new_lab_request	b14a652d-fb65-4353-99d5-991372cd9539	t	2025-04-20 18:21:06.133635+00	New Notification: New lab request created	\N	2025-04-20 18:27:35.008111+00
1e893443-83fd-42b7-b2f7-0f94b1958b80	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	a43688a2-fc64-4aa7-871b-03374c99ee9e	f	2025-04-24 05:35:01.085293+00	Lab Result Ready: Lab result for test allergy_test is now available	\N	\N
4c2294b2-1dbb-4cd5-98b3-267947a065ab	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	df6fdb9b-9239-442c-8ff8-b11952173253	f	2025-04-24 06:29:56.958208+00	Lab Result Ready: Lab result for test lipid_panel is now available	\N	\N
16d693f1-24b8-40e0-b93e-463d161fc79f	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	4c9366ec-02fd-41fe-9dd1-7fe7cc67b401	f	2025-04-24 06:43:26.865946+00	Lab Result Ready: Lab result for test chest_xray is now available	\N	\N
b43ee553-5dfc-45a1-a104-21948a89c872	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	98d1fb80-2da7-4212-902f-e96e45bbe51a	f	2025-04-27 05:59:26.336127+00	Lab Result Ready: Lab result for test urinalysis is now available	\N	\N
9af9f037-699e-409e-ac1e-7df10945a5e0	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	98d1fb80-2da7-4212-902f-e96e45bbe51a	f	2025-04-27 11:02:29.071521+00	Lab Result Ready: Lab result for test urinalysis is now available	\N	\N
54d21851-9b5a-42fc-9371-fe7cef5424b0	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	51183afb-c8d4-41df-9ead-61a96bdad68c	f	2025-04-27 13:48:42.533561+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
2b9acf79-b549-496c-929e-137335e87da6	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	51183afb-c8d4-41df-9ead-61a96bdad68c	f	2025-04-27 14:12:06.339544+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
b186d814-e5c6-4274-8bc6-8f18e6b25609	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	98d1fb80-2da7-4212-902f-e96e45bbe51a	f	2025-04-27 14:15:58.201324+00	Lab Result Ready: Lab result for test urinalysis is now available	\N	\N
a2154f63-5531-425d-afe1-a109b859851c	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	227f773e-4c32-4297-9ea7-cd46d56db515	f	2025-04-27 14:44:41.707275+00	Lab Result Ready: Lab result for test thyroid_panel is now available	\N	\N
3cfb0cdd-3d05-4c2e-8d66-814408e07e75	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	8076c86d-9867-45a6-ab12-7d6461a55b55	f	2025-04-28 08:17:22.597055+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
c7ff6c1a-570f-4d58-a322-a6800eb51e6d	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	8076c86d-9867-45a6-ab12-7d6461a55b55	f	2025-04-29 12:40:37.049217+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
b28456eb-28ae-46e3-afd2-8388f298bbd5	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-04-30 12:00:29.289921+00	\N	\N	\N
3f4ec847-85a6-4c7a-b88c-b8a2e831acb3	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-04-30 12:35:46.155947+00	\N	\N	\N
4f1f6792-c61e-4744-8d12-f871b80dafb9	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-04-30 12:58:53.371528+00	\N	\N	\N
e694bc6d-6116-4e88-a976-898af9795bc6	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-04-30 15:54:11.094411+00	\N	\N	\N
06d3c58c-e799-4e1a-b813-39e1b0fc90b8	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	5a6f36f5-e06f-4559-804c-1ef10ea8535a	f	2025-05-01 10:37:35.923935+00	Lab Result Ready: Lab result for test hba1c is now available	\N	\N
3fb1740d-ba86-4381-b304-ca555eb454de	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-02 07:34:27.938942+00	\N	\N	\N
f72b9b27-cc47-427a-ba36-95767191d11a	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	6f3a9990-c401-4067-abbf-00265ac7fd0e	f	2025-05-02 08:19:32.888795+00	Lab Result Ready: Lab result for test ecg is now available	\N	\N
5be20410-2776-46d2-99ca-d341b6bf5329	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	5a6f36f5-e06f-4559-804c-1ef10ea8535a	f	2025-05-02 14:16:37.007751+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
e9c74808-ec0b-4c0b-b98a-e88bed7bbe76	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	6f3a9990-c401-4067-abbf-00265ac7fd0e	f	2025-05-02 14:44:33.981568+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
c58ee60d-b0ff-49a4-a6d4-e7f094674c4e	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	474ae4e2-420f-403b-a5ba-f0ad77a9e80a	f	2025-05-02 16:18:12.460832+00	Lab Result Ready: Lab result for test hba1c is now available	\N	\N
cbff56b2-cef4-4273-99cf-e9622635a7b1	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	a2b51fa7-fa02-4f47-b7b0-b10d0b3e94ba	f	2025-05-02 18:58:52.032074+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
ef06e844-3b49-462d-8caa-d5986accce4b	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	b4b01294-b650-4ad0-9dce-d6554927472b	f	2025-05-02 19:23:35.747365+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
ec13dd05-c93f-449d-8eaf-f3d319a75728	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	5a444286-d295-4df6-86fb-9d2aefb48816	f	2025-05-02 19:34:18.684898+00	Lab Result Ready: Lab result for test covid19_test is now available	\N	\N
d50e3ed5-9638-403f-b186-e48024a4cee0	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	eea4aee9-80b4-4dfc-ab19-b2427baef690	f	2025-05-02 19:38:53.012425+00	Lab Result Ready: Lab result for test comprehensive_metabolic_panel is now available	\N	\N
df2a0df7-0214-445c-ac97-66e8cffef026	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	2cd8e0db-ba02-4829-a5f4-0851fa5abe87	f	2025-05-02 21:36:35.315982+00	Lab Result Ready: Lab result for test liver_function_test is now available	\N	\N
27dbab41-26a5-4281-8310-8b238de51659	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	22288dab-eb5e-4bde-b521-ca083e43f151	f	2025-05-02 21:52:49.691391+00	Lab Result Ready: Lab result for test comprehensive_metabolic_panel is now available	\N	\N
49ffb7ee-46f3-4d1a-8eb8-cf0a9e4c84b1	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	c1825154-ca03-42e3-8511-3abdbea93f7b	f	2025-05-02 22:16:40.917691+00	Lab Result Ready: Lab result for test liver_function_test is now available	\N	\N
b66c097d-dc69-4119-b4e6-8f67fc27ba00	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	d409f3a9-b302-495b-a30b-e8792c6e1e15	f	2025-05-03 07:48:15.752544+00	Lab Result Ready: Lab result for test ecg is now available	\N	\N
56355796-b51a-4935-8d70-4937168b48e5	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	c05b5fcb-6100-4da5-9bd7-8e9b694804ac	f	2025-05-03 07:50:03.400324+00	Lab Result Ready: Lab result for test lipid_panel is now available	\N	\N
3021910f-915c-490c-9cd0-8ebdabfa66e5	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	c4bdf16a-b8a0-4ba9-ad51-b6bf7da5dbe5	f	2025-05-03 08:08:21.59157+00	Lab Result Ready: Lab result for test hba1c is now available	\N	\N
edf38f6d-1734-4f65-aca4-9faa6075fa8e	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	78cd9800-0d7c-40be-a5c5-dae4c57436f4	f	2025-05-03 08:13:32.439606+00	Lab Result Ready: Lab result for test covid19_test is now available	\N	\N
c63f512e-76fb-4d07-b2e6-9bb112d2e449	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	fdd71039-eb10-4a01-a64b-eb43e73b2f11	f	2025-05-03 08:19:41.593206+00	Lab Result Ready: Lab result for test vitamin_d_test is now available	\N	\N
ad5e550c-a221-486c-8d13-a91e902d8960	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	559963b7-848c-41df-8812-aa5df5b6bf5a	f	2025-05-03 09:13:57.149871+00	Lab Result Ready: Lab result for test urinalysis is now available	\N	\N
e6ce513b-d608-426a-ade5-c49b8ef2c3fe	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	ecd9d9bd-513e-4aad-98ce-a99e859bb7eb	f	2025-05-03 09:21:29.840877+00	Lab Result Ready: Lab result for test thyroid_panel is now available	\N	\N
0f5d9b49-1a56-43e7-9150-f1c1f2783559	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	5a2455f9-ed04-4d3b-8461-9af24dd4afed	f	2025-05-03 09:39:56.523128+00	Lab Result Ready: Lab result for test liver_function_test is now available	\N	\N
63c0136d-ebec-414c-9521-99ef6feb682b	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	47c4a564-2576-472e-a594-80f721d528c4	f	2025-05-03 09:52:36.895641+00	Lab Result Ready: Lab result for test comprehensive_metabolic_panel is now available	\N	\N
e1443c07-cff1-408d-a4e2-e683d0fd5f51	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	f0511d82-c455-4dcd-8566-ab3324d90b62	f	2025-05-03 09:59:32.674578+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
16420939-cc54-4ddd-8f5e-70d52427b9ae	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	086c6d5f-6320-4c4b-8373-4ca822ffdcc6	f	2025-05-03 12:30:48.238536+00	Lab Result Ready: Lab result for test ecg is now available	\N	\N
f118adb0-7e8e-47fe-bb50-35e9c68d194c	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	c765ad74-00f3-4643-b8f9-56e7a0c6672f	f	2025-05-03 13:03:15.467741+00	Lab Result Ready: Lab result for test comprehensive_metabolic_panel is now available	\N	\N
4063e8df-6ad9-4768-a9c0-317efe059d32	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	be3da0f7-65a7-416e-8d01-bf797dadc8f7	f	2025-05-03 13:27:34.747337+00	Lab Result Ready: Lab result for test thyroid_panel is now available	\N	\N
63df0c0a-7316-4c6a-86da-f355b56c2df8	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	ecc0c0a2-913d-4d78-b23f-1b133926299e	f	2025-05-03 14:54:31.584206+00	Lab Result Ready: Lab result for test urinalysis is now available	\N	\N
945624e8-4ab4-4884-9a5e-6e365dd37714	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	861f53fc-a942-4405-a05c-49da7305c95e	f	2025-05-03 15:33:40.645256+00	Lab Result Ready: Lab result for test chest_xray is now available	\N	\N
66ad78fb-2a00-431f-923a-4141619af4a6	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	5fc07be1-e69e-447a-ac62-25ff0c52b9fb	f	2025-05-08 11:47:34.649989+00	Lab Result Ready: Lab result for test lipid_panel is now available	\N	\N
4b3b19c3-d783-48c3-9c68-3a4783c5b6b4	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	118bff6f-e5d1-4d7a-8e94-03e47d13db96	f	2025-05-08 11:50:27.8436+00	Lab Result Ready: Lab result for test chest_xray is now available	\N	\N
94294673-4d3f-4cd7-972c-9229a779ebb2	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	ab2edc8d-ed3c-401a-99a6-f7127436facd	f	2025-05-08 12:55:25.266778+00	Lab Result Ready: Lab result for test allergy_test is now available	\N	\N
f94415e5-1864-45a0-ad68-9b4e04733e3f	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	870b9a7a-cb30-4eb7-87f1-6fa78c6e9b59	f	2025-05-08 13:10:26.706772+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
6ae3a4d6-bcd6-4673-804c-1adb08bcbd26	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	57c65bc3-17a8-43e9-ba72-19bbb765c517	f	2025-05-08 15:20:26.306869+00	Lab Result Ready: Lab result for test liver_function_test is now available	\N	\N
2689cacb-0be4-4ed1-830a-1ab20c8907f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-10 13:00:59.191968+00	\N	\N	\N
9a797f69-3640-47cd-a3e9-9c30d38f77bc	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-10 13:06:47.897192+00	\N	\N	\N
a1ed1510-6882-47f2-9fbc-eeec9b563bd0	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-10 13:11:51.864349+00	\N	\N	\N
ac8073ce-af71-4354-8628-3dd63a35b3a7	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-10 13:28:06.121488+00	\N	\N	\N
a5889a02-9c10-42c3-b6cc-d065df57aca6	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-10 13:35:07.165614+00	Patient kirunet string has been assigned to you for OPD consultation.	\N	\N
f86839ff-0c57-4b4a-8037-d1d951ef24a1	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-10 14:17:54.214631+00	Patient mepa cakaaa has been assigned to you for OPD consultation.	\N	\N
2bc353a6-23e9-448a-8238-32e704c5aa75	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-10 19:16:25.455329+00	Patient kirunet string has been assigned to you for OPD consultation.	\N	\N
01079ff0-e559-4a47-a5cb-6c76de1daaf5	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-10 19:19:32.117653+00	Patient jemari takami has been assigned to you for OPD consultation.	\N	\N
706d1aea-3135-48d7-9dad-21a80226c356	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-10 19:45:55.589321+00	Patient adiss takami has been assigned to you for OPD consultation.	\N	\N
28e23179-292f-4346-92b3-b67922bec993	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-12 08:06:01.981871+00	Patient bini bana has been assigned to you for OPD consultation.	\N	\N
22cce7ed-c506-47b9-8764-d093083fd096	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-12 08:58:56.674641+00	Patient haileab zinabo has been assigned to you for OPD consultation.	\N	\N
de1517a6-549c-499a-898d-de01a01a4b6b	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-12 09:06:08.569619+00	Patient adiss takami has been assigned to you for OPD consultation.	\N	\N
283e1982-8dbb-43c3-a3e7-c277d8b486fd	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-12 09:24:21.853417+00	Patient jemari takami has been assigned to you for OPD consultation.	\N	\N
4d55e139-8fd7-4e8f-aa9d-876418badf07	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-12 09:56:27.18555+00	Patient bini bana has been assigned to you for OPD consultation.	\N	\N
b4be8681-f7f9-4ec8-81d4-aed57552030a	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-13 07:07:13.282257+00	Patient adiss takami has been assigned to you for OPD consultation.	\N	\N
89ff30b6-fe17-4be8-90fc-3ef01fecdf90	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-13 07:31:22.561349+00	Patient yada equ has been assigned to you for OPD consultation.	\N	\N
83fbc4c7-6845-4da7-bd2b-fd4dc8ebb4a5	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-13 07:33:52.20345+00	Patient adiss takami has been assigned to you for OPD consultation.	\N	\N
f6e54a40-c32e-4a80-b431-b3d83b958094	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-13 07:54:58.053331+00	Patient haileab zinabo has been assigned to you for OPD consultation.	\N	\N
e9c0d016-0e1d-4bdb-95fb-69fb9538cfbd	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-13 08:00:34.322368+00	Patient yada equ has been assigned to you for OPD consultation.	\N	\N
60c465a0-5bcf-4c6e-a597-5f039ed019c4	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-13 09:22:31.723769+00	Patient bini bana has been assigned to you for OPD consultation.	\N	\N
46901b06-9d40-4032-972b-36a9dad308c7	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-13 09:39:22.649112+00	Patient adiss takami has been assigned to you for OPD consultation.	\N	\N
d025a720-a4e1-4d7d-94d6-6b544e707364	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-13 10:06:46.863931+00	Patient mepa cakaaa has been assigned to you for OPD consultation.	\N	\N
cc06256a-b15f-4443-9b8b-b14e8bb9efac	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-14 14:57:18.518885+00	Patient mepa cakaaa has been assigned to you for OPD consultation.	\N	\N
d0528e1b-4a27-492e-b391-3a7d3dc3d169	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-14 19:03:48.186578+00	Patient haileab zinabo has been assigned to you for OPD consultation.	\N	\N
8ef23dad-4bd5-46fd-991a-8e545b92e330	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-14 19:38:42.090883+00	Patient adiss takami has been assigned to you for OPD consultation.	\N	\N
2affd59a-6918-4fac-b63f-0956e434f8b7	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-14 20:26:40.594383+00	Patient yada equ has been assigned to you for OPD consultation.	\N	\N
0381cec9-3a49-4446-bd11-0386fc4d840d	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-14 20:46:30.659447+00	Patient jemari takami has been assigned to you for OPD consultation.	\N	\N
24bc9ce5-6c4e-4211-9795-14347e432f85	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-14 21:01:37.779872+00	Patient bini bana has been assigned to you for OPD consultation.	\N	\N
f9110125-dbae-4c7d-be18-9e0e48a3cd46	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-14 21:22:54.338591+00	Patient haileab zinabo has been assigned to you for OPD consultation.	\N	\N
f731f490-bf57-4261-bb40-a4d0da91354f	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-15 07:13:42.21637+00	Patient adiss takami has been assigned to you for OPD consultation.	\N	\N
32b88d35-7817-46ed-823e-73815ed1b9dd	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-15 16:59:40.941418+00	Patient adiss takami has been assigned to you for OPD consultation.	\N	\N
e276bdde-280f-477c-a02a-dfd92f5668c6	722421d7-e863-46cd-9f55-35c992839c8a	\N	\N	f	2025-05-19 15:37:09.462496+00	Patient haileab zinabo has been assigned to you for OPD consultation.	\N	\N
3b48e1da-15a2-4cf6-a81e-9c52ef110817	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	489ed4e0-81b1-4854-a486-93c81874f8f4	f	2025-05-21 06:42:12.649607+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
97ad9572-fadb-4231-982d-633e474565a0	722421d7-e863-46cd-9f55-35c992839c8a	lab_result_ready	489ed4e0-81b1-4854-a486-93c81874f8f4	f	2025-05-21 08:51:42.702833+00	Lab Result Ready: Lab result for test complete_blood_count is now available	\N	\N
\.


--
-- Data for Name: patient_doctor_assignments; Type: TABLE DATA; Schema: public; Owner: doctor_user
--

COPY public.patient_doctor_assignments (id, patient_id, doctor_id, assigned_at, is_active, notes) FROM stdin;
\.


--
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: doctor_user
--

COPY public.patients (id, registration_number, first_name, last_name, date_of_birth, gender, blood_group, phone_number, email, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, created_at, updated_at, is_active) FROM stdin;
f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	P-20250418-00364	jemari	takami	2002-04-04	MALE	B-	0978756440	test999@gmail.com		tfdgh	0978756445	{}	["lat"]	2025-04-30 12:00:49.455393+00	2025-05-21 13:29:34.120579+00	t
45383e0d-a778-421a-bfe1-a94d1e93f2d8	P-20250416-22098	haileab	zinabo	2002-07-16	MALE	AB+	0978756449	ebrahimjenberu6@gmail.com		tfdghjgkl	0978756444	{}	[""]	2025-04-30 12:36:05.285483+00	2025-05-21 13:29:34.120589+00	t
9cb64761-af83-43fa-8a2d-bfd7e56e7e99	P-20250408-67829	mepa	cakaaa	2025-02-08	MALE	AB-	0978756448	ebrahimjenberupapa@gmail.com		enew megn	0978756449	{}	[]	2025-04-24 14:50:36.946401+00	2025-05-21 13:29:34.121119+00	t
0ea31065-2a8a-44be-81fe-5e2272d7c02a	P-20250408-74072	yada	equ	2025-02-08	MALE	AB+	0978756445	ebrahimjenberu@gmail.com		tfdghjgkl	0978756445	{}	[]	2025-04-24 14:50:37.003719+00	2025-05-21 13:29:34.121022+00	t
eb3c734b-f0fd-4678-b394-622352de68e0	P-20250408-33737	kirunet	string	2025-04-08	MALE	A+	stringstri	user@example.com	string	string	string	{}	["string"]	2025-04-24 14:50:36.813767+00	2025-05-21 13:29:34.121168+00	t
77118e18-ff47-4256-96fb-c4cd6029c04c	P-20250414-40515	adiss	takami	2024-12-05	MALE	AB+	0978756449	ebrahimjenberu88@gmail.com		dbnxm	0909090901	{}	[]	2025-04-24 14:50:36.315201+00	2025-05-21 13:29:34.124992+00	t
5ca96958-df06-4d19-a461-abb528247d9c	P-20250408-20507	bini	bana	2025-02-08	MALE	B-	0978756445	ebrahimjenberu@gmail.com		nhbv	0978756445	{}	[]	2025-04-24 14:50:36.584233+00	2025-05-21 13:29:34.124841+00	t
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: doctor_user
--

COPY public.users (id, email, password_hash, full_name, role, is_active, patient_id, specialization, created_at, updated_at, department) FROM stdin;
722421d7-e863-46cd-9f55-35c992839c8a	doctor@example.com	$2a$06$BwRoiuWH7/F1ubbu7gzclugrk/elCh/UKYBFOvc2lXKE7Jzg3.srW	Dr. John Doe	doctor	t	\N	\N	2025-04-14 16:13:53.387954+00	2025-04-14 16:13:53.387954+00	\N
18f41781-0a53-46cf-acaf-a6dcf5a029d5	ebrahimjenberu8@gmail.com	\N	zebex	doctor	t	\N	\N	2025-04-16 07:21:42.671464+00	2025-04-16 07:21:42.671464+00	Neurology
f104bdc4-5f45-484e-98ad-1802124c6555	ebrahimjenberu888@gmail.com	\N	jemari	doctor	t	\N	\N	2025-04-16 12:01:11.044433+00	2025-04-16 12:01:11.044433+00	Dermatology
a08055dc-644c-4ae3-ad9f-4d1d74115e2c	ebrahimjenberu222@gmail.com	\N	astex	labroom	t	\N	\N	2025-04-16 12:09:13.130731+00	2025-04-16 12:09:13.130731+00	Dermatology
fcd0fce2-6fb7-4926-8920-502aae26761e	ebrahimjenberu66@gmail.com	\N	lab1	labroom	t	\N	\N	2025-04-17 14:50:50.202447+00	2025-04-17 14:50:50.202447+00	Dermatology
a96377b1-5d71-4ee2-940d-660ac6491643	ebrahimjenberu6@gmail.com	\N	labtech2	labroom	t	\N	\N	2025-04-17 14:59:43.134486+00	2025-04-17 14:59:43.134486+00	Cardiology
b37d6b57-164f-4430-bab5-b2b1b3717ff0	ebrahimjenberu19@gmail.com	\N	labtech3	labroom	t	\N	\N	2025-04-17 15:29:32.452934+00	2025-04-17 15:29:32.452934+00	Neurology
8866a1aa-f17a-4b68-a775-26ab3bae2f5b	ebrahimjenberu80@gmail.com	\N	labtech5	labroom	t	\N	\N	2025-04-17 16:39:35.481555+00	2025-04-17 16:39:35.481555+00	Orthopedics
dffb0212-2de8-4cc3-a3ea-8e47e03b7b01	ebrahimjenberupapa33@gmail.com	\N	lantech6	labroom	t	\N	\N	2025-04-17 17:17:31.25482+00	2025-04-17 17:17:31.25482+00	Cardiology
0a8f18ea-6563-45b5-8283-0f45b7c16656	ebrahimjenberuyy@gmail.com	\N	card5	cardroom	t	\N	\N	2025-04-17 21:01:02.465927+00	2025-04-17 21:01:02.465927+00	Cardiology
d6be7a66-a5d5-461e-9df2-8bf225536c39	ebrahimjenberu177@gmail.com	\N	labtech7	labroom	t	\N	\N	2025-04-18 05:27:00.908692+00	2025-04-18 05:27:00.908692+00	Cardiology
940b883c-60b3-430f-811d-3b6491ebe2f7	ebrahimjenberupap23a@gmail.com	\N	labtech8	labroom	t	\N	\N	2025-04-18 08:51:04.192115+00	2025-04-18 08:51:04.192115+00	Pulmonology
1876b65b-c8ba-4f3d-b15b-9d675b6afb7e	ebrahimjenberupapa10@gmail.com	\N	labtech10	labroom	t	\N	\N	2025-04-18 20:37:05.175751+00	2025-04-18 20:37:05.175751+00	Dermatology
fe6fdaf1-0cbf-4c63-bad6-8db0bf919441	ebrahimjenberu234@gmail.com	\N	labtech19	labroom	t	\N	\N	2025-04-18 09:02:23.713561+00	2025-04-18 20:50:21.899301+00	Pulmonology
577a3f52-4607-44da-9e9d-7144fe4e95f0	ebrahimjenberu1980@gmail.com	\N	labtech11	labroom	t	\N	\N	2025-04-19 05:53:51.795354+00	2025-04-19 05:53:51.795354+00	Cardiology
a8684839-be39-45c4-beb4-a012911a9fd8	ebrahimjenberu777@gmail.com	\N	tesfaye	doctor	t	\N	\N	2025-04-29 08:11:26.80178+00	2025-04-29 08:11:26.80178+00	Neurology
b0381851-9549-4a99-a7aa-bf35988fc448	hakika@gmail.com	\N	hakika	admin	f	\N	\N	2025-04-20 19:45:02.29647+00	2025-05-01 11:43:51.273337+00	Cardiology
9289434d-2509-4293-a687-fa7bba301beb	newly@example.com	\N	newly	admin	f	\N	\N	2025-04-18 21:00:44.318955+00	2025-05-01 11:44:11.859135+00	cardiology
5092371d-30a3-41e7-8596-aeb57448517d	ebrahimjenberunew@gmail.com	\N	new	labroom	f	\N	\N	2025-04-17 20:45:21.593886+00	2025-05-01 11:44:41.521811+00	Cardiology
348059d9-585e-4880-be73-7bb4c17f5b19	ebrahimjenberu5@gmail.com	\N	wubu	doctor	t	\N	\N	2025-05-02 07:24:25.873894+00	2025-05-02 07:24:25.873894+00	Cardiology
0b2f8016-1d6b-4dee-b135-afdf4ce4cc85	ebrahimjenberu17@gmail.com	\N	labtech4	labroom	f	\N	\N	2025-04-17 15:48:39.220903+00	2025-05-19 13:46:09.950821+00	Neurology
65077748-4977-463d-9fd7-3ec692702fc9	jenberuebrahim@gmail.com	\N	pass check	admin	f	\N	\N	2025-05-19 12:34:31.150657+00	2025-05-21 09:48:18.920742+00	Cardiology
835bfa4b-c812-4f7b-b7dd-11909290facd	labtech27@gmail.com	\N	labtech27	labroom	f	\N	\N	2025-04-19 08:00:30.764314+00	2025-05-21 09:49:33.938141+00	Neurology
12cb6c53-aa5e-4848-b6bd-f1fb6035e141	ebrahimjenberu879@gmail.com	\N	labtech97	labroom	f	\N	\N	2025-04-19 06:02:06.984496+00	2025-05-21 09:50:07.571883+00	Pulmonology
\.


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: lab_request_comments lab_request_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.lab_request_comments
    ADD CONSTRAINT lab_request_comments_pkey PRIMARY KEY (id);


--
-- Name: lab_request_files lab_request_files_pkey; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.lab_request_files
    ADD CONSTRAINT lab_request_files_pkey PRIMARY KEY (id);


--
-- Name: lab_request_history lab_request_history_pkey; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.lab_request_history
    ADD CONSTRAINT lab_request_history_pkey PRIMARY KEY (id);


--
-- Name: lab_requests lab_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.lab_requests
    ADD CONSTRAINT lab_requests_pkey PRIMARY KEY (id);


--
-- Name: medical_records medical_records_pkey; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.medical_records
    ADD CONSTRAINT medical_records_pkey PRIMARY KEY (id);


--
-- Name: medical_reports medical_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.medical_reports
    ADD CONSTRAINT medical_reports_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: patient_doctor_assignments patient_doctor_assignments_patient_id_doctor_id_is_active_key; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.patient_doctor_assignments
    ADD CONSTRAINT patient_doctor_assignments_patient_id_doctor_id_is_active_key UNIQUE (patient_id, doctor_id, is_active);


--
-- Name: patient_doctor_assignments patient_doctor_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.patient_doctor_assignments
    ADD CONSTRAINT patient_doctor_assignments_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: patients patients_registration_number_key; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_registration_number_key UNIQUE (registration_number);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_appointments_doctor_date; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_appointments_doctor_date ON public.appointments USING btree (doctor_id, appointment_date);


--
-- Name: idx_lab_request_comments; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_lab_request_comments ON public.lab_request_comments USING btree (lab_request_id);


--
-- Name: idx_lab_request_files; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_lab_request_files ON public.lab_request_files USING btree (lab_request_id);


--
-- Name: idx_lab_request_history; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_lab_request_history ON public.lab_request_history USING btree (lab_request_id);


--
-- Name: idx_lab_requests_doctor; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_lab_requests_doctor ON public.lab_requests USING btree (doctor_id);


--
-- Name: idx_lab_requests_patient; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_lab_requests_patient ON public.lab_requests USING btree (patient_id);


--
-- Name: idx_medical_records_patient; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_medical_records_patient ON public.medical_records USING btree (patient_id);


--
-- Name: idx_medical_reports_patient; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_medical_reports_patient ON public.medical_reports USING btree (patient_id);


--
-- Name: idx_notifications_user_read; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (recipient_id, is_read);


--
-- Name: idx_patient_doctor; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_patient_doctor ON public.patient_doctor_assignments USING btree (patient_id, doctor_id);


--
-- Name: idx_patients_name; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_patients_name ON public.patients USING btree (first_name, last_name);


--
-- Name: idx_patients_registration_number; Type: INDEX; Schema: public; Owner: doctor_user
--

CREATE INDEX idx_patients_registration_number ON public.patients USING btree (registration_number);


--
-- Name: appointments appointments_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: lab_request_comments lab_request_comments_lab_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.lab_request_comments
    ADD CONSTRAINT lab_request_comments_lab_request_id_fkey FOREIGN KEY (lab_request_id) REFERENCES public.lab_requests(id);


--
-- Name: lab_request_comments lab_request_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.lab_request_comments
    ADD CONSTRAINT lab_request_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: lab_request_files lab_request_files_lab_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.lab_request_files
    ADD CONSTRAINT lab_request_files_lab_request_id_fkey FOREIGN KEY (lab_request_id) REFERENCES public.lab_requests(id);


--
-- Name: lab_request_files lab_request_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.lab_request_files
    ADD CONSTRAINT lab_request_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: lab_request_history lab_request_history_action_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.lab_request_history
    ADD CONSTRAINT lab_request_history_action_by_fkey FOREIGN KEY (action_by) REFERENCES public.users(id);


--
-- Name: lab_request_history lab_request_history_lab_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.lab_request_history
    ADD CONSTRAINT lab_request_history_lab_request_id_fkey FOREIGN KEY (lab_request_id) REFERENCES public.lab_requests(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id);


--
-- Name: patient_doctor_assignments patient_doctor_assignments_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: doctor_user
--

ALTER TABLE ONLY public.patient_doctor_assignments
    ADD CONSTRAINT patient_doctor_assignments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

