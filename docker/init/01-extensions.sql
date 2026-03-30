-- PostgreSQL extensions required for spatial event queries (ll_to_earth function).
-- This runs automatically when the ceolx_postgres Docker container first starts.
-- For Neon branches, run this manually once via the Neon SQL editor before migrating.

CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
