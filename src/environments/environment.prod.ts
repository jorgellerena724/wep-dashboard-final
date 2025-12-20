const apiUrl = 'https://api.shirkasoft.net/api/';
const imgUrl = `${apiUrl}images/`;

export const environment = {
  use_minio: true,
  production: true,
  api: `${apiUrl}`,
  api_users: `${apiUrl}users/`,
  api_security: `${apiUrl}auth/`,
  api_img: `${imgUrl}`,
};
