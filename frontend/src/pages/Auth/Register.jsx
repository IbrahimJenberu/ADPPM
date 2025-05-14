import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api";

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "doctor",
  });

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/register", formData);
      alert("Registration successful! Please login.");
    } catch (err) {
      console.error("Registration failed", err);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center">Register</h2>
        <form onSubmit={handleSubmit} className="mt-4">
          <input
            type="text"
            name="fullName"
            placeholder="Full Name"
            className="w-full p-2 border rounded my-2"
            onChange={handleChange}
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="w-full p-2 border rounded my-2"
            onChange={handleChange}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="w-full p-2 border rounded my-2"
            onChange={handleChange}
          />
          <select
            name="role"
            className="w-full p-2 border rounded my-2"
            onChange={handleChange}
          >
            <option value="doctor">Doctor</option>
            <option value="labtech">Lab Technician</option>
            <option value="cardroom">Card Room Worker</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">
            Register
          </button>
        </form>
        <p className="text-center mt-2">
          Already have an account? <Link to="/login" className="text-blue-600">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
