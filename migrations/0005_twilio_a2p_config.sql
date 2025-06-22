CREATE TABLE IF NOT EXISTS twilio_a2p_config (
    id serial PRIMARY KEY,
    business_id integer NOT NULL REFERENCES businesses(id) UNIQUE,
    use_cases text[] NOT NULL,
    volume text NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);
