import React, { useEffect, useState } from 'react';

interface RequestOptions {
  method: string;
  headers: { [key: string]: string };
  body?: any;
}

interface RequestContext {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
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

const LogoutButton = (props: { setNavbar: (navbar: JSX.Element) => void }) => {
  const logout = () => {
    props.setNavbar(<GuestNavbar setNavbar={props.setNavbar} />);
  };
  return <button onClick={logout}>Log out</button>;
};

const AdminNavbar = (props: { setNavbar: (navbar: JSX.Element) => void }) => {
  return (
    <div>
      Hello, admin - <LogoutButton setNavbar={props.setNavbar} />
    </div>
  );
};

const GuestNavbar = (props: { setNavbar: (navbar: JSX.Element) => void }) => {
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

    const ctx = (await ctxRes.json()) as RequestContext;
    if (ctx.role === 'ADMIN') {
      props.setNavbar(<AdminNavbar setNavbar={props.setNavbar} />);
    }
  };

  return (
    <div>
      <button onClick={login}>Login</button> - <button>Register</button>
    </div>
  );
};

function App() {
  const [navbar, setNavbar] = useState<JSX.Element | null>(null);
  useEffect(() => {
    setNavbar(<GuestNavbar setNavbar={setNavbar} />);
  }, []);
  return navbar;
}

export default App;
