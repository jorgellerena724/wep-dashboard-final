const apiUrl = 'http://localhost:3002/api/';
const imgUrl = `https://api-minio.shirkasoft.net/wep/`;

export const environment = {
  production: false,
  api: `${apiUrl}`,
  api_users: `${apiUrl}users/`,
  api_security: `${apiUrl}auth/`,
  api_img: `${imgUrl}`,
};
