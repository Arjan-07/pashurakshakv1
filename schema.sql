-- PostgreSQL/PostGIS production target schema (MVP uses FastAPI in-memory storage).
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE users (id uuid PRIMARY KEY, role text NOT NULL, name text NOT NULL, phone text UNIQUE);
CREATE TABLE farms (id uuid PRIMARY KEY, farmer_id uuid REFERENCES users(id), name text, location geography(Point,4326));
CREATE TABLE animals (id uuid PRIMARY KEY, farm_id uuid REFERENCES farms(id), species text, breed text, sex text, birth_date date);
CREATE TABLE health_reports (id uuid PRIMARY KEY, animal_id uuid REFERENCES animals(id), affected_animals int NOT NULL, symptoms jsonb, severity text, deaths int DEFAULT 0, vaccination text, description text, location geography(Point,4326), created_at timestamptz DEFAULT now());
CREATE INDEX health_reports_location_idx ON health_reports USING gist(location);
CREATE INDEX health_reports_created_idx ON health_reports(created_at);
CREATE TABLE clusters (id uuid PRIMARY KEY, risk_score int, status text, location geography(Point,4326), created_at timestamptz DEFAULT now());
CREATE TABLE investigations (id uuid PRIMARY KEY, cluster_id uuid REFERENCES clusters(id), assigned_worker uuid REFERENCES users(id), status text, notes text);
CREATE TABLE samples (id uuid PRIMARY KEY, investigation_id uuid REFERENCES investigations(id), sample_type text, status text, collected_at timestamptz);
CREATE TABLE lab_results (id uuid PRIMARY KEY, sample_id uuid REFERENCES samples(id), status text, result text, report_url text);
CREATE TABLE alerts (id uuid PRIMARY KEY, cluster_id uuid REFERENCES clusters(id), priority text, message text, created_at timestamptz DEFAULT now());
CREATE TABLE advisories (id uuid PRIMARY KEY, title text, body text, location geography(Point,4326));
CREATE TABLE audit_logs (id uuid PRIMARY KEY, user_id uuid, action text, entity text, entity_id uuid, created_at timestamptz DEFAULT now());
