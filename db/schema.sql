-- Hintaopas — PostgreSQL schema (stage 1)
-- Product information and retailer prices live in separate tables.
-- Prices are append-only observations: history comes for free and nothing is overwritten.

CREATE TABLE countries (
  code        char(2) PRIMARY KEY,            -- 'FI'
  currency    char(3) NOT NULL                 -- 'EUR'
);

CREATE TABLE chains (
  id          text PRIMARY KEY,                -- 's-group', 'k-group', 'lidl', 'tokmanni'
  name        text NOT NULL,
  country     char(2) NOT NULL REFERENCES countries(code)
);

CREATE TABLE retailers (                       -- store banners: Prisma, K-Citymarket, ...
  id          text PRIMARY KEY,
  chain_id    text NOT NULL REFERENCES chains(id),
  name        text NOT NULL
);

CREATE TABLE stores (                          -- physical stores; K-group prices are per store
  id          bigserial PRIMARY KEY,
  retailer_id text NOT NULL REFERENCES retailers(id),
  external_id text,                            -- the retailer's own store id
  name        text NOT NULL,
  city        text,
  lat         double precision,
  lon         double precision,
  UNIQUE (retailer_id, external_id)
);

CREATE TABLE data_sources (                    -- every price says where it came from
  id          text PRIMARY KEY,                -- 'sample', 'k-ruoka', 's-kaupat', 'open-food-facts'
  kind        text NOT NULL CHECK (kind IN ('sample', 'retailer', 'catalogue', 'user')),
  description text
);

CREATE TABLE categories (
  id          text PRIMARY KEY,
  parent_id   text REFERENCES categories(id),
  name_fi     text NOT NULL,
  name_en     text NOT NULL
);

CREATE TABLE products (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  brand       text,
  category_id text REFERENCES categories(id),
  size_amount numeric,                         -- 500
  size_unit   text CHECK (size_unit IN ('g', 'ml', 'pcs')),
  image_url   text,
  info_source text REFERENCES data_sources(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_codes (                   -- one product can have several EAN/GTINs
  code        text PRIMARY KEY,                -- EAN-13 / EAN-8 / UPC
  product_id  bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE retailer_products (               -- how a retailer identifies the product
  retailer_id text NOT NULL REFERENCES retailers(id),
  external_id text NOT NULL,
  product_id  bigint NOT NULL REFERENCES products(id),
  PRIMARY KEY (retailer_id, external_id)
);

CREATE TABLE price_observations (
  id           bigserial PRIMARY KEY,
  product_id   bigint NOT NULL REFERENCES products(id),
  retailer_id  text   NOT NULL REFERENCES retailers(id),
  store_id     bigint REFERENCES stores(id),   -- null = chain-wide price
  price_cents  integer NOT NULL CHECK (price_cents > 0),
  unit_price_cents integer,                    -- as reported by the retailer, if any
  is_promotion boolean NOT NULL DEFAULT false,
  promo_ends   date,
  source_id    text NOT NULL REFERENCES data_sources(id),
  observed_at  timestamptz NOT NULL
);
CREATE INDEX price_obs_latest ON price_observations (product_id, retailer_id, observed_at DESC);

-- Latest observation per product and retailer; staleness is decided by the app (7 days).
CREATE VIEW latest_prices AS
SELECT DISTINCT ON (product_id, retailer_id, store_id) *
FROM price_observations
ORDER BY product_id, retailer_id, store_id, observed_at DESC;

-- User data
CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shopping_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL
);

CREATE TABLE shopping_list_items (
  list_id     uuid NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  product_id  bigint NOT NULL REFERENCES products(id),
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (list_id, product_id)
);

CREATE TABLE favorites (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  bigint NOT NULL REFERENCES products(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
