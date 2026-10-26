CREATE TABLE product_group_catalog (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    payload_json TEXT NOT NULL,
    updated_by VARCHAR(120) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
