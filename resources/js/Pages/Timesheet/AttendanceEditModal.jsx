import React, { useState, useEffect } from 'react';
import { X, Save, Clock, AlertTriangle, RotateCcw, Trash2, Loader2, Info, Moon, Sun, RefreshCw, CheckCircle, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Format time for input (HH:MM format)
const formatTimeForInput = (timeString) => {
  if (!timeString) return '';
  try {
    let timeOnly;
    // Handle ISO 8601 format
    if (timeString.includes('T')) {
      const [, time] = timeString.split('T');
      timeOnly = time.slice(0, 5); // Extract HH:MM
    } else if (timeString.includes(' ')) {
      // If the time includes a date (like "2024-04-10 14:30:00"), split and take the time part
      const timeParts = timeString.split(' ');
      timeOnly = timeParts[timeParts.length - 1].slice(0, 5);
    } else {
      // Assume it's already just a time string
      timeOnly = timeString.slice(0, 5);
    }
    
    return timeOnly;
  } catch (err) {
    console.error('Time formatting error for input:', err, timeString);
    return '';
  }
};

const formatTime = (timeString) => {
        if (!timeString) return '-';
        
        try {
            let timeOnly;
            // Handle ISO 8601 format
            if (timeString.includes('T')) {
                const [, time] = timeString.split('T');
                timeOnly = time.slice(0, 5); // Extract HH:MM
            } else {
                // If the time includes a date (like "2024-04-10 14:30:00"), split and take the time part
                const timeParts = timeString.split(' ');
                timeOnly = timeParts[timeParts.length - 1].slice(0, 5);
            }
            
            // Parse hours and minutes
            const [hours, minutes] = timeOnly.split(':');
            const hourNum = parseInt(hours, 10);
            
            // Convert to 12-hour format with AM/PM
            const ampm = hourNum >= 12 ? 'PM' : 'AM';
            const formattedHours = hourNum % 12 || 12; // handle midnight and noon
            
            return `${formattedHours}:${minutes} ${ampm}`;
        } catch (error) {
            console.error('Time formatting error:', error);
            return '-';
        }
    };

// Time picker component
const TimePicker = ({ name, value, onChange, placeholder, required = false, disabled = false }) => {
  return (
    <input
      type="time"
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
        disabled ? 'bg-gray-100 cursor-not-allowed' : ''
      }`}
    />
  );
};

const AttendanceEditModal = ({ isOpen, attendance, onClose, onSave, onDelete, onSync }) => {
  const [formData, setFormData] = useState({
    id: '',
    time_in: '',
    time_out: '',
    break_in: '',
    break_out: '',
    next_day_timeout: '',
    is_nightshift: false,
    trip: 0
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize form data when attendance changes
  useEffect(() => {
    if (attendance) {
      setFormData({
        id: attendance.id,
        time_in: formatTimeForInput(attendance.time_in),
        time_out: formatTimeForInput(attendance.time_out),
        break_in: formatTimeForInput(attendance.break_in),
        break_out: formatTimeForInput(attendance.break_out),
        next_day_timeout: formatTimeForInput(attendance.next_day_timeout),
        is_nightshift: attendance.is_nightshift || false,
        trip: attendance.trip || 0
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

  // Handle night shift change with validation
  const handleNightShiftChange = (e) => {
    const isNightShift = e.target.checked;
    setFormData(prev => {
      const newData = { ...prev, is_nightshift: isNightShift };
      
      // Clear conflicting fields when switching modes
      if (isNightShift) {
        // Night shift mode - clear time_out if next_day_timeout is set
        if (prev.next_day_timeout) {
          newData.time_out = '';
        }
      } else {
        // Regular shift mode - clear next_day_timeout
        newData.next_day_timeout = '';
      }
      
      return newData;
    });
  };

  // Validate form data
  const validateForm = () => {
    if (!formData.time_in) {
      setError('Time In is required');
      return false;
    }

    if (formData.is_nightshift) {
      // Night shift validation
      if (!formData.time_out && !formData.next_day_timeout) {
        setError('Either Time Out (same day) or Next Day Timeout is required for night shifts');
        return false;
      }
      if (formData.time_out && formData.next_day_timeout) {
        setError('Please use either Time Out OR Next Day Timeout, not both');
        return false;
      }
    } else {
      // Regular shift validation
      if (!formData.time_out) {
        setError('Time Out is required for regular shifts');
        return false;
      }
    }

    // Validate break times if provided
    if (formData.break_out && !formData.break_in) {
      setError('Break In time is required when Break Out is specified');
      return false;
    }
    if (formData.break_in && !formData.break_out) {
      setError('Break Out time is required when Break In is specified');
      return false;
    }

    // Validate trip value
    if (formData.trip && (isNaN(formData.trip) || formData.trip < 0)) {
      setError('Trip must be a valid positive number');
      return false;
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Prepare the data for submission
      const submitData = {
        id: formData.id,
        time_in: formData.time_in,
        time_out: formData.time_out,
        break_in: formData.break_in,
        break_out: formData.break_out,
        next_day_timeout: formData.next_day_timeout,
        is_nightshift: formData.is_nightshift,
        trip: parseFloat(formData.trip) || 0
      };

      await onSave(submitData);
      setSuccess('Attendance updated successfully!');
      window.location.reload();
    } catch (err) {
      console.error('Error saving attendance:', err);
      setError('Failed to save attendance: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Handle sync
  const handleSync = async () => {
    if (!attendance?.id) return;
    
    setSyncLoading(true);
    setError('');
    
    try {
      await onSync(attendance.id);
      setSuccess('Record synced successfully!');
    } catch (err) {
      console.error('Error syncing record:', err);
      setError('Failed to sync record: ' + (err.message || 'Unknown error'));
    } finally {
      setSyncLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!attendance?.id) return;
    
    setDeleteLoading(true);
    setError('');
    
    try {
      await onDelete(attendance.id);
      setSuccess('Record deleted successfully!');
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error('Error deleting record:', err);
      setError('Failed to delete record: ' + (err.message || 'Unknown error'));
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle reset form
  const handleReset = () => {
    if (attendance) {
      setFormData({
        id: attendance.id,
        time_in: formatTimeForInput(attendance.time_in),
        time_out: formatTimeForInput(attendance.time_out),
        break_in: formatTimeForInput(attendance.break_in),
        break_out: formatTimeForInput(attendance.break_out),
        next_day_timeout: formatTimeForInput(attendance.next_day_timeout),
        is_nightshift: attendance.is_nightshift || false,
        trip: attendance.trip || 0
      });
      setError('');
      setSuccess('');
    }
  };

  // Clear messages after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // If modal is not open, don't render anything
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
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
            disabled={loading || syncLoading || deleteLoading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Employee Information */}
          <div className="bg-gray-50 border rounded-lg p-4 mb-6">
            <div className="font-medium text-gray-900 mb-2">
              {attendance?.employee_name} (ID: {attendance?.idno})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
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
            
            {/* Current Time Values Display */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="text-xs font-medium text-gray-700 mb-2">Current Times:</div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">In:</span> <span className="font-mono">{formatTime(attendance?.time_in)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Out:</span> <span className="font-mono">{formatTime(attendance?.time_out)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Break Out:</span> <span className="font-mono">{formatTime(attendance?.break_out)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Break In:</span> <span className="font-mono">{formatTime(attendance?.break_in)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Next Day:</span> <span className="font-mono">{formatTime(attendance?.next_day_timeout)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Trips:</span> <span className="font-mono">{attendance?.trip || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Error and Success Messages */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Night Shift Toggle */}
          <div className="mb-6">
            <div className="flex items-center space-x-3 mb-3">
              <input
                type="checkbox"
                id="is_nightshift"
                name="is_nightshift"
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                checked={formData.is_nightshift}
                onChange={handleNightShiftChange}
                disabled={loading}
              />
              <label htmlFor="is_nightshift" className="text-sm font-medium text-gray-900">
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
            <p className="text-xs text-gray-600 ml-7">
              {formData.is_nightshift 
                ? "Employee works overnight and may clock out the next day"
                : "Employee clocks in and out on the same day"
              }
            </p>
          </div>

          {/* Time Input Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Time In */}
            <div>
              <label htmlFor="time_in" className="block text-sm font-medium text-gray-700 mb-2">
                Time In <span className="text-red-500">*</span>
                {attendance?.time_in && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Current: {formatTime(attendance.time_in)})
                  </span>
                )}
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
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Break Out */}
            <div>
              <label htmlFor="break_out" className="block text-sm font-medium text-gray-700 mb-2">
                Break Out (Optional)
                {attendance?.break_out && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Current: {formatTime(attendance.break_out)})
                  </span>
                )}
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <div className="pl-10">
                  <TimePicker
                    name="break_out"
                    value={formData.break_out}
                    onChange={handleChange}
                    placeholder="12:00 PM"
                    disabled={loading}
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                When employee leaves for break/lunch
              </p>
            </div>

            {/* Break In */}
            <div>
              <label htmlFor="break_in" className="block text-sm font-medium text-gray-700 mb-2">
                Break In (Optional)
                {attendance?.break_in && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Current: {formatTime(attendance.break_in)})
                  </span>
                )}
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <div className="pl-10">
                  <TimePicker
                    name="break_in"
                    value={formData.break_in}
                    onChange={handleChange}
                    placeholder="1:00 PM"
                    disabled={loading}
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                When employee returns from break/lunch
              </p>
            </div>

            {/* Time Out */}
            <div>
              <label htmlFor="time_out" className="block text-sm font-medium text-gray-700 mb-2">
                Time Out {formData.is_nightshift ? '(Same Day)' : <span className="text-red-500">*</span>}
                {attendance?.time_out && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Current: {formatTime(attendance.time_out)})
                  </span>
                )}
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
                    disabled={(formData.is_nightshift && formData.next_day_timeout) || loading}
                  />
                </div>
              </div>
              {formData.is_nightshift && (
                <p className="mt-1 text-xs text-gray-500">
                  Only use if employee clocks out the same day
                </p>
              )}
            </div>

            {/* Next Day Timeout - Only show for night shifts */}
            {formData.is_nightshift && (
              <div>
                <label htmlFor="next_day_timeout" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-1">
                    <Moon className="h-4 w-4 text-purple-600" />
                    <span>Next Day Timeout</span>
                    {!formData.time_out && <span className="text-red-500">*</span>}
                    {attendance?.next_day_timeout && (
                      <span className="text-xs text-gray-500 ml-2">
                        (Current: {formatTime(attendance.next_day_timeout)})
                      </span>
                    )}
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
                      disabled={!!formData.time_out || loading}
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-purple-600">
                  When employee clocks out the following day
                </p>
              </div>
            )}

            {/* Trip Input */}
            <div>
              <label htmlFor="trip" className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center space-x-1">
                  <Car className="h-4 w-4 text-blue-600" />
                  <span>Number of Trips</span>
                  {attendance?.trip && (
                    <span className="text-xs text-gray-500 ml-2">
                      (Current: {attendance.trip})
                    </span>
                  )}
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
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="0.00"
                />
              </div>
              <p className="mt-1 text-xs text-blue-600">
                Enter number of trips (e.g., 1.5)
              </p>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
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

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <AlertDescription>
                <div className="space-y-3">
                  <p>Are you sure you want to delete this attendance record? This action cannot be undone.</p>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleteLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {deleteLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete Record'
                      )}
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-6 border-t">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteLoading || loading}
                className="text-red-600 border-red-300 hover:bg-red-50"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleSync}
                disabled={syncLoading || loading}
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                title="Sync this attendance record with related data"
                size="sm"
              >
                {syncLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Sync Record
                  </>
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={loading}
                className="text-gray-600 border-gray-300 hover:bg-gray-50"
                size="sm"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>
            
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading || syncLoading || deleteLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || syncLoading || deleteLoading}
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