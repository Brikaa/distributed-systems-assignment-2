package com.ds;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
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
import jakarta.ws.rs.QueryParam;
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
    private final String STUDENT_ROLE = "STUDENT";
    private final Pattern EMAIL_REGEX = Pattern.compile("^[a-zA-Z0-9_!#$%&’*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+$");

    private Response withRole(String[] roles, Callback callback) throws SQLException {
        String authHeader = request.getHeader("Authorization");
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
                    if (role.equalsIgnoreCase(myRole)) {
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

    @GET
    @Path("/health")
    public Response health() {
        return Response.ok().entity(new MessageResponse("Up and running")).build();
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

    private String getInvalidEmailError(String email) {
        return !EMAIL_REGEX.matcher(email).matches() ? "Invalid email" : null;
    }

    private String getInvalidPasswordError(String password) {
        return password.length() < 8 ? "Password must be at least 8 characters long" : null;
    }

    private String getInvalidExperienceError(int experience) {
        return (experience > 100 || experience < 0) ? "Invalid years of experience" : null;
    }

    @POST
    @Path("/register")
    public Response register(UserUpdateRequest req) throws SQLException {
        if (req.name == null || req.email == null || req.password == null || req.role == null || req.experience == null
                || req.bio == null) {
            return Response.status(400).build();
        }

        {
            String err = null;
            if ((err = getInvalidUserNameError(req.name)) != null)
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

        try (Connection conn = dataSource.getInstance().getConnection();
                PreparedStatement st = conn.prepareStatement(
                        "INSERT INTO AppUser (name, email, password, role, experience, bio) VALUES (?, ?, ?, ?, ?, ?)")) {
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
            st.executeUpdate();
        }
        return Response.ok().build();
    }

    @GET
    @Path("/user")
    public Response getUser() throws SQLException {
        return withRole("*", (_conn, rs) -> {
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
        return withRole(ADMIN_ROLE, (conn, _rs) -> {
            try (PreparedStatement st = conn.prepareStatement("DELETE FROM AppUser WHERE id = ?")) {
                st.setObject(1, id);
                int affected = st.executeUpdate();
                if (affected == 0)
                    return Response.status(404).build();
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
        if (req == null) {
            return Response.status(400).build();
        }
        StringBuilder query = new StringBuilder();
        query.append("UPDATE AppUser SET ");
        ArrayList<String> updates = new ArrayList<>();
        LinkedList<Binding> bindings = new LinkedList<>();
        String err = null;

        if (req.name != null) {
            if ((err = getInvalidUserNameError(req.name)) != null)
                return Response.status(400).entity(new MessageResponse(err)).build();
            updates.add("name = ?");
            bindings.addLast((i, st) -> st.setString(i, req.name));
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

        // FIXME: admin can set student experience
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

        if (updates.size() == 0)
            return Response.status(400).build();

        query.append(String.join(",", updates));
        query.append(" WHERE id = ?");

        try (PreparedStatement st = conn.prepareStatement(query.toString())) {
            int i = applyBindings(st, bindings);
            st.setObject(i++, targetId);
            int affected = st.executeUpdate();
            if (affected != 0)
                return Response.status(404).build();
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

    private String getInvalidCourseNameError(String name) {
        return name.isEmpty() ? "Name can't be empty" : null;
    }

    private String getInvalidCourseDatesError(Long startDate, Long endDate) {
        if (endDate < startDate)
            return "Start date can't be before the end date";
        if ((startDate * 1000) < System.currentTimeMillis())
            return "Course can't start in the past";
        return null;
    }

    private String getInvalidCategoryError(String category) {
        return category.isEmpty() ? "Category can't be empty" : null;
    }

    private String getInvalidCapacityError(int capacity) {
        return capacity <= 0 ? "Capacity must be a positive number" : null;
    }

    @POST
    @Path("/course")
    public Response createCourse(CourseUpdateRequest req) throws SQLException {
        return withRole(INSTRUCTOR_ROLE, (conn, rs) -> {
            if (req.name.equals(null) || req.description == null || req.startDate == null || req.endDate == null
                    || req.category == null || req.capacity == null)
                return Response.status(400).build();

            {
                String err = null;
                if ((err = getInvalidCourseNameError(req.name)) != null)
                    return Response.status(400).entity(new MessageResponse(err)).build();
                if ((err = getInvalidCourseDatesError(req.startDate, req.endDate)) != null)
                    return Response.status(400).entity(new MessageResponse(err)).build();
                if ((err = getInvalidCategoryError(req.category)) != null)
                    return Response.status(400).entity(new MessageResponse(err)).build();
                if ((err = getInvalidCapacityError(req.capacity)) != null)
                    return Response.status(400).entity(new MessageResponse(err)).build();
            }

            try (PreparedStatement st = conn.prepareStatement(
                    "INSERT INTO Course (instructorId, name, description, startDate, endDate, category, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)")) {
                int i = 1;
                st.setObject(i++, rs.getObject("id", UUID.class));
                st.setString(i++, req.name);
                st.setString(i++, req.description);
                st.setLong(i++, req.startDate);
                st.setLong(i++, req.endDate);
                st.setString(i++, req.category);
                st.setInt(i++, req.capacity);
                st.executeUpdate();
            }

            return Response.ok().build();
        });
    }

    @DELETE
    @Path("/course/{id}")
    public Response deleteCourse(@PathParam("id") UUID id) throws SQLException {
        return withRole(new String[] { ADMIN_ROLE, INSTRUCTOR_ROLE }, (conn, rs) -> {
            boolean isInstructor = rs.getString("role").equals(INSTRUCTOR_ROLE);
            StringBuilder query = new StringBuilder();
            query.append("DELETE FROM Course WHERE id = ? ");
            if (isInstructor)
                query.append("AND instructorId = ?");
            try (PreparedStatement st = conn.prepareStatement(query.toString())) {
                st.setObject(1, id);
                if (isInstructor)
                    st.setObject(2, rs.getObject("id", UUID.class));
                int affected = st.executeUpdate();
                if (affected == 0)
                    return Response.status(404).build();
                return Response.ok().build();
            }
        });
    }

    @PUT
    @Path("/course/{id}")
    public Response updateCourse(@PathParam("id") UUID id, CourseUpdateRequest req) throws SQLException {
        return withRole(new String[] { ADMIN_ROLE, INSTRUCTOR_ROLE }, (conn, rs) -> {
            if (req == null) {
                return Response.status(400).build();
            }

            StringBuilder query = new StringBuilder();
            query.append("UPDATE Course SET ");
            ArrayList<String> updates = new ArrayList<>();
            LinkedList<Binding> bindings = new LinkedList<>();
            String err = null;

            if (req.name != null) {
                if ((err = getInvalidCourseNameError(req.name)) != null)
                    return Response.status(400).entity(new MessageResponse(err)).build();
                updates.add("name = ?");
                bindings.addLast((i, st) -> st.setString(i, req.name));
            }

            if (req.description != null) {
                updates.add("description = ?");
                bindings.addLast((i, st) -> st.setString(i, req.description));
            }

            if (req.startDate != null && req.endDate != null) {
                if ((err = getInvalidCourseDatesError(req.startDate, req.endDate)) != null)
                    return Response.status(400).entity(new MessageResponse(err)).build();
                updates.add("startDate = ?");
                updates.add("endDate = ?");
                bindings.addLast((i, st) -> st.setTimestamp(i, new Timestamp(req.startDate)));
                bindings.addLast((i, st) -> st.setTimestamp(i, new Timestamp(req.endDate)));
            }

            if (req.category != null) {
                if ((err = getInvalidCategoryError(req.category)) != null)
                    return Response.status(400).entity(new MessageResponse(err)).build();
                updates.add("category = ?");
                bindings.addLast((i, st) -> st.setString(i, req.category));
            }

            if (req.capacity != null) {
                if ((err = getInvalidCapacityError(req.capacity)) != null)
                    return Response.status(400).entity(new MessageResponse(err)).build();
                updates.add("capacity = ?");
                bindings.addLast((i, st) -> st.setInt(i, req.capacity));
            }

            if (updates.size() == 0)
                return Response.status(400).build();

            query.append(String.join(",", updates));
            query.append(" WHERE id = ?");

            boolean isInstructor = rs.getString("role").equals(INSTRUCTOR_ROLE);
            if (isInstructor)
                query.append(" AND instructorId = ?");

            try (PreparedStatement st = conn.prepareStatement(query.toString())) {
                int i = applyBindings(st, bindings);
                st.setObject(i++, id);
                if (isInstructor)
                    st.setObject(i++, rs.getObject("id"));
                int affected = st.executeUpdate();
                if (affected != 0)
                    return Response.status(404).build();
                return Response.ok().build();
            }
        });
    }

    @POST
    @Path("/course/{courseId}/review")
    public Response createReview(@PathParam("courseId") UUID courseId, ReviewCreateRequest req) throws SQLException {
        return withRole(STUDENT_ROLE, (conn, accountRs) -> {
            if (req.body == null)
                req.body = "";
            if (req.stars == null)
                return Response.status(400).build();
            UUID studentId = accountRs.getObject("id", UUID.class);
            try (PreparedStatement st = conn
                    .prepareStatement("SELECT id FROM Review WHERE studentId = ? AND courseId = ?")) {
                st.setObject(1, studentId);
                st.setObject(2, courseId);
                if (st.executeQuery().next())
                    return Response.status(400).entity(new MessageResponse("You already have a review on this course"))
                            .build();
            }
            try (PreparedStatement st = conn
                    .prepareStatement("INSERT INTO Review (studentId, courseId, stars, body) VALUES (?, ?, ?, ?)")) {
                int i = 1;
                st.setObject(i++, studentId);
                st.setObject(i++, courseId);
                st.setObject(i++, req.stars);
                st.setObject(i++, req.body);
                int affected = st.executeUpdate();
                if (affected == 0)
                    return Response.status(404).build();
                return Response.ok().build();
            }
        });
    }

    private String escapeLikeString(String likeString) {
        return likeString.replace("!", "!!").replace("%", "!%").replace("_", "!_").replace("[", "![");
    }

    @GET
    @Path("/course/")
    public Response listCourses(@QueryParam("sortBy") String sortBy, @QueryParam("name") String name,
            @QueryParam("category") String category, @QueryParam("mine") Boolean mine) throws SQLException {
        return withRole("*", (conn, accountRs) -> {
            StringBuilder query = new StringBuilder();
            query.append("""
                    SELECT
                        Course.id AS courseId,
                        Course.name AS courseName,
                        MIN(Instructor.name) AS instructorName,
                        AVG(Review.stars) AS averageStars,
                        COUNT(Review.id) AS numberOfReviews,
                        Course.category,
                        Course.startDate,
                        Course.endDate,
                        Course.capacity
                    FROM Course
                        LEFT JOIN AppUser AS Instructor ON Instructor.id = Course.instructorId
                        LEFT JOIN Review ON Review.courseId = Course.id""");
            ArrayList<String> where = new ArrayList<>();
            LinkedList<Binding> bindings = new LinkedList<>();
            if (name != null) {
                where.add("LOWER(Course.name) LIKE LOWER(?)");
                bindings.addLast((i, st) -> st.setString(i, escapeLikeString(name)));
            }
            if (category != null) {
                where.add("LOWER(Course.category) LIKE LOWER(?)");
                bindings.addLast((i, st) -> st.setString(i, escapeLikeString(category)));
            }
            if (accountRs.getString("role").equals(INSTRUCTOR_ROLE) && mine != null) {
                where.add("Instructor.id = ?");
                bindings.addLast((i, st) -> st.setObject(i, accountRs.getString("id")));
            }

            if (where.size() > 0)
                query.append(" WHERE " + String.join(" AND ", where));

            query.append(" GROUP BY Course.id");

            if (sortBy != null && sortBy.equals("stars"))
                query.append(" ORDER BY averageStars DESC");

            try (PreparedStatement st = conn.prepareStatement(query.toString())) {
                applyBindings(st, bindings);
                ResultSet rs = st.executeQuery();
                ArrayList<CourseResponse> courses = new ArrayList<>();
                while (rs.next()) {
                    courses.add(new CourseResponse() {
                        {
                            name = rs.getString("courseName");
                            instructorName = rs.getString("instructorName");
                            averageStars = rs.getInt("averageStars");
                            numberOfReviews = rs.getInt("numberOfReviews");
                            category = rs.getString("category");
                            startDate = rs.getLong("startDate");
                            endDate = rs.getLong("endDate");
                            capacity = rs.getInt("capacity");
                        }
                    });
                }
                return Response.ok().entity(new CoursesResponse(courses)).build();
            }
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
}

class CourseResponse {
    public String name;
    public String instructorName;
    public Integer averageStars;
    public Integer numberOfReviews;
    public String category;
    public Long startDate;
    public Long endDate;
    public Integer capacity;
}

class CoursesResponse {
    public ArrayList<CourseResponse> courses;

    public CoursesResponse(ArrayList<CourseResponse> courses) {
        this.courses = courses;
    }
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
};
