import { Link } from 'react-router-dom'

const Home = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <h1 className="text-4xl font-bold mb-6">Welcome to ADPPM</h1>
      <p className="text-xl mb-8 text-center max-w-2xl">
        AI Doctor for Proactive Patient Management System
      </p>
      <div className="flex gap-4">
        <Link 
          to="/login" 
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          Login
        </Link>
        <Link 
          to="/about" 
          className="px-6 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition"
        >
          Learn More
        </Link>
      </div>
    </div>
  )
}

export default Home