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

  const currentTimeSeconds = () => Math.floor(Date.now() / 1000);

  {
    console.log('Register Instructor');
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

  {
    console.log('Register Student');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: 's1',
      email: 's1@s1.com',
      password: 's1123',
      affiliation: 'cu',
      experience: 13,
      bio: 'This is a cool student',
      role: 'STUDENT'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  await login('s1', 's1123');

  {
    console.log('s1 views themselves');
    const res = await sendRequest('GET', `${USER_SERVICE_URL}/user`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    delete body.id;
    assert.deepStrictEqual(body, {
      name: 's1',
      email: 's1@s1.com',
      role: 'STUDENT',
      bio: 'This is a cool student',
      affiliation: 'cu'
    });
  }

  {
    console.log('s1 views available courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), { courses: [] });
  }

  {
    console.log('s1 views past enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment?isPast=true`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), { enrollments: [] });
  }

  {
    console.log('s1 views current enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment?isPast=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), { enrollments: [] });
  }

  {
    console.log('s1 views all enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), { enrollments: [] });
  }

  {
    console.log('s1 tries to create a course');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course`, {
      name: 'i1c1',
      description: 'i1c1d',
      startDate: currentTimeSeconds() + 7 * 24 * 60 * 60,
      endDate: currentTimeSeconds() + 14 * 24 * 60 * 60,
      category: 'Machine learning',
      capacity: 300
    });
    console.log(await res.text());
    assert.equal(res.status, 403);
  }

  await login('i1', 'i1123');

  {
    console.log('i1 views available courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), { courses: [] });
  }

  {
    console.log('i1 views their courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course?mine=true`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), { courses: [] });
  }

  {
    console.log('i1 creates a course (i1c1)');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course`, {
      name: 'i1c1',
      description: 'i1c1d',
      startDate: currentTimeSeconds() + 7 * 24 * 60 * 60,
      endDate: currentTimeSeconds() + 14 * 24 * 60 * 60,
      category: 'Machine learning',
      capacity: 300
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  {
    console.log('i1 tries to create a course that starts in the past');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course`, {
      name: 'i1c2',
      description: 'i1c1d',
      startDate: currentTimeSeconds() - 7 * 24 * 60 * 60,
      endDate: currentTimeSeconds() + 14 * 24 * 60 * 60,
      category: 'Machine learning',
      capacity: 300
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], "Course can't start in the past");
  }

  {
    console.log('i1 tries to create a course that ends before it starts');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course`, {
      name: 'i1c2',
      description: 'i1c1d',
      startDate: currentTimeSeconds() + 14 * 24 * 60 * 60,
      endDate: currentTimeSeconds() + 7 * 24 * 60 * 60,
      category: 'Machine learning',
      capacity: 300
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], "End date can't be before the start date");
  }

  {
    console.log('i1 tries to create a course with a negative capacity');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course`, {
      name: 'i1c2',
      description: 'i1c1d',
      startDate: currentTimeSeconds() + 7 * 24 * 60 * 60,
      endDate: currentTimeSeconds() + 14 * 24 * 60 * 60,
      category: 'Machine learning',
      capacity: -300
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], 'Capacity must be a positive number');
  }

  {
    console.log('i1 tries to create a course with zero capacity');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course`, {
      name: 'i1c2',
      description: 'i1c1d',
      startDate: currentTimeSeconds() + 7 * 24 * 60 * 60,
      endDate: currentTimeSeconds() + 14 * 24 * 60 * 60,
      category: 'Machine learning',
      capacity: 0
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], 'Capacity must be a positive number');
  }

  {
    console.log('Register Instructor');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: 'i2',
      email: 'i2@i2.com',
      password: 'i2123',
      affiliation: 'cu',
      experience: 8,
      bio: 'This is another instructor',
      role: 'INSTRUCTOR'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  await login('i2', 'i2123');

  let i2Id = undefined;
  {
    console.log('i1 views themselves');
    const res = await sendRequest('GET', `${USER_SERVICE_URL}/user`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    i2Id = body.id;
    delete body.id;
    assert.deepStrictEqual(body, {
      name: 'i2',
      email: 'i2@i2.com',
      role: 'INSTRUCTOR',
      experience: 8,
      bio: 'This is another instructor',
      affiliation: 'cu'
    });
  }

  {
    console.log('i2 views available courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), { courses: [] });
  }

  {
    console.log('i2 views their courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course?mine=true`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), { courses: [] });
  }

  let i2C1Start = currentTimeSeconds() + 7 * 24 * 60 * 60;
  let i2C1End = currentTimeSeconds() + 7 * 24 * 60 * 60;
  {
    console.log('i2 creates a course (i2c1)');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course`, {
      name: 'i2c1',
      description: 'i2c1d',
      startDate: i2C1Start,
      endDate: i2C1End,
      category: 'Distributed systems',
      capacity: 200
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  let i2C2Start = currentTimeSeconds() + 7 * 24 * 60 * 60;
  let i2C2End = currentTimeSeconds() + 21 * 24 * 60 * 60;
  {
    console.log('i2 creates a course (i2c2)');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course`, {
      name: 'i2c2',
      description: 'i2c2d',
      startDate: i2C2Start,
      endDate: i2C2End,
      category: 'Soft computing',
      capacity: 5000
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  let i2C3Start = currentTimeSeconds() + 7 * 24 * 60 * 60;
  let i2C3End = currentTimeSeconds() + 30 * 24 * 60 * 60;
  {
    console.log('i2 creates a course (i2c3)');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course`, {
      name: 'i2c3',
      description: 'i2c3d',
      startDate: i2C3Start,
      endDate: i2C3End,
      category: 'Web engineering',
      capacity: 50
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  {
    console.log('i2 views available courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body.courses) delete course.id;
    assert.deepStrictEqual(body, {
      courses: [
        {
          name: 'i2c3',
          instructorId: i2Id,
          instructorName: 'i2',
          averageStars: 0,
          numberOfReviews: 0,
          numberOfEnrollments: 0,
          category: 'Web engineering',
          startDate: i2C3Start,
          endDate: i2C3End,
          capacity: 50,
          status: 'PENDING'
        },
        {
          name: 'i2c2',
          instructorId: i2Id,
          instructorName: 'i2',
          averageStars: 0,
          numberOfReviews: 0,
          numberOfEnrollments: 0,
          category: 'Soft computing',
          startDate: i2C2Start,
          endDate: i2C2End,
          capacity: 5000,
          status: 'PENDING'
        },
        {
          name: 'i2c1',
          instructorId: i2Id,
          instructorName: 'i2',
          averageStars: 0,
          numberOfReviews: 0,
          numberOfEnrollments: 0,
          category: 'Distributed systems',
          startDate: i2C1Start,
          endDate: i2C1End,
          capacity: 200,
          status: 'PENDING'
        }
      ]
    });
  }

  {
    console.log('i2 views their courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course?mine=true`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body.courses) delete course.id;
    assert.deepStrictEqual(body, {
      courses: [
        {
          name: 'i2c3',
          instructorId: i2Id,
          instructorName: 'i2',
          averageStars: 0,
          numberOfReviews: 0,
          numberOfEnrollments: 0,
          category: 'Web engineering',
          startDate: i2C3Start,
          endDate: i2C3End,
          capacity: 50,
          status: 'PENDING'
        },
        {
          name: 'i2c2',
          instructorId: i2Id,
          instructorName: 'i2',
          averageStars: 0,
          numberOfReviews: 0,
          numberOfEnrollments: 0,
          category: 'Soft computing',
          startDate: i2C2Start,
          endDate: i2C2End,
          capacity: 5000,
          status: 'PENDING'
        },
        {
          name: 'i2c1',
          instructorId: i2Id,
          instructorName: 'i2',
          averageStars: 0,
          numberOfReviews: 0,
          numberOfEnrollments: 0,
          category: 'Distributed systems',
          startDate: i2C1Start,
          endDate: i2C1End,
          capacity: 200,
          status: 'PENDING'
        }
      ]
    });
  }
})();
