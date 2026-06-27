import psycopg2

def list_users():
    db_name = 'postgres'
    db_user = 'postgres.onsqvduklnwffugsiybs'
    db_pass = 'dyjdop-biqguv-kAmti0'
    db_port = 6543
    host_name = "aws-1-us-east-1.pooler.supabase.com"

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
        
        # 1. Query auth.users
        print("--- AUTH.USERS ---")
        cur.execute("SELECT id, email, email_confirmed_at, last_sign_in_at FROM auth.users;")
        users = cur.fetchall()
        for u in users:
            uid, email, confirmed_at, last_signin = u
            print(f"ID: {uid} | Email: {email} | Confirmed: {confirmed_at} | Last Signin: {last_signin}")
            
        # 2. Query public.user_roles
        print("\n--- PUBLIC.USER_ROLES ---")
        cur.execute("SELECT id, user_id, role, store_id FROM public.user_roles;")
        roles = cur.fetchall()
        for r in roles:
            rid, uid, role, store_id = r
            print(f"Role ID: {rid} | User ID: {uid} | Role: {role} | Store ID: {store_id}")

        cur.close()
        conn.close()
    except Exception as e:
        print("Failed to query database:", e)

if __name__ == "__main__":
    list_users()
