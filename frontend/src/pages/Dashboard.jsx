import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, limit, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Car, CreditCard, LogOut, Plus, AlertCircle, Hash, Search as SearchIcon, Clock, Activity, Trash2, RefreshCw, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  
  // Form State
  const [plateNumber, setPlateNumber] = useState('');
  const [rfidUid, setRfidUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Vehicles State
  const [vehicles, setVehicles] = useState([]);
  const [fetching, setFetching] = useState(true);

  // Logs State
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  
  // Image Modal State
  const [selectedImage, setSelectedImage] = useState(null);

  // 1. Load user's vehicles via real-time listener
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'vehicles'),
      where('owner_uid', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vehicleData = [];
      snapshot.forEach((doc) => {
        vehicleData.push({ id: doc.id, ...doc.data() });
      });
      vehicleData.sort((a, b) => {
        if (!a.created_at || !b.created_at) return 0;
        return b.created_at.toMillis() - a.created_at.toMillis();
      });
      
      setVehicles(vehicleData);
      setFetching(false);
    }, (err) => {
      console.error("Error fetching vehicles:", err);
      setFetching(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 2. Load recent global logs and filter for user's vehicles
  useEffect(() => {
    if (fetching) return; // wait until vehicles are loaded
    
    // If no vehicles, no logs to match. Fast exit.
    if (vehicles.length === 0) {
      setLogs([]);
      setLoadingLogs(false);
      return;
    }

    const qLogs = query(
      collection(db, 'logs'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const rawLogs = [];
      snapshot.forEach((doc) => {
        rawLogs.push({ id: doc.id, ...doc.data() });
      });

      // Filter locally to avoid complex Firestore indexing issues for the MVP
      const matchedLogs = rawLogs.filter(log => 
        vehicles.some(v => v.id === log.vehicle_id)
      );

      // Enhance with human-readable plate numbers
      const enhancedLogs = matchedLogs.map(log => {
        const matchingVehicle = vehicles.find(v => v.id === log.vehicle_id);
        return {
          ...log,
          plate_number: matchingVehicle ? (matchingVehicle.display_plate || matchingVehicle.plate_number) : 'Unknown'
        };
      });

      setLogs(enhancedLogs);
      setLoadingLogs(false);
    }, (err) => {
      console.error("Error fetching logs:", err);
      setLoadingLogs(false);
    });

    return () => unsubscribeLogs();
  }, [vehicles, fetching]);

  // Handle Form Submission
  const handleRegisterVehicle = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!plateNumber || !rfidUid) {
      return setError('Please fill in all fields.');
    }

    try {
      setLoading(true);
      const cleanedPlateNumber = plateNumber.toUpperCase().replace(/[\s-]/g, '');

      const payload = {
        owner_uid: currentUser.uid,
        plate_number: cleanedPlateNumber,
        display_plate: plateNumber.toUpperCase(), 
        rfid_uid: rfidUid,
        created_at: serverTimestamp()
      };

      await addDoc(collection(db, 'vehicles'), payload);

      setSuccessMsg('Vehicle registered successfully!');
      setPlateNumber('');
      setRfidUid('');
      setTimeout(() => setSuccessMsg(''), 3000);
      
    } catch (err) {
      console.error("Error registering vehicle:", err);
      setError('Failed to register vehicle. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete Vehicle
  const handleDeleteVehicle = async (vehicleId) => {
    if (window.confirm("Are you sure you want to remove this vehicle?")) {
      try {
        await deleteDoc(doc(db, "vehicles", vehicleId));
      } catch (err) {
        console.error("Error deleting vehicle:", err);
      }
    }
  };

  // Toggle log type between 'entry' and 'exit'
  const handleToggleLogType = async (logId, currentType) => {
    const newType = currentType === 'entry' ? 'exit' : 'entry';
    try {
      await updateDoc(doc(db, 'logs', logId), { type: newType });
    } catch (err) {
      console.error('Error toggling log type:', err);
    }
  };

  // Delete a log manually
  const handleDeleteLog = async (logId) => {
    if (window.confirm('Remove this log entry?')) {
      try {
        await deleteDoc(doc(db, 'logs', logId));
      } catch (err) {
        console.error('Error deleting log:', err);
      }
    }
  };

  // Format timestamp helper
  const formatTimestamp = (ts) => {
    if (!ts) return 'Just now';
    const date = new Date(ts.toMillis());
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Car className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">Smart Parking Dashboard</h1>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-4">
            <Link
              to="/search"
              className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-2 rounded-md transition-colors"
            >
              <SearchIcon className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:block">Lookup Vehicle</span>
            </Link>
            <span className="text-sm text-gray-600 hidden lg:block mr-2">{currentUser?.email}</span>
            <button
              onClick={() => logout()}
              className="flex items-center text-sm font-medium text-gray-500 hover:text-red-600 transition-colors bg-gray-50 px-3 py-2 rounded-md"
            >
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Register Form */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Plus className="h-5 w-5 text-blue-500 mr-2" />
                Register New Vehicle
              </h2>
              
              {error && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 rounded-md flex items-center text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-3 rounded-md flex items-center text-sm text-green-700">
                  <Car className="h-4 w-4 mr-2 flex-shrink-0" />
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleRegisterVehicle} className="space-y-4">
                <div>
                  <label htmlFor="plateNumber" className="block text-sm font-medium text-gray-700">Plate Number</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Hash className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="plateNumber"
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 border outline-none"
                      placeholder="KL-05-AB-1234"
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="rfidUid" className="block text-sm font-medium text-gray-700">RFID UID</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="rfidUid"
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2.5 border outline-none"
                      placeholder="e.g., 53A8F91B"
                      value={rfidUid}
                      onChange={(e) => setRfidUid(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Registering...' : 'Register Vehicle'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column - Data & Feeds */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* My Vehicles Block */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Car className="h-5 w-5 text-blue-500 mr-2" />
                My Vehicles
              </h2>

              {fetching ? (
                <div className="flex justify-center items-center h-32 text-gray-500">
                  <div className="animate-pulse flex space-x-2 items-center">
                    <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                    <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                    <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                  </div>
                </div>
              ) : vehicles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                  <Car className="h-10 w-10 text-gray-300 mb-2" />
                  <p>No vehicles registered yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehicles.map((vehicle) => (
                    <div 
                      key={vehicle.id} 
                      className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-10 group-hover:bg-blue-100 transition-colors"></div>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Plate Number</p>
                          <p className="text-2xl font-bold text-gray-900 tracking-tight">
                            {vehicle.display_plate || vehicle.plate_number}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {vehicle.status === 'inside' ? (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 tracking-wide">
                              Parked Inside
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 tracking-wide">
                              Outside
                            </span>
                          )}
                          <div className="p-2 bg-blue-50 rounded-md text-blue-600">
                            <Car className="h-5 w-5" />
                          </div>
                          <button
                            onClick={() => handleDeleteVehicle(vehicle.id)}
                            className="p-2 bg-red-50 rounded-md text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors"
                            title="Remove Vehicle"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center text-sm text-gray-600">
                        <CreditCard className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="font-mono">{vehicle.rfid_uid}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity (RFID Logs) Block */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Activity className="h-5 w-5 text-blue-500 mr-2" />
                Recent Activity (RFID Logs)
              </h2>

              {loadingLogs ? (
                <div className="flex justify-center items-center h-24 text-gray-500">
                  <div className="animate-pulse flex space-x-2 items-center">
                    <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                    <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                    <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                  </div>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-100">
                  <Clock className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm">No recent activity found for your vehicles.</p>
                </div>
              ) : (
                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vehicle
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logs.map((log) => (
                        <tr key={log.id} className={`transition-colors ${log.alert ? 'bg-red-500/10 border border-red-500/50' : 'hover:bg-gray-50'}`}>
                          <td className="px-6 py-4 whitespace-nowrap min-w-[320px]">
                            <div className="flex items-center w-full">
                              <div className="flex flex-col">
                                <div className="flex items-center space-x-3">
                                  {log.alert && <span className="animate-pulse text-lg" title="Security Alert">🚨</span>}
                                  <div className="text-sm font-bold text-gray-900">
                                    {log.plate_number}
                                  </div>
                                  {log.detected_plate && (
                                    <span className="bg-yellow-400 text-black font-mono text-xs font-bold px-2 py-1 rounded shadow-sm uppercase tracking-wider border border-yellow-500/50">
                                      {log.detected_plate}
                                    </span>
                                  )}
                                </div>
                                {log.alert && (
                                  <div className="mt-1 flex flex-col">
                                    <span className="text-xs font-bold text-red-600">{log.alert_reason}</span>
                                    <span className="text-[10px] text-red-500/90 mt-0.5">
                                      Expected: {log.registered_plate || log.plate_number} | Seen: {log.detected_plate || 'None'}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {log.imageUrl && (
                                <img 
                                  src={log.imageUrl} 
                                  alt="ESP32-CAM Capture" 
                                  onClick={() => setSelectedImage(log.imageUrl)}
                                  className={`w-16 h-12 object-cover rounded-md border shadow-sm ml-auto hover:scale-110 transition-transform cursor-pointer duration-200 ${log.alert ? 'border-red-500' : 'border-slate-700/50'}`}
                                />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full uppercase tracking-wide ${
                              log.type === 'exit' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {log.type || 'entry'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center">
                            <Clock className="h-4 w-4 mr-1.5 text-gray-400" />
                            {formatTimestamp(log.timestamp)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleToggleLogType(log.id, log.type)}
                                title={`Switch to ${log.type === 'entry' ? 'exit' : 'entry'}`}
                                className="p-1.5 rounded-md text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                title="Delete log"
                                className="p-1.5 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

        </div>
        
        {/* Full-Screen Image Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
          >
            <button 
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2 cursor-pointer"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-8 w-8" />
            </button>
            <img 
              src={selectedImage} 
              alt="Full Size Capture" 
              onClick={(e) => e.stopPropagation()}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl border border-slate-600"
            />
          </div>
        )}
      </main>
    </div>
  );
}
