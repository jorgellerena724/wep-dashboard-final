const apiUrl = 'http://localhost:3002/api/';
const imgUrl = `${apiUrl}images/`;

export const environment = {
  use_minio: false,
  production: false,
  api: `${apiUrl}`,
  api_users: `${apiUrl}users/`,
  api_security: `${apiUrl}auth/`,
  api_img: `${imgUrl}`,
};
