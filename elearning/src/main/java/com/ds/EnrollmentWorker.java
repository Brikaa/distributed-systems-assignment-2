package com.ds;

import jakarta.ejb.MessageDriven;
import jakarta.jms.JMSException;
import jakarta.jms.Message;
import jakarta.jms.MessageListener;
import jakarta.jms.TextMessage;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import jakarta.ejb.ActivationConfigProperty;
import jakarta.ejb.EJB;

@MessageDriven(activationConfig = {
        @ActivationConfigProperty(propertyName = "destinationLookup", propertyValue = "queue/enrollments"),
        @ActivationConfigProperty(propertyName = "destinationType", propertyValue = "jakarta.jms.Queue"),
        @ActivationConfigProperty(propertyName = "acknowledgeMode", propertyValue = "Auto-acknowledge") })
public class EnrollmentWorker implements MessageListener {
    @EJB
    private ApiDataSource dataSource;

    private void createNotification(Connection conn, String userId, String body) throws SQLException {
        try (PreparedStatement st = conn
                .prepareStatement("INSERT INTO Notification (userId, title, body, isRead) VALUES (?, ?, ?, ?)")) {
            st.setString(1, userId);
            st.setString(2, "Course enrollment status");
            st.setString(3, body);
            st.setBoolean(4, false);
            st.executeUpdate();
        }
    }

    private void createEnrollment(String studentId, String courseId) throws SQLException {
        try (Connection conn = dataSource.getInstance().getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement st = conn
                    .prepareStatement("SELECT id FROM enrollment WHERE studentId = ? AND courseId = ?")) {
                st.setString(1, studentId);
                st.setString(2, courseId);
                ResultSet rs = st.executeQuery();
                if (rs.next()) {
                    createNotification(conn, studentId, "Can't enroll in course with id: " + courseId
                            + " since you already had an enrollment request in it");
                    return;
                }
            } catch (Exception e) {
                e.printStackTrace();
                conn.rollback();
                throw e;
            }
            try (PreparedStatement st = conn.prepareStatement(String.format("""
                    SELECT
                        Course.id AS id,
                        Course.name AS name,
                        Course.capacity AS capacity,
                        COUNT(Enrollment.id) AS numberOfEnrollments
                    FROM
                        Course
                        LEFT JOIN Enrollment
                            ON Course.id = Enrollment.courseId
                            AND Enrollment.status = 'ACCEPTED'
                    WHERE
                        Course.id = ?
                        AND Course.status = 'ACCEPTED'
                        AND Course.startDate > %s
                        AND numberOfEnrollments < capacity
                    GROUP BY Course.id""", System.currentTimeMillis() / 1000L))) {
                st.setString(1, courseId);
                ResultSet rs = st.executeQuery();
                if (!rs.next())
                    createNotification(conn, studentId, "Can't enroll in course with id: " + courseId
                            + " since it was not found in future non-full courses.");
                else {
                    try (PreparedStatement st2 = conn.prepareStatement(
                            "INSERT INTO Enrollment (studentId, courseId, status) VALUES (?, ?, 'PENDING')")) {
                        st2.setString(1, studentId);
                        st2.setString(2, courseId);
                        st2.executeUpdate();
                        createNotification(conn, studentId, "Submitted an enrollment request for: '"
                                + rs.getString("name") + "', we will get back to you once it is accepted.");
                    }
                }
                conn.commit();
            } catch (Exception e) {
                e.printStackTrace();
                conn.rollback();
                throw e;
            }
        }
    }

    private void updateEnrollment(String instructorId, String enrollmentId, String status) throws SQLException {
        if (status.equals("ACCEPTED") || status.equals("REJECTED")) {
            System.err.println("Received invalid status: " + status);
            return;
        }

        try (Connection conn = dataSource.getInstance().getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement enrollmentSt = conn.prepareStatement(
                    "SELECT courseId, status, studentId FROM Enrollment WHERE id = ? AND status = 'PENDING'")) {
                enrollmentSt.setString(1, enrollmentId);
                ResultSet enrollmentRs = enrollmentSt.executeQuery();
                final String invalid_enrollment = "Could not find a pending enrollment with id: " + enrollmentId
                        + " that was sent to one of your non-full courses";
                if (!enrollmentRs.next()) {
                    createNotification(conn, instructorId, invalid_enrollment);
                    return;
                }
                // TODO: abstract with one in createEnrollment
                try (PreparedStatement courseSt = conn.prepareStatement(String.format("""
                        SELECT
                            Course.id AS id,
                            Course.name AS name,
                            Course.capacity AS capacity,
                            COUNT(Enrollment.id) AS numberOfEnrollments
                        FROM
                            Course
                            LEFT JOIN Enrollment
                                ON Course.id = Enrollment.courseId
                                AND Enrollment.status = 'ACCEPTED'
                        WHERE
                            Course.id = ?
                            AND Course.status = 'ACCEPTED'
                            AND Course.instructorId = ?
                            %s
                            %s
                        GROUP BY Course.id""",
                        status.equals("ACCEPTED")
                                ? ("AND Course.startDate > " + (System.currentTimeMillis() / 1000L))
                                : "",
                        status.equals("ACCEPTED")
                                ? "AND numberOfEnrollments < capacity"
                                : ""))) {
                    courseSt.setString(1, enrollmentRs.getString("courseId"));
                    courseSt.setString(2, instructorId);
                    ResultSet courseRs = courseSt.executeQuery();
                    if (!courseRs.next())
                        createNotification(conn, instructorId, invalid_enrollment);
                    try (PreparedStatement updateSt = conn
                            .prepareStatement("UPDATE Enrollment SET status = ? WHERE id = ?")) {
                        updateSt.setString(1, status);
                        updateSt.setString(2, enrollmentId);
                        if (updateSt.executeUpdate() == 0) {
                            System.err.println("Could not find an enrollment with id: " + enrollmentId);
                            return;
                        }
                        createNotification(conn, enrollmentRs.getString("studentId"),
                                "Your enrollment for " + courseRs.getString("name") + " has been "
                                        + (status.equals("ACCEPTED") ? "accepted." : "rejected."));
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    conn.rollback();
                    throw e;
                }
            }
        }
    }

    private void deleteEnrollment(String studentId, String enrollmentId) throws SQLException {
        try (Connection conn = dataSource.getInstance().getConnection();
                PreparedStatement st = conn.prepareStatement("DELETE FROM Enrollment WHERE id = ? AND studentId = ?")) {
            st.setString(1, enrollmentId);
            st.setString(2, studentId);
            if (st.executeUpdate() == 0)
                createNotification(conn, studentId,
                        "Could not find an enrollment with id: " + enrollmentId + " in your enrollments");
        }
    }

    private boolean isValidMessageBody(String[] body) {
        String op = body[0];
        boolean validCreateOrDelete = (op.equals("CREATE") || op.equals("DELETE")) && body.length == 3;
        boolean validUpdate = op.equals("UPDATE") && body.length == 4;
        return validCreateOrDelete || validUpdate;
    }

    @Override
    public void onMessage(Message rcvMessage) {
        // CREATE:studentId:courseId
        // UPDATE:instructorId:enrollmentId:ACCEPTED|REJECTED
        // DELETE:studentId:enrollmentId
        if (!(rcvMessage instanceof TextMessage)) {
            System.err.println("Received invalid message type: " + rcvMessage.getClass().toString());
            return;
        }
        TextMessage msg = (TextMessage) rcvMessage;
        try {
            String txt = msg.getText();
            String[] body = txt.split(":");
            String op = body[0];
            if (!isValidMessageBody(body))
                System.err.println("Received invalid msg: " + txt);
            else if (op.equals("CREATE"))
                createEnrollment(body[1], body[2]);
            else if (op.equals("UPDATE"))
                updateEnrollment(body[1], body[2], body[3]);
            else if (op.equals("DELETE"))
                deleteEnrollment(body[1], body[2]);
        } catch (JMSException e) {
            System.err.println("Error handling message:");
            e.printStackTrace();
        } catch (SQLException e) {
            System.err.println("Error inserting into the database:");
            e.printStackTrace();
        }
    }
}
