  // ✅ Correct import path

import { useAuth } from "../contexts/AuthContext"

const Dashboard = () => {
  const { currentUser } = useAuth()
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Welcome, {currentUser?.username}</h1>
      <p className="text-gray-600">This is your dashboard</p>
    </div>
  )
}

export default Dashboard