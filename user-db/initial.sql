CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TYPE role AS ENUM ('ADMIN', 'STUDENT', 'INSTRUCTOR');


CREATE TABLE AppUser (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password varchar(255) NOT NULL,
    role role NOT NULL,
    experience SMALLINT NOT NULL,
    bio TEXT NOT NULL,
    affiliation varchar(255) NOT NULL
);

INSERT INTO AppUser(name, email, password, role, experience, bio, affiliation) VALUES ('admin', 'admin@admin.com', 'admin', 'ADMIN', 0, 'This is an admin account', 'Admin university');
