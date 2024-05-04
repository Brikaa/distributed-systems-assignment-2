CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TYPE role AS ENUM ('ADMIN', 'STUDENT', 'INSTRUCTOR');


CREATE TABLE AppUser (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password varchar(255) NOT NULL,
    role role NOT NULL,
    experience SMALLINT NOT NULL,
    bio TEXT NOT NULL
);

INSERT INTO
    AppUser(name, email, password, role, experience, bio)
    VALUES ('admin', 'admin@admin.com', 'admin', 'ADMIN', 0, 'This is an admin account');

CREATE TABLE Course (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instructorId UUID NOT NULL REFERENCES AppUser (id) ON DELETE CASCADE,
    name VARCHAR(1024) NOT NULL,
    description TEXT NOT NULL,
    startDate TIMESTAMP NOT NULL,
    endDate TIMESTAMP NOT NULL,
    category VARCHAR(255) NOT NULL,
    capacity INTEGER NOT NULL
);
