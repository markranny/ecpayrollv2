import React, { useState, useEffect } from 'react';
import { X, Save, Clock, AlertTriangle, RotateCcw, Trash2, Loader2, Info, Moon, Sun, RefreshCw, CheckCircle, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ... (keep all existing functions like formatTime, TimePicker, etc.)

const AttendanceEditModal = ({ isOpen, attendance, onClose, onSave, onDelete, onSync }) => {
  const [formData, setFormData] = useState({
    id: '',
    time_in: '',
    time_out: '',
    break_in: '',
    break_out: '',
    next_day_timeout: '',
    is_nightshift: false,
    trip: 0 // NEW: Trip field
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNightShiftInfo, setShowNightShiftInfo] = useState(false);

  // ... (keep all existing helper functions)

  // Initialize form data when attendance changes with improved time handling
  useEffect(() => {
    if (attendance) {
      console.log('Initializing form with attendance data:', attendance);
      setFormData({
        id: attendance.id,
        time_in: formatTimeForInput(attendance.time_in),
        time_out: formatTimeForInput(attendance.time_out),
        break_in: formatTimeForInput(attendance.break_in),
        break_out: formatTimeForInput(attendance.break_out),
        next_day_timeout: formatTimeForInput(attendance.next_day_timeout),
        is_nightshift: attendance.is_nightshift || false,
        trip: attendance.trip || 0 // NEW: Initialize trip field
      });
    }
  }, [attendance]);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // ... (keep all existing functions until the render part)

  // If modal is not open, don't render anything
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 md:mx-8">
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-800">Edit Attendance Times</h2>
            {formData.is_nightshift && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                <Moon className="h-4 w-4" />
                <span>Night Shift</span>
              </div>
            )}
            {!formData.is_nightshift && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                <Sun className="h-4 w-4" />
                <span>Regular Shift</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Enhanced Night Shift Information Panel */}
          {showNightShiftInfo && (
            <Alert className="border-purple-200 bg-purple-50">
              <Info className="h-4 w-4 mr-2 text-purple-600" />
              <AlertDescription className="text-purple-800">
                <strong>{formData.is_nightshift ? 'Night Shift Enabled:' : 'Regular Shift Mode:'}</strong>
                <br />
                {formData.is_nightshift ? (
                  <>
                    • Use "Time Out" only if employee clocks out the same day
                    <br />
                    • Use "Next Day Timeout" if employee clocks out the following day
                    <br />
                    • Do not use both fields - choose the appropriate one for your situation
                  </>
                ) : (
                  <>
                    • Use "Time In" and "Time Out" for same-day attendance
                    <br />
                    • "Next Day Timeout" field is disabled for regular shifts
                    <br />
                    • Both Time In and Time Out are required
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1 mb-6">
            <div className="font-medium text-gray-700 mb-3">
              {attendance?.employee_name} (ID: {attendance?.idno})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500">
              <div>
                <span className="font-medium">Department:</span> {attendance?.department || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Date:</span> {attendance?.attendance_date ? new Date(attendance.attendance_date).toLocaleDateString() : 'N/A'}
              </div>
              <div>
                <span className="font-medium">Hours Worked:</span> {attendance?.hours_worked || 'N/A'}
              </div>
            </div>
          </div>

          {/* Enhanced Night Shift Toggle Section */}
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="is_nightshift"
                name="is_nightshift"
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                checked={formData.is_nightshift}
                onChange={handleNightShiftChange}
              />
              <label htmlFor="is_nightshift" className="ml-2 block text-sm font-medium text-gray-900">
                <div className="flex items-center space-x-2">
                  {formData.is_nightshift ? (
                    <Moon className="h-4 w-4 text-purple-600" />
                  ) : (
                    <Sun className="h-4 w-4 text-yellow-600" />
                  )}
                  <span>Night Shift</span>
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-600 ml-6">
              {formData.is_nightshift 
                ? "Night shift mode: Employee works overnight and may clock out the next day"
                : "Regular shift mode: Employee clocks in and out on the same day"
              }
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="time_in" className="block text-sm font-medium text-gray-700 mb-2">
                Time In <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <div className="pl-10">
                  <TimePicker
                    name="time_in"
                    value={formData.time_in}
                    onChange={handleChange}
                    placeholder="9:30 AM"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="time_out" className="block text-sm font-medium text-gray-700 mb-2">
                Time Out {formData.is_nightshift ? '(Same Day)' : <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <div className="pl-10">
                  <TimePicker
                    name="time_out"
                    value={formData.time_out}
                    onChange={handleChange}
                    placeholder="5:30 PM"
                    required={!formData.is_nightshift}
                    disabled={formData.is_nightshift && formData.next_day_timeout}
                  />
                </div>
              </div>
              {formData.is_nightshift && (
                <p className="mt-1 text-xs text-gray-500">
                  Only use this if employee clocks out on the same day. Otherwise, use "Next Day Timeout" below.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="break_out" className="block text-sm font-medium text-gray-700 mb-2">
                Break Out (Optional)
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <div className="pl-10">
                  <TimePicker
                    name="break_out"
                    value={formData.break_out}
                    onChange={handleChange}
                    placeholder="12:00 PM"
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                When employee leaves for break/lunch
              </p>
            </div>

            <div>
              <label htmlFor="break_in" className="block text-sm font-medium text-gray-700 mb-2">
                Break In (Optional)
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <div className="pl-10">
                  <TimePicker
                    name="break_in"
                    value={formData.break_in}
                    onChange={handleChange}
                    placeholder="1:00 PM"
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                When employee returns from break/lunch
              </p>
            </div>
          </div>

          {/* NEW: Trip Input Section */}
          <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
            <div>
              <label htmlFor="trip" className="block text-sm font-medium text-blue-800 mb-2">
                <div className="flex items-center space-x-2">
                  <Car className="h-4 w-4" />
                  <span>Number of Trips</span>
                </div>
              </label>
              <div className="relative">
                <Car className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600 z-10" />
                <input
                  type="number"
                  id="trip"
                  name="trip"
                  min="0"
                  max="999.99"
                  step="0.01"
                  value={formData.trip}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <p className="mt-1 text-xs text-blue-700">
                Enter the number of trips (e.g., 1.5 for one and a half trips)
              </p>
            </div>
          </div>

          {/* Enhanced Next Day Timeout Section */}
          {formData.is_nightshift && (
            <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
              <div>
                <label htmlFor="next_day_timeout" className="block text-sm font-medium text-purple-800 mb-2">
                  <div className="flex items-center space-x-2">
                    <Moon className="h-4 w-4" />
                    <span>Next Day Timeout</span>
                    {!formData.time_out && <span className="text-red-500">*</span>}
                  </div>
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-600 z-10" />
                  <div className="pl-10">
                    <TimePicker
                      name="next_day_timeout"
                      value={formData.next_day_timeout}
                      onChange={handleChange}
                      placeholder="6:00 AM"
                      disabled={!!formData.time_out}
                    />
                  </div>
                </div>
                <div className="mt-2 text-xs text-purple-700">
                  <strong>For night shifts only:</strong> When the employee clocks out on the following day.
                  {formData.time_out && (
                    <div className="mt-1 p-2 bg-purple-100 rounded text-purple-800 font-medium">
                      ⚠️ Disabled because "Time Out" is set. Clear "Time Out" to use this field.
                    </div>
                  )}
                  {!formData.time_out && !formData.next_day_timeout && (
                    <div className="mt-1 p-2 bg-yellow-100 rounded text-yellow-800 font-medium">
                      💡 Either "Time Out" (same day) or "Next Day Timeout" is required for night shifts.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Usage Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <h4 className="font-medium mb-2">How to Use:</h4>
                <div className="space-y-1">
                  <p><strong>Regular Shifts:</strong> Use "Time In" and "Time Out" for same-day attendance</p>
                  <p><strong>Night Shifts:</strong> Check "Night Shift" box, then either:</p>
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>• Use "Time Out" if employee clocks out the same day</li>
                    <li>• Use "Next Day Timeout" if employee clocks out the following day</li>
                  </ul>
                  <p><strong>Break Times:</strong> "Break Out" = leaving for break, "Break In" = returning from break</p>
                  <p><strong>Trips:</strong> Enter the number of trips completed (supports decimals like 1.5)</p>
                </div>
              </div>
            </div>
          </div>

          {/* ... keep all existing delete confirmation dialog and buttons ... */}

          <div className="bg-gray-50 p-6 -mx-6 -mb-6 mt-6 flex justify-between items-center border-t">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteLoading}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleSync}
                disabled={syncLoading}
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                title="Sync this attendance record with related data (Travel Orders, SLVL, Overtime, etc.)"
              >
                {syncLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Record
                  </>
                )}
              </Button>
            </div>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceEditModal;