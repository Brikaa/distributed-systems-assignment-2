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
import java.util.UUID;

import jakarta.ejb.ActivationConfigProperty;
import jakarta.ejb.EJB;

@MessageDriven(activationConfig = {
        @ActivationConfigProperty(propertyName = "destinationLookup", propertyValue = "queue/enrollments"),
        @ActivationConfigProperty(propertyName = "destinationType", propertyValue = "jakarta.jms.Queue"),
        @ActivationConfigProperty(propertyName = "acknowledgeMode", propertyValue = "Auto-acknowledge") })
public class EnrollmentWorker implements MessageListener {
    @EJB
    private ApiDataSource dataSource;

    @EJB
    private DateTimeService dateTimeService;

    @EJB
    private MessagingFailureService messagingFailureService;

    private void createNotification(Connection conn, UUID userId, String body) throws SQLException {
        try (PreparedStatement st = conn.prepareStatement(
                "INSERT INTO Notification (userId, title, body, isRead) VALUES (?, 'Course enrollment status', ?, ?)")) {
            st.setObject(1, userId);
            st.setString(2, body);
            st.setBoolean(3, false);
            st.executeUpdate();
        }
    }

    private void createEnrollment(UUID studentId, UUID courseId) throws SQLException {
        try (Connection conn = dataSource.getInstance().getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement st = conn
                    .prepareStatement("SELECT id FROM enrollment WHERE studentId = ? AND courseId = ?")) {
                st.setObject(1, studentId);
                st.setObject(2, courseId);
                ResultSet rs = st.executeQuery();
                if (rs.next()) {
                    createNotification(conn, studentId, "Can't enroll in course with id: " + courseId
                            + " since you already had an enrollment request in it.");
                    conn.commit();
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
                    GROUP BY Course.id""", dateTimeService.getTimestamp() / 1000L))) {
                st.setObject(1, courseId);
                ResultSet rs = st.executeQuery();
                if (!rs.next())
                    createNotification(conn, studentId, "Can't enroll in course with id: " + courseId
                            + " since it was not found in future courses.");
                else if (rs.getInt("capacity") <= rs.getInt("numberOfEnrollments"))
                    createNotification(conn, studentId,
                            "Can't enroll in course of id: " + courseId + " since it is full.");
                else {
                    try (PreparedStatement st2 = conn.prepareStatement(
                            "INSERT INTO Enrollment (studentId, courseId, status) VALUES (?, ?, 'PENDING')")) {
                        st2.setObject(1, studentId);
                        st2.setObject(2, courseId);
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

    private void updateEnrollment(UUID instructorId, UUID enrollmentId, String status) throws SQLException {
        if (!status.equals("ACCEPTED") && !status.equals("REJECTED")) {
            System.err.println("Received invalid status: " + status);
            return;
        }

        try (Connection conn = dataSource.getInstance().getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement enrollmentSt = conn.prepareStatement(
                    "SELECT courseId, status, studentId FROM Enrollment WHERE id = ? AND status = 'PENDING'")) {
                enrollmentSt.setObject(1, enrollmentId);
                ResultSet enrollmentRs = enrollmentSt.executeQuery();
                final String invalidEnrollment = "Could not find a pending enrollment with id: " + enrollmentId
                        + " that was sent to one of your future courses.";
                if (!enrollmentRs.next()) {
                    createNotification(conn, instructorId, invalidEnrollment);
                    conn.commit();
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
                        GROUP BY Course.id""",
                        status.equals("ACCEPTED")
                                ? ("AND Course.startDate > " + (dateTimeService.getTimestamp() / 1000L))
                                : ""))) {
                    courseSt.setObject(1, enrollmentRs.getObject("courseId", UUID.class));
                    courseSt.setObject(2, instructorId);
                    ResultSet courseRs = courseSt.executeQuery();
                    if (!courseRs.next()) {
                        createNotification(conn, instructorId, invalidEnrollment);
                        conn.commit();
                        return;
                    }
                    if (status.equals("ACCEPTED")
                            && courseRs.getInt("capacity") <= courseRs.getInt("numberOfEnrollments")) {
                        createNotification(conn, instructorId,
                                "Can't accept enrollment of id: " + enrollmentId + " since the course is full.");
                        conn.commit();
                        return;
                    }
                    try (PreparedStatement updateSt = conn.prepareStatement(
                            String.format("UPDATE Enrollment SET status = '%s' WHERE id = ?", status))) {
                        updateSt.setObject(1, enrollmentId);
                        if (updateSt.executeUpdate() == 0) {
                            System.err.println("Could not find an enrollment with id: " + enrollmentId);
                            conn.commit();
                            return;
                        }
                        createNotification(conn, enrollmentRs.getObject("studentId", UUID.class),
                                "Your enrollment for " + courseRs.getString("name") + " has been "
                                        + (status.equals("ACCEPTED") ? "accepted." : "rejected."));
                        conn.commit();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    conn.rollback();
                    throw e;
                }
            }
        }
    }

    private void deleteEnrollment(UUID studentId, UUID enrollmentId) throws SQLException {
        try (Connection conn = dataSource.getInstance().getConnection();
                PreparedStatement st = conn.prepareStatement("DELETE FROM Enrollment WHERE id = ? AND studentId = ?")) {
            st.setObject(1, enrollmentId);
            st.setObject(2, studentId);
            if (st.executeUpdate() == 0)
                createNotification(conn, studentId,
                        "Could not find an enrollment with id: " + enrollmentId + " in your enrollments.");
            createNotification(conn, studentId, "Enrollment of id: " + enrollmentId + " was cancelled.");
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
        messagingFailureService.failIfTesting();
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
                createEnrollment(UUID.fromString(body[1]), UUID.fromString(body[2]));
            else if (op.equals("UPDATE"))
                updateEnrollment(UUID.fromString(body[1]), UUID.fromString(body[2]), body[3]);
            else if (op.equals("DELETE"))
                deleteEnrollment(UUID.fromString(body[1]), UUID.fromString(body[2]));
        } catch (JMSException e) {
            System.err.println("Error handling message:");
            e.printStackTrace();
        } catch (SQLException e) {
            System.err.println("Error inserting into the database:");
            e.printStackTrace();
        }
    }
}
