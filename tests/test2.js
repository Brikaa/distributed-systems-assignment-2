const {
  USER_SERVICE_URL,
  ELEARNING_SERVICE_URL,
  sendRequest,
  login,
  currentTimeSeconds,
  sleep
} = require('./common');
const assert = require('assert');

const setFailure = async () => {
  console.log(`Causing server to fail on next message handling`);
  const res = await sendRequest('POST', `${ELEARNING_SERVICE_URL}/fail`);
  assert.equal(res.status, 200);
};

(async () => {
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

  await login('i1', 'i1123');

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
    await sleep(1000);
  }

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
    assert.deepStrictEqual(body, [
      {
        title: 'Course enrollment status',
        body: "Submitted an enrollment request for: 'i1c1', we will get back to you once it is accepted.",
        isRead: false
      }
    ]);
  }

  console.log("All tests passed");
})();
