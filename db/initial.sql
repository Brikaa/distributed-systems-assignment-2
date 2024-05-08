CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TYPE role AS ENUM ('ADMIN', 'STUDENT', 'INSTRUCTOR');
CREATE TYPE enrollmentStatus AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE courseStatus AS ENUM ('ACCEPTED', 'PENDING');


CREATE TABLE AppUser (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
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
    startDate BIGINT NOT NULL,
    endDate BIGINT NOT NULL,
    category VARCHAR(255) NOT NULL,
    capacity INTEGER NOT NULL,
    status courseStatus NOT NULL
);

CREATE TABLE Review (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    studentId UUID NOT NULL REFERENCES AppUser (id) ON DELETE CASCADE,
    courseId UUID NOT NULL REFERENCES Course (id) ON DELETE CASCADE,
    stars int NOT NULL,
    body TEXT NOT NULL,
    UNIQUE (studentId, courseId)
);

CREATE TABLE Notification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userId UUID NOT NULL REFERENCES AppUser (id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body VARCHAR(1024) NOT NULL,
    isRead BOOLEAN NOT NULL
);

CREATE TABLE Enrollment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    studentId UUID NOT NULL REFERENCES AppUser (id) ON DELETE CASCADE,
    courseId UUID NOT NULL REFERENCES Course (id) ON DELETE CASCADE,
    status enrollmentStatus NOT NULL
);
