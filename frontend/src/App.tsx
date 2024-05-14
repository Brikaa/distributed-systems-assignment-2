import React, { FormEvent, useCallback, useEffect, useState } from "react";

type ElementSetter = (element: JSX.Element) => void;

type Role = "ADMIN" | "INSTRUCTOR" | "STUDENT";

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
  }, [props.authToken, props.user]);

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
    await getAndSetUser();
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
        <input type="submit" />
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
  // TODO: on button click
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

const CourseEditPage = (props: { course: CourseResponse; authToken: string }) => {
  const [name, setName] = useState<string>();
  const [description, setDescription] = useState<string>();
  const [startDate, setStartDate] = useState<number>(Math.floor(Date.now() / 1000));
  const [endDate, setEndDate] = useState<number>();
  const [startDateChanged, setStartDateChanged] = useState<boolean>(false);
  const [endDateChanged, setEndDateChanged] = useState<boolean>(false);
  const [category, setCategory] = useState<string>();
  const [capacity, setCapacity] = useState<number>();
  const [status, setStatus] = useState<string>();
  const [instructorName, setInstructorName] = useState<string>();
  const [averageStars, setAverageStars] = useState<number>();
  const [numberOfReviews, setNumberOfReviews] = useState<number>();
  const [numberOfEnrollments, setNumberOfEnrollments] = useState<number>();

  const getAndSetCourse = useCallback(async () => {
    const res = await sendRequest(props.authToken, "GET", `/api/elearning/course/${props.course.id}`);
    if (res.status !== 200) return;
    const c = await res.json();
    setName(c.name);
    setInstructorName(c.instructorName);
    setAverageStars(c.averageStars);
    setNumberOfReviews(c.numberOfReviews);
    setNumberOfEnrollments(c.numberOfEnrollments);
    setDescription(c.description);
    setStartDate(c.startDate);
    setEndDate(c.endDate);
    setCategory(c.category);
    setCapacity(c.capacity);
    setStatus(c.status);
  }, [props.authToken, props.course]);

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

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <br />
        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <br />
        <label>Instructor name: {instructorName}</label>
        <br />
        <input
          type="number"
          title="Start date (unix seconds)"
          value={startDate}
          onChange={(e) => {
            setStartDate(parseInt(e.target.value));
            setStartDateChanged(true);
          }}
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
        />
        <br />
        <input type="text" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <br />
        <input
          type="number"
          title="Capacity"
          value={capacity}
          onChange={(e) => setCapacity(parseInt(e.target.value))}
        />
        <br />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ACCEPTED">ACCEPTED</option>
          <option value="PENDING">PENDING</option>
        </select>
        <br />
        <label>Number of enrollments: {numberOfEnrollments}</label>
        <br />
        <label>Average stars: {averageStars}</label>
        <br />
        <label>Number of reviews: {numberOfReviews}</label>
        <br />
        <input type="submit" />
      </form>
    </div>
  );
};

const AdminListCourses = (props: { authToken: string; setPage: ElementSetter }) => {
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
            {c.name} - {c.category} - by {c.instructorName} - {new Date(c.startDate * 1000).toISOString()} till{" "}
            {new Date(c.endDate * 1000).toISOString()} - averageStars: {c.averageStars} ({c.numberOfReviews} reviews) -
            capacity: {c.numberOfEnrollments}/{c.capacity} (
            <button onClick={() => props.setPage(<CourseEditPage authToken={props.authToken} course={c} />)}>
              View/edit
            </button>
            , <button onClick={() => handleDelete(c.id)}>Delete</button>)
          </li>
        ))}
      </ul>
    </div>
  );
};

const AdminNavbar = (props: { authToken: string; ctx: Context; setNavbar: ElementSetter; setPage: ElementSetter }) => {
  return (
    <div>
      Logged in as: {props.ctx.name} -{" "}
      <button onClick={() => props.setPage(<AllUsersPage authToken={props.authToken} setPage={props.setPage} />)}>
        View users
      </button>{" "}
      -{" "}
      <button onClick={() => props.setPage(<AdminListCourses authToken={props.authToken} setPage={props.setPage} />)}>
        List courses
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
              title="Experience"
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
        <input type="submit" />
      </form>
    </div>
  );
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
    const ctxRes = await sendRequest(token, "GET", "/api/user/user");
    if (ctxRes.status !== 200) return;

    const ctx = (await ctxRes.json()) as Context;
    if (ctx.role === "ADMIN") {
      props.setNavbar(<AdminNavbar ctx={ctx} setNavbar={props.setNavbar} setPage={props.setPage} authToken={token} />);
      props.setPage(<BlankPage />);
    }
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
  const [page, setPage] = useState<JSX.Element | null>(<BlankPage />);
  useEffect(() => {
    setNavbar(<GuestNavbar setNavbar={setNavbar} setPage={setPage} />);
  }, []);
  return (
    <>
      {navbar}
      {page}
    </>
  );
}

export default App;
