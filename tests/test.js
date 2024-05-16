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
    if (method.toLowerCase() !== 'get' && method.toLowerCase() !== 'delete')
      opts.body = JSON.stringify(body);
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

  const markAllNotificationsAsRead = async () => {
    const allNotificationsRes = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/notification`);
    const text = await allNotificationsRes.text();
    console.log(text);
    assert.equal(allNotificationsRes.status, 200);
    const allNotificationsBody = JSON.parse(text);
    const ids = allNotificationsBody.map((notification) => notification.id);

    await Promise.all(
      ids.map(async (id) => {
        console.log(`Marking ${id} as read`);
        const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/notification/${id}`, {
          isRead: true
        });
        const text = await res.text();
        console.log(text);
        assert.equal(res.status, 200);
      })
    );
  };

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  const timeTravel = async (newDate) => {
    console.log(`Setting server epoch milliseconds to ${newDate}`);
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/date`, {
      date: newDate
    });
    assert.equal(res.status, 200);
  };

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

  let i1Id = undefined;
  {
    console.log('i1 views themselves');
    const res = await sendRequest('GET', `${USER_SERVICE_URL}/user`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    i1Id = body.id;
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

  let s1Id = undefined;
  {
    console.log('s1 views themselves');
    const res = await sendRequest('GET', `${USER_SERVICE_URL}/user`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    s1Id = body.id;
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
    assert.deepStrictEqual(JSON.parse(text), []);
  }

  {
    console.log('s1 views past enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment?isPast=true`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), []);
  }

  {
    console.log('s1 views current enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment?isPast=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), []);
  }

  {
    console.log('s1 views all enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), []);
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
    assert.deepStrictEqual(JSON.parse(text), []);
  }

  {
    console.log('i1 views their courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course?mine=true`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), []);
  }

  let i1C1Start = currentTimeSeconds() + 7 * 24 * 60 * 60;
  let i1C1End = currentTimeSeconds() + 14 * 24 * 60 * 60;
  {
    console.log('i1 creates a course (i1c1)');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course`, {
      name: 'i1c1',
      description: 'i1c1d',
      startDate: i1C1Start,
      endDate: i1C1End,
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
    assert.equal(
      JSON.parse(text)['message'],
      "End date can't be before or equal to the start date"
    );
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
    assert.deepStrictEqual(JSON.parse(text), []);
  }

  {
    console.log('i2 views their courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course?mine=true`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), []);
  }

  let i2C1Start = currentTimeSeconds() + 7 * 24 * 60 * 60;
  let i2C1End = currentTimeSeconds() + 14 * 24 * 60 * 60;
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

  let i2C3Id = undefined;
  {
    console.log('i2 views available courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body) {
      delete course.id;
      if (course.name === 'i2c3') i2C3Id = course.id;
    }
    assert.deepStrictEqual(body, [
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
    ]);
  }

  {
    console.log('i2 views their courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course?mine=true`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body) delete course.id;
    assert.deepStrictEqual(body, [
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
    ]);
  }

  await login('s1', 's1123');

  {
    console.log('s1 views available courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), []);
  }

  await login('admin', 'admin');

  let i1C1Id = undefined;
  let i2C1Id = undefined;
  let i2C2Id = undefined;
  {
    console.log('admin views available courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body) {
      if (course.name === 'i1c1') {
        i1C1Id = course.id;
        console.log({ i1C1Id });
      } else if (course.name === 'i2c1') {
        i2C1Id = course.id;
        console.log({ i2C1Id });
      } else if (course.name === 'i2c2') {
        i2C2Id = course.id;
        console.log({ i2C2Id });
      }
      delete course.id;
    }
    assert.deepStrictEqual(body, [
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
      },
      {
        name: 'i1c1',
        instructorId: i1Id,
        instructorName: 'i1',
        averageStars: 0,
        numberOfReviews: 0,
        numberOfEnrollments: 0,
        category: 'Machine learning',
        startDate: i1C1Start,
        endDate: i1C1End,
        capacity: 300,
        status: 'PENDING'
      }
    ]);
  }

  {
    console.log('admin accepts i1c1 and changes its description to i1c1dd and its dates');
    ++i1C1Start;
    ++i1C1End;
    const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}`, {
      description: 'i1c1dd',
      startDate: i1C1Start,
      endDate: i1C1End,
      status: 'ACCEPTED'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  {
    console.log('admin tries to change i1c1 end date without start date');
    const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}`, {
      description: 'i1c1dd',
      endDate: i1C1End + 1,
      status: 'ACCEPTED'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], 'start date and end date must be changed together');
  }

  {
    console.log('admin accepts i2c1');
    const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/course/${i2C1Id}`, {
      status: 'ACCEPTED'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  {
    console.log('admin deletes i2c2');
    const res = await sendRequest('DELETE', `${ELEARNING_SERVICE_URL}/course/${i2C2Id}`);
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  await login('s1', 's1123');

  {
    console.log('s1 views available courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body) delete course.id;
    assert.deepStrictEqual(body, [
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
        status: 'ACCEPTED'
      },
      {
        name: 'i1c1',
        instructorId: i1Id,
        instructorName: 'i1',
        averageStars: 0,
        numberOfReviews: 0,
        numberOfEnrollments: 0,
        category: 'Machine learning',
        startDate: i1C1Start,
        endDate: i1C1End,
        capacity: 300,
        status: 'ACCEPTED'
      }
    ]);
  }

  {
    console.log('s1 views i1c1');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    assert.deepStrictEqual(body, {
      id: i1C1Id,
      name: 'i1c1',
      category: 'Machine learning',
      description: 'i1c1dd',
      instructorId: i1Id,
      startDate: i1C1Start,
      endDate: i1C1End,
      capacity: 300,
      numberOfEnrollments: 0,
      numberOfReviews: 0,
      averageStars: 0,
      status: 'ACCEPTED',
      enrolled: false
    });
  }

  {
    console.log('s1 enrolls in i1c1');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
  }

  {
    console.log('s1 enrolls in i2c1');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i2C1Id}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
  }

  {
    console.log('s1 tries to enroll in i1c1 again');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
    await sleep(100);
  }

  const s1NotificationsAfterInitialEnrollments = [
    {
      title: 'Course enrollment status',
      body: `Can't enroll in course with id: ${i1C1Id} since you already had an enrollment request in it.`,
      isRead: false
    },
    {
      title: 'Course enrollment status',
      body: "Submitted an enrollment request for: 'i1c1', we will get back to you once it is accepted.",
      isRead: false
    },
    {
      title: 'Course enrollment status',
      body: "Submitted an enrollment request for: 'i2c1', we will get back to you once it is accepted.",
      isRead: false
    }
  ];

  {
    console.log('s1 lists all notifications');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/notification`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.sort((a, b) => {
      if (a.body === b.body) return 0;
      if (a.body < b.body) return -1;
      if (a.body > b.body) return 1;
    });
    body.forEach((notification) => delete notification.id);
    assert.deepStrictEqual(body, s1NotificationsAfterInitialEnrollments);
  }

  {
    console.log('s1 lists unread notifications');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/notification?isRead=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.sort((a, b) => {
      if (a.body === b.body) return 0;
      if (a.body < b.body) return -1;
      if (a.body > b.body) return 1;
    });
    body.forEach((notification) => delete notification.id);
    assert.deepStrictEqual(body, s1NotificationsAfterInitialEnrollments);
  }

  await markAllNotificationsAsRead();
  const s1NotificationsAfterInitialEnrollmentsRead = s1NotificationsAfterInitialEnrollments.map(
    (n) => ({ ...n, isRead: true })
  );

  {
    console.log('s1 lists all notifications');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/notification`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.sort((a, b) => {
      if (a.body === b.body) return 0;
      if (a.body < b.body) return -1;
      if (a.body > b.body) return 1;
    });
    body.forEach((notification) => delete notification.id);
    assert.deepStrictEqual(body, s1NotificationsAfterInitialEnrollmentsRead);
  }

  {
    console.log('s1 lists unread notifications');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/notification?isRead=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.sort((a, b) => {
      if (a.body === b.body) return 0;
      if (a.body < b.body) return -1;
      if (a.body > b.body) return 1;
    });
    body.forEach((notification) => delete notification.id);
    assert.deepStrictEqual(body, []);
  }

  {
    console.log('s1 lists read notifications');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/notification?isRead=true`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.sort((a, b) => {
      if (a.body === b.body) return 0;
      if (a.body < b.body) return -1;
      if (a.body > b.body) return 1;
    });
    body.forEach((notification) => delete notification.id);
    assert.deepStrictEqual(body, s1NotificationsAfterInitialEnrollmentsRead);
  }

  {
    console.log('s1 lists current enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment?isPast=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const enrollment of body) delete enrollment.id;
    body.sort((a, b) => {
      if (a.courseName === b.courseName) return 0;
      if (a.courseName < b.courseName) return -1;
      if (a.courseName > b.courseName) return 1;
    });
    assert.deepStrictEqual(body, [
      {
        courseId: i1C1Id,
        courseName: 'i1c1',
        courseStartDate: i1C1Start,
        courseEndDate: i1C1End,
        status: 'PENDING'
      },
      {
        courseId: i2C1Id,
        courseName: 'i2c1',
        courseStartDate: i2C1Start,
        courseEndDate: i2C1End,
        status: 'PENDING'
      }
    ]);
  }

  {
    console.log('Register Student');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: 's2',
      email: 's2@s2.com',
      password: 's2123',
      affiliation: 'cu',
      bio: 'This is another student',
      role: 'STUDENT'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  await login('s2', 's2123');

  let s2Id = undefined;
  {
    console.log('s2 views themselves');
    const res = await sendRequest('GET', `${USER_SERVICE_URL}/user`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    s2Id = body.id;
    delete body.id;
    assert.deepStrictEqual(body, {
      name: 's2',
      email: 's2@s2.com',
      role: 'STUDENT',
      bio: 'This is another student',
      affiliation: 'cu'
    });
  }

  {
    console.log('s2 enrolls in i1c1');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
  }

  await markAllNotificationsAsRead();

  {
    console.log('Register Student');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: 's3',
      email: 's3@s3.com',
      password: 's3123',
      affiliation: 'cu',
      bio: 'Yet another student',
      role: 'STUDENT'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  await login('s3', 's3123');

  let s3Id = undefined;
  {
    console.log('s3 views themselves');
    const res = await sendRequest('GET', `${USER_SERVICE_URL}/user`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    s3Id = body.id;
    delete body.id;
    assert.deepStrictEqual(body, {
      name: 's3',
      email: 's3@s3.com',
      role: 'STUDENT',
      bio: 'Yet another student',
      affiliation: 'cu'
    });
  }

  {
    console.log('s3 views available courses');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body) delete course.id;
    assert.deepStrictEqual(body, [
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
        status: 'ACCEPTED'
      },
      {
        name: 'i1c1',
        instructorId: i1Id,
        instructorName: 'i1',
        averageStars: 0,
        numberOfReviews: 0,
        numberOfEnrollments: 0,
        category: 'Machine learning',
        startDate: i1C1Start,
        endDate: i1C1End,
        capacity: 300,
        status: 'ACCEPTED'
      }
    ]);
  }

  {
    console.log('s3 searches for courses by name (C)');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course?name=C`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body) delete course.id;
    assert.deepStrictEqual(body, [
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
        status: 'ACCEPTED'
      },
      {
        name: 'i1c1',
        instructorId: i1Id,
        instructorName: 'i1',
        averageStars: 0,
        numberOfReviews: 0,
        numberOfEnrollments: 0,
        category: 'Machine learning',
        startDate: i1C1Start,
        endDate: i1C1End,
        capacity: 300,
        status: 'ACCEPTED'
      }
    ]);
  }

  {
    console.log('s3 searches for courses by name (2)');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course?name=2`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body) delete course.id;
    assert.deepStrictEqual(body, [
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
        status: 'ACCEPTED'
      }
    ]);
  }

  {
    console.log('s3 searches for courses by category (E)');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course?category=E`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body) delete course.id;
    assert.deepStrictEqual(body, [
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
        status: 'ACCEPTED'
      },
      {
        name: 'i1c1',
        instructorId: i1Id,
        instructorName: 'i1',
        averageStars: 0,
        numberOfReviews: 0,
        numberOfEnrollments: 0,
        category: 'Machine learning',
        startDate: i1C1Start,
        endDate: i1C1End,
        capacity: 300,
        status: 'ACCEPTED'
      }
    ]);
  }

  {
    console.log('s3 searches for courses by category (mac)');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course?category=mac`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body) delete course.id;
    assert.deepStrictEqual(body, [
      {
        name: 'i1c1',
        instructorId: i1Id,
        instructorName: 'i1',
        averageStars: 0,
        numberOfReviews: 0,
        numberOfEnrollments: 0,
        category: 'Machine learning',
        startDate: i1C1Start,
        endDate: i1C1End,
        capacity: 300,
        status: 'ACCEPTED'
      }
    ]);
  }

  {
    console.log('s3 views i2c3');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course/${i2C3Id}`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 404);
  }

  {
    console.log('s3 enrolls in i1c1');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
  }

  await markAllNotificationsAsRead();

  await login('i2', 'i2123');

  let i2C1S1Id = undefined;
  {
    console.log('i2 views enrollments on i2c1');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course/${i2C1Id}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.forEach((e) => {
      if (e.studentName === 's1') i2C1S1Id = e.id;
      delete e.id;
    });
    delete body.id;
    assert.deepStrictEqual(body, [
      {
        studentId: s1Id,
        studentName: 's1',
        status: 'PENDING'
      }
    ]);
  }

  await login('i1', 'i1123');

  let i1C1S1Id = undefined;
  let i1C1S2Id = undefined;
  let i1C1S3Id = undefined;
  {
    console.log('i1 views enrollments on i1c1');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.sort((a, b) => {
      if (a.studentName === b.studentName) return 0;
      if (a.studentName < b.studentName) return -1;
      if (a.studentName > b.studentName) return 1;
    });
    body.forEach((enrollment) => {
      if (enrollment.studentName === 's1') i1C1S1Id = enrollment.id;
      else if (enrollment.studentName === 's2') i1C1S2Id = enrollment.id;
      else if (enrollment.studentName === 's3') i1C1S3Id = enrollment.id;
      delete enrollment.id;
    });
    assert.deepStrictEqual(body, [
      {
        studentId: s1Id,
        studentName: 's1',
        status: 'PENDING'
      },
      {
        studentId: s2Id,
        studentName: 's2',
        status: 'PENDING'
      },
      {
        studentId: s3Id,
        studentName: 's3',
        status: 'PENDING'
      }
    ]);
  }

  {
    console.log('i1 tries to view enrollments on i2c1');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course/${i2C1Id}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 404);
  }

  {
    console.log('i1 accepts i1c1s1');
    const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/enrollment/${i1C1S1Id}`, {
      status: 'ACCEPTED'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
  }

  {
    console.log('i1 accepts i1c1s2');
    const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/enrollment/${i1C1S2Id}`, {
      status: 'ACCEPTED'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
  }

  {
    console.log('i1 rejects i1c1s3');
    const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/enrollment/${i1C1S3Id}`, {
      status: 'REJECTED'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
  }

  {
    console.log('i1 tries to reject i1c1s3 again');
    const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/enrollment/${i1C1S3Id}`, {
      status: 'REJECTED'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
  }

  {
    console.log('i1 tries to accept i2c1s1');
    const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/enrollment/${i2C1S1Id}`, {
      status: 'REJECTED'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
    await sleep(100);
  }

  {
    console.log('i1 lists all notifications');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/notification`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.sort((a, b) => {
      if (a.body === b.body) return 0;
      if (a.body < b.body) return -1;
      if (a.body > b.body) return 1;
    });
    body.forEach((notification) => delete notification.id);
    const expected = [
      {
        title: 'Course enrollment status',
        body: `Could not find a pending enrollment with id: ${i1C1S3Id} that was sent to one of your future courses.`,
        isRead: false
      },
      {
        title: 'Course enrollment status',
        body: `Could not find a pending enrollment with id: ${i2C1S1Id} that was sent to one of your future courses.`,
        isRead: false
      }
    ];
    expected.sort((a, b) => {
      if (a.body === b.body) return 0;
      if (a.body < b.body) return -1;
      if (a.body > b.body) return 1;
    });
    assert.deepStrictEqual(body, expected);
  }

  await markAllNotificationsAsRead();

  await login('admin', 'admin');

  {
    console.log('admin gets platform usage');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/usage`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), {
      numberOfStudents: 3,
      numberOfInstructors: 2,
      numberOfAdmins: 1,
      numberOfAcceptedCourses: 2,
      numberOfPendingCourses: 1,
      numberOfAcceptedEnrollments: 2,
      numberOfRejectedEnrollments: 1,
      numberOfPendingEnrollments: 1
    });
  }

  await login('s1', 's1123');

  {
    console.log('s1 lists unread notifications');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/notification?isRead=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.forEach((notification) => delete notification.id);
    assert.deepStrictEqual(body, [
      {
        title: 'Course enrollment status',
        body: `Your enrollment for i1c1 has been accepted.`,
        isRead: false
      }
    ]);
  }

  await markAllNotificationsAsRead();

  {
    console.log('s1 tries to submit a review on i1c1 (it has not started)');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/review`, {
      stars: 5,
      body: 'Nice course'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 404);
    assert.equal(
      JSON.parse(text)['message'],
      'Could not find the specified course in finished courses you were enrolled in'
    );
  }

  {
    console.log('s1 lists current enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment?isPast=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const enrollment of body) delete enrollment.id;
    body.sort((a, b) => {
      if (a.courseName === b.courseName) return 0;
      if (a.courseName < b.courseName) return -1;
      if (a.courseName > b.courseName) return 1;
    });
    assert.deepStrictEqual(body, [
      {
        courseId: i1C1Id,
        courseName: 'i1c1',
        courseStartDate: i1C1Start,
        courseEndDate: i1C1End,
        status: 'ACCEPTED'
      },
      {
        courseId: i2C1Id,
        courseName: 'i2c1',
        courseStartDate: i2C1Start,
        courseEndDate: i2C1End,
        status: 'PENDING'
      }
    ]);
  }

  {
    console.log('s1 cancels i2c1s1');
    const res = await sendRequest('DELETE', `${ELEARNING_SERVICE_URL}/enrollment/${i2C1S1Id}`);
    console.log(await res.text());
    assert.equal(res.status, 202);
    await sleep(100);
  }

  {
    console.log('s1 lists unread notifications');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/notification?isRead=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.forEach((notification) => delete notification.id);
    assert.deepStrictEqual(body, [
      {
        title: 'Course enrollment status',
        body: `Enrollment of id: ${i2C1S1Id} was cancelled.`,
        isRead: false
      }
    ]);
  }

  await markAllNotificationsAsRead();

  {
    console.log('s1 lists current enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment?isPast=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const enrollment of body) delete enrollment.id;
    assert.deepStrictEqual(body, [
      {
        courseId: i1C1Id,
        courseName: 'i1c1',
        courseStartDate: i1C1Start,
        courseEndDate: i1C1End,
        status: 'ACCEPTED'
      }
    ]);
  }

  await login('admin', 'admin');

  {
    console.log('admin gets platform usage');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/usage`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), {
      numberOfStudents: 3,
      numberOfInstructors: 2,
      numberOfAdmins: 1,
      numberOfAcceptedCourses: 2,
      numberOfPendingCourses: 1,
      numberOfAcceptedEnrollments: 2,
      numberOfRejectedEnrollments: 1,
      numberOfPendingEnrollments: 0
    });
  }

  await login('s1', 's1123');
  await timeTravel(Date.now() + 7 * 24 * 60 * 60 * 1000);

  {
    console.log('s1 lists current enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment?isPast=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const enrollment of body) delete enrollment.id;
    assert.deepStrictEqual(body, [
      {
        courseId: i1C1Id,
        courseName: 'i1c1',
        courseStartDate: i1C1Start,
        courseEndDate: i1C1End,
        status: 'ACCEPTED'
      }
    ]);
  }

  {
    console.log('s1 lists past enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment?isPast=true`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const enrollment of body) delete enrollment.id;
    assert.deepStrictEqual(body, []);
  }

  {
    console.log('s1 lists all enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const enrollment of body) delete enrollment.id;
    assert.deepStrictEqual(body, [
      {
        courseId: i1C1Id,
        courseName: 'i1c1',
        courseStartDate: i1C1Start,
        courseEndDate: i1C1End,
        status: 'ACCEPTED'
      }
    ]);
  }

  {
    console.log('s1 tries to submit a review on i1c1 (still not finished)');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/review`, {
      stars: 5,
      body: 'Nice course'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 404);
    assert.equal(
      JSON.parse(text)['message'],
      'Could not find the specified course in finished courses you were enrolled in'
    );
  }

  await timeTravel(Date.now() + 365 * 24 * 60 * 60 * 1000);

  {
    console.log('s1 lists current enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment?isPast=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const enrollment of body) delete enrollment.id;
    assert.deepStrictEqual(body, []);
  }

  {
    console.log('s1 lists past enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment?isPast=true`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const enrollment of body) delete enrollment.id;
    assert.deepStrictEqual(body, [
      {
        courseId: i1C1Id,
        courseName: 'i1c1',
        courseStartDate: i1C1Start,
        courseEndDate: i1C1End,
        status: 'ACCEPTED'
      }
    ]);
  }

  {
    console.log('s1 lists all enrollments');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const enrollment of body) delete enrollment.id;
    assert.deepStrictEqual(body, [
      {
        courseId: i1C1Id,
        courseName: 'i1c1',
        courseStartDate: i1C1Start,
        courseEndDate: i1C1End,
        status: 'ACCEPTED'
      }
    ]);
  }

  {
    console.log('s1 submits a review on i1c1');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/review`, {
      stars: 5,
      body: 'Nice course'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
  }

  {
    console.log('s1 tries to submit a review on i1c1 (it has not started)');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/review`, {
      stars: 5,
      body: 'Nice course'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], 'You already have a review on this course');
  }

  {
    console.log('s1 tries to submit a review on i2c1');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i2C1Id}/review`, {
      stars: 5,
      body: 'Nice course'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 404);
    assert.equal(
      JSON.parse(text)['message'],
      'Could not find the specified course in finished courses you were enrolled in'
    );
  }

  await login('s2', 's2123');

  {
    console.log('s2 tries to submit a review on i1c1 with 6 stars');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/review`, {
      stars: 6
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], 'Stars must be between 0 and 5');
  }

  {
    console.log('s2 tries to submit a review on i1c1 with negative stars');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/review`, {
      stars: -1
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 400);
    assert.equal(JSON.parse(text)['message'], 'Stars must be between 0 and 5');
  }

  {
    console.log('s2 submits a review on i1c1');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/review`, {
      stars: 0
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
  }

  await login('s3', 's3123');

  {
    console.log('s3 tries to submit a review on i1c1 (their enrollment was rejected)');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/review`, {
      stars: 5,
      body: 'Nice course'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 404);
    assert.equal(
      JSON.parse(text)['message'],
      'Could not find the specified course in finished courses you were enrolled in'
    );
  }

  {
    console.log('s3 views available courses ordered by stars');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course?sortBy=stars`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const course of body) delete course.id;
    assert.deepStrictEqual(body, [
      {
        name: 'i1c1',
        instructorId: i1Id,
        instructorName: 'i1',
        averageStars: 2.5,
        numberOfReviews: 2,
        numberOfEnrollments: 2,
        category: 'Machine learning',
        startDate: i1C1Start,
        endDate: i1C1End,
        capacity: 300,
        status: 'ACCEPTED'
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
        status: 'ACCEPTED'
      }
    ]);
  }

  {
    console.log('s3 lists reviews on i1c1');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/review`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    for (const review of body) delete review.id;
    body.sort((a, b) => {
      if (a.studentName === b.studentName) return 0;
      if (a.studentName < b.studentName) return -1;
      if (a.studentName > b.studentName) return 1;
    });
    assert.deepStrictEqual(body, [
      {
        studentId: s1Id,
        studentName: 's1',
        stars: 5,
        body: 'Nice course'
      },
      {
        studentId: s2Id,
        studentName: 's2',
        stars: 0,
        body: ''
      }
    ]);
  }

  await login('s1', 's1123');

  {
    console.log('s1 views i1c1 (notice they are now enrolled)');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    assert.deepStrictEqual(body, {
      id: i1C1Id,
      name: 'i1c1',
      category: 'Machine learning',
      description: 'i1c1dd',
      instructorId: i1Id,
      startDate: i1C1Start,
      endDate: i1C1End,
      capacity: 300,
      numberOfEnrollments: 2,
      numberOfReviews: 2,
      averageStars: 2.5,
      status: 'ACCEPTED',
      enrolled: true
    });
  }

  await login('admin', 'admin');

  {
    console.log('admin sets s1 as admin');
    const res = await sendRequest('PUT', `${USER_SERVICE_URL}/user/${s1Id}`, {
      role: 'ADMIN'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  {
    console.log('admin lists all users');
    const res = await sendRequest('GET', `${USER_SERVICE_URL}/users`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.forEach((user) => delete user.id);
    body.sort((a, b) => {
      if (a.name === b.name) return 0;
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
    });
    assert.deepStrictEqual(body, [
      {
        name: 'admin',
        email: 'admin@admin.com',
        role: 'ADMIN',
        bio: 'This is an admin account',
        affiliation: 'Admin university'
      },
      {
        name: 'i1',
        email: 'i1@i1.com',
        role: 'INSTRUCTOR',
        experience: 13,
        bio: 'This is a cool instructor',
        affiliation: 'cu'
      },
      {
        name: 'i2',
        email: 'i2@i2.com',
        role: 'INSTRUCTOR',
        experience: 8,
        bio: 'This is another instructor',
        affiliation: 'cu'
      },
      {
        name: 's1',
        email: 's1@s1.com',
        role: 'ADMIN',
        bio: 'This is a cool student',
        affiliation: 'cu'
      },
      {
        name: 's2',
        email: 's2@s2.com',
        role: 'STUDENT',
        bio: 'This is another student',
        affiliation: 'cu'
      },
      {
        name: 's3',
        email: 's3@s3.com',
        role: 'STUDENT',
        bio: 'Yet another student',
        affiliation: 'cu'
      }
    ]);
  }

  await login('s1', 's1123');

  {
    console.log('s1 gets platform usage');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/usage`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    assert.deepStrictEqual(JSON.parse(text), {
      numberOfStudents: 2,
      numberOfInstructors: 2,
      numberOfAdmins: 2,
      numberOfAcceptedCourses: 2,
      numberOfPendingCourses: 1,
      numberOfAcceptedEnrollments: 2,
      numberOfRejectedEnrollments: 1,
      numberOfPendingEnrollments: 0
    });
  }

  {
    console.log('s1 deletes i1');
    const res = await sendRequest('DELETE', `${USER_SERVICE_URL}/user/${i1Id}`);
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  {
    console.log('s1 changes the name of i2 to x2');
    const res = await sendRequest('PUT', `${USER_SERVICE_URL}/user/${i2Id}`, {
      name: 'x2'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  {
    console.log('Try to log in as i1');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/login`, {
      nameOrEmail: 'i1',
      password: 'i1123'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 401);
    assert.equal(JSON.parse(text)['message'], 'Invalid name/email or password');
  }

  {
    console.log('Try to log in as i2 (with the old name)');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/login`, {
      nameOrEmail: 'i2',
      password: 'i2123'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 401);
    assert.equal(JSON.parse(text)['message'], 'Invalid name/email or password');
  }

  await login('x2', 'i2123');

  console.log('All tests passed');
})();
