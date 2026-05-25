-- Role alignment helper
-- MANUAL SQL ONLY.
-- Safe for databases using VARCHAR roles.
-- If your database uses a PostgreSQL enum named user_role, this extends it.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'WORKER';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;

        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPERVISOR';
        EXCEPTION WHEN duplicate_object THEN
            NULL;
        END;
    END IF;
END $$;
