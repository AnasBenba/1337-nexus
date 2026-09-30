CREATE ROLE nexus_app
    LOGIN
    PASSWORD 'nexus_app_password';

CREATE ROLE nexus_migrator
    LOGIN
    PASSWORD 'nexus_migrator_password';

GRANT CONNECT ON DATABASE nexus TO nexus_app;
GRANT CONNECT ON DATABASE nexus TO nexus_migrator;

\connect nexus

GRANT USAGE ON SCHEMA public TO nexus_app;
GRANT USAGE, CREATE ON SCHEMA public TO nexus_migrator;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA public
    TO nexus_app;

GRANT USAGE, SELECT, UPDATE
    ON ALL SEQUENCES IN SCHEMA public
    TO nexus_app;

ALTER DEFAULT PRIVILEGES FOR ROLE nexus IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLES TO nexus_app;

ALTER DEFAULT PRIVILEGES FOR ROLE nexus IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE
    ON SEQUENCES TO nexus_app;