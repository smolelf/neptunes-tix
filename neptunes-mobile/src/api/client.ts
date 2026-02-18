import axios from 'axios';

// IMPORTANT: Replace this with your computer's LOCAL IP (e.g., 192.168.1.5)
const BASE_URL = 'http://192.168.1.103:8080';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 5000, // 5 seconds
});

export default apiClient;