CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TYPE enrollmentStatus AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
CREATE TYPE courseStatus AS ENUM ('ACCEPTED', 'PENDING');

CREATE TABLE Course (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instructorId UUID NOT NULL,
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
    studentId UUID NOT NULL,
    courseId UUID NOT NULL REFERENCES Course (id) ON DELETE CASCADE,
    stars int NOT NULL,
    body TEXT NOT NULL,
    UNIQUE (studentId, courseId)
);

CREATE TABLE Notification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userId UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    body VARCHAR(1024) NOT NULL,
    isRead BOOLEAN NOT NULL
);

CREATE TABLE Enrollment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    studentId UUID NOT NULL,
    courseId UUID NOT NULL REFERENCES Course (id) ON DELETE CASCADE,
    status enrollmentStatus NOT NULL,
    UNIQUE (studentId, courseId)
);
