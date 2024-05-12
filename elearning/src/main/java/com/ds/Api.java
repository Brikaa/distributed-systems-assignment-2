package com.ds;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.UUID;

import com.ds.clientresponses.InstructorResponse;
import com.ds.clientresponses.RequestContext;
import com.ds.clientresponses.StudentResponse;
import com.ds.clientresponses.UserCountResponse;
import com.ds.requests.*;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.Resource;
import jakarta.ejb.EJB;
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
    @EJB
    private ApiDataSource dataSource;

    @EJB
    private ApiClient apiClient;

    @EJB
    private DateTimeService dateTimeService;

    @Context
    private HttpServletRequest servletRequest;

    @Inject
    private JMSContext context;

    @Resource(lookup = "java:/queue/enrollments")
    private Queue queue;

    private String userServiceUrl;

    private static final String ADMIN_ROLE = "ADMIN";
    private static final String INSTRUCTOR_ROLE = "INSTRUCTOR";
    private static final String STUDENT_ROLE = "STUDENT";

    @PostConstruct
    public void init() {
        userServiceUrl = System.getenv("USER_SERVICE_URL");
    }

    private String getAuthHeader() {
        return servletRequest.getHeader("Authorization");
    }

    private Response withRole(String[] roles, Callback callback) throws SQLException {
        String authHeader = getAuthHeader();
        if (authHeader == null)
            return Response.status(401).build();
        Response res = apiClient.getInstance().target(userServiceUrl + "/user")
                .request(MediaType.APPLICATION_JSON)
                .header("Authorization", authHeader)
                .get();
        if (res.getStatus() != 200)
            return res;
        RequestContext ctx = res.readEntity(RequestContext.class);
        if (roles.length != 0) {
            boolean found = false;
            String myRole = ctx.role;
            for (String role : roles) {
                if (role.equals(myRole)) {
                    found = true;
                    break;
                }
            }
            if (!found)
                return Response.status(403).build();
        }

        return callback.apply(ctx);
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

    private int applyBindings(PreparedStatement st, LinkedList<Binding> bindings) throws SQLException {
        int i = 1;
        while (!bindings.isEmpty()) {
            bindings.getFirst().apply(i++, st);
            bindings.removeFirst();
        }
        return i;
    }

    private String getInvalidCourseNameError(String name) {
        return name.isEmpty() ? "Name can't be empty" : null;
    }

    private String getInvalidCourseDatesError(Long startDate, Long endDate) {
        if (endDate < startDate)
            return "End date can't be before the start date";
        if ((startDate * 1000) < dateTimeService.getTimestamp())
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
        return withRole(INSTRUCTOR_ROLE, (ctx) -> {
            if (req.name == null || req.description == null || req.startDate == null || req.endDate == null
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

            try (Connection conn = dataSource.getInstance().getConnection();
                    PreparedStatement st = conn.prepareStatement(
                            "INSERT INTO Course (instructorId, name, description, startDate, endDate, category, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')")) {
                int i = 1;
                st.setObject(i++, ctx.id);
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
        return withRole(new String[] { ADMIN_ROLE, INSTRUCTOR_ROLE }, (ctx) -> {
            boolean isInstructor = ctx.role.equals(INSTRUCTOR_ROLE);
            StringBuilder query = new StringBuilder("DELETE FROM Course WHERE id = ? ");
            if (isInstructor)
                query.append("AND instructorId = ?");
            try (Connection conn = dataSource.getInstance().getConnection();
                    PreparedStatement st = conn.prepareStatement(query.toString())) {
                st.setObject(1, id);
                if (isInstructor)
                    st.setObject(2, ctx.id);
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
        return withRole("*", (ctx) -> {
            String role = ctx.role;
            UUID accountId = ctx.id;
            String courseFilter = "";
            if (role.equals(STUDENT_ROLE))
                courseFilter = " AND Course.status = 'ACCEPTED'";
            if (role.equals(INSTRUCTOR_ROLE))
                courseFilter = " AND Course.status = 'ACCEPTED' OR Course.instructorId = ?";
            try (Connection conn = dataSource.getInstance().getConnection();
                    PreparedStatement st = conn.prepareStatement(String.format(
                            """
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
                                        LEFT JOIN Enrollment
                                            ON Enrollment.courseId = Course.id
                                            AND Enrollment.status = 'ACCEPTED'
                                        LEFT JOIN Enrollment AS MyEnrollment
                                            ON MyEnrollment.id = Enrollment.id
                                            AND MyEnrollment.studentId = ?
                                    WHERE
                                        Course.id = ?
                                        %s
                                    GROUP BY Course.id""",
                            courseFilter))) {
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
                        averageStars = rs.getFloat("averageStars");
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
        return withRole(new String[] { ADMIN_ROLE, INSTRUCTOR_ROLE }, (ctx) -> {
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

            String role = ctx.role;
            if (req.status != null && role.equals(ADMIN_ROLE)) {
                if (!req.status.equals("ACCEPTED") && !req.status.equals("PENDING"))
                    return Response.status(400).entity(new MessageResponse("Invalid status")).build();
                updates.add("status = ?");
                bindings.addLast((i, st) -> st.setString(i, req.status));
            }

            if (updates.isEmpty())
                return Response.status(400).entity(new MessageResponse("Empty body")).build();

            query.append(String.join(",", updates));
            query.append(" WHERE id = ?");

            boolean isInstructor = role.equals(INSTRUCTOR_ROLE);
            if (isInstructor)
                query.append(" AND instructorId = ?");

            try (Connection conn = dataSource.getInstance().getConnection();
                    PreparedStatement st = conn.prepareStatement(query.toString())) {
                int i = applyBindings(st, bindings);
                st.setObject(i++, id);
                if (isInstructor)
                    st.setObject(i++, ctx.id);
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
        return withRole("*", (_) -> {
            try (Connection conn = dataSource.getInstance().getConnection()) {
                try (PreparedStatement st = conn
                        .prepareStatement("SELECT id FROM Course WHERE id = ? AND status = 'ACCEPTED'")) {
                    st.setObject(1, courseId);
                    ResultSet rs = st.executeQuery();
                    if (!rs.next())
                        return Response.status(404).entity(new MessageResponse("Could not find the specified course"))
                                .build();
                }
                try (PreparedStatement st = conn
                        .prepareStatement("SELECT id, studentId, stars, body FROM Review WHERE courseId = ?")) {
                    st.setObject(1, courseId);
                    ResultSet rs = st.executeQuery();
                    ArrayList<ReviewResponse> reviews = new ArrayList<>();
                    while (rs.next()) {
                        Response res = apiClient.getInstance().target(userServiceUrl + "/student")
                                .request(MediaType.APPLICATION_JSON).header("Authorization", getAuthHeader()).get();
                        String sName = res.getStatus() == 200 ? res.readEntity(StudentResponse.class).name
                                : "Unknown";
                        reviews.add(new ReviewResponse() {
                            {
                                studentId = rs.getObject("studentId", UUID.class);
                                studentName = sName;
                                stars = rs.getInt("stars");
                                body = rs.getString("body");
                            }
                        });
                    }
                    return Response.status(200).entity(new ReviewsResponse(reviews)).build();
                }
            }
        });
    }

    @POST
    @Path("/course/{courseId}/review")
    public Response createReview(@PathParam("courseId") UUID courseId, ReviewCreateRequest req) throws SQLException {
        return withRole(STUDENT_ROLE, (ctx) -> {
            if (req.body == null)
                req.body = "";

            if (req.stars == null)
                return Response.status(400).entity(new MessageResponse("Empty body")).build();

            if (req.stars < 0 || req.stars > 5)
                return Response.status(400).entity(new MessageResponse("Stars must be between 0 and 5")).build();

            UUID studentId = ctx.id;

            try (Connection conn = dataSource.getInstance().getConnection()) {
                try (PreparedStatement st = conn.prepareStatement(String.format("""
                        SELECT Course.id, Enrollment.id
                        FROM Course
                            LEFT JOIN Enrollment ON Course.id = Enrollment.courseId
                        WHERE
                            Course.id = ?
                            AND Course.endDate <= %s
                            AND Course.status = 'ACCEPTED'
                            AND Enrollment.studentId = ?
                            AND Enrollment.status = 'ACCEPTED'""", dateTimeService.getTimestamp() / 1000L))) {
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
                        return Response.status(400)
                                .entity(new MessageResponse("You already have a review on this course"))
                                .build();
                }

                try (PreparedStatement st = conn
                        .prepareStatement(
                                "INSERT INTO Review (studentId, courseId, stars, body) VALUES (?, ?, ?, ?)")) {
                    int i = 1;
                    st.setObject(i++, studentId);
                    st.setObject(i++, courseId);
                    st.setObject(i++, req.stars);
                    st.setObject(i++, req.body);
                    st.executeUpdate();
                    return Response.ok().build();
                }
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
        return withRole("*", (ctx) -> {
            StringBuilder query = new StringBuilder("""
                    SELECT
                        Course.id AS courseId,
                        Course.name AS courseName,
                        Course.instructorId AS instructorId,
                        AVG(Review.stars) AS averageStars,
                        COUNT(Review.id) AS numberOfReviews,
                        COUNT(Enrollment.id) AS numberOfEnrollments,
                        Course.category,
                        Course.startDate,
                        Course.endDate,
                        Course.capacity,
                        Course.status
                    FROM Course
                        LEFT JOIN Enrollment ON Enrollment.courseId = Course.id AND Enrollment.status = 'ACCEPTED'
                        LEFT JOIN Review ON Review.courseId = Course.id""");
            ArrayList<String> where = new ArrayList<>();
            LinkedList<Binding> bindings = new LinkedList<>();
            String role = ctx.role;
            boolean instructorWantsTheirCourses = role.equals(INSTRUCTOR_ROLE) && mine != null;
            if (!role.equals(ADMIN_ROLE) && !instructorWantsTheirCourses)
                where.add("Course.status = 'ACCEPTED'");
            if (name != null) {
                where.add("LOWER(Course.name) LIKE LOWER(?)");
                bindings.addLast((i, st) -> st.setString(i, escapeLikeString("%" + name + "%")));
            }
            if (category != null) {
                where.add("LOWER(Course.category) LIKE LOWER(?)");
                bindings.addLast((i, st) -> st.setString(i, escapeLikeString("%" + category + "%")));
            }
            if (instructorWantsTheirCourses) {
                where.add("Course.instructorId = ?");
                bindings.addLast((i, st) -> st.setObject(i, ctx.id));
            }

            if (!where.isEmpty())
                query.append(" WHERE " + String.join(" AND ", where));

            query.append(" GROUP BY Course.id");

            if (sortBy != null && sortBy.equals("stars"))
                query.append(" ORDER BY averageStars DESC, Course.name DESC");

            try (Connection conn = dataSource.getInstance().getConnection();
                    PreparedStatement st = conn.prepareStatement(query.toString())) {
                applyBindings(st, bindings);
                ResultSet rs = st.executeQuery();
                ArrayList<CourseResponse> courses = new ArrayList<>();
                while (rs.next()) {
                    Response res = apiClient.getInstance().target(userServiceUrl + "/instructor")
                            .request(MediaType.APPLICATION_JSON).header("Authorization", getAuthHeader()).get();
                    String iName = res.getStatus() == 200 ? res.readEntity(InstructorResponse.class).name
                            : "Unknown";

                    courses.add(new CourseResponse() {
                        {
                            id = rs.getObject("courseId", UUID.class);
                            name = rs.getString("courseName");
                            instructorId = rs.getObject("instructorId", UUID.class);
                            instructorName = iName;
                            averageStars = rs.getFloat("averageStars");
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
        return withRole("*", (_) -> {
            StringBuilder query = new StringBuilder(
                    "SELECT id, title, body, isRead FROM Notification WHERE userId = ?");
            if (isRead != null)
                query.append(" AND isRead = " + (isRead ? "true" : "false"));
            try (Connection conn = dataSource.getInstance().getConnection();
                    PreparedStatement st = conn.prepareStatement(query.toString())) {
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
        return withRole("*", (ctx) -> {
            if (req.isRead == null)
                return Response.status(400).entity(new MessageResponse("Empty body")).build();
            try (Connection conn = dataSource.getInstance().getConnection();
                    PreparedStatement st = conn.prepareStatement("UPDATE Notification SET isRead = "
                            + (req.isRead ? "true" : "false") + " WHERE id = ? AND userId = ?")) {
                st.setObject(1, id);
                st.setObject(2, ctx.id);
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
        return withRole(STUDENT_ROLE, (ctx) -> {
            context.createProducer().send(queue, "CREATE:" + ctx.id + ":" + id);
            return Response.status(202).build();
        });
    }

    @DELETE
    @Path("/enrollment/{id}")
    public Response deleteEnrollment(@PathParam("id") UUID id) throws SQLException {
        return withRole(STUDENT_ROLE, (ctx) -> {
            context.createProducer().send(queue, "DELETE:" + ctx.id + ":" + id);
            return Response.status(202).build();
        });
    }

    @PUT
    @Path("/enrollment/{id}")
    public Response updateEnrollment(@PathParam("id") UUID id, EnrollmentUpdateRequest req) throws SQLException {
        return withRole(INSTRUCTOR_ROLE, (ctx) -> {
            if (!req.status.equals("ACCEPTED") || req.status.equals("REJECTED"))
                return Response.status(400).entity(new MessageResponse("Invalid status")).build();
            context.createProducer().send(queue,
                    "UPDATE:" + ctx.id + ":" + id + ":" + req.status);
            return Response.status(202).build();
        });
    }

    @GET
    @Path("/course/{id}/enrollment")
    public Response listCourseEnrollments(@PathParam("id") UUID id) throws SQLException {
        return withRole(INSTRUCTOR_ROLE, (ctx) -> {
            // Make sure course belongs to instructor
            try (Connection conn = dataSource.getInstance().getConnection()) {
                try (PreparedStatement st = conn
                        .prepareStatement("SELECT id FROM Course where id = ? AND instructorId = ?")) {
                    st.setObject(1, id);
                    st.setObject(2, ctx.id);
                    ResultSet rs = st.executeQuery();
                    if (!rs.next())
                        return Response.status(404)
                                .entity(new MessageResponse("Could not find the specified course in your courses"))
                                .build();
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
            }
        });
    }

    @GET
    @Path("/enrollment")
    public Response listStudentEnrollments(@QueryParam("isPast") Boolean isPast) throws SQLException {
        return withRole(STUDENT_ROLE, (ctx) -> {
            String dateFilter = "";
            if (isPast != null) {
                long currentDate = dateTimeService.getTimestamp() / 1000L;
                dateFilter = isPast ? " AND Course.endDate <= " + currentDate : "AND Course.endDate > " + currentDate;
            }
            try (Connection conn = dataSource.getInstance().getConnection();
                    PreparedStatement st = conn.prepareStatement("""
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
                st.setObject(1, ctx.id);
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
        return withRole(ADMIN_ROLE, (ctx) -> {
            Response res = apiClient.getInstance().target(userServiceUrl + "/user-count")
                    .request(MediaType.APPLICATION_JSON).header("Authorization", getAuthHeader()).get();
            if (res.getStatus() != 200)
                return Response.status(500).build();
            UserCountResponse userCountResponse = res.readEntity(UserCountResponse.class);
            try (Connection conn = dataSource.getInstance().getConnection()) {
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
                Integer noPendingEnrollments = 0;
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
                        else if (status.equals("PENDING"))
                            noPendingEnrollments = count;

                    }
                }

                final int nAcceptedCourses = noAcceptedCourses;
                final int nPendingCourses = noPendingCourses;
                final int nAcceptedEnrollments = noAcceptedEnrollments;
                final int nRejectedEnrollments = noRejectedEnrollments;
                final int nPendingEnrollments = noPendingEnrollments;
                return Response.status(200).entity(new UsageResponse() {
                    {
                        numberOfStudents = userCountResponse.numberOfStudents;
                        numberOfInstructors = userCountResponse.numberOfInstructors;
                        numberOfAdmins = userCountResponse.numberOfAdmins;
                        numberOfAcceptedCourses = nAcceptedCourses;
                        numberOfPendingCourses = nPendingCourses;
                        numberOfAcceptedEnrollments = nAcceptedEnrollments;
                        numberOfRejectedEnrollments = nRejectedEnrollments;
                        numberOfPendingEnrollments = nPendingEnrollments;
                    }
                }).build();
            }
        });
    }

    @POST
    @Path("/date")
    public Response setDate(DateChangeRequest req) {
        if (!dateTimeService.getShouldFake())
            return Response.status(404).build();
        dateTimeService.setTimestamp(req.date);
        return Response.status(200).build();
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
    public Integer numberOfPendingEnrollments;
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
    public Float averageStars;
    public String status;
    public Boolean enrolled;
}

class CourseResponse {
    public UUID id;
    public String name;
    public UUID instructorId;
    public String instructorName;
    public Float averageStars;
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
    public Response apply(RequestContext ctx) throws SQLException;
};
