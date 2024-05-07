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
            try (PreparedStatement st = conn.prepareStatement("""
                    SELECT
                        Course.id AS id,
                        Course.name AS name,
                        Course.capacity AS capacity,
                        Course.startDate AS startDate,
                        COUNT(Enrollment.id) AS numberOfEnrollments
                    FROM
                        Course
                        LEFT JOIN Enrollment ON Course.id = Enrollment.courseId
                    WHERE Course.id = ?
                    GROUP BY Course.id""")) {
                st.setString(1, courseId);
                ResultSet rs = st.executeQuery();
                if (!rs.next()) {
                    createNotification(conn, studentId,
                            "Can't enroll in course with id: " + courseId + " since it was not found on the system.");
                } else if (rs.getInt("numberOfEnrollments") > rs.getInt("capacity")) {
                    createNotification(conn, studentId,
                            "Can't enroll in '" + rs.getString("name") + "' since it is full");
                } else if (rs.getLong("startDate") < System.currentTimeMillis()) {
                    createNotification(conn, studentId,
                            "Can't enroll in '" + rs.getString("name") + "' since it has already started");
                } else {
                    try (PreparedStatement st2 = conn.prepareStatement(
                            "INSERT INTO Enrollment (studentId, courseId, status) VALUES (?, ?, 'PENDING')")) {
                        st2.setString(1, studentId);
                        st2.setString(2, courseId);
                        st2.executeUpdate();
                        createNotification(conn, studentId, "Submitted an enrollment request for: '"
                                + rs.getString("name") + "', we will get back to you once it is accepted.");
                    }
                }
            }
        }
    }

    private void updateEnrollment(String instructorId, String enrollmentId, String status) throws SQLException {
        // TODO: course does not belong to instructor
        if (status.equals("ACCEPTED") || status.equals("REJECTED")) {
            System.err.println("Received invalid status: " + status);
            return;
        }
        try (Connection conn = dataSource.getInstance().getConnection();
                PreparedStatement st = conn.prepareStatement(
                        "UPDATE Enrollment SET status = ? WHERE id = ?")) {
            st.setString(1, status);
            st.setString(2, enrollmentId);
            if (st.executeUpdate() == 0)
                System.err.println("Could not find an enrollment with id: " + enrollmentId);
        }
    }

    private void deleteEnrollment(String enrollmentId) throws SQLException {
        // TODO: course does not belong to instructor
        try (Connection conn = dataSource.getInstance().getConnection();
                PreparedStatement st = conn.prepareStatement(
                        "DELETE FROM Enrollment WHERE id = ?")) {
            st.setString(1, enrollmentId);
            if (st.executeUpdate() == 0)
                System.err.println("Could not find an enrollment with id: " + enrollmentId);
        }

    }

    @Override
    public void onMessage(Message rcvMessage) {
        // CREATE:studentId:courseId
        // UPDATE:enrollmentId:ACCEPTED|REJECTED
        // DELETE:enrollmentId
        if (!(rcvMessage instanceof TextMessage)) {
            System.err.println("Received invalid message type: " + rcvMessage.getClass().toString());
            return;
        }
        TextMessage msg = (TextMessage) rcvMessage;
        try {
            String txt = msg.getText();
            String[] body = txt.split(":");
            if (body.length != 3) {
                System.err.println("Received invalid msg: " + txt);
                return;
            }
            String op = body[0];
            if (op.equals("CREATE"))
                createEnrollment(body[1], body[2]);
            else if (op.equals("UPDATE"))
                updateEnrollment(body[1], body[2]);
            else if (op.equals("DELETE"))
                deleteEnrollment(body[1]);
            else
                System.err.println("Received invalid msg: " + txt);
        } catch (JMSException e) {
            System.err.println("Error handling message");
            e.printStackTrace();
        } catch (SQLException e) {
            System.err.println("Error inserting into the database");
            e.printStackTrace();
        }
    }
}
