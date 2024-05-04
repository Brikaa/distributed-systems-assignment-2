package com.ds;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedList;
import java.util.UUID;

import jakarta.ejb.EJB;
import jakarta.ejb.Stateless;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/")
@Stateless
@Produces(MediaType.APPLICATION_JSON)
public class Api {
    @EJB
    private ApiDataSource dataSource;

    @Context
    private HttpServletRequest request;

    private final String ADMIN_ROLE = "ADMIN";
    private final String INSTRUCTOR_ROLE = "INSTRUCTOR";

    private Response withRole(HttpServletRequest request, String role, Callback callback)
            throws SQLException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null) {
            return Response.status(401).build();
        }
        String authToken = authHeader.replaceFirst("(?i)Bearer ", "");
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
        try (Connection conn = dataSource.getInstance().getConnection();
                PreparedStatement st = conn
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

    @GET
    @Path("/health")
    public Response health() {
        return Response.ok().entity(new MessageResponse("Up and running")).build();
    }

    @GET
    @Path("/user")
    public Response getUser() throws SQLException {
        return withRole(request, "*", (_conn, rs) -> {
            return Response.ok().entity(new UserResponse() {
                {
                    id = rs.getObject("id", UUID.class);
                    name = rs.getString("name");
                    email = rs.getString("email");
                    role = rs.getString("role");
                    if (role.equals(INSTRUCTOR_ROLE))
                        experience = rs.getInt("experience");
                    bio = rs.getString("bio");
                }
            }).build();
        });
    }

    @DELETE
    @Path("/user/{id}")
    public Response deleteUser(@PathParam("id") UUID id) throws SQLException {
        return withRole(request, ADMIN_ROLE, (conn, _rs) -> {
            try (PreparedStatement st = conn.prepareStatement("DELETE FROM AppUser WHERE id = ?")) {
                st.setObject(1, id);
                st.executeUpdate();
                return Response.ok().build();
            }
        });
    }

    private Response updateUser(Connection conn, String role, UUID sourceId, UUID targetId, UserUpdateRequest req)
            throws SQLException {
        if (req == null) {
            return Response.status(400).build();
        }
        StringBuilder query = new StringBuilder();
        query.append("UPDATE AppUser SET ");
        ArrayList<String> updates = new ArrayList<>();
        LinkedList<Binding> bindings = new LinkedList<>();
        if (req.name != null) {
            updates.add("name = ?");
            bindings.addLast((i, st) -> st.setString(i, req.name));
        }
        if (req.email != null) {
            updates.add("email = ?");
            bindings.addLast((i, st) -> st.setString(i, req.email));
        }
        if (req.password != null) {
            updates.add("password = ?");
            bindings.addLast((i, st) -> st.setString(i, req.password));
        }
        if (role.equals(ADMIN_ROLE) && sourceId != targetId && req.role != null) {
            updates.add("role = ?");
            bindings.addLast((i, st) -> st.setString(i, req.role));
        }
        if ((role.equals(ADMIN_ROLE) || role.equals(INSTRUCTOR_ROLE)) && req.experience != null) {
            updates.add("experience = ?");
            bindings.addLast((i, st) -> st.setInt(i, req.experience));
        }
        if (req.bio != null) {
            updates.add("bio = ?");
            bindings.addLast((i, st) -> st.setString(i, req.bio));
        }

        if (updates.size() == 0) {
            return Response.status(400).build();
        }

        query.append(String.join(",", updates));
        query.append(" WHERE id = ?");

        try (PreparedStatement st = conn.prepareStatement(query.toString())) {
            int i = 1;
            while (!bindings.isEmpty()) {
                bindings.getFirst().apply(i++, st);
                bindings.removeFirst();
            }
            st.setObject(i++, targetId);
            st.executeUpdate();
            return Response.ok().build();
        }
    }

    @PUT
    @Path("/user/{id}")
    public Response updateUser(@PathParam("id") UUID id, UserUpdateRequest req) throws SQLException {
        return withRole(request, ADMIN_ROLE, (conn, rs) -> {
            try (PreparedStatement st = conn.prepareStatement("SELECT id FROM AppUser WHERE id = ?")) {
                st.setObject(1, id);
                ResultSet foundRs = st.executeQuery();
                if (!foundRs.next()) {
                    return Response.status(404).build();
                }
            }
            return updateUser(conn, ADMIN_ROLE, rs.getObject("id", UUID.class), id, req);
        });
    }

    @PUT
    @Path("/user")
    public Response updateMyUser(UserUpdateRequest req) throws SQLException {
        return withRole(request, "*", (conn, rs) -> {
            UUID myId = rs.getObject("id", UUID.class);
            return updateUser(conn, "*", myId, myId, req);
        });
    }
}

class UserResponse {
    public UUID id;
    public String name;
    public String email;
    public String role;
    public int experience;
    public String bio;
}

class MessageResponse {
    public String message;

    public MessageResponse(String message) {
        this.message = message;
    }
}

class UserUpdateRequest {
    public String name;
    public String email;
    public String password;
    public String role;
    public Integer experience;
    public String bio;
}

interface Binding {
    public void apply(int idx, PreparedStatement st) throws SQLException;
}

interface Callback {
    public Response apply(Connection conn, ResultSet rs) throws SQLException;
};
