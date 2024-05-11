package com.ds;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedList;
import java.util.UUID;
import java.util.regex.Pattern;

import com.ds.requests.*;

import jakarta.ejb.EJB;
import jakarta.ejb.Stateless;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
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
    private HttpServletRequest servletRequest;

    private static final String ADMIN_ROLE = "ADMIN";
    private static final String INSTRUCTOR_ROLE = "INSTRUCTOR";
    private static final String STUDENT_ROLE = "STUDENT";
    private static final Pattern EMAIL_REGEX = Pattern.compile("^[a-zA-Z0-9_!#$%&’*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+$");

    private Response withRole(String[] roles, Callback callback) throws SQLException {
        String authHeader = servletRequest.getHeader("Authorization");
        if (authHeader == null) {
            return Response.status(401).build();
        }
        String authToken = authHeader.replaceFirst("(?i)Basic ", "");
        // Get id and password
        // Auth token: base64(base64(id):base64(password))
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
            if (roles.length != 0) {
                boolean found = false;
                String myRole = rs.getString("role");
                for (String role : roles) {
                    if (role.equals(myRole)) {
                        found = true;
                        break;
                    }
                }
                if (!found)
                    return Response.status(403).build();
            }
            return callback.apply(conn, rs);
        }
    }

    private Response withRole(String role, Callback callback) throws SQLException {
        if (role.equals("*"))
            return withRole(new String[] {}, callback);
        else
            return withRole(new String[] { role }, callback);
    }

    private String createToken(UUID id, String password) {
        String encodedId = Base64.getEncoder().encodeToString(id.toString().getBytes());
        String encodedPassword = Base64.getEncoder().encodeToString(password.getBytes());
        return Base64.getEncoder().encodeToString((encodedId + ":" + encodedPassword).getBytes());
    }

    @POST
    @Path("/login")
    public Response login(LoginRequest req) throws SQLException {
        try (Connection conn = dataSource.getInstance().getConnection();
                PreparedStatement st = conn
                        .prepareStatement("SELECT id FROM AppUser where (name = ? OR email = ?) AND password = ?")) {
            st.setString(1, req.nameOrEmail);
            st.setString(2, req.nameOrEmail);
            st.setString(3, req.password);
            ResultSet rs = st.executeQuery();
            if (!rs.next()) {
                return Response.status(401).entity(new MessageResponse("Invalid name/email or password")).build();
            }
            String token = createToken(rs.getObject("id", UUID.class), req.password);
            return Response.ok().entity(new TokenResponse(token)).build();
        }
    }

    private String getInvalidUserNameError(String name) {
        return name.isEmpty() ? "Name can't be empty" : null;
    }

    private String getInvalidAffiliationError(String affiliation) {
        return affiliation.isEmpty() ? "Affiliation can't be empty" : null;
    }

    private String getInvalidEmailError(String email) {
        return !EMAIL_REGEX.matcher(email).matches() ? "Invalid email" : null;
    }

    private String getInvalidPasswordError(String password) {
        return password.length() < 4 ? "Password must be at least 4 characters long" : null;
    }

    private String getInvalidExperienceError(int experience) {
        return (experience > 100 || experience < 0) ? "Invalid years of experience" : null;
    }

    @POST
    @Path("/register")
    public Response register(UserUpdateRequest req) throws SQLException {
        if (req.name == null || req.email == null || req.password == null || req.role == null || req.experience == null
                || req.bio == null || req.affiliation == null) {
            return Response.status(400).entity(new MessageResponse("Incomplete body")).build();
        }

        {
            String err = null;
            if ((err = getInvalidUserNameError(req.name)) != null)
                return Response.status(400).entity(new MessageResponse(err)).build();
            if ((err = getInvalidAffiliationError(req.affiliation)) != null)
                return Response.status(400).entity(new MessageResponse(err)).build();
            if ((err = getInvalidEmailError(req.email)) != null)
                return Response.status(400).entity(new MessageResponse(err)).build();
            if ((err = getInvalidPasswordError(req.password)) != null)
                return Response.status(400).entity(new MessageResponse(err)).build();
            if (!req.role.equals(INSTRUCTOR_ROLE) || !req.role.equals(STUDENT_ROLE))
                return Response.status(400).entity(new MessageResponse("Invalid role")).build();
            if (req.role.equals(INSTRUCTOR_ROLE) && (err = getInvalidExperienceError(req.experience)) != null)
                return Response.status(400).entity(new MessageResponse(err)).build();
        }

        try (Connection conn = dataSource.getInstance().getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement st = conn
                    .prepareStatement("SELECT id, email, name FROM AppUser where name = ? OR email = ?")) {
                st.setString(1, req.name);
                st.setString(2, req.email);
                ResultSet rs = st.executeQuery();
                if (rs.next()) {
                    if (rs.getString("name").equals(req.name))
                        return Response.status(400).entity(new MessageResponse("A user with this name already exists"))
                                .build();
                    if (rs.getString("email").equals(req.email))
                        return Response.status(400).entity(new MessageResponse("A user with this email already exists"))
                                .build();
                }
            } catch (Exception e) {
                e.printStackTrace();
                conn.rollback();
                return Response.status(500).build();
            }

            try (PreparedStatement st = conn.prepareStatement(
                    "INSERT INTO AppUser (name, email, password, role, experience, bio, affiliation) VALUES (?, ?, ?, ?, ?, ?, ?)")) {
                int i = 1;
                st.setString(i++, req.name);
                st.setString(i++, req.email);
                st.setString(i++, req.password);
                st.setString(i++, req.role);
                if (req.role.equals(INSTRUCTOR_ROLE))
                    st.setInt(i++, req.experience);
                else
                    st.setInt(i++, 0);
                st.setString(i++, req.bio);
                st.setString(i++, req.affiliation);
                st.executeUpdate();
            } catch (Exception e) {
                e.printStackTrace();
                conn.rollback();
                return Response.status(500).build();
            }
            conn.commit();
            return Response.ok().build();
        }
    }

    private UserResponse getUserResponse(ResultSet rs) throws SQLException {
        return new UserResponse() {
            {
                id = rs.getObject("id", UUID.class);
                name = rs.getString("name");
                email = rs.getString("email");
                role = rs.getString("role");
                if (role.equals(INSTRUCTOR_ROLE))
                    experience = rs.getInt("experience");
                bio = rs.getString("bio");
                affiliation = rs.getString("affiliation");
            }
        };
    }

    @GET
    @Path("/user")
    public Response getMyUser() throws SQLException {
        return withRole("*", (_conn, rs) -> {
            return Response.ok().entity(getUserResponse(rs)).build();
        });
    }

    @GET
    @Path("/user/{id}")
    public Response getUser(@PathParam("id") UUID id) throws SQLException {
        return withRole(ADMIN_ROLE, (conn, _rs) -> {
            try (PreparedStatement st = conn
                    .prepareStatement(
                            "SELECT id, name, email, role, experience, bio, affiliation FROM AppUser WHERE id = ?")) {
                st.setObject(1, id);
                ResultSet rs = st.executeQuery();
                if (!rs.next())
                    return Response.status(404).entity(new MessageResponse("Could not find the specified user"))
                            .build();
                return Response.status(200).entity(getUserResponse(rs)).build();
            }
        });
    }

    @GET
    @Path("/instructor/{id}")
    public Response getInstructor(@PathParam("id") UUID id) throws SQLException {
        return withRole("*", (conn, _rs) -> {
            try (PreparedStatement st = conn
                    .prepareStatement(
                            "SELECT id, name, experience, bio, affiliation FROM AppUser WHERE id = ? AND role = "
                                    + INSTRUCTOR_ROLE)) {
                st.setObject(1, id);
                ResultSet rs = st.executeQuery();
                if (!rs.next())
                    return Response.status(404).entity(new MessageResponse("Could not find the specified instructor"))
                            .build();
                return Response.status(200).entity(new InstructorResponse() {
                    {
                        id = rs.getObject("id", UUID.class);
                        name = rs.getString("name");
                        experience = rs.getInt("experience");
                        bio = rs.getString("bio");
                        affiliation = rs.getString("affiliation");
                    }
                }).build();
            }
        });
    }

    @GET
    @Path("/student/{id}")
    public Response getStudent(@PathParam("id") UUID id) throws SQLException {
        return withRole("*", (conn, _rs) -> {
            try (PreparedStatement st = conn
                    .prepareStatement(
                            "SELECT id, name, bio, affiliation FROM AppUser WHERE id = ? AND role = " + STUDENT_ROLE)) {
                st.setObject(1, id);
                ResultSet rs = st.executeQuery();
                if (!rs.next())
                    return Response.status(404).entity(new MessageResponse("Could not find the specified student"))
                            .build();
                return Response.status(200).entity(new StudentResponse() {
                    {
                        id = rs.getObject("id", UUID.class);
                        name = rs.getString("name");
                        bio = rs.getString("bio");
                        affiliation = rs.getString("affiliation");
                    }
                }).build();
            }
        });
    }

    @DELETE
    @Path("/user/{id}")
    public Response deleteUser(@PathParam("id") UUID id) throws SQLException {
        return withRole(ADMIN_ROLE, (conn, _rs) -> {
            try (PreparedStatement st = conn.prepareStatement("DELETE FROM AppUser WHERE id = ?")) {
                st.setObject(1, id);
                if (st.executeUpdate() == 0)
                    return Response.status(404).entity(new MessageResponse("Could not find the specified user"))
                            .build();
                return Response.ok().build();
            }
        });
    }

    private int applyBindings(PreparedStatement st, LinkedList<Binding> bindings) throws SQLException {
        int i = 1;
        while (!bindings.isEmpty()) {
            bindings.getFirst().apply(i++, st);
            bindings.removeFirst();
        }
        return i;
    }

    private Response updateUser(Connection conn, String role, UUID sourceId, UUID targetId, UserUpdateRequest req)
            throws SQLException {
        StringBuilder query = new StringBuilder("UPDATE AppUser SET ");
        ArrayList<String> updates = new ArrayList<>();
        LinkedList<Binding> bindings = new LinkedList<>();
        String err = null;

        if (req.name != null) {
            if ((err = getInvalidUserNameError(req.name)) != null)
                return Response.status(400).entity(new MessageResponse(err)).build();
            updates.add("name = ?");
            bindings.addLast((i, st) -> st.setString(i, req.name));
        }

        if (req.affiliation != null) {
            if ((err = getInvalidAffiliationError(req.affiliation)) != null)
                return Response.status(400).entity(new MessageResponse(err)).build();
            updates.add("affiliation = ?");
            bindings.addLast((i, st) -> st.setString(i, req.affiliation));
        }

        if (req.email != null) {
            if ((err = getInvalidEmailError(req.email)) != null)
                return Response.status(400).entity(new MessageResponse(err)).build();
            updates.add("email = ?");
            bindings.addLast((i, st) -> st.setString(i, req.email));
        }

        if (req.password != null) {
            if ((err = getInvalidPasswordError(req.password)) != null)
                return Response.status(400).entity(new MessageResponse(err)).build();
            updates.add("password = ?");
            bindings.addLast((i, st) -> st.setString(i, req.password));
        }

        if (role.equals(ADMIN_ROLE) && sourceId != targetId && req.role != null) {
            if (!req.role.equals(INSTRUCTOR_ROLE) || !req.role.equals(STUDENT_ROLE) || !req.role.equals(ADMIN_ROLE))
                return Response.status(400).entity(new MessageResponse("Invalid role")).build();
            updates.add("role = ?");
            bindings.addLast((i, st) -> st.setString(i, req.role));
        }

        if ((role.equals(ADMIN_ROLE) || role.equals(INSTRUCTOR_ROLE)) && req.experience != null) {
            if ((err = getInvalidExperienceError(req.experience)) != null)
                return Response.status(400).entity(new MessageResponse(err)).build();
            updates.add("experience = ?");
            bindings.addLast((i, st) -> st.setInt(i, req.experience));
        }

        if (req.bio != null) {
            updates.add("bio = ?");
            bindings.addLast((i, st) -> st.setString(i, req.bio));
        }

        if (updates.isEmpty())
            return Response.status(400).entity(new MessageResponse("Empty body")).build();

        query.append(String.join(",", updates));
        query.append(" WHERE id = ?");

        try (PreparedStatement st = conn.prepareStatement(query.toString())) {
            int i = applyBindings(st, bindings);
            st.setObject(i++, targetId);
            if (st.executeUpdate() != 0)
                return Response.status(404).entity(new MessageResponse("Could not find the specified user")).build();
            String token = createToken(targetId, req.password);
            return Response.ok().entity(new TokenResponse(token)).build();
        }
    }

    @PUT
    @Path("/user/{id}")
    public Response updateUser(@PathParam("id") UUID id, UserUpdateRequest req) throws SQLException {
        return withRole(ADMIN_ROLE, (conn, rs) -> {
            return updateUser(conn, ADMIN_ROLE, rs.getObject("id", UUID.class), id, req);
        });
    }

    @PUT
    @Path("/user")
    public Response updateMyUser(UserUpdateRequest req) throws SQLException {
        return withRole("*", (conn, rs) -> {
            UUID myId = rs.getObject("id", UUID.class);
            return updateUser(conn, "*", myId, myId, req);
        });
    }

    @GET
    @Path("/user-count")
    public Response countUsers() throws SQLException {
        return withRole(ADMIN_ROLE, (conn, _rs) -> {
            Integer noStudents = 0;
            Integer noInstructors = 0;
            Integer noAdmins = 0;
            try (PreparedStatement st = conn
                    .prepareStatement("SELECT count(id) AS count, role FROM AppUser GROUP BY role")) {
                ResultSet rs = st.executeQuery();
                while (rs.next()) {
                    Integer count = rs.getInt("count");
                    String role = rs.getString("role");
                    if (role.equals(ADMIN_ROLE))
                        noAdmins = count;
                    else if (role.equals(STUDENT_ROLE))
                        noStudents = count;
                    else
                        noInstructors = count;
                }
            }

            final Integer nStudents = noStudents;
            final Integer nInstructors = noInstructors;
            final Integer nAdmins = noAdmins;
            return Response.ok().entity(new UserCountResponse() {
                {
                    numberOfStudents = nStudents;
                    numberOfInstructors = nInstructors;
                    numberOfAdmins = nAdmins;
                }
            }).build();
        });
    }
}

class UserResponse {
    public UUID id;
    public String name;
    public String email;
    public String role;
    public Integer experience;
    public String bio;
    public String affiliation;
}

class InstructorResponse {
    public UUID id;
    public String name;
    public Integer experience;
    public String bio;
    public String affiliation;
}

class StudentResponse {
    public UUID id;
    public String name;
    public String bio;
    public String affiliation;
}

class UserCountResponse {
    public Integer numberOfStudents;
    public Integer numberOfInstructors;
    public Integer numberOfAdmins;
}

class MessageResponse {
    public String message;

    public MessageResponse(String message) {
        this.message = message;
    }
}

class TokenResponse {
    public String token;

    public TokenResponse(String token) {
        this.token = token;
    }
}

interface Binding {
    public void apply(int idx, PreparedStatement st) throws SQLException;
}

interface Callback {
    public Response apply(Connection conn, ResultSet rs) throws SQLException;
}
