import React, { useState, useEffect } from 'react';
import { X, Save, Clock, AlertTriangle, RotateCcw, Trash2, Loader2, Info, Moon, Sun, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const formatTime = (timeString) => {
  if (!timeString) return '-';
  
  try {
    // First check if timeString is valid
    if (typeof timeString !== 'string') {
      console.log('Invalid time format, not a string:', timeString);
      return '-';
    }
    
    let timeOnly;
    // Handle ISO 8601 format
    if (timeString.includes('T')) {
      const [, time] = timeString.split('T');
      timeOnly = time.slice(0, 5); // Extract HH:MM
    } else if (timeString.includes(' ') && timeString.includes(':')) {
      // If the time includes a date (like "2024-04-10 14:30:00"), split and take the time part
      const timeParts = timeString.split(' ');
      timeOnly = timeParts[timeParts.length - 1].slice(0, 5);
    } else if (timeString.includes(':')) {
      // Handle just time format "14:30:00" or "14:30"
      timeOnly = timeString.slice(0, 5);
    } else {
      console.log('Unrecognized time format:', timeString);
      return '-';
    }
    
    // Parse hours and minutes - add robust parsing
    const parts = timeOnly.split(':');
    if (parts.length < 2) {
      console.log('Invalid time format, missing colon:', timeString);
      return '-';
    }
    
    const hours = parts[0];
    const minutes = parts[1];
    
    // Make sure hours and minutes are valid numbers
    const hourNum = parseInt(hours, 10);
    const minNum = parseInt(minutes, 10);
    
    if (isNaN(hourNum) || isNaN(minNum)) {
      console.log('Invalid hour or minute values:', hours, minutes);
      return '-';
    }
    
    // Convert to 12-hour format with AM/PM
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const formattedHours = hourNum % 12 || 12; // handle midnight and noon
    
    return `${formattedHours}:${minutes.padStart(2, '0')} ${ampm}`;
  } catch (error) {
    console.error('Time formatting error:', error, 'for timeString:', timeString);
    return '-';
  }
};

// Enhanced TimePicker component for better time handling

const TimePicker = ({ value, onChange, name, placeholder, required, disabled = false }) => {
  // FIXED: Enhanced time parsing with better error handling
  const parseTime = (timeStr) => {
    if (!timeStr) return { hour: '', minute: '', period: 'AM' };
    
    try {
      console.log(`Parsing time string: "${timeStr}"`);
      
      // Handle null, undefined, or empty strings
      if (timeStr === null || timeStr === undefined || timeStr === '') {
        return { hour: '', minute: '', period: 'AM' };
      }
      
      // Check if it's already in "12:34 AM/PM" format
      if (typeof timeStr === 'string' && timeStr.includes(':') && (timeStr.includes('AM') || timeStr.includes('PM'))) {
        const [timePart, periodPart] = timeStr.split(' ');
        const [hourPart, minutePart] = timePart.split(':');
        
        return {
          hour: hourPart ? hourPart.trim() : '',
          minute: minutePart ? minutePart.trim() : '',
          period: periodPart ? periodPart.trim() : 'AM'
        };
      }
      
      // Handle 24-hour time format (14:30)
      if (typeof timeStr === 'string' && timeStr.includes(':') && !timeStr.includes('AM') && !timeStr.includes('PM')) {
        const [hourPart, minutePart] = timeStr.split(':');
        const hourNum = parseInt(hourPart, 10);
        
        if (!isNaN(hourNum)) {
          const period = hourNum >= 12 ? 'PM' : 'AM';
          const hour12 = hourNum % 12 || 12;
          
          return {
            hour: hour12.toString(),
            minute: minutePart ? minutePart.substring(0, 2) : '00',
            period
          };
        }
      }
      
      // Handle ISO date string (2023-04-10T14:30:00Z)
      if (typeof timeStr === 'string' && timeStr.includes('T')) {
        const date = new Date(timeStr);
        if (!isNaN(date)) {
          let hours = date.getHours();
          const period = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12 || 12;
          
          return {
            hour: hours.toString(),
            minute: date.getMinutes().toString().padStart(2, '0'),
            period
          };
        }
      }
      
      // Try to parse as date as last resort
      const date = new Date(`2000-01-01 ${timeStr}`);
      if (!isNaN(date.getTime())) {
        let hours = date.getHours();
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        
        return {
          hour: hours.toString(),
          minute: date.getMinutes().toString().padStart(2, '0'),
          period
        };
      }
      
      console.warn(`Could not parse time: "${timeStr}"`);
      return { hour: '', minute: '', period: 'AM' };
      
    } catch (error) {
      console.error('Time parsing error:', error, 'for value:', timeStr);
      return { hour: '', minute: '', period: 'AM' };
    }
  };

  const { hour, minute, period } = parseTime(value);

  // FIXED: Enhanced time change handler with better validation
  const handleTimeChange = (type, e) => {
    const newValue = e.target.value;
    
    let updatedHour = hour;
    let updatedMinute = minute;
    let updatedPeriod = period;
    
    if (type === 'hour') {
      updatedHour = newValue === '' ? '' : newValue;
      // FIXED: Auto-set minute to 00 if hour is selected but minute is empty
      if (newValue !== '' && !updatedMinute) {
        updatedMinute = '00';
      }
    }
    if (type === 'minute') {
      updatedMinute = newValue === '' ? '' : newValue;
      // FIXED: Auto-set hour to 12 if minute is selected but hour is empty
      if (newValue !== '' && !updatedHour) {
        updatedHour = '12';
      }
    }
    if (type === 'period') updatedPeriod = newValue;
    
    console.log(`Time change - Type: ${type}, New value: ${newValue}`, {
      hour: updatedHour,
      minute: updatedMinute,
      period: updatedPeriod
    });
    
    // FIXED: Create time string only if we have both components
    if (updatedHour && updatedMinute) {
      const timeString = `${updatedHour}:${updatedMinute} ${updatedPeriod}`;
      console.log(`Setting complete time: ${timeString}`);
      onChange({ target: { name, value: timeString } });
    } else if (!updatedHour && !updatedMinute) {
      // Clear the time value if both are empty
      console.log('Clearing time value');
      onChange({ target: { name, value: '' } });
    }
    // FIXED: Don't set partial values - wait for both hour and minute
  };

  // Create hours options (1-12)
  const hoursOptions = () => {
    const options = [];
    options.push(<option key="hour-default" value="">Hour</option>);
    for (let i = 1; i <= 12; i++) {
      options.push(<option key={`hour-${i}`} value={i}>{i}</option>);
    }
    return options;
  };
  
  // Create minutes options (00-59)
  const minutesOptions = () => {
    const options = [];
    options.push(<option key="minute-default" value="">Min</option>);
    for (let i = 0; i < 60; i++) {
      const minuteStr = i.toString().padStart(2, '0');
      options.push(<option key={`minute-${i}`} value={minuteStr}>{minuteStr}</option>);
    }
    return options;
  };

  return (
    <div className="flex space-x-2 items-center">
      {/* Hour dropdown */}
      <div className="w-1/3">
        <select
          value={hour || ""}
          onChange={(e) => handleTimeChange('hour', e)}
          disabled={disabled}
          className={`w-full py-2 pl-3 pr-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
            disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'
          } ${!hour && required ? 'border-red-300' : 'border-gray-300'}`}
        >
          {hoursOptions()}
        </select>
      </div>
      
      <span className="text-gray-400 font-medium">:</span>
      
      {/* Minute dropdown */}
      <div className="w-1/3">
        <select
          value={minute || ""}
          onChange={(e) => handleTimeChange('minute', e)}
          disabled={disabled}
          className={`w-full py-2 pl-3 pr-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
            disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'
          } ${!minute && required ? 'border-red-300' : 'border-gray-300'}`}
        >
          {minutesOptions()}
        </select>
      </div>
      
      {/* AM/PM dropdown */}
      <div className="w-1/4">
        <select
          value={period}
          onChange={(e) => handleTimeChange('period', e)}
          disabled={disabled}
          className={`w-full py-2 pl-3 pr-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
            disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'
          } border-gray-300`}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
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
    is_nightshift: false
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNightShiftInfo, setShowNightShiftInfo] = useState(false);

  // Add the missing formatTimeForInput function
  const formatTimeForInput = (timeString) => {
    if (!timeString) return '';
    
    try {
      // First check if timeString is valid
      if (typeof timeString !== 'string') {
        console.log('Invalid time format, not a string:', timeString);
        return '';
      }
      
      let timeOnly;
      // Handle ISO 8601 format
      if (timeString.includes('T')) {
        const [, time] = timeString.split('T');
        timeOnly = time.slice(0, 5); // Extract HH:MM
      } else if (timeString.includes(' ') && timeString.includes(':')) {
        // If the time includes a date (like "2024-04-10 14:30:00"), split and take the time part
        const timeParts = timeString.split(' ');
        timeOnly = timeParts[timeParts.length - 1].slice(0, 5);
      } else if (timeString.includes(':')) {
        // Handle just time format "14:30:00" or "14:30"
        timeOnly = timeString.slice(0, 5);
      } else {
        console.log('Unrecognized time format:', timeString);
        return '';
      }
      
      // Parse hours and minutes
      const parts = timeOnly.split(':');
      if (parts.length < 2) {
        console.log('Invalid time format, missing colon:', timeString);
        return '';
      }
      
      const hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      
      if (isNaN(hours)) {
        console.log('Invalid hour value:', parts[0]);
        return '';
      }
      
      // Convert to 12-hour format with AM/PM
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12; // handle midnight and noon
      
      return `${formattedHours}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Time formatting error for input:', error, 'for timeString:', timeString);
      return '';
    }
  };

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
        is_nightshift: attendance.is_nightshift || false
      });
    }
  }, [attendance]);

  // FIXED: Helper function to convert time string to minutes for comparison
  const timeToMinutes = (timeString) => {
    if (!timeString) return 0;
    try {
      // Handle both 12-hour (HH:MM AM/PM) and 24-hour (HH:MM) formats
      let hours, minutes;
      
      if (timeString.includes('AM') || timeString.includes('PM')) {
        // 12-hour format
        const [timePart, period] = timeString.split(' ');
        const [hourStr, minuteStr] = timePart.split(':');
        hours = parseInt(hourStr, 10);
        minutes = parseInt(minuteStr, 10);
        
        if (period === 'PM' && hours !== 12) {
          hours += 12;
        } else if (period === 'AM' && hours === 12) {
          hours = 0;
        }
      } else {
        // 24-hour format
        const [hourStr, minuteStr] = timeString.split(':');
        hours = parseInt(hourStr, 10);
        minutes = parseInt(minuteStr, 10);
      }
      
      return hours * 60 + minutes;
    } catch (error) {
      console.error('Error parsing time:', error);
      return 0;
    }
  };

  // Improved conversion to 24-hour format
  const convertTo24Hour = (timeStr) => {
    if (!timeStr) return '';
    
    try {
      // Handle case where timeStr is already in 24-hour format
      if (!timeStr.includes(' ')) {
        return timeStr; // Assume it's already in 24-hour format
      }
      
      const [timePart, periodPart] = timeStr.split(' ');
      const [hoursPart, minutesPart] = timePart.split(':');
      
      let hours = parseInt(hoursPart, 10);
      const minutes = minutesPart;
      
      // Convert hours based on AM/PM
      if (periodPart === 'PM' && hours !== 12) {
        hours += 12;
      } else if (periodPart === 'AM' && hours === 12) {
        hours = 0;
      }
      
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    } catch (error) {
      console.error('Error converting to 24-hour format:', error, 'for value:', timeStr);
      return '';
    }
  };

  // Improved date-time combination
  const combineDateTime = (originalDateTimeStr, timeStr) => {
    if (!originalDateTimeStr || !timeStr) return '';
    
    try {
      console.log('Combining date and time:', { originalDateTimeStr, timeStr });
      
      // Try to extract just the date part from the original datetime string
      let datePart;
      
      if (typeof originalDateTimeStr === 'string') {
        // Handle ISO format (2023-04-10T14:30:00Z)
        if (originalDateTimeStr.includes('T')) {
          datePart = originalDateTimeStr.split('T')[0];
        } 
        // Handle format like "2023-04-10 14:30:00"
        else if (originalDateTimeStr.includes(' ')) {
          datePart = originalDateTimeStr.split(' ')[0];
        } 
        // Assume it's just a date
        else {
          datePart = originalDateTimeStr;
        }
      } else {
        // If it's not a string, try to use it as a Date object
        const originalDate = new Date(originalDateTimeStr);
        if (!isNaN(originalDate.getTime())) {
          datePart = originalDate.toISOString().split('T')[0];
        } else {
          throw new Error('Could not extract date part from originalDateTimeStr');
        }
      }
      
      // Get the time values
      const time24 = convertTo24Hour(timeStr);
      console.log('Converted to 24-hour format:', time24);
      
      if (!time24) {
        throw new Error('Could not convert time to 24-hour format');
      }
      
      // Combine date and time
      const combinedDateTime = `${datePart}T${time24}:00`;
      console.log('Combined date and time:', combinedDateTime);
      
      return combinedDateTime;
    } catch (error) {
      console.error('Error combining date and time:', error, {
        originalDateTimeStr,
        timeStr
      });
      return '';
    }
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // FIXED: Enhanced Night Shift Handler with better logic
  const handleNightShiftChange = (e) => {
    const isNightShift = e.target.checked;
    
    setFormData(prev => {
      const newData = {
        ...prev,
        is_nightshift: isNightShift
      };
      
      // Better logic for clearing/setting timeout fields
      if (isNightShift) {
        // If enabling night shift, clear regular time_out to avoid confusion
        newData.time_out = '';
      } else {
        // If disabling night shift, clear next_day_timeout and restore time_out if needed
        newData.next_day_timeout = '';
        if (!newData.time_out) {
          // Set a default time_out if none exists
          newData.time_out = '5:00 PM';
        }
      }
      
      return newData;
    });
    
    // Show info panel for guidance
    setShowNightShiftInfo(true);
    setTimeout(() => setShowNightShiftInfo(false), 8000);
  };

  // Helper to get next day for night shift
  const getNextDay = (dateStr) => {
    try {
      const date = new Date(dateStr);
      date.setDate(date.getDate() + 1);
      return date.toISOString().split('T')[0]; // Return just the date part in YYYY-MM-DD format
    } catch (error) {
      console.error('Error calculating next day:', error);
      return dateStr; // Return original if error
    }
  };

  // Handle sync for this specific attendance record
  const handleSync = async () => {
    setSyncLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      
      if (!csrfToken) {
        setError('Session expired. Please refresh the page and try again.');
        setSyncLoading(false);
        return;
      }
      
      // Sync this specific attendance record by ID
      const response = await fetch(`/attendance/${attendance.id}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Attendance record synced successfully');
        
        // Call onSync callback if provided to refresh parent data
        if (onSync) {
          onSync(attendance.id);
        }
        
        // Optionally close modal after successful sync
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError('Sync failed: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error syncing attendance record:', err);
      setError('Error syncing attendance record: ' + (err.message || 'Unknown error'));
    } finally {
      setSyncLoading(false);
    }
  };

  // FIXED: Enhanced form submission with better night shift validation
  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    
    try {
      console.log('Form submission - Current data:', formData);
      
      // Basic validation - at least time_in is required
      if (!formData.time_in) {
        setError('Time In is required');
        setLoading(false);
        return;
      }

      // Enhanced validation for night shifts with clearer error messages
      if (formData.is_nightshift) {
        const hasTimeOut = formData.time_out && formData.time_out.trim() !== '';
        const hasNextDayTimeout = formData.next_day_timeout && formData.next_day_timeout.trim() !== '';
        
        if (!hasTimeOut && !hasNextDayTimeout) {
          setError('For night shifts, please provide either "Time Out" (same day) or "Next Day Timeout" (next day)');
          setLoading(false);
          return;
        }
        
        if (hasTimeOut && hasNextDayTimeout) {
          setError('Please provide either "Time Out" OR "Next Day Timeout", not both. For night shifts, use "Next Day Timeout" if the employee clocks out the following day.');
          setLoading(false);
          return;
        }
      } else {
        // For regular shifts, we need time_out
        if (!formData.time_out || formData.time_out.trim() === '') {
          setError('Time Out is required for regular shifts');
          setLoading(false);
          return;
        }
        
        // Make sure next_day_timeout is cleared for regular shifts
        if (formData.next_day_timeout) {
          setError('Next Day Timeout should only be used for night shifts. Please uncheck "Night Shift" or clear the Next Day Timeout field.');
          setLoading(false);
          return;
        }
      }
      
      // Enhanced time sequence validation
      if (formData.time_in) {
        // For regular shifts, validate time sequence
        if (!formData.is_nightshift && formData.time_out) {
          const timeInMinutes = timeToMinutes(formData.time_in);
          const timeOutMinutes = timeToMinutes(formData.time_out);
          
          if (timeOutMinutes <= timeInMinutes) {
            setError('Time Out must be after Time In for regular shifts');
            setLoading(false);
            return;
          }
        }
        
        // Enhanced break time validation
        if (formData.break_out && formData.break_in) {
          const breakOutMinutes = timeToMinutes(formData.break_out);
          const breakInMinutes = timeToMinutes(formData.break_in);
          const timeInMinutes = timeToMinutes(formData.time_in);
          
          // Break Out should be after Time In
          if (breakOutMinutes <= timeInMinutes) {
            setError('Break Out must be after Time In');
            setLoading(false);
            return;
          }
          
          // Break In should be after Break Out
          if (breakInMinutes <= breakOutMinutes) {
            setError('Break In must be after Break Out - employee returns from break after leaving for break');
            setLoading(false);
            return;
          }
          
          // For regular shifts, break in should be before time out
          if (!formData.is_nightshift && formData.time_out) {
            const timeOutMinutes = timeToMinutes(formData.time_out);
            if (breakInMinutes >= timeOutMinutes) {
              setError('Break In must be before Time Out for regular shifts');
              setLoading(false);
              return;
            }
          }
        }
      }
      
      // Prepare data with better date-time handling
      const submissionData = {
        ...formData,
        id: attendance.id,
        time_in: formData.time_in ? combineDateTime(attendance.attendance_date, formData.time_in) : null,
        time_out: formData.time_out ? combineDateTime(attendance.attendance_date, formData.time_out) : null,
        break_in: formData.break_in ? combineDateTime(attendance.attendance_date, formData.break_in) : null,
        break_out: formData.break_out ? combineDateTime(attendance.attendance_date, formData.break_out) : null,
        next_day_timeout: formData.is_nightshift && formData.next_day_timeout 
          ? combineDateTime(getNextDay(attendance.attendance_date), formData.next_day_timeout) 
          : null,
        is_nightshift: !!formData.is_nightshift
      };
      
      console.log('Prepared submission data:', submissionData);
      
      // Call onSave with the updated data
      if (onSave) {
        await onSave(submissionData);
      }
      
      console.log('Save completed successfully');
      
    } catch (error) {
      console.error('Error in form submission:', error);
      setError('An error occurred while saving the attendance record. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete action
  const handleDelete = async () => {
    if (!attendance?.id) return;
    
    setDeleteLoading(true);
    setError('');
    
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      
      const response = await fetch(`/attendance/${attendance.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (onDelete) {
          onDelete(attendance.id);
        }
        window.location.reload();
        onClose();
      } else {
        setError('Failed to delete attendance: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error deleting attendance:', err);
      setError('Error deleting attendance: ' + (err.message || 'Unknown error'));
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

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

          {/* FIXED: Enhanced Night Shift Toggle Section */}
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

          {/* FIXED: Enhanced Next Day Timeout Section */}
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
                </div>
              </div>
            </div>
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800">Confirm Deletion</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Are you sure you want to delete this attendance record? This action cannot be undone.
                  </p>
                  <div className="flex space-x-2 mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {deleteLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              
              {/* NEW: Sync Button */}
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