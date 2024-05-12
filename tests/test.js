const process = require('process');
const assert = require('assert');

(async () => {
  const USER_SERVICE_URL = process.env['USER_SERVICE_URL'];
  const ELEARNING_SERVICE_URL = process.env['ELEARNING_SERVICE_URL'];
  let authToken = undefined;

  const sendRequest = (method, url, body) => {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (method.toLowerCase() != 'get') opts.body = JSON.stringify(body);
    if (authToken !== undefined) opts.headers['Authorization'] = `Basic ${authToken}`;
    return fetch(url, opts);
  };

  const login = async (nameOrEmail, password) => {
    console.log(`Log in: (${nameOrEmail}, ${password})`);
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/login`, {
      nameOrEmail,
      password
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    authToken = JSON.parse(text)['token'];
  };

  {
    console.log(
      "Register Instructor"
    );
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: 'i1',
      email: 'i1@i1.com',
      password: 'i1123',
      affiliation: 'cu',
      experience: 13,
      bio: 'This is a cool instructor',
      role: 'INSTRUCTOR'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  {
    console.log('Register Instructor with already existing name');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: 'i1',
      email: 'x1@i1.com',
      password: 'i1123',
      affiliation: 'cu',
      experience: 13,
      bio: 'This is a cool instructor',
      role: 'INSTRUCTOR'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], 'A user with this name already exists');
  }

  {
    console.log('Register Instructor with already existing email');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: 'x1',
      email: 'i1@i1.com',
      password: 'i1123',
      affiliation: 'cu',
      experience: 13,
      bio: 'This is a cool instructor',
      role: 'INSTRUCTOR'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], 'A user with this email already exists');
  }

  {
    console.log('Register Instructor with empty name');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: '',
      email: 'i1@i1.com',
      password: 'i1123',
      affiliation: 'cu',
      experience: 13,
      bio: 'This is a cool instructor',
      role: 'INSTRUCTOR'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], "Name can't be empty");
  }

  {
    console.log('Register Instructor with invalid email');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: 'i1',
      email: 'i1i1.com',
      password: 'i1123',
      affiliation: 'cu',
      experience: 13,
      bio: 'This is a cool instructor',
      role: 'INSTRUCTOR'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], 'Invalid email');
  }

  {
    console.log('Register Instructor with negative experience');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: 'i1',
      email: 'i1@i1.com',
      password: 'i1123',
      affiliation: 'cu',
      experience: -13,
      bio: 'This is a cool instructor',
      role: 'INSTRUCTOR'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], 'Invalid years of experience');
  }

  {
    console.log('Register with role as admin');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: 'i1',
      email: 'i1@i1.com',
      password: 'i1123',
      affiliation: 'cu',
      experience: 13,
      bio: 'This is a cool instructor',
      role: 'ADMIN'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], 'Invalid role');
  }

  {
    console.log('Login with i1 invalid password');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/login`, {
      nameOrEmail: 'i1',
      password: 'i123'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 401);
    assert.equal(JSON.parse(text)['message'], 'Invalid name/email or password');
  }

  {
    console.log('Login with i1 invalid username');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/login`, {
      nameOrEmail: 'i2',
      password: 'i1123'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 401);
    assert.equal(JSON.parse(text)['message'], 'Invalid name/email or password');
  }

  {
    console.log('View current user while not logged in');
    const res = await sendRequest('GET', `${USER_SERVICE_URL}/user`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 401);
  }

  await login('i1', 'i1123');
  await login('i1@i1.com', 'i1123');

  {
    console.log('i1 views themselves');
    const res = await sendRequest('GET', `${USER_SERVICE_URL}/user`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    delete body.id;
    assert.deepStrictEqual(body, {
      name: 'i1',
      email: 'i1@i1.com',
      role: 'INSTRUCTOR',
      experience: 13,
      bio: 'This is a cool instructor',
      affiliation: 'cu'
    });
  }
})();
