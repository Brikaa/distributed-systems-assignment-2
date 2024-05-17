const {
  USER_SERVICE_URL,
  ELEARNING_SERVICE_URL,
  sendRequest,
  login,
  currentTimeSeconds,
  sleep,
  markAllNotificationsAsRead
} = require('./common');
const assert = require('assert');

const setFailure = async () => {
  console.log(`Causing server to fail on next message handling`);
  const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/fail`);
  assert.equal(res.status, 200);
};

(async () => {
  {
    console.log('Register Instructor i1');
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

  await login('i1', 'i1123');

  {
    console.log('i1 creates a course (i1c1)');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course`, {
      name: 'i1c1',
      description: 'i1c1d',
      startDate: currentTimeSeconds() + 7 * 24 * 60 * 60,
      endDate: currentTimeSeconds() + 14 * 24 * 60 * 60,
      category: 'Machine learning',
      capacity: 1
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  {
    console.log('Register Student s1');
    const res = await sendRequest('POST', `${USER_SERVICE_URL}/register`, {
      name: 's1',
      email: 's1@s1.com',
      password: 's1123',
      affiliation: 'cu',
      bio: 'This is a cool student',
      role: 'STUDENT'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  {
    console.log('Register Student s2');
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

  await login('admin', 'admin');

  let i1C1Id = undefined;

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
      }
      delete course.id;
    }
  }

  {
    console.log('admin accepts i1c1');
    const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}`, {
      status: 'ACCEPTED'
    });
    console.log(await res.text());
    assert.equal(res.status, 200);
  }

  await login('s1', 's1123');

  await setFailure();

  {
    console.log('s1 enrolls in i1c1');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
  }

  await markAllNotificationsAsRead();

  await login('s2', 's2123');

  {
    console.log('s2 enrolls in i1c1');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
    await sleep(1000);
  }

  await markAllNotificationsAsRead();

  await login('i1', 'i1123');

  let i1C1S1Id = undefined;
  let i1C1S2Id = undefined;
  {
    console.log('i1 views enrollments on i1c1, and tries to accept both i1c1s1 and i1c1s2');
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
    for (const enrollment of body) {
      if (enrollment.studentName === 's1') i1C1S1Id = enrollment.id;
      else if (enrollment.studentName === 's2') i1C1S2Id = enrollment.id;
      delete enrollment.id;
      delete enrollment.studentId;
    }
    assert.deepStrictEqual(body, [
      {
        studentName: 's1',
        status: 'PENDING'
      },
      {
        studentName: 's2',
        status: 'PENDING'
      }
    ]);
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
    console.log('i1 tries to accept i1c1s2 (course is full)');
    const res = await sendRequest('PUT', `${ELEARNING_SERVICE_URL}/enrollment/${i1C1S2Id}`, {
      status: 'ACCEPTED'
    });
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
    await sleep(50);
  }

  {
    console.log('i1 lists unread notifications');
    const res = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/notification?isRead=false`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 200);
    const body = JSON.parse(text);
    body.forEach((notification) => delete notification.id);
    assert.deepStrictEqual(body, [
      {
        title: 'Course enrollment status',
        body: `Can't accept enrollment of id: ${i1C1S2Id} since the course is full.`,
        isRead: false
      }
    ]);
  }

  await markAllNotificationsAsRead();

  await login('s2', 's2123');

  {
    console.log('s2 cancels i1c1s2');
    const res = await sendRequest('DELETE', `${ELEARNING_SERVICE_URL}/enrollment/${i1C1S2Id}`);
    console.log(await res.text());
    assert.equal(res.status, 202);
  }

  {
    console.log('s2 tries to enroll in i1c1 (course is full)');
    const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/course/${i1C1Id}/enrollment`);
    const text = await res.text();
    console.log(text);
    assert.equal(res.status, 202);
    await sleep(50);
  }

  {
    console.log('s2 lists unread notifications');
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
    assert.deepStrictEqual(body, [
      {
        title: 'Course enrollment status',
        body: `Can't enroll in course of id: ${i1C1Id} since it is full.`,
        isRead: false
      },
      {
        title: 'Course enrollment status',
        body: `Enrollment of id: ${i1C1S2Id} was cancelled.`,
        isRead: false
      }
    ]);
  }

  await markAllNotificationsAsRead();

  console.log('All tests passed');
})();
