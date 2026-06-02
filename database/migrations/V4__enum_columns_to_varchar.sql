-- Fixes Docker PostgreSQL enum column incompatibility with JPA EnumType.STRING after Flyway bootstrap.
-- Hibernate binds enum values as VARCHAR, so these persisted columns must be VARCHAR too.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'role'
          AND udt_name = 'user_role'
    ) THEN
        ALTER TABLE users
            ALTER COLUMN role DROP DEFAULT;
        ALTER TABLE users
            ALTER COLUMN role TYPE VARCHAR(50) USING role::text;
        ALTER TABLE users
            ALTER COLUMN role SET DEFAULT 'CITIZEN';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'issues'
          AND column_name = 'category'
          AND udt_name = 'issue_category'
    ) THEN
        ALTER TABLE issues
            ALTER COLUMN category TYPE VARCHAR(50) USING category::text;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'issues'
          AND column_name = 'status'
          AND udt_name = 'issue_status'
    ) THEN
        ALTER TABLE issues
            ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE issues
            ALTER COLUMN status TYPE VARCHAR(50) USING status::text;
        ALTER TABLE issues
            ALTER COLUMN status SET DEFAULT 'REPORTED';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'issues'
          AND column_name = 'severity'
          AND udt_name = 'severity_level'
    ) THEN
        ALTER TABLE issues
            ALTER COLUMN severity DROP DEFAULT;
        ALTER TABLE issues
            ALTER COLUMN severity TYPE VARCHAR(50) USING severity::text;
        ALTER TABLE issues
            ALTER COLUMN severity SET DEFAULT 'LOW';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'issue_media'
          AND column_name = 'media_type'
          AND udt_name = 'media_type'
    ) THEN
        ALTER TABLE issue_media
            ALTER COLUMN media_type TYPE VARCHAR(50) USING media_type::text;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'issue_status_history'
          AND column_name = 'old_status'
          AND udt_name = 'issue_status'
    ) THEN
        ALTER TABLE issue_status_history
            ALTER COLUMN old_status TYPE VARCHAR(50) USING old_status::text;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'issue_status_history'
          AND column_name = 'new_status'
          AND udt_name = 'issue_status'
    ) THEN
        ALTER TABLE issue_status_history
            ALTER COLUMN new_status TYPE VARCHAR(50) USING new_status::text;
    END IF;
END $$;
