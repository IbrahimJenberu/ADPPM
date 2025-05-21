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
-- Name: test_priority; Type: TYPE; Schema: public; Owner: labroom_user
--

CREATE TYPE public.test_priority AS ENUM (
    'high',
    'medium',
    'low'
);


ALTER TYPE public.test_priority OWNER TO labroom_user;

--
-- Name: test_status; Type: TYPE; Schema: public; Owner: labroom_user
--

CREATE TYPE public.test_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE public.test_status OWNER TO labroom_user;

--
-- Name: test_type; Type: TYPE; Schema: public; Owner: labroom_user
--

CREATE TYPE public.test_type AS ENUM (
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


ALTER TYPE public.test_type OWNER TO labroom_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: analytics_metrics; Type: TABLE; Schema: public; Owner: labroom_user
--

CREATE TABLE public.analytics_metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    metric_type character varying(50) NOT NULL,
    metric_value integer NOT NULL,
    metric_date date DEFAULT CURRENT_DATE NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analytics_metrics OWNER TO labroom_user;

--
-- Name: lab_notifications; Type: TABLE; Schema: public; Owner: labroom_user
--

CREATE TABLE public.lab_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    recipient_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    lab_request_id uuid,
    lab_result_id uuid,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    notification_type character varying(50) NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone
);


ALTER TABLE public.lab_notifications OWNER TO labroom_user;

--
-- Name: lab_reports; Type: TABLE; Schema: public; Owner: labroom_user
--

CREATE TABLE public.lab_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    report_type character varying(50) NOT NULL,
    report_format character varying(10) NOT NULL,
    date_range_start date NOT NULL,
    date_range_end date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    file_path text NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL
);


ALTER TABLE public.lab_reports OWNER TO labroom_user;

--
-- Name: lab_request_events; Type: TABLE; Schema: public; Owner: labroom_user
--

CREATE TABLE public.lab_request_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lab_request_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    event_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    details jsonb
);


ALTER TABLE public.lab_request_events OWNER TO labroom_user;

--
-- Name: lab_requests; Type: TABLE; Schema: public; Owner: labroom_user
--

CREATE TABLE public.lab_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    technician_id uuid,
    test_type public.test_type NOT NULL,
    priority public.test_priority DEFAULT 'medium'::public.test_priority NOT NULL,
    status public.test_status DEFAULT 'pending'::public.test_status NOT NULL,
    notes text,
    diagnosis_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    due_date timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone
);


ALTER TABLE public.lab_requests OWNER TO labroom_user;

--
-- Name: lab_results; Type: TABLE; Schema: public; Owner: labroom_user
--

CREATE TABLE public.lab_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    lab_request_id uuid NOT NULL,
    result_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    conclusion text,
    image_paths text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE public.lab_results OWNER TO labroom_user;

--
-- Name: result_images; Type: TABLE; Schema: public; Owner: labroom_user
--

CREATE TABLE public.result_images (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    result_id uuid NOT NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_size bigint NOT NULL,
    file_type text NOT NULL,
    description text,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.result_images OWNER TO labroom_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: labroom_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    department character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO labroom_user;

--
-- Data for Name: analytics_metrics; Type: TABLE DATA; Schema: public; Owner: labroom_user
--

COPY public.analytics_metrics (id, metric_type, metric_value, metric_date, updated_at) FROM stdin;
\.


--
-- Data for Name: lab_notifications; Type: TABLE DATA; Schema: public; Owner: labroom_user
--

COPY public.lab_notifications (id, recipient_id, sender_id, lab_request_id, lab_result_id, title, message, notification_type, is_read, created_at, read_at) FROM stdin;
e64994db-a937-4632-830a-a8ce8a01e775	dffb0212-2de8-4cc3-a3ea-8e47e03b7b01	dffb0212-2de8-4cc3-a3ea-8e47e03b7b01	2ab442d0-7194-468b-b957-f9a231a7d52d	\N	New Lab Test Assignment	You have been assigned a new complete_blood_count test for Patient	lab_request_assigned	f	2025-04-18 05:23:31.715372+00	\N
1031f8d0-51ba-47e4-9d11-d9033fa43921	722421d7-e863-46cd-9f55-35c992839c8a	d6be7a66-a5d5-461e-9df2-8bf225536c39	123399cd-73f3-4a3b-a5ee-1e8eca8796a8	\N	Lab Request Assigned	Your lab request for Patient has been assigned and is in progress	lab_request_updated	f	2025-04-18 05:29:08.876391+00	\N
7096a1ce-5bbb-4587-8b65-f8334d11d388	722421d7-e863-46cd-9f55-35c992839c8a	a08055dc-644c-4ae3-ad9f-4d1d74115e2c	aa0d37a7-fd66-4e8b-b850-f57e790b3f17	bba10b00-786d-4851-a475-07749678f630	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-04-20 13:56:43.898024+00	\N
10beb047-1ddd-4e8c-888f-740c93330dac	722421d7-e863-46cd-9f55-35c992839c8a	a08055dc-644c-4ae3-ad9f-4d1d74115e2c	b14a652d-fb65-4353-99d5-991372cd9539	b02705cc-5b47-4c01-99ad-795ceb1097d8	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-04-20 14:03:55.11314+00	\N
5ee7f2f5-1d08-43ac-aca5-9fb8b78b25a3	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	5a444286-d295-4df6-86fb-9d2aefb48816	\N	Lab Request Assigned	Your lab request for Patient has been assigned and is in progress	lab_request_updated	f	2025-04-22 16:01:36.061769+00	\N
493c4e97-a828-4a1c-869d-752fb5b23665	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	a43688a2-fc64-4aa7-871b-03374c99ee9e	\N	Lab Request Assigned	Your lab request for Patient has been assigned and is in progress	lab_request_updated	f	2025-04-22 17:09:28.270729+00	\N
565a502c-60b1-473c-b87f-f6a64248cf79	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	a43688a2-fc64-4aa7-871b-03374c99ee9e	f1851cc0-2f9a-4270-9c77-3a09a202b8c3	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-04-24 05:35:00.617272+00	\N
05c3bd68-55bb-40b9-a86d-27ff60440093	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	df6fdb9b-9239-442c-8ff8-b11952173253	1c660555-af4e-4db4-9347-41bafd2b9019	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-04-24 06:29:56.496716+00	\N
41335be6-e3a6-4a3f-92be-912ee272b7ab	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	4c9366ec-02fd-41fe-9dd1-7fe7cc67b401	ae61bfdf-f05e-4735-ad39-2df42013faed	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-04-24 06:43:26.253316+00	\N
94465168-3462-4b95-88a5-ee8a63b26c93	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	8076c86d-9867-45a6-ab12-7d6461a55b55	\N	Lab Request Assigned	Your lab request for Patient has been assigned and is in progress	lab_request_updated	f	2025-04-24 19:20:40.785728+00	\N
dceb70a3-1ed2-4179-918a-6be80a0e564f	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	7609d3bc-2e15-4a4e-b6b7-c440574091c9	10583038-fe9f-4ef0-91d5-a30bc6d01439	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-04-26 10:27:09.619199+00	\N
6376c06a-b446-47df-b31c-2e6d0279b5e6	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	98d1fb80-2da7-4212-902f-e96e45bbe51a	c7ccfe95-0462-4556-93a0-ace04ef1d57a	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-04-27 05:59:26.088051+00	\N
72911a04-e93d-4196-9fff-e6e5bff57106	3fa85f64-5717-4562-b3fc-2c963f66afa6	3fa85f64-5717-4562-b3fc-2c963f66afa6	51183afb-c8d4-41df-9ead-61a96bdad68c	\N	New Lab Test Assignment	You have been assigned a new complete_blood_count test for Patient	lab_request_assigned	f	2025-04-27 13:14:47.239151+00	\N
05d1ff42-1c45-4b1d-b4f3-a80f0dad4a0b	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	51183afb-c8d4-41df-9ead-61a96bdad68c	ad4886fe-0399-419b-a451-09ba428e41a8	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-04-27 13:48:41.964979+00	\N
13f8ce17-f1dd-434e-bed8-8718d1d3c43e	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	227f773e-4c32-4297-9ea7-cd46d56db515	e13f0a23-175e-41d0-a213-07351d8c8386	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-04-27 14:44:40.477948+00	\N
d889b117-45bf-4c75-9584-fe9d8037e6cd	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	8076c86d-9867-45a6-ab12-7d6461a55b55	feb5bf02-6629-4bc4-80e5-c5b23c2bd3b6	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-04-28 08:17:20.565727+00	\N
3996a529-ece2-4ace-9fc1-c4c22cf30d25	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	5a6f36f5-e06f-4559-804c-1ef10ea8535a	9db0173b-c630-4f16-a253-a07f55370581	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-01 10:37:34.73168+00	\N
294f8181-90c4-4414-93b2-0e6bb640f21c	3fa85f64-5717-4562-b3fc-2c963f66afa6	3fa85f64-5717-4562-b3fc-2c963f66afa6	474ae4e2-420f-403b-a5ba-f0ad77a9e80a	\N	New Lab Test Assignment	You have been assigned a new hba1c test for Patient	lab_request_assigned	f	2025-05-02 08:14:31.943834+00	\N
29b1aa9a-4974-4946-b8e2-9a0d71fce38b	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	6f3a9990-c401-4067-abbf-00265ac7fd0e	ec67ed20-d831-4f8a-8f22-5867021c8b11	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-02 08:19:20.559157+00	\N
fd8f4701-9ab7-4e4f-989c-939067c1f2ff	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	474ae4e2-420f-403b-a5ba-f0ad77a9e80a	dbca8a05-6bf9-4d4e-8042-ce458c5d9179	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-02 16:18:09.742142+00	\N
32429ca2-9434-41b8-8422-52982f89e7ef	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	a2b51fa7-fa02-4f47-b7b0-b10d0b3e94ba	bd50e9ba-45b6-4820-aa50-614618ab0686	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-02 18:58:51.227409+00	\N
c4c78455-f8bb-4b03-a266-35f777fdd494	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	b4b01294-b650-4ad0-9dce-d6554927472b	c3a1f348-be02-4a5e-9efb-077f3061054f	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-02 19:23:35.045985+00	\N
c0352123-ed1b-4f2d-a001-e50563db8a2b	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	5a444286-d295-4df6-86fb-9d2aefb48816	1bbf52e6-a0aa-4602-86bc-41bf2aa1ba39	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-02 19:34:18.363661+00	\N
40fc807c-fdd1-452d-813a-a2eb0a1cf9df	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	eea4aee9-80b4-4dfc-ab19-b2427baef690	d9f049e9-06f1-48ee-b8a0-96f4540bf955	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-02 19:38:52.527153+00	\N
cb5bdc1b-a12d-4e24-ad6a-c1f40a921b3a	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	2cd8e0db-ba02-4829-a5f4-0851fa5abe87	ca58ff4c-995a-48c5-9e46-bbb7f8fc1cd4	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-02 21:36:34.514732+00	\N
2021a50e-fcf2-4ab7-857e-54c5712573cc	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	22288dab-eb5e-4bde-b521-ca083e43f151	82065947-c357-41b5-aeea-0886f9f0990b	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-02 21:52:49.010423+00	\N
e7e20491-fa11-45aa-a35f-761b628a803e	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	c1825154-ca03-42e3-8511-3abdbea93f7b	e30f23e4-39e4-4355-b476-4b024a8114aa	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-02 22:16:40.171956+00	\N
0aeed18f-a5e5-4cbb-aeda-090a3377e73e	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	d409f3a9-b302-495b-a30b-e8792c6e1e15	1793768d-aec4-43b4-a01b-63c170cb85df	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 07:48:15.382691+00	\N
0851d985-5ebb-4b40-a3e8-ae512b8e4e62	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	c05b5fcb-6100-4da5-9bd7-8e9b694804ac	ad8b93e3-aa59-47a4-bb98-c12e4bf90d0c	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 07:50:03.026589+00	\N
c2c3fa1b-3e67-449b-ae63-180acb1b0b5f	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	c4bdf16a-b8a0-4ba9-ad51-b6bf7da5dbe5	60b4383a-c5f5-4766-9359-85b77b8d4771	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 08:08:21.103371+00	\N
df8dbe90-6bb3-4d17-bdf9-311ef4f4ecb8	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	78cd9800-0d7c-40be-a5c5-dae4c57436f4	d7c0bc7e-4e13-48ec-b638-ff347f57920b	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 08:13:32.136387+00	\N
7419f44d-2f86-45ee-8744-5ce6ff9edb28	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	fdd71039-eb10-4a01-a64b-eb43e73b2f11	7228e076-600e-4fad-9194-07b78c47eb06	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 08:19:41.260152+00	\N
0d2771ab-e564-4c36-a59c-87fba211ed0c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	559963b7-848c-41df-8812-aa5df5b6bf5a	7a86f199-fca2-40e7-89be-bf0f75ac2cf9	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 09:13:56.416576+00	\N
6d41aab5-3fc2-4057-87b9-245782052c92	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	ecd9d9bd-513e-4aad-98ce-a99e859bb7eb	fc16d07e-1b72-4646-aac8-722c2650773c	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 09:21:29.087252+00	\N
9066680e-8fb1-4f7c-b070-37940b1b8ecd	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	5a2455f9-ed04-4d3b-8461-9af24dd4afed	59ebaf54-01ed-42af-a4d0-70f6d59f90f8	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 09:39:55.927419+00	\N
99e1cf3f-c6bf-4629-b60b-f036dc4b6477	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	47c4a564-2576-472e-a594-80f721d528c4	cc3abe3b-5b7f-459f-86d4-b8c914d9eb9a	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 09:52:35.939999+00	\N
9a7ea965-2bc5-4e95-a980-34b5a04bc468	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	f0511d82-c455-4dcd-8566-ab3324d90b62	5f3bf49d-96b2-4b1f-ab69-c98fd90d15eb	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 09:59:31.944069+00	\N
3de0ee13-d1e0-4363-9f37-e52dab29815c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	086c6d5f-6320-4c4b-8373-4ca822ffdcc6	0028f08f-9da3-456f-9d44-61ad2893807d	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 12:30:47.487069+00	\N
bb1ad884-6e46-4621-bd48-20412b3b5122	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	c765ad74-00f3-4643-b8f9-56e7a0c6672f	e3a7b6d8-0ace-4e24-bb48-2efe049e5d38	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 13:03:14.713322+00	\N
74acd1d1-c7aa-45e9-aea0-77f68147ef8e	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	be3da0f7-65a7-416e-8d01-bf797dadc8f7	57c442a0-d573-4d04-aef8-e96554a5bf18	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 13:27:33.981283+00	\N
5c9b83b7-c56c-429d-90ed-25295f0712fa	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	ecc0c0a2-913d-4d78-b23f-1b133926299e	ae73cd8f-33f0-423b-93f9-377d5e8967a7	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 14:54:30.303783+00	\N
d56ebc14-9723-4a74-b20a-1a5ae6c62f2e	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	861f53fc-a942-4405-a05c-49da7305c95e	30b0d3e4-2674-465f-9e55-1be01b4b220d	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-03 15:33:40.142028+00	\N
286f3ab6-c88d-4264-9589-6a09e5d22dfc	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	5fc07be1-e69e-447a-ac62-25ff0c52b9fb	268280d9-f85a-46ca-999c-5ab4893ce0d8	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-08 11:47:33.551966+00	\N
ec0d873d-398a-430e-9278-f9b370f34cb2	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	118bff6f-e5d1-4d7a-8e94-03e47d13db96	451d99f7-c6ee-4707-adcf-6896a11071e6	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-08 11:50:26.701898+00	\N
0fc4621e-a44c-4cf9-b8cd-d6fcfb9678c1	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	ab2edc8d-ed3c-401a-99a6-f7127436facd	ddfa651b-1e8f-45b9-8dcc-de133dfb595f	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-08 12:55:24.095164+00	\N
5a57f811-2367-4737-b815-fb3d8887e64f	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	870b9a7a-cb30-4eb7-87f1-6fa78c6e9b59	237e5db3-c7e9-477e-bb0f-c4fca80ad121	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-08 13:10:25.526239+00	\N
10320291-13ec-46f1-87b7-d402338dd377	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	57c65bc3-17a8-43e9-ba72-19bbb765c517	aefdcfe2-3a08-4b34-ac9b-030d36cdfd63	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-08 15:20:24.781284+00	\N
8d5f6144-3ce0-4e50-a25e-cac52c64524f	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	489ed4e0-81b1-4854-a486-93c81874f8f4	a6839c4a-5836-43c5-8805-4fbb7754a655	Lab Result Ready	Lab test results for Patient are now available	lab_result_ready	f	2025-05-21 06:42:00.658436+00	\N
\.


--
-- Data for Name: lab_reports; Type: TABLE DATA; Schema: public; Owner: labroom_user
--

COPY public.lab_reports (id, report_type, report_format, date_range_start, date_range_end, created_at, file_path, is_deleted) FROM stdin;
3ead5185-5a12-441a-b190-74a13c8dcc14	daily	csv	2025-04-19	2025-04-19	2025-04-19 14:21:38.250324+00	generating_3ead5185-5a12-441a-b190-74a13c8dcc14	f
05a75207-8cc2-41e3-bf82-d586128a8256	daily	csv	2025-04-19	2025-04-19	2025-04-19 14:36:30.013818+00	generating_05a75207-8cc2-41e3-bf82-d586128a8256	f
82344a3f-dc81-461e-becb-10b43ef3d021	daily	csv	2025-04-19	2025-04-19	2025-04-19 14:48:35.363071+00	/app/uploads/report_82344a3f-dc81-461e-becb-10b43ef3d021_20250419_144835.csv	f
a065e256-7fad-4212-81fb-ea3819843edf	daily	pdf	2025-04-19	2025-04-19	2025-04-19 15:23:55.050715+00	generating_a065e256-7fad-4212-81fb-ea3819843edf	f
36ad1024-2ee4-434d-932d-9826ee83521a	daily	pdf	2025-04-19	2025-04-19	2025-04-19 15:33:04.283355+00	generating_36ad1024-2ee4-434d-932d-9826ee83521a	f
cdac8762-4e1a-4dfa-988f-98d646df958b	daily	pdf	2025-04-19	2025-04-19	2025-04-19 15:44:41.378524+00	generating_cdac8762-4e1a-4dfa-988f-98d646df958b	f
f1f0e1f7-92ce-455f-a1e4-4b995d7ccdad	daily	pdf	2025-04-19	2025-04-19	2025-04-19 15:48:52.644958+00	generating_f1f0e1f7-92ce-455f-a1e4-4b995d7ccdad	f
d1f93d4d-84cc-4a7a-a4f1-df0430e5b8eb	daily	pdf	2025-04-19	2025-04-19	2025-04-19 15:55:49.989244+00	generating_d1f93d4d-84cc-4a7a-a4f1-df0430e5b8eb	f
1740297a-ddaf-408c-bc19-5ebe8907ea52	daily	pdf	2025-04-19	2025-04-19	2025-04-19 16:02:03.522901+00	generating_1740297a-ddaf-408c-bc19-5ebe8907ea52	f
c8c13fc9-3f15-4c9d-b356-f1c3c6475158	daily	pdf	2025-04-19	2025-04-19	2025-04-19 16:09:35.28234+00	generating_c8c13fc9-3f15-4c9d-b356-f1c3c6475158	f
830a81b7-5490-4d4a-a5b4-605d13d3000c	daily	pdf	2025-04-19	2025-04-19	2025-04-19 16:21:37.073655+00	/app/uploads/report_830a81b7-5490-4d4a-a5b4-605d13d3000c_20250419_162137.pdf	f
8136629b-ef64-4448-a2da-2152fbbc9f23	daily	pdf	2025-04-19	2025-04-19	2025-04-19 16:29:15.361764+00	/app/uploads/report_8136629b-ef64-4448-a2da-2152fbbc9f23_20250419_162915.pdf	f
4d366117-c776-4e36-a51b-d45a4d321913	daily	pdf	2025-04-19	2025-04-19	2025-04-19 16:36:12.665252+00	/app/uploads/report_4d366117-c776-4e36-a51b-d45a4d321913_20250419_163612.pdf	f
bca8b6e1-b2b8-4994-9dc3-1eff142da4f7	daily	pdf	2025-04-26	2025-04-26	2025-04-26 11:19:32.802833+00	/app/uploads/report_bca8b6e1-b2b8-4994-9dc3-1eff142da4f7_20250426_111932.pdf	f
fe500c52-19fa-4e30-af8b-18f6d2f706cc	daily	pdf	2025-04-27	2025-04-27	2025-04-27 19:15:40.939095+00	/app/uploads/report_fe500c52-19fa-4e30-af8b-18f6d2f706cc_20250427_191540.pdf	f
523b7350-5385-4fa8-97a6-bc4544e00dc8	monthly	pdf	2025-03-28	2025-04-27	2025-04-27 19:17:03.904141+00	/app/uploads/report_523b7350-5385-4fa8-97a6-bc4544e00dc8_20250427_191703.pdf	f
f4d4a37a-dd51-4efb-8f6e-a6c7b17b9fd2	monthly	pdf	2025-03-29	2025-04-28	2025-04-28 06:38:42.354452+00	/app/uploads/report_f4d4a37a-dd51-4efb-8f6e-a6c7b17b9fd2_20250428_063842.pdf	f
165a6ffe-cbe1-4415-a382-433592fdb342	monthly	pdf	2025-03-29	2025-04-28	2025-04-28 06:41:16.468519+00	/app/uploads/report_165a6ffe-cbe1-4415-a382-433592fdb342_20250428_064116.pdf	f
7cecce66-ade1-4d9f-a954-62d9fbfc7358	monthly	pdf	2025-04-02	2025-05-02	2025-05-02 08:21:03.269284+00	/app/uploads/report_7cecce66-ade1-4d9f-a954-62d9fbfc7358_20250502_082103.pdf	f
40e8bcf1-4c96-4036-bcc8-cc373b0b3a5a	monthly	pdf	2025-04-05	2025-05-05	2025-05-05 16:12:50.130428+00	/app/uploads/report_40e8bcf1-4c96-4036-bcc8-cc373b0b3a5a_20250505_161250.pdf	f
082cf84c-abe3-4051-9b3d-9f174a3e9742	monthly	pdf	2025-04-08	2025-05-08	2025-05-08 19:42:50.71746+00	/app/uploads/report_082cf84c-abe3-4051-9b3d-9f174a3e9742_20250508_194250.pdf	f
b79e0879-fd62-413f-a417-a47c827760e4	daily	pdf	2025-05-19	2025-05-19	2025-05-19 20:07:35.772151+00	/app/uploads/report_b79e0879-fd62-413f-a417-a47c827760e4_20250519_200735.pdf	f
530b6e6c-2628-47b3-92a0-7f95c68ac059	daily	pdf	2025-05-20	2025-05-20	2025-05-20 08:58:33.618702+00	/app/uploads/report_530b6e6c-2628-47b3-92a0-7f95c68ac059_20250520_085833.pdf	f
66c68664-20f1-41d3-ad86-15fe609968b7	daily	pdf	2025-05-20	2025-05-20	2025-05-20 09:02:56.668532+00	/app/uploads/report_66c68664-20f1-41d3-ad86-15fe609968b7_20250520_090256.pdf	f
831f0b61-6849-4be5-a21e-ccbba2fcf4b3	daily	pdf	2025-05-20	2025-05-20	2025-05-20 09:51:36.737174+00	/app/uploads/report_831f0b61-6849-4be5-a21e-ccbba2fcf4b3_20250520_095136.pdf	f
d9499eba-2dcb-490e-a9ff-6cbde4a83ed0	daily	pdf	2025-05-20	2025-05-20	2025-05-20 09:52:07.85253+00	/app/uploads/report_d9499eba-2dcb-490e-a9ff-6cbde4a83ed0_20250520_095207.pdf	f
c1ce8857-f094-42bf-8a1a-70d102fa4ac5	daily	pdf	2025-05-20	2025-05-20	2025-05-20 09:59:50.903476+00	/app/uploads/report_c1ce8857-f094-42bf-8a1a-70d102fa4ac5_20250520_095950.pdf	f
7b78ac33-7452-4e69-a422-aa22a994da1c	daily	pdf	2025-05-20	2025-05-20	2025-05-20 10:06:14.601925+00	/app/uploads/report_7b78ac33-7452-4e69-a422-aa22a994da1c_20250520_100614.pdf	f
19914cfc-7671-40b5-9648-472517a20828	monthly	pdf	2025-04-20	2025-05-20	2025-05-20 10:15:36.526421+00	/app/uploads/report_19914cfc-7671-40b5-9648-472517a20828_20250520_101536.pdf	f
617f50a4-e760-4418-b3ce-c7b24a04b928	daily	pdf	2025-05-20	2025-05-20	2025-05-20 10:24:42.950361+00	/app/uploads/report_617f50a4-e760-4418-b3ce-c7b24a04b928_20250520_102442.pdf	f
43691c31-cbd0-4d44-b757-a46ebd97b8e5	monthly	pdf	2025-04-20	2025-05-20	2025-05-20 10:38:40.79395+00	generating_43691c31-cbd0-4d44-b757-a46ebd97b8e5	f
b2fc8256-e613-4b4d-a0dd-f0f2a01d65d3	monthly	pdf	2025-04-20	2025-05-20	2025-05-20 12:43:14.795813+00	/app/uploads/report_b2fc8256-e613-4b4d-a0dd-f0f2a01d65d3_20250520_124314.pdf	f
a80c664a-b394-41a8-b986-6a6e85b17550	monthly	pdf	2025-04-20	2025-05-20	2025-05-20 13:07:42.726565+00	/app/uploads/report_a80c664a-b394-41a8-b986-6a6e85b17550_20250520_130743.pdf	f
99bc6d96-901e-4a92-95f0-f520369119b9	daily	pdf	2025-05-20	2025-05-20	2025-05-20 13:09:58.337121+00	/app/uploads/report_99bc6d96-901e-4a92-95f0-f520369119b9_20250520_130958.pdf	f
e2abcd0f-ec29-410a-af75-2afde68db0af	daily	pdf	2025-05-20	2025-05-20	2025-05-20 13:21:52.502894+00	/app/uploads/report_e2abcd0f-ec29-410a-af75-2afde68db0af_20250520_132152.pdf	f
78c30638-167e-4d1c-ac35-8c8ef580e278	daily	pdf	2025-05-20	2025-05-20	2025-05-20 13:42:04.318603+00	/app/uploads/report_78c30638-167e-4d1c-ac35-8c8ef580e278_20250520_134204.pdf	f
9bf3d38b-ea0c-4649-8ddf-19079e07d995	daily	pdf	2025-05-21	2025-05-21	2025-05-21 06:53:53.358588+00	/app/uploads/report_9bf3d38b-ea0c-4649-8ddf-19079e07d995_20250521_065354.pdf	f
74f7cd29-4bd7-45e7-b116-28f2e8635373	daily	pdf	2025-05-21	2025-05-21	2025-05-21 07:17:10.014057+00	/app/uploads/report_74f7cd29-4bd7-45e7-b116-28f2e8635373_20250521_071710.pdf	f
3e767c1d-972c-47ab-b252-afe30590f803	daily	pdf	2025-05-21	2025-05-21	2025-05-21 07:36:52.546255+00	/app/uploads/report_3e767c1d-972c-47ab-b252-afe30590f803_20250521_073652.pdf	f
7cb8c89d-7d74-453f-95e5-c7bd850e01d9	daily	pdf	2025-05-21	2025-05-21	2025-05-21 07:38:08.438142+00	/app/uploads/report_7cb8c89d-7d74-453f-95e5-c7bd850e01d9_20250521_073808.pdf	f
6faa8039-8cc6-47fc-8f65-3bf7b980e3db	monthly	pdf	2025-04-21	2025-05-21	2025-05-21 07:38:31.378062+00	/app/uploads/report_6faa8039-8cc6-47fc-8f65-3bf7b980e3db_20250521_073831.pdf	f
606230e2-a498-44c1-9cb5-0fff9478f3ed	weekly	pdf	2025-05-14	2025-05-21	2025-05-21 07:44:03.285028+00	/app/uploads/report_606230e2-a498-44c1-9cb5-0fff9478f3ed_20250521_074403.pdf	f
94d4c230-2601-4932-8090-da98402494c7	daily	pdf	2025-05-21	2025-05-21	2025-05-21 07:44:49.335232+00	/app/uploads/report_94d4c230-2601-4932-8090-da98402494c7_20250521_074449.pdf	f
0c96d0bf-ca85-4d44-b6c9-8b36b0288f14	monthly	pdf	2025-04-21	2025-05-21	2025-05-21 07:45:03.147022+00	/app/uploads/report_0c96d0bf-ca85-4d44-b6c9-8b36b0288f14_20250521_074503.pdf	f
b373014d-fca4-4359-b11a-021b4546588b	weekly	pdf	2025-05-14	2025-05-21	2025-05-21 07:45:50.765212+00	/app/uploads/report_b373014d-fca4-4359-b11a-021b4546588b_20250521_074550.pdf	f
ab9e0d9b-a4df-4d75-8cc4-0047fc0d4de3	weekly	txt	2025-05-14	2025-05-21	2025-05-21 07:46:10.742381+00	/app/uploads/report_ab9e0d9b-a4df-4d75-8cc4-0047fc0d4de3_20250521_074610.txt	f
67eaf130-eb7d-41a6-b843-56c3bacb7b58	monthly	pdf	2025-04-21	2025-05-21	2025-05-21 07:47:59.501944+00	/app/uploads/report_67eaf130-eb7d-41a6-b843-56c3bacb7b58_20250521_074759.pdf	f
a7e61a89-8dee-4ad9-bb23-ed9ae294cf23	monthly	txt	2025-04-21	2025-05-21	2025-05-21 07:48:49.601626+00	/app/uploads/report_a7e61a89-8dee-4ad9-bb23-ed9ae294cf23_20250521_074849.txt	f
880a40c7-6d6d-430f-b131-8b07cda556cb	daily	pdf	2025-05-21	2025-05-21	2025-05-21 08:08:15.021127+00	/app/uploads/report_880a40c7-6d6d-430f-b131-8b07cda556cb_20250521_080815.pdf	f
36c8689e-6d28-4442-8400-cbd13e88d2f6	monthly	pdf	2025-04-21	2025-05-21	2025-05-21 08:08:30.588474+00	/app/uploads/report_36c8689e-6d28-4442-8400-cbd13e88d2f6_20250521_080830.pdf	f
ab6fc653-c173-422a-8084-f3c59f862881	daily	pdf	2025-05-21	2025-05-21	2025-05-21 09:02:45.731583+00	/app/uploads/report_ab6fc653-c173-422a-8084-f3c59f862881_20250521_090245.pdf	f
\.


--
-- Data for Name: lab_request_events; Type: TABLE DATA; Schema: public; Owner: labroom_user
--

COPY public.lab_request_events (id, lab_request_id, event_type, event_timestamp, user_id, details) FROM stdin;
b5162d53-82b0-4713-8d28-c5e3357f6793	9de73000-ae23-4237-958f-719e86df5bf8	technician_assigned	2025-04-20 13:12:08.623082+00	d6be7a66-a5d5-461e-9df2-8bf225536c39	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
670bd2e2-c528-4c1c-9cdc-7b56c2935bec	745a4553-eae0-42d4-a6a8-d8d3af7a1fa8	technician_assigned	2025-04-20 13:20:57.441484+00	d6be7a66-a5d5-461e-9df2-8bf225536c39	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
965795a3-9d07-4806-93ea-6d3650881fc2	b14a652d-fb65-4353-99d5-991372cd9539	technician_assigned	2025-04-20 13:31:30.942727+00	a08055dc-644c-4ae3-ad9f-4d1d74115e2c	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
f4354f95-1524-47d2-961e-e9a2477a64c4	aa0d37a7-fd66-4e8b-b850-f57e790b3f17	technician_assigned	2025-04-20 13:41:42.643259+00	a08055dc-644c-4ae3-ad9f-4d1d74115e2c	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
10efa0cd-2366-441e-8a02-64f751b8d61b	aa0d37a7-fd66-4e8b-b850-f57e790b3f17	result_created	2025-04-20 13:56:43.667027+00	a08055dc-644c-4ae3-ad9f-4d1d74115e2c	{"conclusion": "new", "lab_result_id": "bba10b00-786d-4851-a475-07749678f630", "metrics_count": 1}
3f05325f-b2f2-4cd2-9ecd-a520ecc156df	b14a652d-fb65-4353-99d5-991372cd9539	result_created	2025-04-20 14:03:54.881598+00	a08055dc-644c-4ae3-ad9f-4d1d74115e2c	{"conclusion": "new", "lab_result_id": "b02705cc-5b47-4c01-99ad-795ceb1097d8", "metrics_count": 1}
11b68822-2729-4085-bcc2-86c368c4b64b	b14a652d-fb65-4353-99d5-991372cd9539	result_updated	2025-04-20 15:19:20.360447+00	a08055dc-644c-4ae3-ad9f-4d1d74115e2c	{"lab_result_id": "b02705cc-5b47-4c01-99ad-795ceb1097d8", "updated_fields": ["result_data", "conclusion"], "conclusion_updated": true, "result_data_updated": true}
d7af9d0c-a635-4294-a822-c331384f5004	b14a652d-fb65-4353-99d5-991372cd9539	result_updated	2025-04-20 15:24:51.740359+00	a08055dc-644c-4ae3-ad9f-4d1d74115e2c	{"lab_result_id": "b02705cc-5b47-4c01-99ad-795ceb1097d8", "updated_fields": ["result_data", "conclusion", "updated_at"], "conclusion_updated": true, "result_data_updated": true}
963e80f9-f262-4f97-8c39-95c1880c60a2	b14a652d-fb65-4353-99d5-991372cd9539	image_uploaded	2025-04-20 15:30:28.902387+00	a08055dc-644c-4ae3-ad9f-4d1d74115e2c	{"path": "/uploads/b02705cc-5b47-4c01-99ad-795ceb1097d8/20250420153028_d5288688cd644561b4efe75163526211_Activity Diagram for Analyzer AI Tools3drawio.png", "filename": "20250420153028_d5288688cd644561b4efe75163526211_Activity Diagram for Analyzer AI Tools3drawio.png", "file_size": 46840, "file_type": "image/png", "lab_result_id": "b02705cc-5b47-4c01-99ad-795ceb1097d8"}
16793038-88de-4d27-9303-a8ea7bc79952	a43688a2-fc64-4aa7-871b-03374c99ee9e	result_created	2025-04-24 05:35:00.520647+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "jemari", "lab_result_id": "f1851cc0-2f9a-4270-9c77-3a09a202b8c3", "metrics_count": 1}
958bead1-f905-4e7b-84f2-4134f0feb249	df6fdb9b-9239-442c-8ff8-b11952173253	technician_assigned	2025-04-24 06:29:56.225367+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
31c1a709-8728-4c64-9b72-a8089492c4a0	df6fdb9b-9239-442c-8ff8-b11952173253	result_created	2025-04-24 06:29:56.422904+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "jemari", "lab_result_id": "1c660555-af4e-4db4-9347-41bafd2b9019", "metrics_count": 1}
75e3fc94-9efe-4550-9843-ec932298d78a	4c9366ec-02fd-41fe-9dd1-7fe7cc67b401	technician_assigned	2025-04-24 06:43:25.343213+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
e78a05bc-3432-4d1c-a358-004174fec39c	4c9366ec-02fd-41fe-9dd1-7fe7cc67b401	result_created	2025-04-24 06:43:25.998954+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "jemari", "lab_result_id": "ae61bfdf-f05e-4735-ad39-2df42013faed", "metrics_count": 1}
e8ec41cf-d72b-475a-ba3d-2d903503ea84	7609d3bc-2e15-4a4e-b6b7-c440574091c9	technician_assigned	2025-04-26 10:27:09.069972+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
f3127ebd-8127-4ff6-ac9e-7fe34df9689c	7609d3bc-2e15-4a4e-b6b7-c440574091c9	result_created	2025-04-26 10:27:09.395748+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "fcgvbhnm", "lab_result_id": "10583038-fe9f-4ef0-91d5-a30bc6d01439", "metrics_count": 1}
0e6b2366-544d-4332-a228-83ecb87237e5	98d1fb80-2da7-4212-902f-e96e45bbe51a	technician_assigned	2025-04-27 05:59:25.828375+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
8e765fd2-a21b-4290-8c33-35340dd78714	98d1fb80-2da7-4212-902f-e96e45bbe51a	result_created	2025-04-27 05:59:26.02917+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "yes", "lab_result_id": "c7ccfe95-0462-4556-93a0-ace04ef1d57a", "metrics_count": 1}
85642891-e8fc-4e36-aca7-6f4e2c874167	98d1fb80-2da7-4212-902f-e96e45bbe51a	image_uploaded	2025-04-27 11:01:51.407624+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"path": "/uploads/c7ccfe95-0462-4556-93a0-ace04ef1d57a/20250427110151_37b924bd3e244820a2522c921dbb599d_OIP.jpeg", "filename": "20250427110151_37b924bd3e244820a2522c921dbb599d_OIP.jpeg", "file_size": 6047, "file_type": "image/jpeg", "lab_result_id": "c7ccfe95-0462-4556-93a0-ace04ef1d57a"}
52d6c845-d82b-42ff-80ea-cd7d0a580eec	98d1fb80-2da7-4212-902f-e96e45bbe51a	result_updated	2025-04-27 11:02:27.041089+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"lab_result_id": "c7ccfe95-0462-4556-93a0-ace04ef1d57a", "updated_fields": ["result_data", "conclusion", "updated_at"], "conclusion_updated": true, "result_data_updated": true}
e85e4f80-144f-492d-bd1b-da197596e9b8	51183afb-c8d4-41df-9ead-61a96bdad68c	result_created	2025-04-27 13:48:41.881372+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "fghj", "lab_result_id": "ad4886fe-0399-419b-a451-09ba428e41a8", "metrics_count": 1}
cbca7571-7b6a-4dfb-85c5-811c6fb952d1	51183afb-c8d4-41df-9ead-61a96bdad68c	result_updated	2025-04-27 14:12:05.981761+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"lab_result_id": "ad4886fe-0399-419b-a451-09ba428e41a8", "updated_fields": ["result_data", "conclusion", "updated_at"], "conclusion_updated": true, "result_data_updated": true}
d13e4d2f-aa25-4359-95ce-f0595a0f9c85	51183afb-c8d4-41df-9ead-61a96bdad68c	image_uploaded	2025-04-27 14:13:34.19874+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"path": "/uploads/ad4886fe-0399-419b-a451-09ba428e41a8/20250427141334_fe19e0748eb64795bd3c2e6644027983_aqua 1.png", "filename": "20250427141334_fe19e0748eb64795bd3c2e6644027983_aqua 1.png", "file_size": 27383, "file_type": "image/png", "lab_result_id": "ad4886fe-0399-419b-a451-09ba428e41a8"}
11f5a432-9f3e-411d-9e26-0e7441713207	98d1fb80-2da7-4212-902f-e96e45bbe51a	image_uploaded	2025-04-27 14:15:26.803211+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"path": "/uploads/c7ccfe95-0462-4556-93a0-ace04ef1d57a/20250427141526_cd2b592a516b41ae85b7c24884d0d9d3_aqua 1.png", "filename": "20250427141526_cd2b592a516b41ae85b7c24884d0d9d3_aqua 1.png", "file_size": 27383, "file_type": "image/png", "lab_result_id": "c7ccfe95-0462-4556-93a0-ace04ef1d57a"}
2cbd3108-9061-4aa8-9510-eae82e5d7ce1	98d1fb80-2da7-4212-902f-e96e45bbe51a	result_updated	2025-04-27 14:15:57.890468+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"lab_result_id": "c7ccfe95-0462-4556-93a0-ace04ef1d57a", "updated_fields": ["result_data", "conclusion", "updated_at"], "conclusion_updated": true, "result_data_updated": true}
aca02ea0-03b8-4651-be2b-33496d065ab1	4c9366ec-02fd-41fe-9dd1-7fe7cc67b401	image_uploaded	2025-04-27 14:24:12.067403+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"path": "/uploads/ae61bfdf-f05e-4735-ad39-2df42013faed/20250427142412_e7659586f2184184bbd03430a204eb57_aqua 1.png", "filename": "20250427142412_e7659586f2184184bbd03430a204eb57_aqua 1.png", "file_size": 27383, "file_type": "image/png", "lab_result_id": "ae61bfdf-f05e-4735-ad39-2df42013faed"}
7f46cb42-dffc-49e1-861e-4c63947afa89	227f773e-4c32-4297-9ea7-cd46d56db515	technician_assigned	2025-04-27 14:44:39.978731+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
3ff1dbd8-bf37-4692-a71a-b4cd800eef83	227f773e-4c32-4297-9ea7-cd46d56db515	result_created	2025-04-27 14:44:40.278505+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "ghjk", "lab_result_id": "e13f0a23-175e-41d0-a213-07351d8c8386", "metrics_count": 1}
81415369-6e8b-4d7f-85d7-f97d6a9d8731	227f773e-4c32-4297-9ea7-cd46d56db515	image_uploaded	2025-04-27 14:45:28.703277+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"path": "/uploads/e13f0a23-175e-41d0-a213-07351d8c8386/20250427144528_2a8f2b396f9f4be3b829871a2d88eb5b_coursera.jpg", "filename": "20250427144528_2a8f2b396f9f4be3b829871a2d88eb5b_coursera.jpg", "file_size": 112992, "file_type": "image/jpeg", "lab_result_id": "e13f0a23-175e-41d0-a213-07351d8c8386"}
5e860701-5156-4ae7-9c75-60452b9f510d	8076c86d-9867-45a6-ab12-7d6461a55b55	result_created	2025-04-28 08:17:20.384978+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "yes", "lab_result_id": "feb5bf02-6629-4bc4-80e5-c5b23c2bd3b6", "metrics_count": 1}
4602a368-db27-4e69-90da-486891fcc45d	8076c86d-9867-45a6-ab12-7d6461a55b55	result_updated	2025-04-29 12:40:32.538679+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"lab_result_id": "feb5bf02-6629-4bc4-80e5-c5b23c2bd3b6", "updated_fields": ["result_data", "conclusion", "updated_at"], "conclusion_updated": true, "result_data_updated": true}
ffe9dd1e-2c18-4709-a74d-08728e6e9b2e	8076c86d-9867-45a6-ab12-7d6461a55b55	image_uploaded	2025-04-29 12:41:28.938135+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"path": "/uploads/feb5bf02-6629-4bc4-80e5-c5b23c2bd3b6/20250429124128_58d3278b384b4600b78213c777f3aa66_aqua 1.png", "filename": "20250429124128_58d3278b384b4600b78213c777f3aa66_aqua 1.png", "file_size": 27383, "file_type": "image/png", "lab_result_id": "feb5bf02-6629-4bc4-80e5-c5b23c2bd3b6"}
8b4f528b-6b91-4557-9cb4-b8190d9a7b87	5a6f36f5-e06f-4559-804c-1ef10ea8535a	technician_assigned	2025-05-01 10:37:34.359479+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
cc9de35e-1785-411f-84b7-3ea2b55b655c	5a6f36f5-e06f-4559-804c-1ef10ea8535a	result_created	2025-05-01 10:37:34.605557+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "dieases detected", "lab_result_id": "9db0173b-c630-4f16-a253-a07f55370581", "metrics_count": 1}
e1286083-b18a-4d4c-947c-72438b3d0a03	6f3a9990-c401-4067-abbf-00265ac7fd0e	technician_assigned	2025-05-02 08:19:19.271959+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
8ed3aa7e-d38e-4f2e-8495-1d993da8d26f	6f3a9990-c401-4067-abbf-00265ac7fd0e	result_created	2025-05-02 08:19:20.205494+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "yes", "lab_result_id": "ec67ed20-d831-4f8a-8f22-5867021c8b11", "metrics_count": 1}
4574c5ff-ea15-41ee-b5a4-16570a16f833	474ae4e2-420f-403b-a5ba-f0ad77a9e80a	result_created	2025-05-02 16:18:09.396195+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "positive", "lab_result_id": "dbca8a05-6bf9-4d4e-8042-ce458c5d9179", "metrics_count": 1}
dd20cae4-74de-4365-a8ed-dc2c07b60efb	a2b51fa7-fa02-4f47-b7b0-b10d0b3e94ba	technician_assigned	2025-05-02 18:58:50.519423+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
488c2d77-3e8f-46ef-9e97-e006c0dfb3b5	a2b51fa7-fa02-4f47-b7b0-b10d0b3e94ba	result_created	2025-05-02 18:58:50.939878+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "positive", "lab_result_id": "bd50e9ba-45b6-4820-aa50-614618ab0686", "metrics_count": 1}
039591b1-00b3-4408-aede-845e3e7f3fb9	b4b01294-b650-4ad0-9dce-d6554927472b	technician_assigned	2025-05-02 19:23:34.472428+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
53904782-b35d-4f06-817f-77a45b2d067c	b4b01294-b650-4ad0-9dce-d6554927472b	result_created	2025-05-02 19:23:34.845477+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "needs treatment", "lab_result_id": "c3a1f348-be02-4a5e-9efb-077f3061054f", "metrics_count": 1}
d68bfa26-e119-4163-be81-a1ca0d60399f	5a444286-d295-4df6-86fb-9d2aefb48816	result_created	2025-05-02 19:34:18.315278+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "help it up", "lab_result_id": "1bbf52e6-a0aa-4602-86bc-41bf2aa1ba39", "metrics_count": 1}
7c992d6e-472f-4997-8f10-42a5bedb66e5	eea4aee9-80b4-4dfc-ab19-b2427baef690	technician_assigned	2025-05-02 19:38:52.199705+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
4c278bb7-faef-45f9-acb5-164668cae4fa	eea4aee9-80b4-4dfc-ab19-b2427baef690	result_created	2025-05-02 19:38:52.432265+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "success is comming", "lab_result_id": "d9f049e9-06f1-48ee-b8a0-96f4540bf955", "metrics_count": 1}
76b962de-8578-4939-b5e1-9906e0f9120f	2cd8e0db-ba02-4829-a5f4-0851fa5abe87	technician_assigned	2025-05-02 21:36:33.817818+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
051318e0-0def-4715-9a67-219e054cdeea	2cd8e0db-ba02-4829-a5f4-0851fa5abe87	result_created	2025-05-02 21:36:34.306081+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "", "lab_result_id": "ca58ff4c-995a-48c5-9e46-bbb7f8fc1cd4", "metrics_count": 1}
22ce7afe-19bf-4f8d-aec4-df41f1d31f07	22288dab-eb5e-4bde-b521-ca083e43f151	technician_assigned	2025-05-02 21:52:48.287122+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
bfb2808a-da3d-402b-a623-527667b90e6f	22288dab-eb5e-4bde-b521-ca083e43f151	result_created	2025-05-02 21:52:48.821346+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "", "lab_result_id": "82065947-c357-41b5-aeea-0886f9f0990b", "metrics_count": 1}
74cca1c4-4947-48bc-b23e-aee4720928a2	c1825154-ca03-42e3-8511-3abdbea93f7b	technician_assigned	2025-05-02 22:16:39.51993+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
a1ba3c87-d28b-4ab0-82e3-cd52a461b0e5	c1825154-ca03-42e3-8511-3abdbea93f7b	result_created	2025-05-02 22:16:40.043221+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "", "lab_result_id": "e30f23e4-39e4-4355-b476-4b024a8114aa", "metrics_count": 1}
7745c46d-aceb-452d-8cf5-20cc82af6739	d409f3a9-b302-495b-a30b-e8792c6e1e15	technician_assigned	2025-05-03 07:48:15.194475+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
1d768822-11de-4746-b67d-827c2b6fb3e6	d409f3a9-b302-495b-a30b-e8792c6e1e15	result_created	2025-05-03 07:48:15.331553+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "delivered", "lab_result_id": "1793768d-aec4-43b4-a01b-63c170cb85df", "metrics_count": 1}
98cab7c6-3311-4daa-b974-cd60d16dd2f7	c05b5fcb-6100-4da5-9bd7-8e9b694804ac	technician_assigned	2025-05-03 07:50:02.824602+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
2ffb8656-568f-418b-9ecf-f8abb58d17a5	c05b5fcb-6100-4da5-9bd7-8e9b694804ac	result_created	2025-05-03 07:50:02.96613+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "test delivery", "lab_result_id": "ad8b93e3-aa59-47a4-bb98-c12e4bf90d0c", "metrics_count": 1}
74673d09-26ab-4c7a-9fa0-fc41d6f1a22b	c4bdf16a-b8a0-4ba9-ad51-b6bf7da5dbe5	technician_assigned	2025-05-03 08:08:20.900895+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
ff4c29e0-2b45-4838-ba24-e894e8770cae	c4bdf16a-b8a0-4ba9-ad51-b6bf7da5dbe5	result_created	2025-05-03 08:08:21.044242+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "done", "lab_result_id": "60b4383a-c5f5-4766-9359-85b77b8d4771", "metrics_count": 1}
aa5fca7d-24f5-4cb9-8658-3e879ac8f3f6	78cd9800-0d7c-40be-a5c5-dae4c57436f4	technician_assigned	2025-05-03 08:13:31.95756+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
2ba9a248-1b8a-4d39-8ff5-559aab0541b7	78cd9800-0d7c-40be-a5c5-dae4c57436f4	result_created	2025-05-03 08:13:32.087446+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "delivered", "lab_result_id": "d7c0bc7e-4e13-48ec-b638-ff347f57920b", "metrics_count": 1}
69ef74e3-1ddf-4f2c-9768-d6b10fc3e889	fdd71039-eb10-4a01-a64b-eb43e73b2f11	technician_assigned	2025-05-03 08:19:41.066689+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
761e782d-841c-47c5-9895-38216a8ffad2	fdd71039-eb10-4a01-a64b-eb43e73b2f11	result_created	2025-05-03 08:19:41.209337+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "got it", "lab_result_id": "7228e076-600e-4fad-9194-07b78c47eb06", "metrics_count": 1}
2db7bf58-6bd3-47b6-b457-7b85a02d34cd	559963b7-848c-41df-8812-aa5df5b6bf5a	technician_assigned	2025-05-03 09:13:55.800642+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
0e28d52a-35a3-4a0e-a0f5-c177e34f661e	559963b7-848c-41df-8812-aa5df5b6bf5a	result_created	2025-05-03 09:13:56.283409+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "finished", "lab_result_id": "7a86f199-fca2-40e7-89be-bf0f75ac2cf9", "metrics_count": 1}
436e32e5-263d-45d9-8e14-4291a9d46839	ecd9d9bd-513e-4aad-98ce-a99e859bb7eb	technician_assigned	2025-05-03 09:21:28.599791+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
9ac19faf-1df8-4acd-8523-5497c976351c	ecd9d9bd-513e-4aad-98ce-a99e859bb7eb	result_created	2025-05-03 09:21:28.942634+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "conclusion of test", "lab_result_id": "fc16d07e-1b72-4646-aac8-722c2650773c", "metrics_count": 1}
8b2de624-1ccf-4e58-aed2-0d2d74d5e606	5a2455f9-ed04-4d3b-8461-9af24dd4afed	technician_assigned	2025-05-03 09:39:55.369358+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
5a653f50-a2e9-42d7-b6dd-8a7e9d986398	5a2455f9-ed04-4d3b-8461-9af24dd4afed	result_created	2025-05-03 09:39:55.813732+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "positive", "lab_result_id": "59ebaf54-01ed-42af-a4d0-70f6d59f90f8", "metrics_count": 1}
d2427955-ed2d-474b-ac4a-e80e970e6a2b	47c4a564-2576-472e-a594-80f721d528c4	technician_assigned	2025-05-03 09:52:35.447848+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
cb291076-a16c-4d56-b431-f34f9eb27d02	47c4a564-2576-472e-a594-80f721d528c4	result_created	2025-05-03 09:52:35.789992+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "diseas identified", "lab_result_id": "cc3abe3b-5b7f-459f-86d4-b8c914d9eb9a", "metrics_count": 1}
f5e74a81-28dd-4b47-b744-4fb8bf98d69e	f0511d82-c455-4dcd-8566-ab3324d90b62	technician_assigned	2025-05-03 09:59:31.213234+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
a66fcaff-2fce-44e0-a1cc-e59db1f2c1a2	f0511d82-c455-4dcd-8566-ab3324d90b62	result_created	2025-05-03 09:59:31.735381+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "worsening", "lab_result_id": "5f3bf49d-96b2-4b1f-ab69-c98fd90d15eb", "metrics_count": 1}
44f0340a-1737-4def-b0fc-9b70bfbb5d80	086c6d5f-6320-4c4b-8373-4ca822ffdcc6	technician_assigned	2025-05-03 12:30:46.661611+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
8b5187c7-6f0f-4701-b8cc-2365e8b7403e	086c6d5f-6320-4c4b-8373-4ca822ffdcc6	result_created	2025-05-03 12:30:47.165051+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "heal him", "lab_result_id": "0028f08f-9da3-456f-9d44-61ad2893807d", "metrics_count": 1}
42c8270e-bef4-407c-b59d-5f3cb293ca66	c765ad74-00f3-4643-b8f9-56e7a0c6672f	technician_assigned	2025-05-03 13:03:14.012145+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
80a98f89-8064-43ee-b4f3-3e3d6e234c78	c765ad74-00f3-4643-b8f9-56e7a0c6672f	result_created	2025-05-03 13:03:14.480002+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "needs attention ", "lab_result_id": "e3a7b6d8-0ace-4e24-bb48-2efe049e5d38", "metrics_count": 1}
065bbb74-1bcd-4d6a-982e-568ce2cafd1b	be3da0f7-65a7-416e-8d01-bf797dadc8f7	technician_assigned	2025-05-03 13:27:33.314692+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
328a096e-d31b-4474-9cf3-96bba51835f7	be3da0f7-65a7-416e-8d01-bf797dadc8f7	result_created	2025-05-03 13:27:33.655837+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "check notification", "lab_result_id": "57c442a0-d573-4d04-aef8-e96554a5bf18", "metrics_count": 1}
bb2b48c2-605a-4c36-84d7-67ef3704944e	ecc0c0a2-913d-4d78-b23f-1b133926299e	technician_assigned	2025-05-03 14:54:29.420757+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
77a405a2-ef90-4dac-946f-f5055630bcf2	ecc0c0a2-913d-4d78-b23f-1b133926299e	result_created	2025-05-03 14:54:30.165686+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "check delivery test", "lab_result_id": "ae73cd8f-33f0-423b-93f9-377d5e8967a7", "metrics_count": 1}
d2276841-f55a-4f16-a628-f3e3f849f4e7	861f53fc-a942-4405-a05c-49da7305c95e	technician_assigned	2025-05-03 15:33:39.878138+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
8a3770d9-5cc5-4ef6-a634-92daa2eeb823	861f53fc-a942-4405-a05c-49da7305c95e	result_created	2025-05-03 15:33:40.069419+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "accepted test notification", "lab_result_id": "30b0d3e4-2674-465f-9e55-1be01b4b220d", "metrics_count": 1}
0f4058f8-6b23-45d9-909b-3751b99310ec	5fc07be1-e69e-447a-ac62-25ff0c52b9fb	technician_assigned	2025-05-08 11:47:32.240665+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
ff0cf38e-51d7-4e48-b989-f2ecb410abad	5fc07be1-e69e-447a-ac62-25ff0c52b9fb	result_created	2025-05-08 11:47:33.097601+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "try net", "lab_result_id": "268280d9-f85a-46ca-999c-5ab4893ce0d8", "metrics_count": 1}
e5f0715f-097a-44ed-b167-d486127a2320	118bff6f-e5d1-4d7a-8e94-03e47d13db96	technician_assigned	2025-05-08 11:50:25.954806+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
a6374d47-25d3-45b4-b197-7e195027babe	118bff6f-e5d1-4d7a-8e94-03e47d13db96	result_created	2025-05-08 11:50:26.487286+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "xbsma", "lab_result_id": "451d99f7-c6ee-4707-adcf-6896a11071e6", "metrics_count": 1}
0147f1b9-c9a5-4b09-a8fb-a3e51524732a	ab2edc8d-ed3c-401a-99a6-f7127436facd	technician_assigned	2025-05-08 12:55:23.146556+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
02926992-549c-43b2-a5d5-ee1dfbf041e4	ab2edc8d-ed3c-401a-99a6-f7127436facd	result_created	2025-05-08 12:55:23.824771+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "newly", "lab_result_id": "ddfa651b-1e8f-45b9-8dcc-de133dfb595f", "metrics_count": 1}
cec22dee-5c7f-4908-827b-b18ad27b183c	870b9a7a-cb30-4eb7-87f1-6fa78c6e9b59	technician_assigned	2025-05-08 13:10:24.974197+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
4efe038c-e92d-4315-b94d-e0e738540109	870b9a7a-cb30-4eb7-87f1-6fa78c6e9b59	result_created	2025-05-08 13:10:25.318646+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "newly coming", "lab_result_id": "237e5db3-c7e9-477e-bb0f-c4fca80ad121", "metrics_count": 1}
b08adc08-553e-4228-bd03-801dc18922ad	57c65bc3-17a8-43e9-ba72-19bbb765c517	technician_assigned	2025-05-08 15:20:23.783499+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
7e99403c-7044-440d-853f-9b60d7ae5578	57c65bc3-17a8-43e9-ba72-19bbb765c517	result_created	2025-05-08 15:20:24.630449+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "rtyu", "lab_result_id": "aefdcfe2-3a08-4b34-ac9b-030d36cdfd63", "metrics_count": 1}
5e75b2a5-b1bc-4a98-aabf-0de5c5475156	489ed4e0-81b1-4854-a486-93c81874f8f4	technician_assigned	2025-05-21 06:41:59.817281+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"action": "auto_assigned_during_result_creation", "new_status": "in_progress", "previous_status": "pending"}
651798b1-5761-440f-b052-9cd9a1d7f263	489ed4e0-81b1-4854-a486-93c81874f8f4	result_created	2025-05-21 06:41:59.99256+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"conclusion": "attaced", "lab_result_id": "a6839c4a-5836-43c5-8805-4fbb7754a655", "metrics_count": 1}
431c4552-6da3-4753-903f-776eb5444b1d	489ed4e0-81b1-4854-a486-93c81874f8f4	result_updated	2025-05-21 08:51:40.463099+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"lab_result_id": "a6839c4a-5836-43c5-8805-4fbb7754a655", "updated_fields": ["result_data", "conclusion", "updated_at"], "conclusion_updated": true, "result_data_updated": true}
69a8be28-90f5-4afa-b5b9-dd5a324dc1f5	489ed4e0-81b1-4854-a486-93c81874f8f4	image_uploaded	2025-05-21 08:52:56.17954+00	3fa85f64-5717-4562-b3fc-2c963f66afa6	{"path": "/uploads/a6839c4a-5836-43c5-8805-4fbb7754a655/20250521085255_9f46759806c848399b4e1f93be4687eb_aqua 1.png", "filename": "20250521085255_9f46759806c848399b4e1f93be4687eb_aqua 1.png", "file_size": 27383, "file_type": "image/png", "lab_result_id": "a6839c4a-5836-43c5-8805-4fbb7754a655"}
\.


--
-- Data for Name: lab_requests; Type: TABLE DATA; Schema: public; Owner: labroom_user
--

COPY public.lab_requests (id, patient_id, doctor_id, technician_id, test_type, priority, status, notes, diagnosis_notes, created_at, updated_at, completed_at, due_date, is_deleted, deleted_at, is_read, read_at) FROM stdin;
2ab442d0-7194-468b-b957-f9a231a7d52d	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	dffb0212-2de8-4cc3-a3ea-8e47e03b7b01	complete_blood_count	high	pending	yes	yes	2025-04-18 05:10:07.937239+00	2025-04-18 05:23:32.6411+00	\N	2025-04-18 05:22:51.786+00	f	\N	f	\N
123399cd-73f3-4a3b-a5ee-1e8eca8796a8	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	d6be7a66-a5d5-461e-9df2-8bf225536c39	complete_blood_count	low	in_progress	mukera1		2025-04-17 14:27:15.310481+00	2025-04-18 05:29:08.87306+00	\N	\N	f	\N	f	\N
9de73000-ae23-4237-958f-719e86df5bf8	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	d6be7a66-a5d5-461e-9df2-8bf225536c39	complete_blood_count	medium	in_progress	new		2025-04-20 12:41:27.451345+00	2025-04-20 13:12:08.618181+00	\N	\N	f	\N	f	\N
745a4553-eae0-42d4-a6a8-d8d3af7a1fa8	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	d6be7a66-a5d5-461e-9df2-8bf225536c39	complete_blood_count	low	in_progress	lala		2025-04-20 13:18:07.197179+00	2025-04-20 13:20:57.438761+00	\N	\N	f	\N	f	\N
aa0d37a7-fd66-4e8b-b850-f57e790b3f17	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	a08055dc-644c-4ae3-ad9f-4d1d74115e2c	complete_blood_count	medium	completed	new		2025-04-20 13:40:18.054566+00	2025-04-20 13:56:43.340437+00	2025-04-20 13:56:43.340437+00	\N	f	\N	f	\N
b14a652d-fb65-4353-99d5-991372cd9539	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	a08055dc-644c-4ae3-ad9f-4d1d74115e2c	lipid_panel	low	completed	what		2025-04-20 13:29:21.97802+00	2025-04-20 14:03:54.356507+00	2025-04-20 14:03:54.356507+00	\N	f	\N	f	\N
a43688a2-fc64-4aa7-871b-03374c99ee9e	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	allergy_test	medium	completed	rr		2025-04-22 16:32:24.145064+00	2025-04-24 05:35:00.382362+00	2025-04-24 05:35:00.382362+00	\N	f	\N	f	\N
df6fdb9b-9239-442c-8ff8-b11952173253	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	lipid_panel	medium	completed	new		2025-04-24 06:23:00.186599+00	2025-04-24 06:29:56.293187+00	2025-04-24 06:29:56.293187+00	\N	f	\N	f	\N
4c9366ec-02fd-41fe-9dd1-7fe7cc67b401	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	chest_xray	low	completed	mukera1		2025-04-22 15:49:50.698+00	2025-04-24 06:43:25.608851+00	2025-04-24 06:43:25.608851+00	\N	f	\N	f	\N
7609d3bc-2e15-4a4e-b6b7-c440574091c9	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	covid19_test	low	completed	new		2025-04-24 16:37:24.853326+00	2025-04-26 10:27:09.190545+00	2025-04-26 10:27:09.190545+00	\N	f	\N	f	\N
98d1fb80-2da7-4212-902f-e96e45bbe51a	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	urinalysis	high	completed	nz		2025-04-24 16:19:45.737266+00	2025-04-27 05:59:25.879311+00	2025-04-27 05:59:25.879311+00	\N	f	\N	f	\N
3c829b62-c289-422e-8258-1d2afee2cd31	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	urinalysis	medium	pending	nskz		2025-04-24 13:41:26.199367+00	2025-04-24 13:41:26.549029+00	\N	\N	t	2025-04-27 13:07:16.031296+00	f	\N
e68d9080-5ef0-411b-82c8-356ab79402e0	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	\N	chest_xray	medium	pending	bdzx		2025-04-24 13:50:55.172285+00	2025-04-24 13:50:55.324242+00	\N	\N	t	2025-04-27 13:07:59.131164+00	f	\N
51183afb-c8d4-41df-9ead-61a96bdad68c	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	complete_blood_count	medium	completed	ne		2025-04-27 06:02:25.603939+00	2025-04-27 13:48:41.75669+00	2025-04-27 13:48:41.75669+00	\N	f	\N	f	\N
227f773e-4c32-4297-9ea7-cd46d56db515	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	thyroid_panel	high	completed	yess		2025-04-24 16:04:31.700682+00	2025-04-27 14:44:40.109109+00	2025-04-27 14:44:40.109109+00	\N	f	\N	f	\N
06c3d2f2-5d0e-4094-ae99-f921ce716bd1	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	vitamin_d_test	medium	pending	tap		2025-04-24 13:31:41.008396+00	2025-04-24 13:31:41.139147+00	\N	\N	t	2025-04-27 15:06:29.289423+00	f	\N
8168b190-a73f-4712-8d56-1acbd44a1811	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	complete_blood_count	medium	pending	n		2025-04-24 13:16:53.461454+00	2025-04-24 13:16:53.622753+00	\N	\N	t	2025-04-27 15:06:58.441471+00	f	\N
0f390a53-a290-4612-9c54-bae3afdc3aad	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	thyroid_panel	low	pending	ne		2025-04-24 13:15:18.953988+00	2025-04-24 13:15:19.143811+00	\N	\N	t	2025-04-27 15:07:17.773898+00	f	\N
d2aaba59-318f-4772-9941-61e2c6dea845	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	covid19_test	low	pending	new		2025-04-24 11:59:08.251504+00	2025-04-24 11:59:08.464157+00	\N	\N	t	2025-04-27 15:07:55.056914+00	f	\N
adbdb433-9b78-4ff3-a478-a66bfc5b2f54	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	lipid_panel	medium	pending	new\n		2025-04-24 10:40:43.229649+00	2025-04-24 10:40:43.370682+00	\N	\N	t	2025-04-27 19:10:28.43463+00	f	\N
6a287bff-39b4-4610-8374-daecf47a6512	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	hba1c	high	pending	new		2025-04-24 10:30:45.375867+00	2025-04-24 10:30:45.536527+00	\N	\N	t	2025-04-27 19:10:38.38865+00	f	\N
0a885b2a-ea66-435f-a121-603e5eb3bb62	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	ecg	high	pending	new		2025-04-24 10:16:39.210989+00	2025-04-24 10:16:39.818587+00	\N	\N	t	2025-04-27 19:10:50.660529+00	f	\N
9ac15498-cca7-4f04-bcd1-b2fc0dffd4d6	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	thyroid_panel	high	pending	ya		2025-04-24 09:46:38.360744+00	2025-04-24 09:46:38.806871+00	\N	\N	t	2025-04-27 19:11:03.432413+00	f	\N
d4a39d28-c18e-46c9-aab8-702704d0ffc1	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	urinalysis	high	pending	kexa		2025-04-24 09:41:38.313126+00	2025-04-24 09:41:39.021863+00	\N	\N	t	2025-04-27 19:11:16.627405+00	f	\N
4688e64b-a1e3-47b8-9d1f-3c58b2bb4d52	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	comprehensive_metabolic_panel	medium	pending	trial		2025-04-24 09:30:33.044278+00	2025-04-24 09:30:33.586443+00	\N	\N	t	2025-04-27 19:11:29.615841+00	f	\N
22191d66-cb42-45e3-946d-13289b5827ea	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	ecg	high	pending	ttt		2025-04-24 09:17:59.842926+00	2025-04-24 09:18:00.389865+00	\N	\N	t	2025-04-27 19:11:40.242839+00	f	\N
6958e700-fcfb-47ee-aace-8f335b180a2a	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	hba1c	low	pending	check		2025-04-24 09:03:54.859674+00	2025-04-24 09:03:54.970808+00	\N	\N	t	2025-04-27 19:11:51.453134+00	f	\N
8c7102cc-e689-4dad-9d18-c640ad26393f	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	lipid_panel	high	pending	hi		2025-04-24 08:53:31.795002+00	2025-04-24 08:53:32.116915+00	\N	\N	t	2025-04-27 19:12:03.314528+00	f	\N
78a0f371-70b1-4fd3-b386-ab4574bf7bf1	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	comprehensive_metabolic_panel	low	pending	trial2		2025-04-24 08:52:27.8683+00	2025-04-24 08:52:28.510994+00	\N	\N	t	2025-04-27 19:12:13.281155+00	f	\N
595ee596-afdb-41f4-ae32-5ae1b9791ff2	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	lipid_panel	medium	pending	trial7		2025-04-24 08:50:43.648417+00	2025-04-24 08:50:44.356751+00	\N	\N	t	2025-04-27 19:12:21.295412+00	f	\N
47627328-be51-4900-89de-3fb62494db74	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	allergy_test	medium	pending	socket7		2025-04-24 08:49:12.217949+00	2025-04-24 08:49:12.66404+00	\N	\N	t	2025-04-27 19:12:32.160166+00	f	\N
0ae71324-4fbf-46a2-8a5a-8d5acebcdf17	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	covid19_test	low	pending	socket6		2025-04-24 08:32:51.424345+00	2025-04-24 08:32:51.561915+00	\N	\N	t	2025-04-27 19:12:41.464987+00	f	\N
2be72d56-dcf9-4565-8331-9da3e4cafdc5	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	chest_xray	medium	pending	socket4		2025-04-24 08:29:13.025787+00	2025-04-24 08:29:13.359962+00	\N	\N	t	2025-04-27 19:12:50.304307+00	f	\N
2062f5a4-10fb-49ab-bcaa-8cdf2eb01941	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	ecg	high	pending	socket3		2025-04-24 08:15:55.001581+00	2025-04-24 08:15:55.335618+00	\N	\N	t	2025-04-27 19:12:57.674098+00	f	\N
42f18f34-9ed2-41c5-a5ec-6d4c3fb5f094	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	urinalysis	low	pending	socket2		2025-04-24 08:14:59.846298+00	2025-04-24 08:14:59.955056+00	\N	\N	t	2025-04-27 19:13:07.263598+00	f	\N
12c6417e-319d-40a3-93a8-729e11c020f4	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	vitamin_d_test	medium	pending	socket		2025-04-24 08:14:25.158954+00	2025-04-24 08:14:25.530188+00	\N	\N	t	2025-04-28 08:09:20.72525+00	f	\N
39293a7c-a9de-445d-a7b4-0f4897498b36	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	hba1c	low	pending	new		2025-04-24 06:33:13.847631+00	2025-04-24 06:33:13.979624+00	\N	\N	t	2025-04-28 08:09:46.314197+00	f	\N
80f85965-4428-49e5-a561-663f11c91730	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	\N	complete_blood_count	high	pending	la		2025-04-24 13:34:10.177526+00	2025-04-24 13:34:10.343588+00	\N	\N	t	2025-04-28 08:10:39.817948+00	f	\N
01dea266-7266-4b00-980f-9c79554c8594	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	\N	complete_blood_count	high	pending			2025-04-24 14:53:22.3428+00	2025-04-24 14:53:22.586927+00	\N	\N	t	2025-04-28 08:12:09.223959+00	f	\N
8076c86d-9867-45a6-ab12-7d6461a55b55	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	complete_blood_count	low	completed	jskla		2025-04-24 15:56:44.585332+00	2025-04-28 08:17:20.220998+00	2025-04-28 08:17:20.220998+00	\N	f	\N	f	\N
5a6f36f5-e06f-4559-804c-1ef10ea8535a	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	hba1c	high	completed	tial notification		2025-04-24 14:51:24.09334+00	2025-05-01 10:37:34.465534+00	2025-05-01 10:37:34.465534+00	\N	f	\N	f	\N
6f3a9990-c401-4067-abbf-00265ac7fd0e	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	ecg	medium	completed	mukera 3		2025-04-22 15:55:27.661436+00	2025-05-02 08:19:19.86768+00	2025-05-02 08:19:19.86768+00	\N	f	\N	f	\N
474ae4e2-420f-403b-a5ba-f0ad77a9e80a	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	hba1c	high	completed	new		2025-04-24 15:41:57.941246+00	2025-05-02 16:18:08.863367+00	2025-05-02 16:18:08.863367+00	\N	f	\N	f	\N
a2b51fa7-fa02-4f47-b7b0-b10d0b3e94ba	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	complete_blood_count	low	completed	yada		2025-04-17 13:55:00.517815+00	2025-05-02 18:58:50.6495+00	2025-05-02 18:58:50.6495+00	\N	f	\N	f	\N
b4b01294-b650-4ad0-9dce-d6554927472b	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	complete_blood_count	medium	completed	new		2025-04-19 14:17:31.822797+00	2025-05-02 19:23:34.587248+00	2025-05-02 19:23:34.587248+00	\N	f	\N	f	\N
5a444286-d295-4df6-86fb-9d2aefb48816	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	covid19_test	medium	completed	mukera2		2025-04-22 15:54:29.290699+00	2025-05-02 19:34:18.196437+00	2025-05-02 19:34:18.196437+00	\N	f	\N	f	\N
eea4aee9-80b4-4dfc-ab19-b2427baef690	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	comprehensive_metabolic_panel	medium	completed	newles		2025-04-17 19:28:34.375357+00	2025-05-02 19:38:52.27133+00	2025-05-02 19:38:52.27133+00	\N	f	\N	f	\N
2cd8e0db-ba02-4829-a5f4-0851fa5abe87	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	liver_function_test	high	completed	ehh		2025-05-02 21:34:45.893405+00	2025-05-02 21:36:34.006738+00	2025-05-02 21:36:34.006738+00	\N	f	\N	f	\N
22288dab-eb5e-4bde-b521-ca083e43f151	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	comprehensive_metabolic_panel	high	completed	yo		2025-05-02 21:50:41.438765+00	2025-05-02 21:52:48.573032+00	2025-05-02 21:52:48.573032+00	\N	f	\N	f	\N
c1825154-ca03-42e3-8511-3abdbea93f7b	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	liver_function_test	medium	completed	jol;		2025-05-02 22:15:36.384503+00	2025-05-02 22:16:39.732857+00	2025-05-02 22:16:39.732857+00	\N	f	\N	f	\N
d409f3a9-b302-495b-a30b-e8792c6e1e15	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	ecg	medium	completed	socket trial		2025-05-03 07:47:03.845516+00	2025-05-03 07:48:15.246173+00	2025-05-03 07:48:15.246173+00	\N	f	\N	f	\N
c05b5fcb-6100-4da5-9bd7-8e9b694804ac	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	lipid_panel	low	completed	new		2025-05-03 07:49:06.920859+00	2025-05-03 07:50:02.873158+00	2025-05-03 07:50:02.873158+00	\N	f	\N	f	\N
c4bdf16a-b8a0-4ba9-ad51-b6bf7da5dbe5	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	hba1c	low	completed	kl		2025-05-03 08:07:04.558716+00	2025-05-03 08:08:20.951648+00	2025-05-03 08:08:20.951648+00	\N	f	\N	f	\N
78cd9800-0d7c-40be-a5c5-dae4c57436f4	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	covid19_test	high	completed	nm		2025-05-03 08:12:28.728115+00	2025-05-03 08:13:32.001103+00	2025-05-03 08:13:32.001103+00	\N	f	\N	f	\N
fdd71039-eb10-4a01-a64b-eb43e73b2f11	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	vitamin_d_test	low	completed	nm		2025-05-03 08:18:47.86826+00	2025-05-03 08:19:41.123026+00	2025-05-03 08:19:41.123026+00	\N	f	\N	f	\N
559963b7-848c-41df-8812-aa5df5b6bf5a	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	urinalysis	medium	completed	new 		2025-05-03 09:12:39.187342+00	2025-05-03 09:13:56.014949+00	2025-05-03 09:13:56.014949+00	\N	f	\N	f	\N
ecd9d9bd-513e-4aad-98ce-a99e859bb7eb	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	thyroid_panel	high	completed	trial 1		2025-05-03 09:20:14.434814+00	2025-05-03 09:21:28.725532+00	2025-05-03 09:21:28.725532+00	\N	f	\N	f	\N
5a2455f9-ed04-4d3b-8461-9af24dd4afed	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	liver_function_test	high	completed	low		2025-05-03 09:38:58.582037+00	2025-05-03 09:39:55.512961+00	2025-05-03 09:39:55.512961+00	\N	f	\N	f	\N
47c4a564-2576-472e-a594-80f721d528c4	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	comprehensive_metabolic_panel	high	completed	ty		2025-05-03 09:51:17.393601+00	2025-05-03 09:52:35.615101+00	2025-05-03 09:52:35.615101+00	\N	f	\N	f	\N
f0511d82-c455-4dcd-8566-ab3324d90b62	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	complete_blood_count	high	completed	last		2025-05-03 09:57:25.305049+00	2025-05-03 09:59:31.34702+00	2025-05-03 09:59:31.34702+00	\N	f	\N	f	\N
086c6d5f-6320-4c4b-8373-4ca822ffdcc6	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	ecg	low	completed	advance		2025-05-03 12:29:12.739022+00	2025-05-03 12:30:46.885525+00	2025-05-03 12:30:46.885525+00	\N	f	\N	f	\N
c765ad74-00f3-4643-b8f9-56e7a0c6672f	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	comprehensive_metabolic_panel	medium	completed	trial 7		2025-05-03 13:01:56.667168+00	2025-05-03 13:03:14.162301+00	2025-05-03 13:03:14.162301+00	\N	f	\N	f	\N
be3da0f7-65a7-416e-8d01-bf797dadc8f7	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	thyroid_panel	low	completed	try\n		2025-05-03 13:26:14.186488+00	2025-05-03 13:27:33.439478+00	2025-05-03 13:27:33.439478+00	\N	f	\N	f	\N
ecc0c0a2-913d-4d78-b23f-1b133926299e	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	urinalysis	high	completed	notification end		2025-05-03 14:51:57.430187+00	2025-05-03 14:54:29.665393+00	2025-05-03 14:54:29.665393+00	\N	f	\N	f	\N
861f53fc-a942-4405-a05c-49da7305c95e	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	chest_xray	medium	completed	last		2025-05-03 15:32:26.302176+00	2025-05-03 15:33:39.9476+00	2025-05-03 15:33:39.9476+00	\N	f	\N	f	\N
c2c5b812-4992-441b-a5b6-0b1e3b9561d3	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	\N	lipid_panel	medium	pending	try note		2025-05-06 06:17:42.98544+00	2025-05-06 06:17:44.203734+00	\N	\N	f	\N	f	\N
66461580-e747-4144-96ed-9561541d3e4d	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	low	pending	trial one		2025-05-06 06:22:01.959195+00	2025-05-06 06:22:03.155655+00	\N	\N	f	\N	f	\N
1729d057-0342-4f1d-9210-b7ef4e4a0eac	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	urinalysis	medium	pending	request trial 1		2025-05-06 07:39:54.133382+00	2025-05-06 07:39:57.24702+00	\N	\N	f	\N	f	\N
f00a3004-1e60-4950-a3b3-f5c6ab452c3b	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	\N	chest_xray	low	pending	request delivery test 1		2025-05-06 08:07:08.485794+00	2025-05-06 08:07:08.81851+00	\N	\N	f	\N	f	\N
0fc544ed-68f3-4f6e-916d-81bef9135ebb	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	hba1c	medium	pending	request trail 2		2025-05-06 08:42:17.928989+00	2025-05-06 08:42:19.043426+00	\N	\N	f	\N	f	\N
e863f3bd-31c7-4e69-8edf-01267e4e5b1f	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	covid19_test	medium	pending	test on browser		2025-05-06 09:03:42.750381+00	2025-05-06 09:03:44.76244+00	\N	\N	f	\N	f	\N
ff1143af-079b-4e46-8514-2203c9a4ed50	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	medium	pending	i am tired		2025-05-06 09:10:11.608678+00	2025-05-06 09:10:12.309311+00	\N	\N	f	\N	f	\N
ed49e04e-69a1-4037-b652-2887a26060b1	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	medium	pending	soket check		2025-05-06 09:52:57.320254+00	2025-05-06 09:53:00.657818+00	\N	\N	f	\N	f	\N
87068984-c1ff-4b92-a535-7044b9597c9f	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	\N	thyroid_panel	medium	pending	socket check		2025-05-06 10:25:01.77146+00	2025-05-06 10:25:02.126004+00	\N	\N	f	\N	f	\N
93e34c24-b094-490e-ba35-b6f9e7a8afbb	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	\N	comprehensive_metabolic_panel	medium	pending	trial 7		2025-05-06 10:38:25.017959+00	2025-05-06 10:38:25.017968+00	\N	\N	f	\N	f	\N
02e2ce19-c715-4798-8be0-013ae843ebc5	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	covid19_test	medium	pending	labrequest delivery check		2025-05-06 12:07:52.837361+00	2025-05-06 12:07:52.837369+00	\N	\N	f	\N	f	\N
f3ce8d41-faef-4c1f-b702-2a9f675bc97f	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	comprehensive_metabolic_panel	medium	pending	check lab request on frontend		2025-05-06 12:59:56.325944+00	2025-05-06 12:59:56.32595+00	\N	\N	f	\N	f	\N
bc9379e4-764b-4b04-b326-ad95c95c0fbe	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	\N	urinalysis	medium	pending	try		2025-05-06 13:14:42.443581+00	2025-05-06 13:14:42.443587+00	\N	\N	f	\N	f	\N
eccb14a1-5889-4370-8365-55a47349fd49	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	vitamin_d_test	low	pending	truo		2025-05-06 13:33:48.309862+00	2025-05-06 13:33:48.30987+00	\N	\N	f	\N	f	\N
34ece074-611b-4b3b-8eab-cea2ffea04b8	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	thyroid_panel	high	pending	new		2025-05-06 14:42:06.868815+00	2025-05-06 14:42:06.868823+00	\N	\N	f	\N	f	\N
d6176f81-49e2-4911-9c94-c18fcba57fd1	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	medium	pending	trmmm		2025-05-06 15:01:29.231882+00	2025-05-06 15:01:29.231898+00	\N	\N	f	\N	f	\N
abebadbc-1eb1-492e-abce-50e8871d173e	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	\N	thyroid_panel	medium	pending	notes 1		2025-05-07 08:32:13.443631+00	2025-05-07 08:32:13.443637+00	\N	\N	f	\N	f	\N
60988a19-375d-434b-a974-43d7eb53e03e	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	high	pending	trial 2		2025-05-07 08:33:16.130757+00	2025-05-07 08:33:16.130761+00	\N	\N	f	\N	f	\N
4e524d28-05e0-4570-b31a-f1f993b9b613	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	\N	chest_xray	high	pending	hiiii		2025-05-07 08:59:23.121137+00	2025-05-07 08:59:23.121145+00	\N	\N	f	\N	f	\N
cc62bf26-8921-4e9c-af6e-3a62408bf7c5	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	medium	pending	new		2025-05-07 13:37:53.947777+00	2025-05-07 13:37:53.947783+00	\N	\N	f	\N	f	\N
d84c7242-9c55-4295-8806-f86eecc83b97	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	medium	pending	new		2025-05-07 13:37:57.749875+00	2025-05-07 13:37:57.749882+00	\N	\N	f	\N	f	\N
1101c9d6-8058-4529-88cf-c25e1b772bff	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	\N	comprehensive_metabolic_panel	high	pending	traing web socket	\N	2025-05-07 15:06:11.31971+00	2025-05-07 15:06:17.977744+00	\N	\N	f	\N	f	\N
595bf1a0-4f63-4c28-8ad4-68e95a807e7b	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	vitamin_d_test	low	pending	check socket	\N	2025-05-07 15:18:25.742496+00	2025-05-07 15:18:34.468103+00	\N	\N	f	\N	f	\N
5606c667-6bb9-4b3d-971b-617255af84e5	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	\N	covid19_test	medium	pending	checkup websocket	\N	2025-05-07 15:28:35.827142+00	2025-05-07 15:28:42.012607+00	\N	\N	f	\N	f	\N
41f12377-5d97-4c78-84af-6283afaddc9c	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	covid19_test	high	pending	try socket	\N	2025-05-07 15:32:17.441175+00	2025-05-07 15:32:23.381397+00	\N	\N	f	\N	f	\N
12bf170b-1072-453c-a682-e73cc936b153	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	\N	urinalysis	high	pending	check socket delivery	\N	2025-05-07 15:44:15.35648+00	2025-05-07 15:44:20.295342+00	\N	\N	f	\N	f	\N
664edecb-8419-48b6-aae2-f9f89684b073	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	chest_xray	medium	pending	new	\N	2025-05-07 16:27:03.874992+00	2025-05-07 16:27:15.99616+00	\N	\N	f	\N	f	\N
4360252a-dc4e-443c-b7b7-4ff5a7d7a5da	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	\N	complete_blood_count	high	pending	try	\N	2025-05-07 20:10:40.950614+00	2025-05-07 20:10:44.594461+00	\N	\N	f	\N	f	\N
025401c2-b1a7-4b10-888c-c11714ce70d6	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	high	pending	try	\N	2025-05-07 20:13:11.463185+00	2025-05-07 20:13:11.60543+00	\N	\N	f	\N	f	\N
b201654e-8825-43be-b08a-a635ee9aff41	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	\N	thyroid_panel	medium	pending	yes	\N	2025-05-07 20:16:24.621176+00	2025-05-07 20:16:28.549986+00	\N	\N	f	\N	f	\N
7e4f7509-b43d-4f07-9bb1-f90357315e13	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	\N	urinalysis	medium	pending	yes	\N	2025-05-07 20:17:07.956082+00	2025-05-07 20:17:08.144298+00	\N	\N	f	\N	f	\N
162a5d14-478b-48db-a4ff-8c1698c98b8a	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	\N	comprehensive_metabolic_panel	high	pending	try\n	\N	2025-05-07 22:32:02.958166+00	2025-05-07 22:32:11.993757+00	\N	\N	f	\N	f	\N
9061712d-4532-4bea-8293-ad35c96711a4	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	\N	thyroid_panel	medium	pending	try socket	\N	2025-05-08 07:40:20.135313+00	2025-05-08 07:40:51.974467+00	\N	\N	f	\N	f	\N
d45986f3-9c10-42eb-a25b-8b81f7f94f06	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	ecg	high	pending	nj	\N	2025-05-08 07:59:37.730497+00	2025-05-08 07:59:45.259313+00	\N	\N	f	\N	f	\N
a2f5cc1a-ea45-4cc5-bea4-32febb5a462e	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	\N	lipid_panel	high	pending	mk	\N	2025-05-08 08:13:36.650651+00	2025-05-08 08:13:39.72839+00	\N	\N	f	\N	f	\N
5fc07be1-e69e-447a-ac62-25ff0c52b9fb	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	lipid_panel	high	completed	vb	\N	2025-05-08 08:24:35.843629+00	2025-05-08 11:47:32.636131+00	2025-05-08 11:47:32.636131+00	\N	f	\N	f	\N
118bff6f-e5d1-4d7a-8e94-03e47d13db96	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	chest_xray	high	completed	you	\N	2025-05-08 08:02:12.424431+00	2025-05-08 11:50:26.096642+00	2025-05-08 11:50:26.096642+00	\N	f	\N	f	\N
c9e66efd-d28a-4ed1-888d-b34e37b6e24c	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	medium	pending	new	\N	2025-05-08 11:52:02.790284+00	2025-05-08 11:52:08.690995+00	\N	\N	f	\N	f	\N
de8fcdd8-2b24-4afa-af8d-3ccec04bbf88	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	lipid_panel	medium	pending	test	\N	2025-05-08 12:00:01.849648+00	2025-05-08 12:00:08.595962+00	\N	\N	f	\N	f	\N
8ee59c04-6c6a-4c9d-9e53-7c1359c758b4	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	\N	urinalysis	medium	pending	what	\N	2025-05-08 12:40:15.672706+00	2025-05-08 12:40:25.96346+00	\N	\N	f	\N	f	\N
2ec07788-21f0-44eb-ac9f-1cd3af1858fb	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	medium	pending	tes	\N	2025-05-08 12:45:11.011123+00	2025-05-08 12:45:17.71541+00	\N	\N	f	\N	f	\N
ab2edc8d-ed3c-401a-99a6-f7127436facd	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	allergy_test	medium	completed	new	\N	2025-05-08 12:52:36.122514+00	2025-05-08 12:55:23.316896+00	2025-05-08 12:55:23.316896+00	\N	f	\N	f	\N
870b9a7a-cb30-4eb7-87f1-6fa78c6e9b59	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	complete_blood_count	medium	completed	test	\N	2025-05-08 11:56:52.518605+00	2025-05-08 13:10:25.07896+00	2025-05-08 13:10:25.07896+00	\N	f	\N	f	\N
f3147558-d389-4243-acfd-bbe593634ce9	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	\N	lipid_panel	medium	pending	tese	\N	2025-05-08 13:31:57.431544+00	2025-05-08 13:32:00.858808+00	\N	\N	f	\N	f	\N
04c82fba-c354-467f-8d34-81093aff8dcc	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	chest_xray	high	pending	edsadz	\N	2025-05-08 13:34:30.338804+00	2025-05-08 13:34:30.661085+00	\N	\N	f	\N	f	\N
bf5653a8-3d0d-4042-9a30-1f3229a31495	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	\N	ecg	low	pending	4ere	\N	2025-05-08 13:45:29.430641+00	2025-05-08 13:45:33.136643+00	\N	\N	f	\N	f	\N
6308fd08-c140-4dfd-8662-4ed1b257ee29	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	\N	allergy_test	low	pending	ghjk	\N	2025-05-08 13:56:52.511541+00	2025-05-08 13:56:57.364368+00	\N	\N	f	\N	f	\N
132a8cc9-ff07-4016-813a-2e0870ba8e4f	45383e0d-a778-421a-bfe1-a94d1e93f2d8	722421d7-e863-46cd-9f55-35c992839c8a	\N	lipid_panel	high	pending	sds	\N	2025-05-08 13:59:18.305536+00	2025-05-08 13:59:18.429982+00	\N	\N	f	\N	f	\N
becde712-a11d-435e-bbc6-5c3416e7cd10	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	comprehensive_metabolic_panel	low	pending	saz	\N	2025-05-08 14:00:37.846334+00	2025-05-08 14:00:40.792695+00	\N	\N	f	\N	f	\N
77adaa46-f9ec-48c0-ab04-be7d84a7a7f7	0ea31065-2a8a-44be-81fe-5e2272d7c02a	722421d7-e863-46cd-9f55-35c992839c8a	\N	lipid_panel	medium	pending	as\\	\N	2025-05-08 14:02:33.299038+00	2025-05-08 14:02:33.414334+00	\N	\N	f	\N	f	\N
0441338d-072e-4ff7-b193-7cf841699052	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	\N	complete_blood_count	high	pending	ssd	\N	2025-05-08 14:04:07.795133+00	2025-05-08 14:04:11.767552+00	\N	\N	f	\N	f	\N
726007ce-6f86-4398-9c80-63014e9b97ad	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	high	pending	sds	\N	2025-05-08 14:25:16.777407+00	2025-05-08 14:25:20.147011+00	\N	\N	f	\N	f	\N
2964896a-b54e-4818-b9e6-8f56c4a4e2e3	5ca96958-df06-4d19-a461-abb528247d9c	722421d7-e863-46cd-9f55-35c992839c8a	\N	thyroid_panel	low	pending	rrr	\N	2025-05-08 14:44:49.980926+00	2025-05-08 14:44:53.674193+00	\N	\N	f	\N	f	\N
f937f850-c4bc-470d-a4a6-d7246595097f	9cb64761-af83-43fa-8a2d-bfd7e56e7e99	722421d7-e863-46cd-9f55-35c992839c8a	\N	covid19_test	high	pending	please	\N	2025-05-08 15:14:10.762987+00	2025-05-08 15:14:15.378174+00	\N	\N	f	\N	f	\N
57c65bc3-17a8-43e9-ba72-19bbb765c517	77118e18-ff47-4256-96fb-c4cd6029c04c	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	liver_function_test	medium	completed	k	\N	2025-05-08 15:16:10.642216+00	2025-05-08 15:20:24.027702+00	2025-05-08 15:20:24.027702+00	\N	f	\N	f	\N
3b2e693e-5e8f-4d64-8206-1e6070680150	f51e8d2a-6403-43dc-9309-59f4b3b2a1f1	722421d7-e863-46cd-9f55-35c992839c8a	\N	liver_function_test	high	pending	ddf	\N	2025-05-08 15:38:12.238647+00	2025-05-08 15:38:23.435414+00	\N	\N	f	\N	f	\N
ebab1734-1187-4360-a93c-f5cb252d68ff	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	\N	allergy_test	low	pending	eeee	\N	2025-05-08 16:17:59.477939+00	2025-05-08 16:18:02.678842+00	\N	\N	f	\N	f	\N
489ed4e0-81b1-4854-a486-93c81874f8f4	eb3c734b-f0fd-4678-b394-622352de68e0	722421d7-e863-46cd-9f55-35c992839c8a	3fa85f64-5717-4562-b3fc-2c963f66afa6	complete_blood_count	high	completed	new	\N	2025-05-09 14:33:00.784815+00	2025-05-21 06:41:59.973522+00	2025-05-21 06:41:59.973522+00	\N	f	\N	f	\N
\.


--
-- Data for Name: lab_results; Type: TABLE DATA; Schema: public; Owner: labroom_user
--

COPY public.lab_results (id, lab_request_id, result_data, conclusion, image_paths, created_at, updated_at, is_deleted, deleted_at) FROM stdin;
b02705cc-5b47-4c01-99ad-795ceb1097d8	b14a652d-fb65-4353-99d5-991372cd9539	{"jemr": "mech"}	jemari	{"/uploads/b02705cc-5b47-4c01-99ad-795ceb1097d8/20250420153028_d5288688cd644561b4efe75163526211_Activity Diagram for Analyzer AI Tools3drawio.png"}	2025-04-20 14:03:54.343812+00	2025-04-20 15:30:28.89881+00	t	2025-04-27 14:25:00.730724+00
ae61bfdf-f05e-4735-ad39-2df42013faed	4c9366ec-02fd-41fe-9dd1-7fe7cc67b401	{"jemr": "mech"}	jemari	{"/uploads/ae61bfdf-f05e-4735-ad39-2df42013faed/20250427142412_e7659586f2184184bbd03430a204eb57_aqua 1.png"}	2025-04-24 06:43:25.596499+00	2025-04-27 14:24:12.063501+00	t	2025-04-27 14:41:20.974846+00
e30f23e4-39e4-4355-b476-4b024a8114aa	c1825154-ca03-42e3-8511-3abdbea93f7b	{"beka": {"unit": "km", "value": "78", "recorded_at": "2025-05-02T22:16:18.637Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}		{}	2025-05-02 22:16:39.726434+00	2025-05-02 22:16:39.726438+00	f	\N
e13f0a23-175e-41d0-a213-07351d8c8386	227f773e-4c32-4297-9ea7-cd46d56db515	{"gh": {"unit": "mk", "value": "56", "recorded_at": "2025-04-27T14:44:22.640Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "56"}}	ghjk	{/uploads/e13f0a23-175e-41d0-a213-07351d8c8386/20250427144528_2a8f2b396f9f4be3b829871a2d88eb5b_coursera.jpg}	2025-04-27 14:44:40.103657+00	2025-04-27 14:45:28.687351+00	f	\N
bba10b00-786d-4851-a475-07749678f630	aa0d37a7-fd66-4e8b-b850-f57e790b3f17	{"new": "new"}	new	{}	2025-04-20 13:56:43.32888+00	2025-04-20 13:56:43.328888+00	t	2025-04-27 11:04:12.003936+00
f1851cc0-2f9a-4270-9c77-3a09a202b8c3	a43688a2-fc64-4aa7-871b-03374c99ee9e	{"jemr": "mech"}	jemari	{}	2025-04-24 05:35:00.354965+00	2025-04-24 05:35:00.354985+00	t	2025-04-27 14:12:27.762501+00
1793768d-aec4-43b4-a01b-63c170cb85df	d409f3a9-b302-495b-a30b-e8792c6e1e15	{"notifiy doctor": {"unit": "mg", "value": "22", "recorded_at": "2025-05-03T07:47:49.771Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	delivered	{}	2025-05-03 07:48:15.243689+00	2025-05-03 07:48:15.243692+00	f	\N
ad4886fe-0399-419b-a451-09ba428e41a8	51183afb-c8d4-41df-9ead-61a96bdad68c	{"fvh": {"unit": "ui", "value": "45", "updated_at": "2025-04-27T14:12:05.975834", "updated_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "recorded_at": "2025-04-27T13:48:22.105Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "45"}}	fgh	{"/uploads/ad4886fe-0399-419b-a451-09ba428e41a8/20250427141334_fe19e0748eb64795bd3c2e6644027983_aqua 1.png"}	2025-04-27 13:48:41.749836+00	2025-04-27 14:13:34.194991+00	t	2025-04-27 14:14:18.796923+00
feb5bf02-6629-4bc4-80e5-c5b23c2bd3b6	8076c86d-9867-45a6-ab12-7d6461a55b55	{"yes": {"unit": "mg", "value": "11", "updated_at": "2025-04-29T12:40:32.506886", "updated_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "recorded_at": "2025-04-28T08:15:57.755Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	yes	{"/uploads/feb5bf02-6629-4bc4-80e5-c5b23c2bd3b6/20250429124128_58d3278b384b4600b78213c777f3aa66_aqua 1.png"}	2025-04-28 08:17:20.200925+00	2025-04-29 12:41:28.861061+00	f	\N
9db0173b-c630-4f16-a253-a07f55370581	5a6f36f5-e06f-4559-804c-1ef10ea8535a	{"done": {"unit": "mg", "value": "89", "recorded_at": "2025-05-01T10:36:55.195Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	dieases detected	{}	2025-05-01 10:37:34.458386+00	2025-05-01 10:37:34.458389+00	f	\N
c7ccfe95-0462-4556-93a0-ace04ef1d57a	98d1fb80-2da7-4212-902f-e96e45bbe51a	{"bb": {"unit": "mg", "value": "90", "updated_at": "2025-04-27T14:15:57.885079", "updated_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "recorded_at": "2025-04-27T05:59:17.194Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "70"}}	n	{/uploads/c7ccfe95-0462-4556-93a0-ace04ef1d57a/20250427110151_37b924bd3e244820a2522c921dbb599d_OIP.jpeg,"/uploads/c7ccfe95-0462-4556-93a0-ace04ef1d57a/20250427141526_cd2b592a516b41ae85b7c24884d0d9d3_aqua 1.png"}	2025-04-27 05:59:25.873994+00	2025-04-27 14:15:57.885105+00	t	2025-04-27 14:16:12.763322+00
10583038-fe9f-4ef0-91d5-a30bc6d01439	7609d3bc-2e15-4a4e-b6b7-c440574091c9	{"title": {"unit": "34", "value": "pass", "recorded_at": "2025-04-26T10:26:16.131Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "23"}}	fcgvbhnm	{}	2025-04-26 10:27:09.181393+00	2025-04-26 10:27:09.181397+00	t	2025-04-27 14:22:35.114672+00
1c660555-af4e-4db4-9347-41bafd2b9019	df6fdb9b-9239-442c-8ff8-b11952173253	{"jemr": "mech"}	jemari	{}	2025-04-24 06:29:56.288244+00	2025-04-24 06:29:56.288248+00	t	2025-04-27 14:23:28.297555+00
ec67ed20-d831-4f8a-8f22-5867021c8b11	6f3a9990-c401-4067-abbf-00265ac7fd0e	{"new": {"unit": "mg", "value": "89", "recorded_at": "2025-05-02T08:18:27.114Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	yes	{}	2025-05-02 08:19:19.840969+00	2025-05-02 08:19:19.840978+00	f	\N
dbca8a05-6bf9-4d4e-8042-ce458c5d9179	474ae4e2-420f-403b-a5ba-f0ad77a9e80a	{"test 1": {"unit": "mg", "value": "10", "recorded_at": "2025-05-02T16:17:38.974Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	positive	{}	2025-05-02 16:18:08.822932+00	2025-05-02 16:18:08.822937+00	f	\N
bd50e9ba-45b6-4820-aa50-614618ab0686	a2b51fa7-fa02-4f47-b7b0-b10d0b3e94ba	{"notifications test": {"unit": "dl", "value": "89", "recorded_at": "2025-05-02T18:58:14.042Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	positive	{}	2025-05-02 18:58:50.640768+00	2025-05-02 18:58:50.640773+00	f	\N
c3a1f348-be02-4a5e-9efb-077f3061054f	b4b01294-b650-4ad0-9dce-d6554927472b	{"lab result notification": {"unit": "mg", "value": "17", "recorded_at": "2025-05-02T19:21:36.779Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "55"}}	needs treatment	{}	2025-05-02 19:23:34.581043+00	2025-05-02 19:23:34.581049+00	f	\N
1bbf52e6-a0aa-4602-86bc-41bf2aa1ba39	5a444286-d295-4df6-86fb-9d2aefb48816	{"notification alert": {"unit": "dl", "value": "90", "recorded_at": "2025-05-02T19:33:51.189Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "99"}}	help it up	{}	2025-05-02 19:34:18.192422+00	2025-05-02 19:34:18.192425+00	f	\N
d9f049e9-06f1-48ee-b8a0-96f4540bf955	eea4aee9-80b4-4dfc-ab19-b2427baef690	{"last test of notification ": {"unit": "ml", "value": "78", "recorded_at": "2025-05-02T19:38:17.721Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "88"}}	success is comming	{}	2025-05-02 19:38:52.267955+00	2025-05-02 19:38:52.267958+00	f	\N
ca58ff4c-995a-48c5-9e46-bbb7f8fc1cd4	2cd8e0db-ba02-4829-a5f4-0851fa5abe87	{"here is the result": {"unit": "dl", "value": "79", "recorded_at": "2025-05-02T21:36:08.383Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "88"}}		{}	2025-05-02 21:36:34.001334+00	2025-05-02 21:36:34.001338+00	f	\N
82065947-c357-41b5-aeea-0886f9f0990b	22288dab-eb5e-4bde-b521-ca083e43f151	{"fine": {"unit": "kg", "value": "yes", "recorded_at": "2025-05-02T21:52:17.454Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "80"}}		{}	2025-05-02 21:52:48.561821+00	2025-05-02 21:52:48.561829+00	f	\N
60b4383a-c5f5-4766-9359-85b77b8d4771	c4bdf16a-b8a0-4ba9-ad51-b6bf7da5dbe5	{"try": {"unit": "li", "value": "90", "recorded_at": "2025-05-03T08:07:21.609Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	done	{}	2025-05-03 08:08:20.948454+00	2025-05-03 08:08:20.948458+00	f	\N
d7c0bc7e-4e13-48ec-b638-ff347f57920b	78cd9800-0d7c-40be-a5c5-dae4c57436f4	{"last": {"unit": "mk", "value": "34", "recorded_at": "2025-05-03T08:12:59.276Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	delivered	{}	2025-05-03 08:13:31.998479+00	2025-05-03 08:13:31.998482+00	f	\N
7228e076-600e-4fad-9194-07b78c47eb06	fdd71039-eb10-4a01-a64b-eb43e73b2f11	{"kelay": {"unit": "kg", "value": "88", "recorded_at": "2025-05-03T08:19:02.190Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "98"}}	got it	{}	2025-05-03 08:19:41.120813+00	2025-05-03 08:19:41.120815+00	f	\N
7a86f199-fca2-40e7-89be-bf0f75ac2cf9	559963b7-848c-41df-8812-aa5df5b6bf5a	{"second": {"unit": "ml", "value": "90", "recorded_at": "2025-05-03T09:13:24.568Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "89"}}	finished	{}	2025-05-03 09:13:55.995009+00	2025-05-03 09:13:55.995016+00	f	\N
fc16d07e-1b72-4646-aac8-722c2650773c	ecd9d9bd-513e-4aad-98ce-a99e859bb7eb	{"test parameter 1": {"unit": "ml", "value": "20", "recorded_at": "2025-05-03T09:20:50.503Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "70"}}	conclusion of test	{}	2025-05-03 09:21:28.719753+00	2025-05-03 09:21:28.71976+00	f	\N
59ebaf54-01ed-42af-a4d0-70f6d59f90f8	5a2455f9-ed04-4d3b-8461-9af24dd4afed	{"new parameter": {"unit": "ml", "value": "90", "recorded_at": "2025-05-03T09:39:27.592Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "80"}}	positive	{}	2025-05-03 09:39:55.506996+00	2025-05-03 09:39:55.507001+00	f	\N
cc3abe3b-5b7f-459f-86d4-b8c914d9eb9a	47c4a564-2576-472e-a594-80f721d528c4	{"new parameter": {"unit": "dl", "value": "90", "recorded_at": "2025-05-03T09:51:50.250Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "99"}}	diseas identified	{}	2025-05-03 09:52:35.609934+00	2025-05-03 09:52:35.609937+00	f	\N
5f3bf49d-96b2-4b1f-ab69-c98fd90d15eb	f0511d82-c455-4dcd-8566-ab3324d90b62	{"trial test parameter": {"unit": "mg", "value": "77", "recorded_at": "2025-05-03T09:58:45.179Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	worsening	{}	2025-05-03 09:59:31.340435+00	2025-05-03 09:59:31.340441+00	f	\N
0028f08f-9da3-456f-9d44-61ad2893807d	086c6d5f-6320-4c4b-8373-4ca822ffdcc6	{"lets test it": {"unit": "ml", "value": "55", "recorded_at": "2025-05-03T12:30:02.404Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "44"}}	heal him	{}	2025-05-03 12:30:46.852054+00	2025-05-03 12:30:46.852066+00	f	\N
e3a7b6d8-0ace-4e24-bb48-2efe049e5d38	c765ad74-00f3-4643-b8f9-56e7a0c6672f	{"socket trial": {"unit": "dl", "value": "99", "recorded_at": "2025-05-03T13:02:31.289Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "22"}}	needs attention 	{}	2025-05-03 13:03:14.153644+00	2025-05-03 13:03:14.153651+00	f	\N
57c442a0-d573-4d04-aef8-e96554a5bf18	be3da0f7-65a7-416e-8d01-bf797dadc8f7	{"trial 2": {"unit": "dl", "value": "55", "recorded_at": "2025-05-03T13:26:51.154Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "78"}}	check notification	{}	2025-05-03 13:27:33.433156+00	2025-05-03 13:27:33.433161+00	f	\N
ae73cd8f-33f0-423b-93f9-377d5e8967a7	ecc0c0a2-913d-4d78-b23f-1b133926299e	{"last notify": {"unit": "lk", "value": "88", "recorded_at": "2025-05-03T14:53:50.094Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "79"}}	check delivery test	{}	2025-05-03 14:54:29.653944+00	2025-05-03 14:54:29.653951+00	f	\N
30b0d3e4-2674-465f-9e55-1be01b4b220d	861f53fc-a942-4405-a05c-49da7305c95e	{"last notification test": {"unit": "dl", "value": "90", "recorded_at": "2025-05-03T15:32:55.240Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "80"}}	accepted test notification	{}	2025-05-03 15:33:39.942578+00	2025-05-03 15:33:39.942581+00	f	\N
ddfa651b-1e8f-45b9-8dcc-de133dfb595f	ab2edc8d-ed3c-401a-99a6-f7127436facd	{"mepa": {"unit": "mg", "value": "34", "recorded_at": "2025-05-08T12:54:24.865Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	newly	{}	2025-05-08 12:55:23.299008+00	2025-05-08 12:55:23.299014+00	f	\N
237e5db3-c7e9-477e-bb0f-c4fca80ad121	870b9a7a-cb30-4eb7-87f1-6fa78c6e9b59	{"trial4": {"unit": "dl", "value": "90", "recorded_at": "2025-05-08T13:09:28.687Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	newly coming	{}	2025-05-08 13:10:25.074009+00	2025-05-08 13:10:25.074013+00	f	\N
aefdcfe2-3a08-4b34-ac9b-030d36cdfd63	57c65bc3-17a8-43e9-ba72-19bbb765c517	{"ty": {"unit": "kj", "value": "78", "recorded_at": "2025-05-08T15:19:52.141Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "56"}}	rtyu	{}	2025-05-08 15:20:23.98685+00	2025-05-08 15:20:23.986859+00	f	\N
ad8b93e3-aa59-47a4-bb98-c12e4bf90d0c	c05b5fcb-6100-4da5-9bd7-8e9b694804ac	{"notify 2": {"unit": "mk", "value": "34", "recorded_at": "2025-05-03T07:49:28.726Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	test delivery	{}	2025-05-03 07:50:02.870616+00	2025-05-03 07:50:02.870619+00	t	2025-05-21 08:06:43.153421+00
451d99f7-c6ee-4707-adcf-6896a11071e6	118bff6f-e5d1-4d7a-8e94-03e47d13db96	{"try": {"unit": "dl", "value": "88", "recorded_at": "2025-05-08T11:50:04.678Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	xbsma	{}	2025-05-08 11:50:26.086644+00	2025-05-08 11:50:26.086649+00	t	2025-05-21 08:10:25.325848+00
268280d9-f85a-46ca-999c-5ab4893ce0d8	5fc07be1-e69e-447a-ac62-25ff0c52b9fb	{"new test": {"unit": "dl", "value": "78", "recorded_at": "2025-05-08T11:46:53.773Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "90"}}	try net	{}	2025-05-08 11:47:32.626357+00	2025-05-08 11:47:32.626364+00	t	2025-05-21 08:10:50.539291+00
a6839c4a-5836-43c5-8805-4fbb7754a655	489ed4e0-81b1-4854-a486-93c81874f8f4	{"glucose": {"unit": "dl", "value": "99", "updated_at": "2025-05-21T08:51:40.437446", "updated_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "recorded_at": "2025-05-21T06:40:57.891Z", "recorded_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "normal_range": "80"}}	attaced	{}	2025-05-21 06:41:59.923578+00	2025-05-21 08:51:40.437529+00	f	\N
\.


--
-- Data for Name: result_images; Type: TABLE DATA; Schema: public; Owner: labroom_user
--

COPY public.result_images (id, result_id, file_path, file_name, file_size, file_type, description, uploaded_by, created_at) FROM stdin;
03ed76a9-7055-4361-a2a5-da650cd95680	a6839c4a-5836-43c5-8805-4fbb7754a655	/uploads/a6839c4a-5836-43c5-8805-4fbb7754a655/20250521085255_9f46759806c848399b4e1f93be4687eb_aqua 1.png	20250521085255_9f46759806c848399b4e1f93be4687eb_aqua 1.png	27383	image/png	\N	3fa85f64-5717-4562-b3fc-2c963f66afa6	2025-05-21 08:52:56.122424+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: labroom_user
--

COPY public.users (id, email, full_name, role, department, is_active, created_at, updated_at) FROM stdin;
dffb0212-2de8-4cc3-a3ea-8e47e03b7b01	ebrahimjenberupapa33@gmail.com	lantech6	labroom	Cardiology	t	2025-04-17 17:17:31.459005+00	2025-04-17 17:17:31.459005+00
0a8f18ea-6563-45b5-8283-0f45b7c16656	ebrahimjenberuyy@gmail.com	card5	cardroom	Cardiology	t	2025-04-17 21:01:02.73646+00	2025-04-17 21:01:02.73646+00
d6be7a66-a5d5-461e-9df2-8bf225536c39	ebrahimjenberu177@gmail.com	labtech7	labroom	Cardiology	t	2025-04-18 05:27:01.066424+00	2025-04-18 05:27:01.066424+00
940b883c-60b3-430f-811d-3b6491ebe2f7	ebrahimjenberupap23a@gmail.com	labtech8	labroom	Pulmonology	t	2025-04-18 08:51:04.356935+00	2025-04-18 08:51:04.356935+00
1876b65b-c8ba-4f3d-b15b-9d675b6afb7e	ebrahimjenberupapa10@gmail.com	labtech10	labroom	Dermatology	t	2025-04-18 20:37:08.168207+00	2025-04-18 20:37:08.168207+00
fe6fdaf1-0cbf-4c63-bad6-8db0bf919441	ebrahimjenberu234@gmail.com	labtech19	labroom	Pulmonology	t	2025-04-18 09:02:23.910864+00	2025-04-18 20:50:22.050724+00
577a3f52-4607-44da-9e9d-7144fe4e95f0	ebrahimjenberu1980@gmail.com	labtech11	labroom	Cardiology	t	2025-04-19 05:53:52.434885+00	2025-04-19 05:53:52.434885+00
a8684839-be39-45c4-beb4-a012911a9fd8	ebrahimjenberu777@gmail.com	tesfaye	doctor	Neurology	t	2025-04-29 08:11:28.354228+00	2025-04-29 08:11:28.354228+00
b0381851-9549-4a99-a7aa-bf35988fc448	hakika@gmail.com	hakika	admin	Cardiology	f	2025-04-20 19:45:05.445612+00	2025-05-01 11:43:52.065166+00
9289434d-2509-4293-a687-fa7bba301beb	newly@example.com	newly	admin	cardiology	f	2025-04-18 21:00:44.394337+00	2025-05-01 11:44:12.501185+00
5092371d-30a3-41e7-8596-aeb57448517d	ebrahimjenberunew@gmail.com	new	labroom	Cardiology	f	2025-04-17 20:45:22.050816+00	2025-05-01 11:44:41.787773+00
348059d9-585e-4880-be73-7bb4c17f5b19	ebrahimjenberu5@gmail.com	wubu	doctor	Cardiology	t	2025-05-02 07:24:32.872345+00	2025-05-02 07:24:32.872345+00
0b2f8016-1d6b-4dee-b135-afdf4ce4cc85	ebrahimjenberu17@gmail.com	labtech4	labroom	Neurology	f	2025-05-19 13:46:10.207651+00	2025-05-19 13:46:10.207651+00
65077748-4977-463d-9fd7-3ec692702fc9	jenberuebrahim@gmail.com	pass check	admin	Cardiology	f	2025-05-19 12:34:34.402576+00	2025-05-21 09:48:20.086688+00
835bfa4b-c812-4f7b-b7dd-11909290facd	labtech27@gmail.com	labtech27	labroom	Neurology	f	2025-04-19 08:00:31.21408+00	2025-05-21 09:49:34.387699+00
12cb6c53-aa5e-4848-b6bd-f1fb6035e141	ebrahimjenberu879@gmail.com	labtech97	labroom	Pulmonology	f	2025-04-19 06:02:07.504437+00	2025-05-21 09:50:07.789212+00
\.


--
-- Name: analytics_metrics analytics_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.analytics_metrics
    ADD CONSTRAINT analytics_metrics_pkey PRIMARY KEY (id);


--
-- Name: lab_notifications lab_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.lab_notifications
    ADD CONSTRAINT lab_notifications_pkey PRIMARY KEY (id);


--
-- Name: lab_reports lab_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.lab_reports
    ADD CONSTRAINT lab_reports_pkey PRIMARY KEY (id);


--
-- Name: lab_request_events lab_request_events_pkey; Type: CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.lab_request_events
    ADD CONSTRAINT lab_request_events_pkey PRIMARY KEY (id);


--
-- Name: lab_requests lab_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.lab_requests
    ADD CONSTRAINT lab_requests_pkey PRIMARY KEY (id);


--
-- Name: lab_results lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_pkey PRIMARY KEY (id);


--
-- Name: result_images result_images_pkey; Type: CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.result_images
    ADD CONSTRAINT result_images_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_analytics_metrics_metric_date; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_analytics_metrics_metric_date ON public.analytics_metrics USING btree (metric_date);


--
-- Name: idx_lab_notifications_lab_request_id; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_notifications_lab_request_id ON public.lab_notifications USING btree (lab_request_id);


--
-- Name: idx_lab_notifications_recipient_id; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_notifications_recipient_id ON public.lab_notifications USING btree (recipient_id);


--
-- Name: idx_lab_request_events_event_type; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_request_events_event_type ON public.lab_request_events USING btree (event_type);


--
-- Name: idx_lab_request_events_lab_request_id; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_request_events_lab_request_id ON public.lab_request_events USING btree (lab_request_id);


--
-- Name: idx_lab_requests_created_at; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_created_at ON public.lab_requests USING btree (created_at DESC) WHERE (is_deleted = false);


--
-- Name: idx_lab_requests_created_id; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_created_id ON public.lab_requests USING btree (created_at DESC, id DESC) WHERE (is_deleted = false);


--
-- Name: idx_lab_requests_doctor_id; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_doctor_id ON public.lab_requests USING btree (doctor_id);


--
-- Name: idx_lab_requests_is_read; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_is_read ON public.lab_requests USING btree (is_read) WHERE (is_deleted = false);


--
-- Name: idx_lab_requests_optimized; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_optimized ON public.lab_requests USING btree (status, priority, test_type, created_at DESC) WHERE (is_deleted = false);


--
-- Name: idx_lab_requests_pagination; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_pagination ON public.lab_requests USING btree (created_at DESC, id DESC) WHERE (is_deleted = false);


--
-- Name: idx_lab_requests_patient_doctor; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_patient_doctor ON public.lab_requests USING btree (patient_id, doctor_id) WHERE (is_deleted = false);


--
-- Name: idx_lab_requests_patient_id; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_patient_id ON public.lab_requests USING btree (patient_id);


--
-- Name: idx_lab_requests_priority_status; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_priority_status ON public.lab_requests USING btree (priority, status) WHERE (is_deleted = false);


--
-- Name: idx_lab_requests_status; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_status ON public.lab_requests USING btree (status) WHERE (is_deleted = false);


--
-- Name: idx_lab_requests_technician; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_technician ON public.lab_requests USING btree (technician_id, created_at DESC) WHERE (is_deleted = false);


--
-- Name: idx_lab_requests_technician_id; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_technician_id ON public.lab_requests USING btree (technician_id);


--
-- Name: idx_lab_requests_test_type; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_requests_test_type ON public.lab_requests USING btree (test_type) WHERE (is_deleted = false);


--
-- Name: idx_lab_results_created_at; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_results_created_at ON public.lab_results USING btree (created_at DESC);


--
-- Name: idx_lab_results_lab_request_id; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_results_lab_request_id ON public.lab_results USING btree (lab_request_id);


--
-- Name: idx_lab_results_request; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_results_request ON public.lab_results USING btree (lab_request_id, created_at DESC) WHERE (is_deleted = false);


--
-- Name: idx_lab_results_request_id; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_results_request_id ON public.lab_results USING btree (lab_request_id, created_at DESC) WHERE (is_deleted = false);


--
-- Name: idx_lab_results_request_id_created; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_lab_results_request_id_created ON public.lab_results USING btree (lab_request_id, created_at DESC) WHERE (is_deleted = false);


--
-- Name: idx_result_images_result_id; Type: INDEX; Schema: public; Owner: labroom_user
--

CREATE INDEX idx_result_images_result_id ON public.result_images USING btree (result_id, created_at DESC);


--
-- Name: lab_results fk_lab_request; Type: FK CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT fk_lab_request FOREIGN KEY (lab_request_id) REFERENCES public.lab_requests(id) ON DELETE CASCADE;


--
-- Name: lab_notifications lab_notifications_lab_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.lab_notifications
    ADD CONSTRAINT lab_notifications_lab_request_id_fkey FOREIGN KEY (lab_request_id) REFERENCES public.lab_requests(id);


--
-- Name: lab_notifications lab_notifications_lab_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.lab_notifications
    ADD CONSTRAINT lab_notifications_lab_result_id_fkey FOREIGN KEY (lab_result_id) REFERENCES public.lab_results(id);


--
-- Name: lab_request_events lab_request_events_lab_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.lab_request_events
    ADD CONSTRAINT lab_request_events_lab_request_id_fkey FOREIGN KEY (lab_request_id) REFERENCES public.lab_requests(id) ON DELETE CASCADE;


--
-- Name: lab_results lab_results_lab_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_lab_request_id_fkey FOREIGN KEY (lab_request_id) REFERENCES public.lab_requests(id);


--
-- Name: result_images result_images_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: labroom_user
--

ALTER TABLE ONLY public.result_images
    ADD CONSTRAINT result_images_result_id_fkey FOREIGN KEY (result_id) REFERENCES public.lab_results(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

