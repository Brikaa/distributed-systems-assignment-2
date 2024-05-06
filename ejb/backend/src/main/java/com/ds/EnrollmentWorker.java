package com.ds;

import jakarta.ejb.MessageDriven;
import jakarta.jms.JMSException;
import jakarta.jms.Message;
import jakarta.jms.MessageListener;
import jakarta.jms.TextMessage;

import java.sql.Connection;
import java.sql.PreparedStatement;
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

    private void createEnrollment(String studentId, String courseId) throws SQLException {
        try (Connection conn = dataSource.getInstance().getConnection();
                PreparedStatement st = conn.prepareStatement(
                        "INSERT INTO Enrollment (studentId, courseId, status) VALUES (?, ?, 'PENDING')")) {
            st.setString(1, studentId);
            st.setString(2, courseId);
            st.executeUpdate();
        }
    }

    private void updateEnrollment(String enrollmentId, String status) throws SQLException {
        if (status.equals("ACCEPTED") || status.equals("REJECTED")) {
            System.err.println("Received invalid status: " + status);
            return;
        }
        try (Connection conn = dataSource.getInstance().getConnection();
                PreparedStatement st = conn.prepareStatement(
                        "UPDATE Enrollment SET status = ? WHERE id = ?")) {
            st.setString(1, status);
            st.setString(2, enrollmentId);
            int affected = st.executeUpdate();
            if (affected == 0)
                System.err.println("Could not find an enrollment with id: " + enrollmentId);
        }
    }

    private void deleteEnrollment(String enrollmentId) throws SQLException {
        try (Connection conn = dataSource.getInstance().getConnection();
                PreparedStatement st = conn.prepareStatement(
                        "DELETE FROM Enrollment WHERE id = ?")) {
            st.setString(1, enrollmentId);
            int affected = st.executeUpdate();
            if (affected == 0)
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
