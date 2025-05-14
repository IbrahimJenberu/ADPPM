import { Link } from 'react-router-dom'

const Unauthorized = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-4xl font-bold text-red-600 mb-4">403 - Unauthorized</h1>
      <p className="text-lg mb-6">You don't have permission to access this page</p>
      <Link 
        to="/" 
        className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
      >
        Go to Home
      </Link>
    </div>
  )
}

export default Unauthorized