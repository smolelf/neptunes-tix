// web-admin/src/app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // 🚀 Import Router
import apiClient from '@/lib/apiClient';
import Cookies from 'js-cookie';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter(); // 🚀 Initialize Router

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await apiClient.post('/login', { email, password });
      Cookies.set('adminToken', response.data.token, { expires: 3 });
      
      // 🚀 Redirect to the dashboard
      router.push('/dashboard');
      
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Admin Portal</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input 
              type="email" 
              className="mt-1 w-full p-2 border rounded-md text-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input 
              type="password" 
              className="mt-1 w-full p-2 border rounded-md text-black"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-md font-bold hover:bg-blue-700">
            Sign In
          </button>
        </form>

        {error && <div className="mt-4 text-sm text-center text-red-600">{error}</div>}
      </div>
    </div>
  );
}