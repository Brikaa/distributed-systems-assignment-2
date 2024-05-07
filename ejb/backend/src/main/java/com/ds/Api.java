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

import jakarta.annotation.Resource;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.jms.JMSContext;
import jakarta.jms.JMSDestinationDefinition;
import jakarta.jms.JMSDestinationDefinitions;
import jakarta.jms.Queue;
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

@JMSDestinationDefinitions(value = {
        @JMSDestinationDefinition(name = "java:/queue/enrollments", interfaceName = "jakarta.jms.Queue") })
@Path("/")
@Stateless
@Produces(MediaType.APPLICATION_JSON)
public class Api {
    @Inject
    private ApiDataSource dataSource;

    @Context
    private HttpServletRequest servletRequest;

    @Inject
    private JMSContext context;

    @Resource(lookup = "java:/queue/enrollments")
    private Queue queue;

    private final String ADMIN_ROLE = "ADMIN";
    private final String INSTRUCTOR_ROLE = "INSTRUCTOR";
    private final String STUDENT_ROLE = "STUDENT";
    private final Pattern EMAIL_REGEX = Pattern.compile("^[a-zA-Z0-9_!#$%&’*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+$");

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
            return Response.status(400).entity(new MessageResponse("Empty body")).build();
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
                    .prepareStatement("SELECT id, name, email, role, experience, bio FROM AppUser WHERE id = ?")) {
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
                    .prepareStatement("SELECT id, name, experience, bio FROM AppUser WHERE id = ?")) {
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
                return Response.status(400).entity(new MessageResponse("Empty body")).build();

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
                    "INSERT INTO Course (instructorId, name, description, startDate, endDate, category, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')")) {
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
            StringBuilder query = new StringBuilder("DELETE FROM Course WHERE id = ? ");
            if (isInstructor)
                query.append("AND instructorId = ?");
            try (PreparedStatement st = conn.prepareStatement(query.toString())) {
                st.setObject(1, id);
                if (isInstructor)
                    st.setObject(2, rs.getObject("id", UUID.class));
                if (st.executeUpdate() == 0)
                    return Response.status(404).entity(
                            new MessageResponse("Could not find the specified course")).build();
                return Response.ok().build();
            }
        });
    }

    @GET
    @Path("/course/{id}")
    public Response getCourse(@PathParam("id") UUID id) throws SQLException {
        return withRole("*", (conn, accountRs) -> {
            String role = accountRs.getString("role");
            UUID accountId = accountRs.getObject("id", UUID.class);
            String courseFilter = "";
            if (role.equals(STUDENT_ROLE))
                courseFilter = " AND Course.status = 'ACCEPTED'";
            if (role.equals(INSTRUCTOR_ROLE))
                courseFilter = " AND Course.status = 'ACCEPTED' OR Course.instructorId = ?";
            try (PreparedStatement st = conn.prepareStatement(String.format("""
                    SELECT
                        Course.id,
                        Course.name,
                        Course.category,
                        Course.description,
                        Course.capacity,
                        Course.instructorId,
                        Course.startDate,
                        Course.endDate,
                        Count(Enrollment.id) AS numberOfEnrollments,
                        Count(MyEnrollment.id) AS enrolled
                        AVG(Review.stars) AS averageStars
                        Course.status
                    FROM Course
                        LEFT JOIN Enrollment ON Enrollment.courseId = Course.id AND Enrollment.status = 'ACCEPTED'
                        LEFT JOIN Enrollment AS MyEnrollment
                            ON MyEnrollment.id = Enrollment.id
                            AND MyEnrollment.studentId = ?
                    WHERE
                        Course.id = ?
                        %s
                    GROUP BY Course.id""", courseFilter))) {
                st.setObject(1, accountId);
                st.setObject(2, id);
                if (role.equals(INSTRUCTOR_ROLE))
                    st.setObject(3, accountId);
                ResultSet rs = st.executeQuery();
                if (!rs.next())
                    return Response.status(404).entity(new MessageResponse("Could not find the specified course"))
                            .build();
                return Response.status(200).entity(new FullCourseResponse() {
                    {
                        id = rs.getObject("id", UUID.class);
                        name = rs.getString("name");
                        category = rs.getString("category");
                        description = rs.getString("description");
                        instructorId = rs.getObject("instructorId", UUID.class);
                        startDate = rs.getLong("startDate");
                        endDate = rs.getLong("endDate");
                        capacity = rs.getInt("capacity");
                        numberOfEnrollments = rs.getInt("numberOfEnrollments");
                        numberOfReviews = rs.getInt("numberOfReviews");
                        averageStars = rs.getInt("averageStars");
                        status = rs.getString("status");
                        enrolled = rs.getInt("enrolled") != 0;
                    }
                }).build();
            }
        });
    }

    @PUT
    @Path("/course/{id}")
    public Response updateCourse(@PathParam("id") UUID id, CourseUpdateRequest req) throws SQLException {
        return withRole(new String[] { ADMIN_ROLE, INSTRUCTOR_ROLE }, (conn, rs) -> {
            StringBuilder query = new StringBuilder("UPDATE Course SET ");
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

            String role = rs.getString("role");
            if (req.status != null && role.equals(ADMIN_ROLE)) {
                if (!req.status.equals("ACCEPTED") && !req.status.equals("PENDING"))
                    return Response.status(400).entity(new MessageResponse("Invalid status")).build();
                updates.add("status = ?");
                bindings.addLast((i, st) -> st.setString(i, req.status));
            }

            if (updates.size() == 0)
                return Response.status(400).entity(new MessageResponse("Empty body")).build();

            query.append(String.join(",", updates));
            query.append(" WHERE id = ?");

            boolean isInstructor = role.equals(INSTRUCTOR_ROLE);
            if (isInstructor)
                query.append(" AND instructorId = ?");

            try (PreparedStatement st = conn.prepareStatement(query.toString())) {
                int i = applyBindings(st, bindings);
                st.setObject(i++, id);
                if (isInstructor)
                    st.setObject(i++, rs.getObject("id"));
                if (st.executeUpdate() != 0)
                    return Response.status(404).entity(new MessageResponse("Could not find the specified course"))
                            .build();
                return Response.ok().build();
            }
        });
    }

    @GET
    @Path("/course/{courseId}/review")
    public Response listReviews(@PathParam("courseId") UUID courseId) throws SQLException {
        return withRole("*", (conn, accountRs) -> {
            try (PreparedStatement st = conn
                    .prepareStatement("SELECT id FROM Course WHERE id = ? AND status = 'ACCEPTED'")) {
                st.setObject(1, courseId);
                ResultSet rs = st.executeQuery();
                if (!rs.next())
                    return Response.status(404).entity(new MessageResponse("Could not find the specified course"))
                            .build();
            }
            try (PreparedStatement st = conn.prepareStatement("""
                    SELECT Review.id, Review.studentId, Student.name AS studentName, stars, body
                    FROM Review
                        LEFT JOIN AppUser AS Student ON Student.id = Review.studentId
                    WHERE Review.courseId = ?""")) {
                st.setObject(1, courseId);
                ResultSet rs = st.executeQuery();
                ArrayList<ReviewResponse> reviews = new ArrayList<>();
                while (rs.next()) {
                    reviews.add(new ReviewResponse() {
                        {
                            studentId = rs.getObject("studentId", UUID.class);
                            studentName = rs.getString("studentName");
                            stars = rs.getInt("stars");
                            body = rs.getString("body");
                        }
                    });
                }
                return Response.status(200).entity(new ReviewsResponse(reviews)).build();
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
                return Response.status(400).entity(new MessageResponse("Empty body")).build();

            if (req.stars < 1 || req.stars > 5)
                return Response.status(400).entity(new MessageResponse("Stars must be between 1 and 5")).build();

            UUID studentId = accountRs.getObject("id", UUID.class);

            try (PreparedStatement st = conn.prepareStatement(String.format("""
                    SELECT Course.id, Enrollment.id
                    FROM Course
                        LEFT JOIN Enrollment ON Course.id = Enrollment.courseId
                    WHERE
                        Course.id = ?
                        AND Course.endDate <= %s
                        AND Course.status = 'ACCEPTED'
                        AND Enrollment.studentId = ?
                        AND Enrollment.status = 'ACCEPTED'""", System.currentTimeMillis() / 1000L))) {
                st.setObject(1, courseId);
                st.setObject(2, studentId);
                ResultSet rs = st.executeQuery();
                if (!rs.next())
                    return Response.status(404)
                            .entity(new MessageResponse(
                                    "Could not find the specified course in finished courses you were enrolled in"))
                            .build();
            }

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
                st.executeUpdate();
                return Response.ok().build();
            }
        });
    }

    private String escapeLikeString(String likeString) {
        return likeString.replace("!", "!!").replace("%", "!%").replace("_", "!_").replace("[", "![");
    }

    @GET
    @Path("/course")
    public Response listCourses(@QueryParam("sortBy") String sortBy, @QueryParam("name") String name,
            @QueryParam("category") String category, @QueryParam("mine") Boolean mine) throws SQLException {
        return withRole("*", (conn, accountRs) -> {
            StringBuilder query = new StringBuilder("""
                    SELECT
                        Course.id AS courseId,
                        Course.name AS courseName,
                        Instructor.id AS instructorId,
                        Instructor.name AS instructorName,
                        AVG(Review.stars) AS averageStars,
                        COUNT(Review.id) AS numberOfReviews,
                        COUNT(Enrollment.id) AS numberOfEnrollments,
                        Course.category,
                        Course.startDate,
                        Course.endDate,
                        Course.capacity,
                        Course.status
                    FROM Course
                        LEFT JOIN AppUser AS Instructor
                            ON Instructor.id = Course.instructorId
                            AND Enrollment.status = 'ACCEPTED'
                        LEFT JOIN Review ON Review.courseId = Course.id""");
            ArrayList<String> where = new ArrayList<>();
            LinkedList<Binding> bindings = new LinkedList<>();
            String role = accountRs.getString("role");
            boolean instructorWantsTheirCourses = role.equals(INSTRUCTOR_ROLE) && mine != null;
            if (!role.equals(ADMIN_ROLE) && !instructorWantsTheirCourses)
                where.add("Course.status = 'ACCEPTED'");
            if (name != null) {
                where.add("LOWER(Course.name) LIKE LOWER(?)");
                bindings.addLast((i, st) -> st.setString(i, escapeLikeString(name)));
            }
            if (category != null) {
                where.add("LOWER(Course.category) LIKE LOWER(?)");
                bindings.addLast((i, st) -> st.setString(i, escapeLikeString(category)));
            }
            if (instructorWantsTheirCourses) {
                where.add("Instructor.id = ?");
                bindings.addLast((i, st) -> st.setObject(i, accountRs.getString("id")));
            }

            if (where.size() > 0)
                query.append(" WHERE " + String.join(" AND ", where));

            query.append(" GROUP BY Course.id, Instructor.id");

            if (sortBy != null && sortBy.equals("stars"))
                query.append(" ORDER BY averageStars DESC");

            try (PreparedStatement st = conn.prepareStatement(query.toString())) {
                applyBindings(st, bindings);
                ResultSet rs = st.executeQuery();
                ArrayList<CourseResponse> courses = new ArrayList<>();
                while (rs.next()) {
                    courses.add(new CourseResponse() {
                        {
                            id = rs.getObject("courseId", UUID.class);
                            name = rs.getString("courseName");
                            instructorId = rs.getObject("instructorId", UUID.class);
                            instructorName = rs.getString("instructorName");
                            averageStars = rs.getInt("averageStars");
                            averageStars = averageStars == null ? 0 : averageStars;
                            numberOfReviews = rs.getInt("numberOfReviews");
                            numberOfEnrollments = rs.getInt("numberOfEnrollments");
                            category = rs.getString("category");
                            startDate = rs.getLong("startDate");
                            endDate = rs.getLong("endDate");
                            capacity = rs.getInt("capacity");
                            status = rs.getString("status");
                        }
                    });
                }
                return Response.ok().entity(new CoursesResponse(courses)).build();
            }
        });
    }

    @GET
    @Path("/notification")
    public Response listNotifications(@QueryParam("read") Boolean isRead) throws SQLException {
        return withRole("*", (conn, accountRs) -> {
            StringBuilder query = new StringBuilder(
                    "SELECT id, title, body, isRead FROM Notification WHERE userId = ?");
            if (isRead != null)
                query.append(" AND isRead = " + (isRead ? "true" : "false"));
            try (PreparedStatement st = conn.prepareStatement(query.toString())) {
                st.setObject(1, UUID.class);
                ResultSet rs = st.executeQuery();
                ArrayList<NotificationResponse> notifications = new ArrayList<>();
                while (rs.next()) {
                    notifications.add(new NotificationResponse() {
                        {
                            id = rs.getObject("id", UUID.class);
                            title = rs.getString("title");
                            body = rs.getString("body");
                            isRead = rs.getBoolean("isRead");
                        }
                    });
                }
                return Response.status(200).entity(new NotificationsResponse(notifications)).build();
            }
        });
    }

    @PUT
    @Path("/notification/{id}")
    public Response updateNotification(@PathParam("id") UUID id, NotificationUpdateRequest req) throws SQLException {
        return withRole("*", (conn, accountRs) -> {
            if (req.isRead == null)
                return Response.status(400).entity(new MessageResponse("Empty body")).build();
            try (PreparedStatement st = conn.prepareStatement("UPDATE Notification SET isRead = "
                    + (req.isRead ? "true" : "false") + " WHERE id = ? AND userId = ?")) {
                st.setObject(1, id);
                st.setObject(2, accountRs.getObject("id", UUID.class));
                if (st.executeUpdate() == 0)
                    return Response.status(404).entity(new MessageResponse("Could not find the specified notification"))
                            .build();
                return Response.status(200).build();
            }
        });
    }

    @POST
    @Path("/course/{id}/enrollment")
    public Response createEnrollment(@PathParam("id") UUID id) throws SQLException {
        return withRole(STUDENT_ROLE, (_conn, rs) -> {
            context.createProducer().send(queue, "CREATE:" + rs.getObject("id", UUID.class) + ":" + id);
            return Response.status(202).build();
        });
    }

    @DELETE
    @Path("/enrollment/{id}")
    public Response deleteEnrollment(@PathParam("id") UUID id) throws SQLException {
        return withRole(STUDENT_ROLE, (_conn, rs) -> {
            context.createProducer().send(queue, "DELETE:" + rs.getObject("id", UUID.class) + ":" + id);
            return Response.status(202).build();
        });
    }

    @PUT
    @Path("/enrollment/{id}")
    public Response updateEnrollment(@PathParam("id") UUID id, EnrollmentUpdateRequest req) throws SQLException {
        return withRole(INSTRUCTOR_ROLE, (_conn, rs) -> {
            if (!req.status.equals("ACCEPTED") || req.status.equals("REJECTED"))
                return Response.status(400).entity(new MessageResponse("Invalid status")).build();
            context.createProducer().send(queue,
                    "UPDATE:" + rs.getObject("id", UUID.class) + ":" + id + ":" + req.status);
            return Response.status(202).build();
        });
    }

    @GET
    @Path("/course/{id}/enrollment")
    public Response listCourseEnrollments(@PathParam("id") UUID id) throws SQLException {
        return withRole(INSTRUCTOR_ROLE, (conn, accountRs) -> {
            // Make sure course belongs to instructor
            try (PreparedStatement st = conn
                    .prepareStatement("SELECT id FROM Course where id = ? AND instructorId = ?")) {
                st.setObject(1, id);
                st.setObject(2, accountRs.getObject("id", UUID.class));
                ResultSet rs = st.executeQuery();
                if (!rs.next())
                    return Response.status(404)
                            .entity(new MessageResponse("Could not find the specified course in your courses")).build();
            }
            try (PreparedStatement st = conn.prepareStatement("""
                    SELECT
                        Enrollment.id AS id,
                        Enrollment.studentId AS studentId,
                        Student.name as studentName,
                        Enrollment.status as status
                    FROM
                        Enrollment
                        LEFT JOIN Student ON Student.id = Enrollment.studentId
                    WHERE
                        Enrollment.courseId = ?""")) {
                st.setObject(1, id);
                ResultSet rs = st.executeQuery();
                ArrayList<InstructorEnrollmentResponse> enrollments = new ArrayList<>();
                while (rs.next()) {
                    enrollments.add(new InstructorEnrollmentResponse() {
                        {
                            id = rs.getObject("id", UUID.class);
                            studentId = rs.getObject("studentId", UUID.class);
                            studentName = rs.getString("studentName");
                            status = rs.getString("status");
                        }
                    });
                }
                return Response.status(200).entity(new InstructorEnrollmentsResponse(enrollments)).build();
            }
        });
    }

    @GET
    @Path("/enrollment")
    public Response listStudentEnrollments(@QueryParam("isPast") Boolean isPast) throws SQLException {
        return withRole(STUDENT_ROLE, (conn, accountRs) -> {
            String dateFilter = "";
            if (isPast != null) {
                long currentDate = System.currentTimeMillis() / 1000L;
                dateFilter = isPast ? " AND Course.endDate <= " + currentDate : "AND Course.endDate > " + currentDate;
            }
            try (PreparedStatement st = conn.prepareStatement("""
                    SELECT
                        Enrollment.id AS id,
                        Enrollment.courseId AS courseId,
                        Course.name as courseName,
                        Course.startDate as courseStartDate,
                        Course.endDate as courseEndDate,
                        Enrollment.status as status
                    FROM
                        Enrollment
                        LEFT JOIN Course ON Course.id = Enrollment.courseId
                    WHERE
                        Enrollment.studentId = ?
                        AND Course.status = 'ACCEPTED'""" + dateFilter)) {
                st.setObject(1, accountRs.getObject("id", UUID.class));
                ResultSet rs = st.executeQuery();
                ArrayList<StudentEnrollmentResponse> enrollments = new ArrayList<>();
                while (rs.next()) {
                    enrollments.add(new StudentEnrollmentResponse() {
                        {
                            id = rs.getObject("id", UUID.class);
                            courseId = rs.getObject("courseId", UUID.class);
                            courseName = rs.getString("courseName");
                            courseStartDate = rs.getLong("courseStartDate");
                            courseEndDate = rs.getLong("courseEndDate");
                            status = rs.getString("status");
                        }
                    });
                }
                return Response.status(200).entity(new StudentEnrollmentsResponse(enrollments)).build();
            }
        });
    }

    @GET
    @Path("/usage")
    public Response getPlatformUsage() throws SQLException {
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

            Integer noAcceptedCourses = 0;
            Integer noPendingCourses = 0;
            try (PreparedStatement st = conn.prepareStatement("SELECT count(id) AS count, status FROM Course")) {
                ResultSet rs = st.executeQuery();
                while (rs.next()) {
                    Integer count = rs.getInt("count");
                    String status = rs.getString("status");
                    if (status.equals("ACCEPTED"))
                        noAcceptedCourses = count;
                    else if (status.equals("PENDING"))
                        noPendingCourses = count;
                }
            }

            Integer noAcceptedEnrollments = 0;
            Integer noRejectedEnrollments = 0;
            try (PreparedStatement st = conn
                    .prepareStatement("SELECT count(id) AS count, status FROM Enrollment GROUP BY status")) {
                ResultSet rs = st.executeQuery();
                while (rs.next()) {
                    Integer count = rs.getInt("count");
                    String status = rs.getString("status");
                    if (status.equals("ACCEPTED"))
                        noAcceptedEnrollments = count;
                    else if (status.equals("REJECTED"))
                        noRejectedEnrollments = count;
                }
            }

            final int nStudents = noStudents;
            final int nInstructors = noInstructors;
            final int nAdmins = noAdmins;
            final int nAcceptedCourses = noAcceptedCourses;
            final int nPendingCourses = noPendingCourses;
            final int nAcceptedEnrollments = noAcceptedEnrollments;
            final int nRejectedEnrollments = noRejectedEnrollments;
            return Response.status(200).entity(new UsageResponse() {
                {
                    numberOfStudents = nStudents;
                    numberOfInstructors = nInstructors;
                    numberOfAdmins = nAdmins;
                    numberOfAcceptedCourses = nAcceptedCourses;
                    numberOfPendingCourses = nPendingCourses;
                    numberOfAcceptedEnrollments = nAcceptedEnrollments;
                    numberOfRejectedEnrollments = nRejectedEnrollments;
                }
            }).build();
        });
    }
}

class UsageResponse {
    public Integer numberOfStudents;
    public Integer numberOfInstructors;
    public Integer numberOfAdmins;
    public Integer numberOfAcceptedCourses;
    public Integer numberOfPendingCourses;
    public Integer numberOfAcceptedEnrollments;
    public Integer numberOfRejectedEnrollments;
}

class UserResponse {
    public UUID id;
    public String name;
    public String email;
    public String role;
    public Integer experience;
    public String bio;
}

class InstructorResponse {
    public UUID id;
    public String name;
    public Integer experience;
    public String bio;
}

class FullCourseResponse {
    public UUID id;
    public String name;
    public String category;
    public String description;
    public UUID instructorId;
    public Long startDate;
    public Long endDate;
    public Integer capacity;
    public Integer numberOfEnrollments;
    public Integer numberOfReviews;
    public Integer averageStars;
    public String status;
    public Boolean enrolled;
}

class CourseResponse {
    public UUID id;
    public String name;
    public UUID instructorId;
    public String instructorName;
    public Integer averageStars;
    public Integer numberOfReviews;
    public Integer numberOfEnrollments;
    public String category;
    public Long startDate;
    public Long endDate;
    public Integer capacity;
    public String status;
}

class CoursesResponse {
    public ArrayList<CourseResponse> courses;

    public CoursesResponse(ArrayList<CourseResponse> courses) {
        this.courses = courses;
    }
}

class NotificationResponse {
    public UUID id;
    public String title;
    public String body;
    public Boolean isRead;
}

class NotificationsResponse {
    public ArrayList<NotificationResponse> notifications;

    public NotificationsResponse(ArrayList<NotificationResponse> notifications) {
        this.notifications = notifications;
    }
}

class InstructorEnrollmentResponse {
    public UUID id;
    public UUID studentId;
    public String studentName;
    public String status;
}

class InstructorEnrollmentsResponse {
    public ArrayList<InstructorEnrollmentResponse> enrollments;

    public InstructorEnrollmentsResponse(ArrayList<InstructorEnrollmentResponse> enrollments) {
        this.enrollments = enrollments;
    }
}

class StudentEnrollmentResponse {
    public UUID id;
    public UUID courseId;
    public String courseName;
    public Long courseStartDate;
    public Long courseEndDate;
    public String status;
}

class StudentEnrollmentsResponse {
    public ArrayList<StudentEnrollmentResponse> enrollments;

    public StudentEnrollmentsResponse(ArrayList<StudentEnrollmentResponse> enrollments) {
        this.enrollments = enrollments;
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

class ReviewResponse {
    UUID studentId;
    String studentName;
    Integer stars;
    String body;
}

class ReviewsResponse {
    public ArrayList<ReviewResponse> reviews;

    public ReviewsResponse(ArrayList<ReviewResponse> reviews) {
        this.reviews = reviews;
    }

}

interface Binding {
    public void apply(int idx, PreparedStatement st) throws SQLException;
}

interface Callback {
    public Response apply(Connection conn, ResultSet rs) throws SQLException;
};
