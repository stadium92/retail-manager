-- Auto-generated from 20260125031629_cbe22d2d-68b9-4cd1-a72c-529aa1c4ed5f.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Fix update_updated_at_column function to 
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
