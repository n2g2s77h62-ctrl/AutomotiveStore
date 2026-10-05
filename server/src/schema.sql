PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  article TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  price_kopecks INTEGER NOT NULL CHECK (price_kopecks >= 0),
  old_price_kopecks INTEGER CHECK (old_price_kopecks IS NULL OR old_price_kopecks >= price_kopecks),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  image_url TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vehicle_fitments (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  make TEXT NOT NULL COLLATE NOCASE,
  model TEXT NOT NULL COLLATE NOCASE,
  year_from INTEGER NOT NULL,
  year_to INTEGER NOT NULL,
  engine_code TEXT,
  CHECK (year_to >= year_from),
  UNIQUE (product_id, make, model, year_from, year_to, engine_code)
);

DELETE FROM vehicle_fitments
WHERE id NOT IN (
  SELECT MIN(id)
  FROM vehicle_fitments
  GROUP BY product_id, make, model, year_from, year_to, COALESCE(engine_code, '')
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_fitments_unique_idx
  ON vehicle_fitments(product_id, make, model, year_from, year_to, COALESCE(engine_code, ''));

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('retail', 'business')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company_name TEXT,
  tax_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_tax_id_unique
  ON customers(tax_id) WHERE tax_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_prices (
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_kopecks INTEGER NOT NULL CHECK (price_kopecks >= 0),
  PRIMARY KEY (customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS business_leads (
  id INTEGER PRIMARY KEY,
  company_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('retail', 'business')),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled')),
  total_kopecks INTEGER NOT NULL CHECK (total_kopecks >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  article_snapshot TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_kopecks INTEGER NOT NULL CHECK (unit_price_kopecks >= 0),
  line_total_kopecks INTEGER NOT NULL CHECK (line_total_kopecks >= 0)
);

CREATE INDEX IF NOT EXISTS products_category_active_idx ON products(category_id, is_active);
CREATE INDEX IF NOT EXISTS products_name_idx ON products(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS vehicle_fitments_lookup_idx ON vehicle_fitments(make, model, year_from, year_to);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);