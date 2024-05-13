import React, { FormEvent, useCallback, useEffect, useState } from 'react';

type ElementSetter = (element: JSX.Element) => void;

type Role = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

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

interface UserResponse {
  name: string;
  email: string;
  role: string;
  experience: number;
  bio: string;
  affiliation: string;
}

interface UserInList {
  id: string;
  name: string;
}

const sendRequest = async (authToken: string | null, method: string, url: string, body?: any) => {
  const opts: RequestOptions = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (method.toLowerCase() !== 'get' && method.toLowerCase() !== 'delete')
    opts.body = JSON.stringify(body);
  if (authToken !== null) opts.headers['Authorization'] = `Basic ${authToken}`;
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
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [experience, setExperience] = useState<number>(0);
  const [bio, setBio] = useState<string>('');
  const [affiliation, setAffiliation] = useState<string>('');

  const getAndSetUser = useCallback(async () => {
    const res = await sendRequest(props.authToken, 'GET', `/api/user/user/${props.user.id}`);
    if (res.status !== 200) return;
    const u = (await res.json()) as UserResponse;
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setExperience(u.experience);
    setBio(u.bio);
    setAffiliation(u.affiliation);
  }, [props.authToken, props.user]);

  useEffect(() => {
    (async () => {
      await getAndSetUser();
    })();
  }, [getAndSetUser]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res = await sendRequest(props.authToken, 'PUT', `/api/user/user/${props.user.id}`, {
      name,
      email,
      password: password === '' ? null : password,
      role,
      experience,
      bio,
      affiliation
    });
    if (res.status !== 200) return;
    alert('Success!');
    await getAndSetUser();
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <br />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="STUDENT">Student</option>
          <option value="INSTRUCTOR">Instructor</option>
          <option value="ADMIN">Admin</option>
        </select>
        <br />
        {role === 'INSTRUCTOR' && (
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
      const res = await sendRequest(props.authToken, 'GET', '/api/user/users');
      if (res.status !== 200) return;
      setUsers(await res.json());
    })();
  }, [props.authToken]);

  const handleDelete = async (userId: string) => {
    const c = window.confirm('Are you sure you want to delete this user?');
    if (!c) return;
    const res = await sendRequest(props.authToken, 'DELETE', `/api/user/user/${userId}`);
    if (res.status !== 200) return;
    const res2 = await sendRequest(props.authToken, 'GET', '/api/user/users');
    if (res2.status !== 200) return;
    setUsers(await res2.json());
  };
  // TODO: on button click
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>
          {u.name} (<button onClick={() => handleDelete(u.id)}>Delete</button>,{' '}
          <button
            onClick={() => props.setPage(<UserEditPage authToken={props.authToken} user={u} />)}
          >
            View/edit
          </button>
          )<br />
        </li>
      ))}
    </ul>
  );
};

const AdminNavbar = (props: {
  authToken: string;
  ctx: Context;
  setNavbar: ElementSetter;
  setPage: ElementSetter;
}) => {
  return (
    <div>
      Logged in as: {props.ctx.name} -{' '}
      <button
        onClick={() =>
          props.setPage(<AllUsersPage authToken={props.authToken} setPage={props.setPage} />)
        }
      >
        View users
      </button>{' '}
      - <LogoutButton setNavbar={props.setNavbar} setPage={props.setPage} />
    </div>
  );
};

const RegistrationPage = () => {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<string>('STUDENT');
  const [experience, setExperience] = useState<number>(0);
  const [bio, setBio] = useState<string>('');
  const [affiliation, setAffiliation] = useState<string>('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res = await sendRequest(null, 'POST', '/api/user/register', {
      name,
      email,
      password,
      role,
      experience,
      bio,
      affiliation
    });
    if (res.status === 200) alert('Success. You can now log in');
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <br />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
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
        {role === 'INSTRUCTOR' && (
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
    const nameOrEmail = prompt('Name or email');
    if (nameOrEmail === null) return;
    const password = prompt('Password');
    if (password === null) return;
    const res = await sendRequest(null, 'POST', '/api/user/login', { nameOrEmail, password });
    if (res.status !== 200) return;

    const token = (await res.json())['token'] as string;
    const ctxRes = await sendRequest(token, 'GET', '/api/user/user');
    if (ctxRes.status !== 200) return;

    const ctx = (await ctxRes.json()) as Context;
    if (ctx.role === 'ADMIN') {
      props.setNavbar(
        <AdminNavbar
          ctx={ctx}
          setNavbar={props.setNavbar}
          setPage={props.setPage}
          authToken={token}
        />
      );
      props.setPage(<BlankPage />);
    }
  };

  return (
    <div>
      <button onClick={login}>Login</button> -{' '}
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
