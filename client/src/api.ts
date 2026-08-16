import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    const msg = data?.error || data?.message || err.message || 'Network error';
    return Promise.reject(status ? `${msg} (status ${status})` : msg);
  }
);
