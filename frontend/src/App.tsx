import React, { FormEvent, useCallback, useEffect, useState } from "react";

type ElementSetter = (element: JSX.Element) => void;

type Role = "ADMIN" | "INSTRUCTOR" | "STUDENT";
type EnrollmentStatus = "ACCEPTED" | "PENDING" | "REJECTED";

const LOCAL_STORAGE_TOKEN = "token";

interface RequestOptions {
  method: string;
  headers: { [key: string]: string };
  body?: any;
}

interface Context {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface InstructorEnrollmentResponse {
  id: string;
  studentId: string;
  studentName: string;
  status: EnrollmentStatus;
}

interface StudentEnrollmentResponse {
  id: string;
  courseId: string;
  courseName: string;
  courseStartDate: number;
  courseEndDate: number;
  status: EnrollmentStatus;
}

interface CourseResponse {
  id: string;
  name: string;
  instructorId: string;
  instructorName: string;
  averageStars: number;
  numberOfReviews: number;
  numberOfEnrollments: number;
  category: string;
  startDate: number;
  endDate: number;
  capacity: number;
  status: string;
}

interface UserInList {
  id: string;
  name: string;
}

interface ReviewResponse {
  id: string;
  studentId: string;
  studentName: string;
  stars: number;
  body: string;
}

interface UsageResponse {
  numberOfStudents: number;
  numberOfInstructors: number;
  numberOfAdmins: number;
  numberOfAcceptedCourses: number;
  numberOfPendingCourses: number;
  numberOfAcceptedEnrollments: number;
  numberOfRejectedEnrollments: number;
  numberOfPendingEnrollments: number;
}

interface InstructorResponse {
  name: string;
  experience: number;
  bio: string;
  affiliation: string;
}

interface NotificationResponse {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
}

const sendRequest = async (authToken: string | null, method: string, url: string, body?: any) => {
  const opts: RequestOptions = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };
  if (method.toLowerCase() !== "get" && method.toLowerCase() !== "delete") opts.body = JSON.stringify(body);
  if (authToken !== null) opts.headers["Authorization"] = `Basic ${authToken}`;
  const res = await fetch(url, opts);
  if (res.status >= 400) alert(`An error has occurred: ${await res.text()}`);
  return res;
};

const LogoutButton = (props: { setNavbar: ElementSetter; setPage: ElementSetter }) => {
  const logout = () => {
    localStorage.removeItem(LOCAL_STORAGE_TOKEN);
    props.setNavbar(<GuestNavbar setNavbar={props.setNavbar} setPage={props.setPage} />);
    props.setPage(<BlankPage />);
  };
  return <button onClick={logout}>Log out</button>;
};

const UserEditPage = (props: { user: UserInList; authToken: string }) => {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [experience, setExperience] = useState<number>(0);
  const [bio, setBio] = useState<string>("");
  const [affiliation, setAffiliation] = useState<string>("");

  const getAndSetUser = useCallback(async () => {
    const res = await sendRequest(props.authToken, "GET", `/api/user/user/${props.user.id}`);
    if (res.status !== 200) return;
    const u = await res.json();
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setExperience(u.experience);
    setBio(u.bio);
    setAffiliation(u.affiliation);
  }, [props.authToken, props.user.id]);

  useEffect(() => {
    getAndSetUser();
  }, [getAndSetUser]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res = await sendRequest(props.authToken, "PUT", `/api/user/user/${props.user.id}`, {
      name,
      email,
      password: password === "" ? null : password,
      role,
      experience,
      bio,
      affiliation,
    });
    if (res.status !== 200) return;
    alert("Success!");
    getAndSetUser();
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <br />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <br />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <br />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="STUDENT">Student</option>
          <option value="INSTRUCTOR">Instructor</option>
          <option value="ADMIN">Admin</option>
        </select>
        <br />
        {role === "INSTRUCTOR" && (
          <>
            <input
              type="number"
              min="0"
              value={experience}
              onChange={(e) => setExperience(parseInt(e.target.value))}
              title="Experience"
            />
            <br />
          </>
        )}
        <textarea placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} />
        <br />
        <input
          type="text"
          placeholder="Affiliation"
          value={affiliation}
          onChange={(e) => setAffiliation(e.target.value)}
        />
        <br />
        <input type="submit" value="Update" />
      </form>
    </div>
  );
};

const AllUsersPage = (props: { authToken: string; setPage: ElementSetter }) => {
  const [users, setUsers] = useState<UserInList[]>([]);
  useEffect(() => {
    (async () => {
      const res = await sendRequest(props.authToken, "GET", "/api/user/users");
      if (res.status !== 200) return;
      setUsers(await res.json());
    })();
  }, [props.authToken]);

  const handleDelete = async (userId: string) => {
    const c = window.confirm("Are you sure you want to delete this user?");
    if (!c) return;
    const res = await sendRequest(props.authToken, "DELETE", `/api/user/user/${userId}`);
    if (res.status !== 200) return;
    const res2 = await sendRequest(props.authToken, "GET", "/api/user/users");
    if (res2.status !== 200) return;
    setUsers(await res2.json());
  };
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>
          {u.name} (<button onClick={() => handleDelete(u.id)}>Delete</button>,{" "}
          <button onClick={() => props.setPage(<UserEditPage authToken={props.authToken} user={u} />)}>
            View/edit
          </button>
          )<br />
        </li>
      ))}
    </ul>
  );
};

const Enrollments = (props: {
  authToken: string;
  courseId: string;
  courseStart: number;
  getAndSetCourse: () => Promise<void>;
}) => {
  const [enrollments, setEnrollments] = useState<InstructorEnrollmentResponse[]>([]);

  const getAndSetEnrollments = useCallback(async () => {
    const res = await sendRequest(props.authToken, "GET", `/api/elearning/course/${props.courseId}/enrollment`);
    if (res.status !== 200) return;
    setEnrollments(await res.json());
  }, [props.courseId, props.authToken]);

  const handleEnrollmentUpdate = async (enrollmentId: string, newStatus: EnrollmentStatus) => {
    const res = await sendRequest(props.authToken, "PUT", `/api/elearning/enrollment/${enrollmentId}`, {
      status: newStatus,
    });
    if (res.status !== 202) return;
    alert("Submitted. We will process your request");
    getAndSetEnrollments();
    props.getAndSetCourse();
  };

  useEffect(() => {
    getAndSetEnrollments();
  }, [getAndSetEnrollments]);

  return (
    <>
      <h1>Enrollments</h1>
      <ul>
        {enrollments.map((e) => (
          <li key={e.id}>
            {e.studentName} - {e.status}{" "}
            {e.status === "PENDING" && (
              <>
                -{" "}
                <button
                  onClick={() => handleEnrollmentUpdate(e.id, "ACCEPTED")}
                  disabled={props.courseStart * 1000 < Date.now()}
                >
                  accept
                </button>{" "}
                - <button onClick={() => handleEnrollmentUpdate(e.id, "REJECTED")}>reject</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
};

const CourseEditPage = (props: { course: CourseResponse; authToken: string; ctx: Context }) => {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [startDate, setStartDate] = useState<number>(0);
  const [endDate, setEndDate] = useState<number>(0);
  const [startDateChanged, setStartDateChanged] = useState<boolean>(false);
  const [endDateChanged, setEndDateChanged] = useState<boolean>(false);
  const [category, setCategory] = useState<string>("");
  const [capacity, setCapacity] = useState<number>(0);
  const [status, setStatus] = useState<string>("ACCEPTED");
  const [averageStars, setAverageStars] = useState<number>(0);
  const [numberOfReviews, setNumberOfReviews] = useState<number>(0);
  const [numberOfEnrollments, setNumberOfEnrollments] = useState<number>(0);
  const [enrolled, setEnrolled] = useState<boolean>(false);
  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [instructor, setInstructor] = useState<InstructorResponse>({
    affiliation: "",
    bio: "",
    experience: 0,
    name: "",
  });
  const readonly = props.ctx.role !== "ADMIN";

  const getAndSetReviews = useCallback(async () => {
    const res = await sendRequest(props.authToken, "GET", `/api/elearning/course/${props.course.id}/review`);
    if (res.status !== 200) return;
    setReviews(await res.json());
  }, [props.course.id, props.authToken]);

  const getAndSetCourse = useCallback(async () => {
    const res = await sendRequest(props.authToken, "GET", `/api/elearning/course/${props.course.id}`);
    if (res.status !== 200) return;
    const c = await res.json();
    setName(c.name);
    setAverageStars(c.averageStars);
    setNumberOfReviews(c.numberOfReviews);
    setNumberOfEnrollments(c.numberOfEnrollments);
    setDescription(c.description);
    setStartDate(c.startDate);
    setEndDate(c.endDate);
    setCategory(c.category);
    setCapacity(c.capacity);
    setStatus(c.status);
    setEnrolled(c.enrolled);

    const res2 = await sendRequest(props.authToken, "GET", `/api/user/instructor/${props.course.instructorId}`);
    if (res2.status !== 200) return;
    setInstructor(await res2.json());

    if (c.status === "PENDING") return;
    getAndSetReviews();
  }, [props.authToken, props.course.id, props.course.instructorId, getAndSetReviews]);

  useEffect(() => {
    getAndSetCourse();
  }, [getAndSetCourse]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res = await sendRequest(props.authToken, "PUT", `/api/elearning/course/${props.course.id}`, {
      name,
      description,
      startDate: startDateChanged ? startDate : undefined,
      endDate: endDateChanged ? endDate : undefined,
      category,
      capacity,
      status,
    });
    if (res.status !== 200) return;
    alert("Success!");
    getAndSetCourse();
  };

  const handleEnroll = async () => {
    const res = await sendRequest(props.authToken, "POST", `/api/elearning/course/${props.course.id}/enrollment`);
    if (res.status !== 202) return;
    alert("Submitted. We will process your request");
  };

  const handleReview = async () => {
    const starsStr = prompt("Number of stars (0 - 5 inclusive)");
    if (starsStr === null) return;
    const stars = parseInt(starsStr);
    if (isNaN(stars) || stars < 0 || stars > 5) {
      alert("Stars must be a number that is between 0 and 5 (inclusive)");
      return;
    }
    const body = prompt("Review body");
    const res = await sendRequest(props.authToken, "POST", `/api/elearning/course/${props.course.id}/review`, {
      stars,
      body,
    });
    if (res.status !== 200) return;
    alert("Review submitted successfully");
    getAndSetReviews();
    getAndSetCourse();
  };

  return (
    <div>
      <h1>Course info</h1>
      <form onSubmit={readonly ? () => {} : handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={readonly}
        />
        <br />
        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={readonly}
        />
        <br />
        <input
          type="number"
          title="Start date (unix seconds)"
          value={startDate}
          onChange={(e) => {
            setStartDate(parseInt(e.target.value));
            setStartDateChanged(true);
          }}
          disabled={readonly}
        />
        <br />
        <input
          type="number"
          title="End date (unix seconds)"
          value={endDate}
          onChange={(e) => {
            setEndDate(parseInt(e.target.value));
            setEndDateChanged(true);
          }}
          disabled={readonly}
        />
        <br />
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={readonly}
        />
        <br />
        <input
          type="number"
          title="Capacity"
          value={capacity}
          onChange={(e) => setCapacity(parseInt(e.target.value))}
          disabled={readonly}
        />
        <br />
        <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={readonly}>
          <option value="ACCEPTED">ACCEPTED</option>
          <option value="PENDING">PENDING</option>
        </select>
        <br />
        <label>
          <b>Number of enrollments:</b> {numberOfEnrollments}
        </label>
        <br />
        <label>
          <b>Average stars:</b> {averageStars}
        </label>
        <br />
        <label>
          <b>Number of reviews:</b> {numberOfReviews}
        </label>
        <br />
        <label>
          <b>Enrolled:</b> {enrolled ? "yes" : "no"}
        </label>
        <br />
        {!readonly && <input type="submit" value="Update" />}
      </form>
      <h1>About the instructor</h1>
      <label>
        <b>Name:</b> {instructor.name}
      </label>
      <br />
      <label>
        <b>Experience:</b> {instructor.experience} years
      </label>
      <br />
      <label>
        <b>Bio:</b> {instructor.bio}
      </label>
      <br />
      <label>
        <b>Affiliation:</b> {instructor.affiliation}
      </label>
      <br />
      {props.ctx.role === "STUDENT" && (
        <>
          <button
            onClick={handleEnroll}
            disabled={enrolled || capacity <= numberOfEnrollments || startDate * 1000 <= Date.now()}
          >
            Enroll
          </button>{" "}
          -{" "}
          <button onClick={handleReview} disabled={!enrolled || Date.now() <= endDate * 1000}>
            Review
          </button>
        </>
      )}
      <h1>Reviews</h1>
      <ul>
        {reviews.map((r) => (
          <li key={r.id}>
            {r.stars} stars by {r.studentName}: {r.body}
          </li>
        ))}
      </ul>
      {props.ctx.role === "INSTRUCTOR" && props.ctx.id === props.course.instructorId && (
        <Enrollments
          authToken={props.authToken}
          courseId={props.course.id}
          courseStart={props.course.startDate}
          getAndSetCourse={getAndSetCourse}
        />
      )}
    </div>
  );
};

const CourseCreatePage = (props: { authToken: string }) => {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [startDate, setStartDate] = useState<number>(Math.floor(Date.now() / 1000));
  const [endDate, setEndDate] = useState<number>(Math.floor(Date.now() / 1000));
  const [category, setCategory] = useState<string>("");
  const [capacity, setCapacity] = useState<number>(1);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res = await sendRequest(props.authToken, "POST", `/api/elearning/course`, {
      name,
      description,
      startDate,
      endDate,
      category,
      capacity,
    });
    if (res.status !== 200) return;
    alert("Success!");
  };

  return (
    <div>
      <h1>Course info</h1>
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <br />
        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <br />
        <input
          type="number"
          title="Start date (unix seconds)"
          value={startDate}
          onChange={(e) => setStartDate(parseInt(e.target.value))}
          required
        />
        <br />
        <input
          type="number"
          title="End date (unix seconds)"
          value={endDate}
          onChange={(e) => setEndDate(parseInt(e.target.value))}
          required
        />
        <br />
        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        />
        <br />
        <input
          type="number"
          title="Capacity"
          value={capacity}
          onChange={(e) => setCapacity(parseInt(e.target.value))}
          required
        />
        <br />
        <input type="submit" value="Create" />
      </form>
    </div>
  );
};

const CoursesListPage = (props: { ctx: Context; authToken: string; setPage: ElementSetter }) => {
  const [courses, setCourses] = useState<CourseResponse[]>([]);
  const [name, setName] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  useEffect(() => {
    (async () => {
      const res = await sendRequest(props.authToken, "GET", "/api/elearning/course");
      if (res.status !== 200) return;
      setCourses(await res.json());
    })();
  }, [props.authToken]);

  const handleSort = async () => {
    const res = await sendRequest(props.authToken, "GET", "/api/elearning/course?sortBy=stars");
    if (res.status !== 200) return;
    setCourses(await res.json());
  };

  const handleFilter = async () => {
    const params = new URLSearchParams({ name, category });
    const res = await sendRequest(props.authToken, "GET", `/api/elearning/course?${params.toString()}`);
    if (res.status !== 200) return;
    setCourses(await res.json());
  };

  const handleDelete = async (courseId: string) => {
    const c = window.confirm("Are you sure you want to delete this course?");
    if (!c) return;
    const res = await sendRequest(props.authToken, "DELETE", `/api/elearning/course/${courseId}`);
    if (res.status !== 200) return;
    const res2 = await sendRequest(props.authToken, "GET", "/api/elearning/course");
    if (res2.status !== 200) return;
    setCourses(await res2.json());
  };

  return (
    <div>
      <input type="text" placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />{" "}
      <input type="text" placeholder="category" value={category} onChange={(e) => setCategory(e.target.value)} />{" "}
      <button onClick={handleFilter}>Filter</button> <button onClick={handleSort}>Sort by stars</button>
      <ul>
        {courses.map((c) => (
          <li key={c.id}>
            {c.name} - {c.category} - by {c.instructorName} - {new Date(c.startDate * 1000).toLocaleString()} till{" "}
            {new Date(c.endDate * 1000).toLocaleString()} - averageStars: {c.averageStars} ({c.numberOfReviews} reviews)
            - capacity: {c.numberOfEnrollments}/{c.capacity} (
            <button
              onClick={() => props.setPage(<CourseEditPage authToken={props.authToken} course={c} ctx={props.ctx} />)}
            >
              {/* TODO: instructor edit their own courses? */}
              {props.ctx.role === "ADMIN" ? "View/edit" : "View"}
            </button>
            {props.ctx.role === "ADMIN" && (
              <>
                , <button onClick={() => handleDelete(c.id)}>Delete</button>
              </>
            )}
            )
          </li>
        ))}
      </ul>
    </div>
  );
};

const AdminPlatformUsagePage = (props: { authToken: string }) => {
  const [usage, setUsage] = useState<UsageResponse>({
    numberOfAcceptedCourses: 0,
    numberOfAcceptedEnrollments: 0,
    numberOfAdmins: 0,
    numberOfInstructors: 0,
    numberOfPendingCourses: 0,
    numberOfPendingEnrollments: 0,
    numberOfRejectedEnrollments: 0,
    numberOfStudents: 0,
  });
  useEffect(() => {
    (async () => {
      const res = await sendRequest(props.authToken, "GET", "/api/elearning/usage");
      if (res.status !== 200) return;
      setUsage(await res.json());
    })();
  }, [props.authToken]);

  return (
    <div>
      <label>
        <b>numberOfStudents:</b> {usage.numberOfStudents}
      </label>
      <br />
      <label>
        <b>numberOfInstructors:</b> {usage.numberOfInstructors}
      </label>
      <br />
      <label>
        <b>numberOfAdmins:</b> {usage.numberOfAdmins}
      </label>
      <br />
      <label>
        <b>numberOfAcceptedCourses:</b> {usage.numberOfAcceptedCourses}
      </label>
      <br />
      <label>
        <b>numberOfPendingCourses:</b> {usage.numberOfPendingCourses}
      </label>
      <br />
      <label>
        <b>numberOfAcceptedEnrollments:</b> {usage.numberOfAcceptedEnrollments}
      </label>
      <br />
      <label>
        <b>numberOfRejectedEnrollments:</b> {usage.numberOfRejectedEnrollments}
      </label>
      <br />
      <label>
        <b>numberOfPendingEnrollments:</b> {usage.numberOfPendingEnrollments}
      </label>
      <br />
    </div>
  );
};

const NotificationsPage = (props: { authToken: string }) => {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);

  const handleFilter = useCallback(
    async (queryParam: string) => {
      const res = await sendRequest(props.authToken, "GET", `/api/elearning/notification${queryParam}`);
      if (res.status !== 200) return;
      const body = await res.json();
      setNotifications(body);
      body.forEach((n: NotificationResponse) => {
        if (!n.isRead) sendRequest(props.authToken, "PUT", `/api/elearning/notification/${n.id}`, { isRead: true });
      });
    },
    [props.authToken]
  );

  useEffect(() => {
    handleFilter("?isRead=false");
  }, [handleFilter]);

  return (
    <div>
      <h1>Notifications</h1>
      <button onClick={() => handleFilter("?isRead=false")}>unread</button> -{" "}
      <button onClick={() => handleFilter("?isRead=true")}>read</button> -{" "}
      <button onClick={() => handleFilter("")}>all</button>
      <ul>
        {notifications.map((n) => (
          <li key={n.id}>
            {n.isRead ? n.title : <b>{n.title}</b>}
            <br />
            {n.body}
          </li>
        ))}
      </ul>
    </div>
  );
};

const NotificationsButton = (props: { setPage: ElementSetter; authToken: string }) => {
  return (
    <button
      onClick={() => {
        props.setPage(<NotificationsPage authToken={props.authToken} />);
      }}
    >
      Notifications
    </button>
  );
};

const AdminNavbar = (props: { authToken: string; ctx: Context; setNavbar: ElementSetter; setPage: ElementSetter }) => {
  return (
    <div>
      Logged in as: {props.ctx.name} ({props.ctx.role}) -{" "}
      <NotificationsButton setPage={props.setPage} authToken={props.authToken} /> -{" "}
      <button onClick={() => props.setPage(<AllUsersPage authToken={props.authToken} setPage={props.setPage} />)}>
        Manage users
      </button>{" "}
      -{" "}
      <button
        onClick={() =>
          props.setPage(<CoursesListPage authToken={props.authToken} setPage={props.setPage} ctx={props.ctx} />)
        }
      >
        View and manage courses
      </button>{" "}
      -{" "}
      <button onClick={() => props.setPage(<AdminPlatformUsagePage authToken={props.authToken} />)}>
        Track platform usage
      </button>{" "}
      - <LogoutButton setNavbar={props.setNavbar} setPage={props.setPage} />
    </div>
  );
};

const InstructorNavbar = (props: {
  authToken: string;
  ctx: Context;
  setNavbar: ElementSetter;
  setPage: ElementSetter;
}) => {
  return (
    <div>
      Logged in as: {props.ctx.name} ({props.ctx.role}) -{" "}
      <NotificationsButton setPage={props.setPage} authToken={props.authToken} /> -{" "}
      <button onClick={() => props.setPage(<CourseCreatePage authToken={props.authToken} />)}>Create a course</button> -{" "}
      <button
        onClick={() =>
          props.setPage(<CoursesListPage authToken={props.authToken} setPage={props.setPage} ctx={props.ctx} />)
        }
      >
        View courses
      </button>{" "}
      - <LogoutButton setNavbar={props.setNavbar} setPage={props.setPage} />
    </div>
  );
};

const StudentEnrollmentsPage = (props: { authToken: string }) => {
  const [enrollments, setEnrollments] = useState<StudentEnrollmentResponse[]>([]);

  const getAndSetEnrollments = useCallback(
    async (queryParam: string) => {
      const res = await sendRequest(props.authToken, "GET", `/api/elearning/enrollment${queryParam}`);
      if (res.status !== 200) return;
      setEnrollments(await res.json());
    },
    [props.authToken]
  );

  useEffect(() => {
    getAndSetEnrollments("");
  }, [getAndSetEnrollments]);

  const handleCancel = async (enrollmentId: string) => {
    const res = await sendRequest(props.authToken, "DELETE", `/api/elearning/enrollment/${enrollmentId}`);
    if (res.status !== 202) return;
    alert("Submitted. We will process your request");
    getAndSetEnrollments("");
  };

  return (
    <>
      <h1>My enrollments</h1>
      <button onClick={() => getAndSetEnrollments("?isPast=true")}>Enrollments on finished courses</button> -{" "}
      <button onClick={() => getAndSetEnrollments("?isPast=false")}>Enrollments on current/future courses</button> -{" "}
      <button onClick={() => getAndSetEnrollments("")}>All enrollments</button>
      <ul>
        {enrollments.map((e) => (
          <li key={e.id}>
            {e.courseName} - {e.courseStartDate} till {e.courseEndDate} - {e.status} -{" "}
            <button onClick={() => handleCancel(e.id)}>cancel</button>
          </li>
        ))}
      </ul>
    </>
  );
};

const StudentNavbar = (props: {
  authToken: string;
  ctx: Context;
  setNavbar: ElementSetter;
  setPage: ElementSetter;
}) => {
  return (
    <div>
      Logged in as: {props.ctx.name} ({props.ctx.role}) -{" "}
      <NotificationsButton setPage={props.setPage} authToken={props.authToken} /> -{" "}
      <button onClick={() => props.setPage(<StudentEnrollmentsPage authToken={props.authToken} />)}>
        My enrollments
      </button>{" "}
      -{" "}
      <button
        onClick={() =>
          props.setPage(<CoursesListPage authToken={props.authToken} setPage={props.setPage} ctx={props.ctx} />)
        }
      >
        View courses
      </button>{" "}
      - <LogoutButton setNavbar={props.setNavbar} setPage={props.setPage} />
    </div>
  );
};

const RegistrationPage = () => {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [role, setRole] = useState<string>("STUDENT");
  const [experience, setExperience] = useState<number>(0);
  const [bio, setBio] = useState<string>("");
  const [affiliation, setAffiliation] = useState<string>("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res = await sendRequest(null, "POST", "/api/user/register", {
      name,
      email,
      password,
      role,
      experience,
      bio,
      affiliation,
    });
    if (res.status === 200) alert("Success. You can now log in");
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <br />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <br />
        <select value={role} onChange={(e) => setRole(e.target.value)} required>
          <option value="STUDENT">Student</option>
          <option value="INSTRUCTOR">Instructor</option>
        </select>
        <br />
        {role === "INSTRUCTOR" && (
          <>
            <input
              type="number"
              min="0"
              value={experience}
              onChange={(e) => setExperience(parseInt(e.target.value))}
              title="Years of experience"
              required
            />
            <br />
          </>
        )}
        <textarea placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} required />
        <br />
        <input
          type="text"
          placeholder="Affiliation"
          value={affiliation}
          onChange={(e) => setAffiliation(e.target.value)}
          required
        />
        <br />
        <input type="submit" value="Register" />
      </form>
    </div>
  );
};

const renderAccordingToUser = async (token: string, setNavbar: ElementSetter, setPage: ElementSetter) => {
  const ctxRes = await sendRequest(token, "GET", "/api/user/user");
  if (ctxRes.status !== 200) {
    localStorage.removeItem(LOCAL_STORAGE_TOKEN);
    return;
  }

  const ctx = (await ctxRes.json()) as Context;
  if (ctx.role === "ADMIN") {
    setNavbar(<AdminNavbar ctx={ctx} setNavbar={setNavbar} setPage={setPage} authToken={token} />);
  } else if (ctx.role === "INSTRUCTOR") {
    setNavbar(<InstructorNavbar ctx={ctx} setNavbar={setNavbar} setPage={setPage} authToken={token} />);
  } else if (ctx.role === "STUDENT") {
    setNavbar(<StudentNavbar authToken={token} ctx={ctx} setNavbar={setNavbar} setPage={setPage} />);
  }
  setPage(<BlankPage />);
  return;
};

const GuestNavbar = (props: { setNavbar: ElementSetter; setPage: ElementSetter }) => {
  const login = async () => {
    const nameOrEmail = prompt("Name or email");
    if (nameOrEmail === null) return;
    const password = prompt("Password");
    if (password === null) return;
    const res = await sendRequest(null, "POST", "/api/user/login", { nameOrEmail, password });
    if (res.status !== 200) return;

    const token = (await res.json())["token"] as string;
    localStorage.setItem(LOCAL_STORAGE_TOKEN, token);
    renderAccordingToUser(token, props.setNavbar, props.setPage);
  };

  return (
    <div>
      <button onClick={login}>Login</button> -{" "}
      <button onClick={() => props.setPage(<RegistrationPage />)}>Register</button>
    </div>
  );
};

const BlankPage = () => <div></div>;

function App() {
  const [navbar, setNavbar] = useState<JSX.Element | null>(null);
  const [page, setPage] = useState<JSX.Element>(<BlankPage />);
  useEffect(() => {
    setNavbar(<GuestNavbar setNavbar={setNavbar} setPage={setPage} />);
    const token = localStorage.getItem(LOCAL_STORAGE_TOKEN);
    if (token !== undefined && token !== null) renderAccordingToUser(token, setNavbar, setPage);
  }, []);
  return (
    <>
      {navbar}
      {page}
    </>
  );
}

export default App;
