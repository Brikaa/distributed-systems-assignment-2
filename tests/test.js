const process = require('process');
const assert = require('assert');

(async () => {
  const USER_SERVICE_URL = process.env['USER_SERVICE_URL'];
  const ELEARNING_SERVICE_URL = process.env['ELEARNING_SERVICE_URL'];

  const sendRequest = (method, url, body) => {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (method.toLowerCase() != 'get') opts.body = JSON.stringify(body);
    return fetch(url, opts);
  };

  {
    console.log(
      "Register Instructor (name: i1, email: i1@i1.com, password: i1123, affiliation: cu, experience: 13, bio: 'this is a cool instructor', role: instructor)"
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
})();
