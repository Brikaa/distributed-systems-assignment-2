const process = require('process');
const assert = require('assert');

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
  const allNotificationsRes = await sendRequest('GET', `${ELEARNING_SERVICE_URL}/notification?isRead=false`);
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

module.exports = {
  sendRequest,
  login,
  markAllNotificationsAsRead,
  sleep,
  currentTimeSeconds,
  timeTravel,
  USER_SERVICE_URL,
  ELEARNING_SERVICE_URL
};
