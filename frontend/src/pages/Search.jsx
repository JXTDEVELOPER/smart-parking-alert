import React, { useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Search as SearchIcon, AlertCircle, Car, User, Phone, ScanSearch, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Search() {
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  
  const [isAlerting, setIsAlerting] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setError('');
    setSearchResult(null);
    setAlertMessage(null);
    setLoading(true);

    try {
      const normalizedPlate = searchInput.toUpperCase().replace(/[\s-]/g, '');

      const vehiclesRef = collection(db, 'vehicles');
      const q = query(vehiclesRef, where('plate_number', '==', normalizedPlate));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setLoading(false);
        return setError('Vehicle not found in the system.');
      }

      const vehicleDoc = querySnapshot.docs[0];
      const vehicleData = vehicleDoc.data();
      const ownerUid = vehicleData.owner_uid;
      const display_plate = vehicleData.display_plate || vehicleData.plate_number;

      const userRef = doc(db, 'users', ownerUid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setLoading(false);
        return setError('Vehicle owner profile could not be found.');
      }

      const userData = userSnap.data();

      setSearchResult({
        display_plate: display_plate,
        ownerName: userData.name,
        phone_number: userData.phone_number
      });

    } catch (err) {
      console.error("Error during search:", err);
      setError('An error occurred during lookup: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendAlert = async () => {
    setIsAlerting(true);
    setAlertMessage(null);
    
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const res = await fetch(`${backendUrl}/api/alerts/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: searchResult.phone_number,
          plateNumber: searchResult.display_plate
        })
      });

      if (!res.ok) {
        throw new Error('Failed to send SMS.');
      }

      setAlertMessage('SMS Alert Sent Successfully!');
    } catch (err) {
      console.error('Alert error:', err.message);
      setAlertMessage('Failed to send SMS.');
    } finally {
      setIsAlerting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <Link to="/dashboard" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
          </Link>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center">
          
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <ScanSearch className="h-8 w-8" />
          </div>

          <h1 className="text-3xl font-extrabold text-gray-900 text-center mb-2">Blocker Lookup</h1>
          <p className="text-gray-500 text-center mb-8 max-w-md">
            Is a vehicle blocking your way? Enter the license plate number below to find the owner and send a move request.
          </p>

          <form onSubmit={handleSearch} className="w-full max-w-md mb-8">
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Car className="h-6 w-6 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-12 pr-28 py-4 border-2 border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-lg transition-colors font-semibold uppercase"
                placeholder="KL-05-AB-1234"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                required
              />
              <div className="absolute inset-y-0 right-0 p-1.5 flex transition-opacity">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Searching...' : <><SearchIcon className="h-4 w-4 mr-2" /> Search</>}
                </button>
              </div>
            </div>
          </form>

          {/* Error View */}
          {error && (
            <div className="w-full max-w-md bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start animate-pulse">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Result View */}
          {searchResult && (
            <div className="w-full max-w-md bg-white border-2 border-green-100 rounded-xl overflow-hidden shadow-sm transition-all animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-green-50 px-6 py-4 border-b border-green-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-green-900 flex items-center">
                  <Car className="h-5 w-5 mr-2" />
                  Vehicle Found
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 uppercase tracking-wider">
                  {searchResult.display_plate}
                </span>
              </div>
              
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center">
                  <div className="p-2 bg-gray-50 rounded-lg mr-4">
                    <User className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Registered Owner</p>
                    <p className="text-lg font-semibold text-gray-900">{searchResult.ownerName}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="p-2 bg-gray-50 rounded-lg mr-4">
                    <Phone className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Contact Number</p>
                    <p className="text-lg font-semibold text-gray-900 font-mono tracking-tight">{searchResult.phone_number}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={handleSendAlert}
                    disabled={isAlerting}
                    className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-bold rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <AlertCircle className="h-5 w-5 mr-2" />
                    {isAlerting ? 'Sending...' : 'Send Move Alert (SMS)'}
                  </button>
                  {alertMessage && (
                    <p className={`text-center font-bold text-sm mt-3 ${alertMessage.includes('Successfully') ? 'text-green-600' : 'text-red-600'}`}>
                      {alertMessage}
                    </p>
                  )}
                  <p className="text-center text-xs text-gray-500 mt-3">
                    This will notify the owner anonymously to move their vehicle.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
