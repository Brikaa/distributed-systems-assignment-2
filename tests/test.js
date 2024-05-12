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
    console.log('admin accepts i1c1 and changes its description to i1c1dd');
    const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}`, {
      description: 'i1c1dd',
      status: 'ACCEPTED'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
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
})();
