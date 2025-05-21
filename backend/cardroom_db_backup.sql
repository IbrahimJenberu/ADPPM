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
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: log_patient_changes(); Type: FUNCTION; Schema: public; Owner: cardroom_user
--

CREATE FUNCTION public.log_patient_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.log_patient_changes() OWNER TO cardroom_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: cardroom_user
--

CREATE TABLE public.appointments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    appointment_date timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 30 NOT NULL,
    appointment_type character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'SCHEDULED'::character varying,
    reason text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false
);


ALTER TABLE public.appointments OWNER TO cardroom_user;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: cardroom_user
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    action character varying(20) NOT NULL,
    user_id uuid NOT NULL,
    changes jsonb NOT NULL,
    ip_address character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO cardroom_user;

--
-- Name: doctors; Type: TABLE; Schema: public; Owner: cardroom_user
--

CREATE TABLE public.doctors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    full_name character varying(200) NOT NULL,
    department character varying(100) NOT NULL,
    is_available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false
);


ALTER TABLE public.doctors OWNER TO cardroom_user;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: cardroom_user
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    recipient_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone
);


ALTER TABLE public.notifications OWNER TO cardroom_user;

--
-- Name: opd_assignments; Type: TABLE; Schema: public; Owner: cardroom_user
--

CREATE TABLE public.opd_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    priority character varying(20) DEFAULT 'NORMAL'::character varying,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_deleted boolean DEFAULT false
);


ALTER TABLE public.opd_assignments OWNER TO cardroom_user;

--
-- Name: patients; Type: TABLE; Schema: public; Owner: cardroom_user
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
    is_deleted boolean DEFAULT false
);


ALTER TABLE public.patients OWNER TO cardroom_user;

--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: cardroom_user
--

COPY public.appointments (id, patient_id, doctor_id, appointment_date, duration_minutes, appointment_type, status, reason, notes, created_at, updated_at, is_deleted) FROM stdin;
8425ba43-1c7c-4881-b818-9748585af85e	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	2027-04-09 18:21:03.314+00	50	INITIAL	SCHEDULED	check	good	2025-04-09 18:19:20.578415+00	2025-04-09 18:21:50.283324+00	f
499821f8-2aed-4598-b878-928fe9b78f56	0ea31065-2a8a-44be-81fe-5e2272d7c02a	000c52cd-2136-4bf7-9382-b59536cfbf8b	2025-04-19 19:04:52+00	45	FOLLOW_UP	SCHEDULED	sdfghjk	drghjk	2025-04-09 19:05:20.621057+00	2025-04-09 19:05:20.621057+00	f
a6006f29-eb33-48bf-a020-d7d20dc0a17f	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	57491bdb-9e98-4eae-a8aa-2a8758c10062	2025-04-11 19:05:47+00	45	FOLLOW_UP	SCHEDULED	xv	ghjnm	2025-04-09 19:06:12.559111+00	2025-04-09 19:06:12.559111+00	f
670d28d5-1ed1-4219-a3c1-342bcec41126	5ca96958-df06-4d19-a461-abb528247d9c	7e8df331-5d04-4e54-b3d5-d08097b9aa10	2025-04-12 19:06:11+00	45	FOLLOW_UP	SCHEDULED	xdfjhkl	drgy	2025-04-09 19:06:37.773332+00	2025-04-09 19:06:37.773332+00	f
55809ed5-9d69-4ebb-b299-b96a417ad6eb	0ea31065-2a8a-44be-81fe-5e2272d7c02a	000c52cd-2136-4bf7-9382-b59536cfbf8b	2025-04-25 19:30:30+00	45	CONSULTATION	SCHEDULED	weg	dsf	2025-04-09 19:31:18.102301+00	2025-04-09 19:31:18.102301+00	f
2e0620d5-b33a-432e-9531-4d09d298ae9a	0ea31065-2a8a-44be-81fe-5e2272d7c02a	000c52cd-2136-4bf7-9382-b59536cfbf8b	2025-05-03 19:34:30+00	30	FOLLOW_UP	SCHEDULED	defg	df	2025-04-09 19:37:40.837323+00	2025-04-09 19:37:40.837323+00	f
80531019-2fc1-4d63-ad12-c0cfdcace909	eb3c734b-f0fd-4678-b394-622352de68e0	7e8df331-5d04-4e54-b3d5-d08097b9aa10	2025-05-03 08:23:25+00	30	FOLLOW_UP	SCHEDULED	yu	uu	2025-04-10 08:23:53.736266+00	2025-04-10 08:23:53.736266+00	f
3f12975c-90b7-49da-b9d3-12b42437db8b	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	2026-05-15 14:42:12+00	45	CONSULTATION	SCHEDULED	tryuijk	ertyjh	2025-04-11 14:55:26.82515+00	2025-04-11 14:55:26.82515+00	f
62fdeb93-80c9-4877-827d-7312bacd8949	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	2025-04-12 18:59:25+00	30	FOLLOW_UP	CANCELLED	dfgh	jegn	2025-04-09 19:00:44.396711+00	2025-04-12 21:45:40.797039+00	f
f39cbc03-f9ca-4438-8e7c-ca64c0085aa0	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	2025-10-15 08:11:00+00	30	FOLLOW_UP	SCHEDULED	nm	nbm	2025-04-14 08:28:07.19145+00	2025-04-14 08:28:07.19145+00	f
cf2b5104-e183-4a3b-995c-ca30fb4d036b	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	2027-04-14 08:28:00+00	30	FOLLOW_UP	SCHEDULED	asxd	sa	2025-04-14 08:29:16.892379+00	2025-04-14 08:29:16.892379+00	f
0b655f46-5d74-4eb0-93f0-dd604d89e865	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	2027-04-16 08:28:00+00	30	FOLLOW_UP	SCHEDULED	asxd	sa	2025-04-14 08:54:11.965328+00	2025-04-14 08:54:11.965328+00	f
4ac94926-2ae0-4211-bb1f-3f2a86860afc	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	2026-04-16 13:34:00+00	45	FOLLOW_UP	SCHEDULED	2345	ty	2025-04-16 13:35:09.316354+00	2025-04-16 13:35:09.316354+00	f
3838230a-08e9-4163-b7be-a4dea245ef40	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	2025-04-19 18:52:21+00	30	INITIAL	SCHEDULED	fgt	efrgt	2025-04-09 18:59:27.651533+00	2025-04-16 13:49:20.893704+00	f
a5b553c2-ede0-42ce-a831-68a2aa112879	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	2025-05-12 20:09:13.555+00	60	INITIAL	CONFIRMED	string	was good	2025-04-12 08:24:35.100755+00	2025-04-30 08:21:05.969484+00	f
c7c87193-7610-40cc-bf5f-eb9edf201199	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	2025-05-03 13:32:58+00	30	CONSULTATION	SCHEDULED	nafkot	enegenagnalen	2025-04-30 13:34:04.699366+00	2025-04-30 13:34:04.699366+00	f
cc1ebd41-c0e9-4604-a3de-1d850babc815	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	2025-05-31 07:35:54+00	45	EMERGENCY	SCHEDULED	skin	condition	2025-05-02 07:38:14.889109+00	2025-05-02 07:38:14.889109+00	f
3501347f-38ef-4197-a6b1-8246d43f72f8	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	2025-05-02 16:34:05+00	45	PROCEDURE	CONFIRMED	nalgn	kezas	2025-04-30 16:35:12.523928+00	2025-05-02 07:44:44.512428+00	f
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: cardroom_user
--

COPY public.audit_logs (id, entity_type, entity_id, action, user_id, changes, ip_address, created_at) FROM stdin;
\.


--
-- Data for Name: doctors; Type: TABLE DATA; Schema: public; Owner: cardroom_user
--

COPY public.doctors (id, full_name, department, is_available, created_at, updated_at, is_deleted) FROM stdin;
57491bdb-9e98-4eae-a8aa-2a8758c10062	doc	Orthopedics	t	2025-04-09 19:05:33.571423+00	2025-04-09 19:05:33.571423+00	f
000c52cd-2136-4bf7-9382-b59536cfbf8b	kira	Neurology	t	2025-04-09 19:04:52.725668+00	2025-04-09 19:04:52.725668+00	f
7e8df331-5d04-4e54-b3d5-d08097b9aa10	mepa	Dermatology	t	2025-04-09 19:05:45.386575+00	2025-04-09 19:05:45.386575+00	f
722421d7-e863-46cd-9f55-35c992839c8a	tamnke	Neurology	t	2025-04-09 15:50:16.585793+00	2025-04-09 15:50:16.585793+00	f
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: cardroom_user
--

COPY public.notifications (id, recipient_id, title, message, entity_type, entity_id, is_read, created_at, read_at) FROM stdin;
\.


--
-- Data for Name: opd_assignments; Type: TABLE DATA; Schema: public; Owner: cardroom_user
--

COPY public.opd_assignments (id, patient_id, doctor_id, priority, status, notes, created_at, updated_at, is_deleted) FROM stdin;
eef7a538-b58f-4ee8-9276-7a2211fbf7ef	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	string	2025-04-09 15:19:05.940032+00	2025-04-09 15:19:05.940032+00	f
b2cfb7ac-fd78-491d-984c-d50ffdb752a7	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	string	2025-04-09 15:31:19.516163+00	2025-04-09 15:31:19.516163+00	f
4761d43d-3e1f-45bb-8938-c2ab7bac60e9	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	string	2025-04-09 15:39:24.351783+00	2025-04-09 15:39:24.351783+00	f
07223c71-db30-43db-ae09-1f00108ec0c0	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	string	2025-04-09 16:00:44.684173+00	2025-04-09 16:00:44.684173+00	f
a1e4d30b-5d1d-41f7-bebb-01bdc453c887	5ca96958-df06-4d19-a461-abb528247d9c	000c52cd-2136-4bf7-9382-b59536cfbf8b	LOW	PENDING	wow	2025-04-09 15:50:16.564256+00	2025-04-09 16:03:33.25374+00	f
9c1426cf-b92f-4b8f-b937-462618ae5834	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-09 17:26:31.914754+00	2025-04-09 17:26:31.914754+00	f
e7e26d54-6d71-4f29-859e-352b5b02fbfc	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-09 18:10:00.134777+00	2025-04-09 18:10:00.134777+00	f
79061832-480f-4a09-b612-83d9cfb1a6c9	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-09 18:14:25.59139+00	2025-04-09 18:14:25.59139+00	f
8a4f08a3-fece-4915-bc18-7c05fca45ff5	0ea31065-2a8a-44be-81fe-5e2272d7c02a	000c52cd-2136-4bf7-9382-b59536cfbf8b	NORMAL	PENDING	\N	2025-04-09 19:04:52.720398+00	2025-04-09 19:04:52.720398+00	f
a1bbc383-d2c1-4c8b-b857-a92e2f0bac2e	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	57491bdb-9e98-4eae-a8aa-2a8758c10062	NORMAL	PENDING	\N	2025-04-09 19:05:33.567092+00	2025-04-09 19:05:33.567092+00	f
f1a2e328-3811-4c5f-a4c8-3126777d8250	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	7e8df331-5d04-4e54-b3d5-d08097b9aa10	NORMAL	PENDING	\N	2025-04-09 19:05:45.382241+00	2025-04-09 19:05:45.382241+00	f
6605d99e-bc61-47f3-bcff-e058852875de	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-10 04:57:08.704568+00	2025-04-10 04:57:08.704568+00	f
dc0f43b5-48b9-482b-a992-af3f647fac19	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-10 06:49:33.314497+00	2025-04-10 06:49:33.314497+00	f
3fd21d93-1308-411d-b8ce-6be649fc9a5c	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-10 07:09:35.38827+00	2025-04-10 07:09:35.38827+00	f
72e66304-a8d8-4d6c-96d7-ae46bde2b769	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-10 07:36:05.913326+00	2025-04-10 07:36:05.913326+00	f
75b7d01f-0dcc-48ee-9c3c-3e2b759fb5da	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-10 07:52:10.704244+00	2025-04-10 07:52:10.704244+00	f
2a0a3066-dc5a-461b-8938-ce172896ea98	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-10 12:27:28.717917+00	2025-04-10 12:27:28.717917+00	f
97bc21d4-d420-4cbc-8faf-1bef14bf9032	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-10 19:54:10.654234+00	2025-04-10 19:54:10.654234+00	f
5b7a3376-f170-4240-a617-d3bf3fd00b2f	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-10 19:54:18.823979+00	2025-04-10 19:54:18.823979+00	f
96aad0ba-6d8d-4736-b6da-c24ee7f0810b	f2ce0ded-13f4-422d-93fd-950bdf36d5fc	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-10 19:54:25.429636+00	2025-04-10 19:54:25.429636+00	f
68192e11-cbff-42ae-af5e-70607eedd2de	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-10 19:54:34.024969+00	2025-04-10 19:54:34.024969+00	f
f9b0cdb2-3c63-4085-a07d-f14a1711ae37	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	string	2025-04-10 21:25:05.294378+00	2025-04-10 21:25:05.294378+00	f
89453c19-6ddb-4ab0-ac7c-97607fd7f0b1	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	string	2025-04-10 21:44:25.081071+00	2025-04-10 21:44:25.081071+00	f
ebf5ef44-d58a-4120-bb1f-75c058cb7c70	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	string	2025-04-10 21:49:28.4628+00	2025-04-10 21:49:28.4628+00	f
4eabc8a6-6713-4bb2-b354-511133f1fefc	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-10 21:51:04.202297+00	2025-04-10 21:51:04.202297+00	f
4d66b898-b9ac-4b1f-a24b-6116016ba64d	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-12 08:23:51.408767+00	2025-04-12 08:23:51.408767+00	f
693c56b2-6866-4c71-9068-fa3564d56843	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-14 08:10:24.702321+00	2025-04-14 08:10:24.702321+00	f
ab3ffb5d-3886-4ace-9b25-1676b0a43441	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-16 13:35:35.32948+00	2025-04-16 13:35:35.32948+00	f
4bc79196-19f4-4472-8457-23f9eb5132ef	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-30 12:00:28.407363+00	2025-04-30 12:00:28.407363+00	f
7a34196e-573b-4ff5-b7b7-f8b3c7f489b8	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-30 12:35:45.674597+00	2025-04-30 12:35:45.674597+00	f
7f679c99-53a5-4825-8d0d-041aea7eb358	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-30 12:58:51.985376+00	2025-04-30 12:58:51.985376+00	f
c184deee-8ac2-47f3-822e-d120ca4ef284	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	a8684839-be39-45c4-beb4-a012911a9fd8	NORMAL	PENDING	\N	2025-04-30 15:43:07.609795+00	2025-04-30 15:43:07.609795+00	f
53579115-96af-4384-84b4-efb5cda10fcf	45383e0d-a778-421a-bfe1-a94d1e93f2d8	000c52cd-2136-4bf7-9382-b59536cfbf8b	NORMAL	PENDING	\N	2025-04-30 15:43:19.492521+00	2025-04-30 15:43:19.492521+00	f
515e6bca-7be2-4e00-9809-9d0f4d3aee8c	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-04-30 15:54:10.813865+00	2025-04-30 15:54:10.813865+00	f
09f3edc8-dc4f-460d-b023-b25e0de56db9	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	348059d9-585e-4880-be73-7bb4c17f5b19	NORMAL	PENDING	\N	2025-04-30 15:55:18.305094+00	2025-04-30 15:55:18.305094+00	f
34028a12-09be-4242-81b7-aedf401b9b73	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	18f41781-0a53-46cf-acaf-a6dcf5a029d5	NORMAL	PENDING	\N	2025-04-30 15:55:28.890757+00	2025-04-30 15:55:28.890757+00	f
53b13ed1-d949-49b9-bd63-bd13d882c5b9	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	f104bdc4-5f45-484e-98ad-1802124c6555	NORMAL	PENDING	\N	2025-04-30 15:55:38.935514+00	2025-04-30 15:55:38.935514+00	f
18ce9a60-b8e4-460e-8d65-741bca6133f7	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	a8684839-be39-45c4-beb4-a012911a9fd8	NORMAL	PENDING	\N	2025-04-30 15:55:41.527909+00	2025-04-30 15:55:41.527909+00	f
110e5205-3593-4440-8c22-4e1637666461	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	7f2478f5-2e8a-456e-87fe-7f249aaffeb7	NORMAL	PENDING	\N	2025-04-30 15:55:46.66668+00	2025-04-30 15:55:46.66668+00	f
229685db-72f5-4ee1-91a9-64633d52f67c	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	1f922f38-85c1-4a61-b4ff-0c02d3b12781	NORMAL	PENDING	\N	2025-04-30 15:55:49.331645+00	2025-04-30 15:55:49.331645+00	f
c58f28e8-5f13-4aee-89b1-7bbd7f2ddf87	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	405d2da2-1770-46eb-9978-ee58c0349175	NORMAL	PENDING	\N	2025-04-30 15:55:52.449526+00	2025-04-30 15:55:52.449526+00	f
e47398a4-782f-466b-8674-f7773243375e	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	7e8df331-5d04-4e54-b3d5-d08097b9aa10	NORMAL	PENDING	\N	2025-04-30 15:55:56.060335+00	2025-04-30 15:55:56.060335+00	f
4b33bd35-5ef1-45d6-966a-5bd01d91d3f3	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-02 07:34:26.244267+00	2025-05-02 07:34:26.244267+00	f
53e08dcd-5197-4313-adfa-fd3419843b1c	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-10 13:00:57.497106+00	2025-05-10 13:00:57.497106+00	f
061e9a1e-fcd2-4662-8f27-ec99d6cd0c75	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-10 13:06:47.169169+00	2025-05-10 13:06:47.169169+00	f
709ba82e-178c-44c5-882f-029ebd0d2b41	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-10 13:11:49.712697+00	2025-05-10 13:11:49.712697+00	f
c5a612a9-7e8b-43ff-8eab-c8d7141d01ca	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-10 13:28:04.61738+00	2025-05-10 13:28:04.61738+00	f
f454913f-e941-4fc3-b13f-cba00bc37607	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-10 13:35:06.438883+00	2025-05-10 13:35:06.438883+00	f
5f89414b-ad0a-40d9-a844-9d34e2b19cfb	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-10 14:17:53.33806+00	2025-05-10 14:17:53.33806+00	f
5d498488-5d42-4170-819a-5cb85ad71dc4	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-10 19:16:24.099599+00	2025-05-10 19:16:24.099599+00	f
d174d140-7d35-4649-b55a-91c5c38e15e2	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-10 19:19:26.066435+00	2025-05-10 19:19:26.066435+00	f
7995c559-9c02-4aee-8e8b-6e0402961ee3	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-10 19:45:54.626112+00	2025-05-10 19:45:54.626112+00	f
f20fa6a3-2b86-4ed3-931c-bdbf43709de4	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-12 08:05:59.245749+00	2025-05-12 08:05:59.245749+00	f
c53f918d-697e-4e07-9b76-52ff55661471	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-12 08:31:57.744716+00	2025-05-12 08:31:57.744716+00	f
5b6ce6d8-9df4-44f1-909c-69117fc5e826	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-12 08:32:44.83764+00	2025-05-12 08:32:44.83764+00	f
9636a8f4-d088-4201-a927-a913540b267a	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-12 08:58:55.835884+00	2025-05-12 08:58:55.835884+00	f
39614273-d03f-4a4b-a241-2bad289b8a4a	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-12 09:06:07.63174+00	2025-05-12 09:06:07.63174+00	f
49421edc-7293-40ea-9a89-b266d931a928	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-12 09:24:17.722773+00	2025-05-12 09:24:17.722773+00	f
762f8a91-ea57-4541-aebd-4ff173f289dc	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-12 09:56:26.048655+00	2025-05-12 09:56:26.048655+00	f
19934284-d62d-4860-af86-6d403c68105f	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-13 07:07:12.202052+00	2025-05-13 07:07:12.202052+00	f
2b024279-c091-48bc-9e7b-31e5e3f1931b	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-13 07:31:21.510169+00	2025-05-13 07:31:21.510169+00	f
3b6dc142-1ee8-44c0-8972-069f114ab154	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-13 07:33:51.450235+00	2025-05-13 07:33:51.450235+00	f
60b008f8-0b03-4b9f-b9b7-c917b3bb7546	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-13 07:54:56.245009+00	2025-05-13 07:54:56.245009+00	f
17c0fc21-524f-484f-9c70-5b12f9868021	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-13 08:00:32.319056+00	2025-05-13 08:00:32.319056+00	f
254821ad-9216-49af-a1b8-839f9766811c	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-13 09:22:30.825065+00	2025-05-13 09:22:30.825065+00	f
b32cc01c-b65b-4a5e-b366-ff11aa2b0826	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-13 09:39:21.825115+00	2025-05-13 09:39:21.825115+00	f
177ab691-e6bf-467b-a9cf-d2f6d7ffa15f	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-13 10:06:45.069105+00	2025-05-13 10:06:45.069105+00	f
4a2ed946-3757-4b8c-abc9-31c8655db5fe	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-14 14:57:17.454294+00	2025-05-14 14:57:17.454294+00	f
e964a8b5-af2c-4a89-be5f-a349b64f1d6c	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-14 19:03:45.885599+00	2025-05-14 19:03:45.885599+00	f
d14c5f50-17d0-42aa-bc64-ccc141678e5a	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-14 19:38:40.33155+00	2025-05-14 19:38:40.33155+00	f
cd53b4b0-5b93-4041-8a68-f3e02c98b187	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-14 20:26:39.666477+00	2025-05-14 20:26:39.666477+00	f
bd03edf9-50dc-48ca-ad79-5973656f1287	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-14 20:46:29.696692+00	2025-05-14 20:46:29.696692+00	f
f99bf6c8-8adf-42d8-9c0a-61ae9fb859e1	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-14 21:01:37.045934+00	2025-05-14 21:01:37.045934+00	f
a112af16-bde5-4c29-a904-e6217aef9ee7	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-14 21:22:53.460308+00	2025-05-14 21:22:53.460308+00	f
8814f246-8880-4976-9f6e-9bfe9038efe8	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-15 07:13:40.514583+00	2025-05-15 07:13:40.514583+00	f
064f1a2a-fc86-4eb7-a7e3-da38f819f0c9	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-15 16:59:38.563173+00	2025-05-15 16:59:38.563173+00	f
23429c2c-5387-4816-bbf8-0f988a472a84	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	NORMAL	PENDING	\N	2025-05-19 15:37:07.588692+00	2025-05-19 15:37:07.588692+00	f
\.


--
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: cardroom_user
--

COPY public.patients (id, registration_number, first_name, last_name, date_of_birth, gender, blood_group, phone_number, email, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, created_at, updated_at, is_deleted) FROM stdin;
eb3c734b-f0fd-4678-b394-622352de68e0	P-20250408-33737	kirunet	string	2025-04-08	MALE	A+	stringstri	user@example.com	string	string	string	{}	["string"]	2025-04-08 08:30:59.759796+00	2025-04-08 08:36:15.660618+00	f
be52d352-6bf1-4657-9770-880c49f100e7	P-20250408-21698	string	string	2025-04-08	MALE	A+	stringstri	user@example.com	string	string	string	{}	["string"]	2025-04-08 08:35:05.518544+00	2025-04-08 09:09:49.505821+00	t
9cb64761-af83-43fa-8a2d-bfd7e56e7e99	P-20250408-67829	mepa	cakaaa	2025-02-08	MALE	AB-	0978756448	ebrahimjenberupapa@gmail.com		enew megn	0978756449	{}	[]	2025-04-08 09:08:20.47577+00	2025-04-08 09:26:48.078104+00	f
0ea31065-2a8a-44be-81fe-5e2272d7c02a	P-20250408-74072	yada	equ	2025-02-08	MALE	AB+	0978756445	ebrahimjenberu@gmail.com		tfdghjgkl	0978756445	{}	[]	2025-04-08 09:27:29.030235+00	2025-04-08 09:27:29.030235+00	f
5ca96958-df06-4d19-a461-abb528247d9c	P-20250408-20507	bini	bana	2025-02-08	MALE	B-	0978756445	ebrahimjenberu@gmail.com		nhbv	0978756445	{}	[]	2025-04-08 12:25:58.203124+00	2025-04-08 12:25:58.203124+00	f
f2ce0ded-13f4-422d-93fd-950bdf36d5fc	P-20250408-97963	string	strin	2025-04-08	MALE	A+	stringstri	user@example.com	string	string	string	{}	["string"]	2025-04-08 08:44:46.840725+00	2025-04-20 20:10:57.936771+00	t
77118e18-ff47-4256-96fb-c4cd6029c04c	P-20250414-40515	adiss	takami	2024-12-05	MALE	AB+	0978756449	ebrahimjenberu88@gmail.com		dbnxm	0909090901	{}	[]	2025-04-14 08:09:42.787932+00	2025-04-21 06:14:42.282812+00	f
45383e0d-a778-421a-bfe1-a94d1e93f2d8	P-20250416-22098	haileab	zinabo	2002-07-16	MALE	AB+	0978756449	ebrahimjenberu6@gmail.com		tfdghjgkl	0978756444	{}	[""]	2025-04-16 13:37:16.546447+00	2025-04-29 08:18:06.175475+00	f
f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	P-20250418-00364	jemari	takami	2002-04-04	MALE	B-	0978756440	test999@gmail.com		tfdgh	0978756445	{}	["lat"]	2025-04-18 17:06:15.403344+00	2025-05-05 15:05:41.11806+00	f
\.


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: cardroom_user
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: cardroom_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: cardroom_user
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);


--
-- Name: appointments no_overlapping_appointments; Type: CONSTRAINT; Schema: public; Owner: cardroom_user
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT no_overlapping_appointments UNIQUE (doctor_id, appointment_date, duration_minutes);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: cardroom_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: opd_assignments opd_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: cardroom_user
--

ALTER TABLE ONLY public.opd_assignments
    ADD CONSTRAINT opd_assignments_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: cardroom_user
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: patients patients_registration_number_key; Type: CONSTRAINT; Schema: public; Owner: cardroom_user
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_registration_number_key UNIQUE (registration_number);


--
-- Name: idx_appointment_date; Type: INDEX; Schema: public; Owner: cardroom_user
--

CREATE INDEX idx_appointment_date ON public.appointments USING btree (appointment_date);


--
-- Name: idx_appointment_doctor; Type: INDEX; Schema: public; Owner: cardroom_user
--

CREATE INDEX idx_appointment_doctor ON public.appointments USING btree (doctor_id);


--
-- Name: idx_appointment_patient; Type: INDEX; Schema: public; Owner: cardroom_user
--

CREATE INDEX idx_appointment_patient ON public.appointments USING btree (patient_id);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: cardroom_user
--

CREATE INDEX idx_audit_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_notifications_recipient; Type: INDEX; Schema: public; Owner: cardroom_user
--

CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_id);


--
-- Name: idx_opd_doctor; Type: INDEX; Schema: public; Owner: cardroom_user
--

CREATE INDEX idx_opd_doctor ON public.opd_assignments USING btree (doctor_id);


--
-- Name: idx_opd_patient; Type: INDEX; Schema: public; Owner: cardroom_user
--

CREATE INDEX idx_opd_patient ON public.opd_assignments USING btree (patient_id);


--
-- Name: idx_patient_name; Type: INDEX; Schema: public; Owner: cardroom_user
--

CREATE INDEX idx_patient_name ON public.patients USING btree (first_name, last_name);


--
-- Name: idx_registration_number; Type: INDEX; Schema: public; Owner: cardroom_user
--

CREATE INDEX idx_registration_number ON public.patients USING btree (registration_number);


--
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cardroom_user
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: opd_assignments opd_assignments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: cardroom_user
--

ALTER TABLE ONLY public.opd_assignments
    ADD CONSTRAINT opd_assignments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- PostgreSQL database dump complete
--

