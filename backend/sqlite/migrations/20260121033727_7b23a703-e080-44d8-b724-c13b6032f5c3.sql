-- Auto-generated from 20260121033727_7b23a703-e080-44d8-b724-c13b6032f5c3.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Drop the problematic trigger that auto-assigns master role to all users
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Create a new smarter function that only assigns master role for self-signups
-- (when the user signs up directly, not when created by admin API)
CREATE OR REPLACE FUNCTION handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER

  END IF;
  RETURN new;
END;
$$;

-- Recreate the trigger with the updated function
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user_role();

-- Clean up duplicate master roles for users who should only be workers
-- Delete the auto-created master roles for users who have a worker role with a store_id
DELETE FROM user_roles 
WHERE role = 'master' 
AND store_id IS NULL 
AND user_id IN (
  SELECT user_id FROM user_roles WHERE role = 'worker' AND store_id IS NOT NULL
);
