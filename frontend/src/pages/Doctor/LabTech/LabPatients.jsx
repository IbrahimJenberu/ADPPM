// Lab/LabPatients.jsx
import React, { useState } from 'react';
import { FiSearch, FiEye, FiFileText, FiClock, FiCheckCircle } from 'react-icons/fi';

function LabPatients() {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([
    { id: 'P10022', name: 'Sarah Smith', age: 35, gender: 'Female', testsCompleted: 3, testsPending: 1, lastTest: '2023-03-28' },
    { id: 'P10023', name: 'Michael Brown', age: 28, gender: 'Male', testsCompleted: 2, testsPending: 1, lastTest: '2023-03-29' },
    { id: 'P10024', name: 'Emily Davis', age: 54, gender: 'Female', testsCompleted: 4, testsPending: 0, lastTest: '2023-03-29' },
    { id: 'P10025', name: 'Robert Wilson', age: 62, gender: 'Male', testsCompleted: 2, testsPending: 0, lastTest: '2023-03-29' },
    { id: 'P10026', name: 'Jennifer Lee', age: 45, gender: 'Female', testsCompleted: 1, testsPending: 0, lastTest: '2023-03-28' },
    { id: 'P10027', name: 'Thomas Moore', age: 38, gender: 'Male', testsCompleted: 1, testsPending: 0, lastTest: '2023-03-28' },
    { id: 'P10029', name: 'David Miller', age: 51, gender: 'Male', testsCompleted: 1, testsPending: 2, lastTest: '2023-03-30' },
  ]);

  const filteredPatients = patients.filter(patient => 
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold mb-4 md:mb-0">Lab Patients</h2>
          <div className="w-full md:w-1/3 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tests Completed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tests Pending</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Test Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{patient.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{patient.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.age}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.gender}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FiCheckCircle className="mr-1.5 h-4 w-4 text-green-500" />
                      <span className="text-sm text-gray-900">{patient.testsCompleted}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FiClock className="mr-1.5 h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-gray-900">{patient.testsPending}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.lastTest}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-900" title="View Patient Details">
                        <FiEye className="h-5 w-5" />
                      </button>
                      <button className="text-purple-600 hover:text-purple-900" title="View Test History">
                        <FiFileText className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPatients.length === 0 && (
          <div className="text-center py-4 text-gray-500">No patients found matching your search criteria.</div>
        )}
      </div>
    </div>
  );
}

export default LabPatients;