import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:3001/api' : '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.error || err.message || 'Network error';
    return Promise.reject(msg);
  }
);
