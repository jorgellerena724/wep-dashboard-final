const apiUrl = 'http://localhost:8000/api/';
const imgUrl = `https://api-minio.shirkasoft.net/wep/`;

export const environment = {
  production: false,
  api: `${apiUrl}`,
  api_users: `${apiUrl}users/`,
  api_security: `${apiUrl}auth/`,
  api_img: `${imgUrl}`,
  FRONT_TOKEN:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQHNoaXJrYXNvZnQuY29tIiwiZnVsbF9uYW1lIjoiU3VwZXIgQWRtaW4iLCJjbGllbnQiOiJzaGlya2Fzb2Z0In0.aJzrR79pG1NhTqRTW4fk0NmmmR7F_XVj0jKQ8c1URhg',
};
