-- Auto-generated from 20260121134608_7dfe977e-3b33-47b5-9db1-44e762403216.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Fix the update_updated_at function to include search_path
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER

  RETURN NEW;
END;
$$;
