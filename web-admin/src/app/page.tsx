'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/apiClient';
import Cookies from 'js-cookie';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // 🚀 Added a loading state for polish
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/login', { email, password });
      const token = response.data.token;

      // 🚀 THE BULLETPROOF BOUNCER: Decode the JWT payload directly
      try {
        // A JWT has 3 parts separated by dots. The payload is the middle part [index 1].
        const payloadBase64 = token.split('.')[1];
        const decodedJson = atob(payloadBase64); // Decode Base64 to string
        const parsedPayload = JSON.parse(decodedJson); // Parse string to JSON

        // Extract the role EXACTLY as it is named in your Go auth.go file!
        const userRole = parsedPayload.user_role; 

        if (userRole === 'customer') {
          setError("Access Denied: This portal is for Administrators and Agents only.");
          setLoading(false);
          return; // Kick them out!
        }
      } catch (decodeErr) {
        console.error("Failed to decode token", decodeErr);
        setError("Login failed due to secure token error.");
        setLoading(false);
        return;
      }

      // If they pass the check, set the cookie and let them in
      Cookies.set('adminToken', token, { expires: 3 });
      router.push('/dashboard');
      
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96">
        <h1 className="text-2xl font-black tracking-tighter text-center text-blue-600 mb-1">NEPTUNE'S TIX.</h1>
        <h2 className="text-xs font-bold mb-6 text-center text-gray-400 tracking-widest uppercase">Admin Portal</h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input 
              type="email" 
              className="mt-1 w-full p-2 border rounded-md text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input 
              type="password" 
              className="mt-1 w-full p-2 border rounded-md text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white p-2.5 rounded-md font-bold hover:bg-blue-700 transition disabled:opacity-70 flex justify-center items-center"
            disabled={loading}
          >
            {loading ? (
               <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-100 text-sm text-center text-red-600 font-medium">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}