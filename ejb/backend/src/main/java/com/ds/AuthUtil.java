package com.ds;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Base64;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;

interface Callback {
    public Response apply(Connection conn, ResultSet rs) throws SQLException;
};

public class AuthUtil {
    private static final String AUTH_SCHEME = "(?i)Bearer";

    public static Response withRole(Connection conn, HttpServletRequest request, String role, Callback callback)
            throws SQLException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null) {
            return Response.status(401).build();
        }
        String authToken = authHeader.replaceFirst(AUTH_SCHEME + " ", "");
        // Get username and password
        // Auth token: base64(base64(username):base64(password))
        String[] idPass = null;
        String id = null;
        String password = null;
        try {
            String decoded = new String(Base64.getDecoder().decode(authToken));
            idPass = decoded.split(":", 2);
            id = new String(Base64.getDecoder().decode(idPass[0]));
            password = new String(Base64.getDecoder().decode(idPass[1]));
        } catch (IllegalArgumentException e) {
        }
        if (idPass == null || id == null || password == null || idPass.length < 2) {
            return Response.status(401).entity(new MessageResponse("Invalid Auth token")).build();
        }
        try (PreparedStatement st = conn
                .prepareStatement("SELECT * FROM AppUser WHERE id::text = ? AND password = ?")) {
            st.setString(1, id);
            st.setString(2, password);
            ResultSet rs = st.executeQuery();
            if (!rs.next()) {
                return Response.status(401).build();
            }
            if (role != "*" && !rs.getString("role").equalsIgnoreCase(role)) {
                return Response.status(403).build();
            }
            return callback.apply(conn, rs);
        }
    }

    public static Response withRole(AppDataSource ds, HttpServletRequest request, String role, Callback callback)
            throws SQLException {
        try (Connection conn = ds.getInstance().getConnection()) {
            return withRole(conn, request, role, callback);
        }
    }
}