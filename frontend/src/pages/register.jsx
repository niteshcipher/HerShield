import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../lib/axios';

const Register = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [aadhar, setAadhar] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    if (!name||!aadhar || !email || !password) {
      alert('Please fill all fields');
      return;
    }

    try {
      const res = await axios.post('/auth/signup', {
        name,
        aadhar,
        email,
        password,
      });

      console.log('Registered:', res.data);
      navigate('/dashboard');
    } catch (err) {
      console.error('Register error:', err?.response?.data || err.message);
      alert(err?.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1e1e2f] px-4">
      <div className="w-full max-w-md bg-[#2c2c3e] p-8 rounded-2xl shadow-lg animate-fade-in-up">
        <h2 className="text-2xl font-bold text-center text-gray-200 mb-6">Register</h2>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 rounded-lg bg-[#3a3a4f] border border-[#444] text-gray-200 placeholder-gray-400"
          />

          <input
            type="aadhar"
            placeholder="Aadhar Number"
            value={aadhar}
            onChange={(e) => setAadhar(e.target.value)}
            className="w-full p-3 rounded-lg bg-[#3a3a4f] border border-[#444] text-gray-200 placeholder-gray-400"
          />    

          <input
            type="email"
            placeholder="Email or Phone"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-lg bg-[#3a3a4f] border border-[#444] text-gray-200 placeholder-gray-400"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-lg bg-[#3a3a4f] border border-[#444] text-gray-200 placeholder-gray-400"
          />

          <button
            onClick={handleRegister}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
          >
            Create Account
          </button>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-purple-300 hover:underline font-semibold"
          >
            Login
          </button>
        </p>

        <div className="text-center mt-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-300 transition text-sm"
          >
            ← Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
