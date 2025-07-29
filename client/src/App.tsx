import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import RoomsList from './pages/RoomsList';
import RoomBuilder from './pages/RoomBuilder';
import Login from './pages/Login';
import Signup from './pages/Signup';

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!localStorage.getItem('token'));

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('token'));
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <>
      <nav className="p-4 border-b mb-4 flex space-x-4">
        <Link to="/" className="text-blue-600 hover:underline">Rooms</Link>
        {isLoggedIn ? (
          <button onClick={handleLogout} className="text-red-500 hover:underline">Logout</button>
        ) : (
          <>
            <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
            <Link to="/signup" className="text-blue-600 hover:underline">Sign Up</Link>
          </>
        )}
      </nav>
      <Routes>
        <Route
          path="/"
          element={
            isLoggedIn ? <RoomsList /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/rooms/:id"
          element={
            isLoggedIn ? <RoomBuilder /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/login"
          element={
            isLoggedIn ? <Navigate to="/" replace /> : <Login />
          }
        />
        <Route
          path="/signup"
          element={
            isLoggedIn ? <Navigate to="/" replace /> : <Signup />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
