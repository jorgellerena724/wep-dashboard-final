const apiUrl = 'https://wep-backend.shirkasoft.net/api/';
const imgUrl = `https://api-minio.shirkasoft.net/wep/`;

export const environment = {
  use_minio: true,
  production: true,
  api: `${apiUrl}`,
  api_users: `${apiUrl}users/`,
  api_security: `${apiUrl}auth/`,
  api_img: `${imgUrl}`,
};
