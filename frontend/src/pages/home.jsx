import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/images/logo.png'; // Adjust path based on your structure

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-[#1e1e2f]">
      {/* Top Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <img src={logo} alt="Logo" className="w-36 h-36 mb-6 object-contain" />
        <h1 className="text-3xl font-bold text-gray-200 text-center">
          HerShield
        </h1>
      </div>

      {/* Bottom Section */}
      <div className="flex-1 bg-[#1e1e2f] rounded-t-3xl px-8 flex flex-col items-center justify-center">
        {/* <p className="text-base text-gray-300 text-center mb-8">
          Empowering Safety Through Innovation
        </p> */}
        <button
          onClick={() => navigate('/register')}
          className="bg-purple-700 hover:bg-purple-800 text-white font-semibold py-3 px-8 rounded-xl transition duration-300"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default Home;
