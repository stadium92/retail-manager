import psycopg2

def fix_emails():
    db_name = 'postgres'
    db_user = 'postgres.onsqvduklnwffugsiybs'
    db_pass = 'dyjdop-biqguv-kAmti0'
    db_port = 6543
    host_name = "aws-1-us-east-1.pooler.supabase.com"

    print(f"Connecting to database {host_name}:{db_port} as {db_user}...")
    try:
        conn = psycopg2.connect(
            dbname=db_name,
            user=db_user,
            password=db_pass,
            host=host_name,
            port=db_port,
            sslmode='require'
        )
        cur = conn.cursor()
        print("Connected successfully. Updating profiles emails and handle_new_user trigger...")

        sql_commands = """
        -- 1. Backfill existing emails from auth.users to public.profiles
        UPDATE public.profiles p
        SET email = u.email
        FROM auth.users u
        WHERE p.id = u.id;

        -- 2. Update handle_new_user trigger function to include email column
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
          profile_full_name TEXT;
          avatar TEXT;
        BEGIN
          profile_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
          avatar := COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL);

          INSERT INTO public.profiles (id, email, full_name, avatar_url)
          VALUES (NEW.id, NEW.email, profile_full_name, avatar)
          ON CONFLICT (id) DO UPDATE
            SET email = EXCLUDED.email,
                full_name = EXCLUDED.full_name,
                avatar_url = EXCLUDED.avatar_url,
                updated_at = now();

          RETURN NEW;
        END;
        $$;
        """
        cur.execute(sql_commands)
        conn.commit()
        print("Profile emails fixed successfully!")
        
        cur.close()
        conn.close()
    except Exception as e:
        print("Connection or execution failed:", e)

if __name__ == "__main__":
    fix_emails()
