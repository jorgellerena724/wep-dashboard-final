const apiUrl = 'http://localhost:8000/api/';
const imgUrl = `http://localhost:9002/wep/`;

export const environment = {
  use_minio: true,
  production: true,
  api: `${apiUrl}`,
  api_users: `${apiUrl}users/`,
  api_security: `${apiUrl}auth/`,
  api_img: `${imgUrl}`,
};
