CREATE TABLE items (
  id               BIGSERIAL PRIMARY KEY,
  barcode          TEXT UNIQUE,
  name             TEXT NOT NULL,
  brand            TEXT,
  location         TEXT NOT NULL DEFAULT 'pantry'
                   CHECK (location IN ('pantry', 'fridge', 'freezer', 'other')),
  unit             TEXT NOT NULL DEFAULT 'count',
  quantity         NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity     NUMERIC(12, 3) CHECK (min_quantity >= 0),
  target_quantity  NUMERIC(12, 3) CHECK (target_quantity >= 0),
  track_shopping   BOOLEAN NOT NULL DEFAULT TRUE,
  snoozed_until    TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX items_name_idx ON items (lower(name));

CREATE TABLE inventory_events (
  id              BIGSERIAL PRIMARY KEY,
  item_id         BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  delta           NUMERIC(12, 3) NOT NULL,
  quantity_after  NUMERIC(12, 3) NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('create', 'scan_in', 'scan_out', 'adjust', 'set')),
  source          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX inventory_events_item_time_idx ON inventory_events (item_id, created_at DESC);

CREATE TABLE shopping_extras (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  quantity    NUMERIC(12, 3) NOT NULL DEFAULT 1,
  checked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  JSONB NOT NULL
);

INSERT INTO settings (key, value) VALUES
  ('defaultMinQuantity', '1'),
  ('lookaheadDays', '7'),
  ('usageWindowDays', '30');
