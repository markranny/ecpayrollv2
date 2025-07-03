import React from 'react';
import { X, Clock, Calendar, User, Building, AlertTriangle, CheckCircle, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AttendanceInfoModal = ({ isOpen, attendance, onClose, onEdit }) => {
  if (!isOpen || !attendance) return null;

  // Format time with better display
  const formatTime = (timeString) => {
    if (!timeString) return '-';
    
    try {
      let timeOnly;
      if (timeString.includes('T')) {
        const [, time] = timeString.split('T');
        timeOnly = time.slice(0, 5);
      } else if (timeString.includes(' ') && timeString.includes(':')) {
        const timeParts = timeString.split(' ');
        timeOnly = timeParts[timeParts.length - 1].slice(0, 5);
      } else if (timeString.includes(':')) {
        timeOnly = timeString.slice(0, 5);
      } else {
        return '-';
      }
      
      const parts = timeOnly.split(':');
      if (parts.length < 2) return '-';
      
      const hourNum = parseInt(parts[0], 10);
      const minutes = parts[1];
      
      if (isNaN(hourNum)) return '-';
      
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const formattedHours = hourNum % 12 || 12;
      
      return `${formattedHours}:${minutes.padStart(2, '0')} ${ampm}`;
    } catch (error) {
      return '-';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return '-';
    }
  };

  // Calculate late/undertime based on standard 9-hour workday
  const calculateLateUndertime = () => {
    const timeIn = attendance.time_in;
    const timeOut = attendance.is_nightshift && attendance.next_day_timeout 
      ? attendance.next_day_timeout 
      : attendance.time_out;
    
    if (!timeIn) return { late: 0, undertime: 0, isComplete: false };
    
    try {
      // Standard work schedule: 8:00 AM - 5:00 PM (9 hours with 1 hour break)
      const standardStart = new Date(attendance.attendance_date + 'T08:00:00');
      const standardEnd = new Date(attendance.attendance_date + 'T17:00:00');
      
      const actualStart = new Date(timeIn);
      const actualEnd = timeOut ? new Date(timeOut) : null;
      
      // Calculate late minutes
      let lateMinutes = 0;
      if (actualStart > standardStart) {
        lateMinutes = Math.floor((actualStart - standardStart) / (1000 * 60));
      }
      
      // Calculate undertime minutes
      let undertimeMinutes = 0;
      if (actualEnd && actualEnd < standardEnd) {
        undertimeMinutes = Math.floor((standardEnd - actualEnd) / (1000 * 60));
      }
      
      // Check if work hours are less than 9 hours
      let totalWorkedHours = 0;
      if (actualEnd) {
        const workDuration = actualEnd - actualStart;
        
        // Subtract break time if both break times are recorded
        let breakDuration = 0;
        if (attendance.break_out && attendance.break_in) {
          const breakOut = new Date(attendance.break_out);
          const breakIn = new Date(attendance.break_in);
          breakDuration = breakIn - breakOut;
        }
        
        totalWorkedHours = (workDuration - breakDuration) / (1000 * 60 * 60);
      }
      
      // If total worked hours is less than 9, consider it undertime
      if (actualEnd && totalWorkedHours < 9) {
        const expectedHours = 9;
        const shortfallHours = expectedHours - totalWorkedHours;
        undertimeMinutes = Math.max(undertimeMinutes, Math.floor(shortfallHours * 60));
      }
      
      return {
        late: lateMinutes,
        undertime: undertimeMinutes,
        isComplete: !!actualEnd,
        totalHours: totalWorkedHours
      };
    } catch (error) {
      return { late: 0, undertime: 0, isComplete: false };
    }
  };

  const lateUndertimeInfo = calculateLateUndertime();

  // Format minutes to hours and minutes
  const formatMinutes = (minutes) => {
    if (minutes <= 0) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Render status badge
  const renderStatusBadge = (value, type = 'boolean') => {
    if (type === 'boolean') {
      return value ? (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ✓ Yes
        </span>
      ) : (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
          ✗ No
        </span>
      );
    }
    
    if (type === 'source') {
      const sourceColors = {
        'import': 'bg-blue-100 text-blue-800',
        'manual': 'bg-yellow-100 text-yellow-800',
        'biometric': 'bg-green-100 text-green-800',
        'manual_edit': 'bg-red-100 text-red-800',
        'slvl_sync': 'bg-indigo-100 text-indigo-800'
      };
      
      const sourceLabels = {
        'manual_edit': 'Manually Edited',
        'slvl_sync': 'SLVL Sync'
      };
      
      const colorClass = sourceColors[value] || 'bg-gray-100 text-gray-800';
      const label = sourceLabels[value] || (value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown');
      
      return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
          {label}
        </span>
      );
    }
    
    return value || '-';
  };

  // Format numeric values
  const formatNumeric = (value, decimals = 2) => {
    if (value === null || value === undefined || value === '' || isNaN(Number(value))) {
      return '-';
    }
    return Number(value).toFixed(decimals);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {attendance.employee_name || 'Unknown Employee'}
              </h2>
              <p className="text-sm text-gray-600">
                ID: {attendance.idno || 'N/A'} • {attendance.department || 'N/A'}
              </p>
            </div>
            {attendance.is_nightshift && (
              <div className="flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                <Moon className="h-4 w-4" />
                <span>Night Shift</span>
              </div>
            )}
            {!attendance.is_nightshift && (
              <div className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                <Sun className="h-4 w-4" />
                <span>Regular Shift</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Date and Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <Calendar className="h-5 w-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Date Information</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-600">Date:</span>
                  <span className="ml-2 text-sm text-gray-900">{formatDate(attendance.attendance_date)}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Day:</span>
                  <span className="ml-2 text-sm text-gray-900">{attendance.day || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-3">
                <Building className="h-5 w-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Department Info</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium text-gray-600">Department:</span>
                  <span className="ml-2 text-sm text-gray-900">{attendance.department || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Line:</span>
                  <span className="ml-2 text-sm text-gray-900">{attendance.line || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Time Information */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Time Information</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">Time In</div>
                <div className="text-lg font-bold text-gray-900">{formatTime(attendance.time_in)}</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">Break Out</div>
                <div className="text-lg font-bold text-gray-900">{formatTime(attendance.break_out)}</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">Break In</div>
                <div className="text-lg font-bold text-gray-900">{formatTime(attendance.break_in)}</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">
                  {attendance.is_nightshift && attendance.next_day_timeout ? 'Next Day Timeout' : 'Time Out'}
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {attendance.is_nightshift && attendance.next_day_timeout 
                    ? formatTime(attendance.next_day_timeout)
                    : formatTime(attendance.time_out)
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Late/Undertime Analysis */}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <h3 className="font-semibold text-gray-900">Attendance Analysis</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">Hours Worked</div>
                <div className="text-lg font-bold text-gray-900">
                  {lateUndertimeInfo.totalHours ? lateUndertimeInfo.totalHours.toFixed(2) : formatNumeric(attendance.hours_worked)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {lateUndertimeInfo.totalHours && lateUndertimeInfo.totalHours < 9 ? 
                    <span className="text-red-600">Below 9 hours</span> : 
                    <span className="text-green-600">Standard hours</span>
                  }
                </div>
              </div>
              
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">Late</div>
                <div className={`text-lg font-bold ${lateUndertimeInfo.late > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {lateUndertimeInfo.late > 0 ? formatMinutes(lateUndertimeInfo.late) : 'On Time'}
                </div>
                {lateUndertimeInfo.late > 0 && (
                  <div className="text-xs text-red-500 mt-1">
                    Late by {formatMinutes(lateUndertimeInfo.late)}
                  </div>
                )}
              </div>
              
              <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">Undertime</div>
                <div className={`text-lg font-bold ${lateUndertimeInfo.undertime > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {lateUndertimeInfo.undertime > 0 ? formatMinutes(lateUndertimeInfo.undertime) : 'Full Time'}
                </div>
                {lateUndertimeInfo.undertime > 0 && (
                  <div className="text-xs text-orange-500 mt-1">
                    Short by {formatMinutes(lateUndertimeInfo.undertime)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Payroll Information */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-4">Payroll Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center p-2 bg-white rounded shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">OT</div>
                <div className="text-sm font-bold text-gray-900">{formatNumeric(attendance.overtime)}</div>
              </div>
              <div className="text-center p-2 bg-white rounded shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">Travel</div>
                <div className="text-sm font-bold text-gray-900">{formatNumeric(attendance.travel_order, 1)}</div>
              </div>
              <div className="text-center p-2 bg-white rounded shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">SLVL</div>
                <div className="text-sm font-bold text-gray-900">{formatNumeric(attendance.slvl, 1)}</div>
              </div>
              <div className="text-center p-2 bg-white rounded shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">Holiday</div>
                <div className="text-sm font-bold text-gray-900">{formatNumeric(attendance.holiday)}</div>
              </div>
              <div className="text-center p-2 bg-white rounded shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">Retro</div>
                <div className="text-sm font-bold text-gray-900">{formatNumeric(attendance.retromultiplier)}</div>
              </div>
              <div className="text-center p-2 bg-white rounded shadow-sm">
                <div className="text-xs font-medium text-gray-600 mb-1">Offset</div>
                <div className="text-sm font-bold text-gray-900">{formatNumeric(attendance.offset)}</div>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xs font-medium text-gray-600 mb-1">CT</div>
                {renderStatusBadge(attendance.ct)}
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-gray-600 mb-1">CS</div>
                {renderStatusBadge(attendance.cs)}
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-gray-600 mb-1">Rest Day</div>
                {renderStatusBadge(attendance.restday)}
              </div>
              <div className="text-center">
                <div className="text-xs font-medium text-gray-600 mb-1">OB</div>
                {renderStatusBadge(attendance.ob)}
              </div>
            </div>
          </div>

          {/* Status Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-4">Status Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium text-gray-600">Source:</span>
                <div className="mt-1">{renderStatusBadge(attendance.source, 'source')}</div>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Posting Status:</span>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    attendance.posting_status === 'posted' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {attendance.posting_status === 'posted' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Posted
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Not Posted
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onEdit} className="bg-blue-600 hover:bg-blue-700 text-white">
            Edit Attendance
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceInfoModal;