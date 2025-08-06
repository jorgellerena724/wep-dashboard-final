const apiUrl = 'https://wepbackend.shirkasoft.net/api/';
const imgUrl = `https://api-minio.shirkasoft.net/wep/`;

export const environment = {
  production: true,
  api: `${apiUrl}`,
  api_users: `${apiUrl}users/`,
  api_security: `${apiUrl}auth/`,
  api_img: `${imgUrl}`,
};
