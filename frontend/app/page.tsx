"use client";

import GoLivePanel from "./components/GoLivePanel";
import UserList from "./components/UserList";
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";
import { useAuth } from "./contexts/AuthContext";

export default function Home() {
  const { user, logout, showRegister } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">
        Welcome to Pixie AI
      </h1>

      {!user ? (
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-2xl font-semibold text-gray-700 mb-6 text-center">
            {showRegister ? "Register" : "Login"}
          </h2>

          {showRegister ? <RegisterForm /> : <LoginForm />}
        </div>
      ) : (
        <div className="w-full max-w-4xl space-y-8">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-md">
            <p className="text-lg font-medium text-gray-700">
              Welcome, {user.email}!
            </p>

            <button
              onClick={logout}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Logout
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <GoLivePanel className="md:col-span-1" />

            <UserList />
          </div>
        </div>
      )}
    </div>
  );
}
