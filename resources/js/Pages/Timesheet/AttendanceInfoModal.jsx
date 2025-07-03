import React from 'react';
import { X, Edit, Clock, Calendar, User, Building, Timer, AlertTriangle, CheckCircle, Moon, Sun, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const AttendanceInfoModal = ({ isOpen, attendance, onClose, onEdit }) => {
  if (!isOpen || !attendance) return null;

  // Helper function to format time
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
      
      const hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      
      if (isNaN(hours)) return '-';
      
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      
      return `${formattedHours}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Time formatting error:', error);
      return '-';
    }
  };

  // Helper function to format date
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

  // Helper function to format minutes to hours and minutes
  const formatMinutes = (minutes) => {
    if (!minutes || minutes <= 0) return null;
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Calculate late/undertime display
  const getLateUndertimeDisplay = () => {
    const late = attendance.late_minutes || 0;
    const undertime = attendance.undertime_minutes || 0;
    
    if (late === 0 && undertime === 0) {
      return (
        <div className="flex items-center text-green-600">
          <CheckCircle className="h-4 w-4 mr-1" />
          <span className="font-medium">On Time</span>
        </div>
      );
    }
    
    const parts = [];
    if (late > 0) {
      parts.push(
        <div key="late" className="flex items-center text-red-600">
          <AlertTriangle className="h-4 w-4 mr-1" />
          <span className="font-medium">{formatMinutes(late)} late</span>
        </div>
      );
    }
    
    if (undertime > 0) {
      parts.push(
        <div key="undertime" className="flex items-center text-orange-600">
          <Timer className="h-4 w-4 mr-1" />
          <span className="font-medium">{formatMinutes(undertime)} undertime</span>
        </div>
      );
    }
    
    return (
      <div className="space-y-1">
        {parts}
      </div>
    );
  };

  // Helper function to format numeric values
  const formatNumeric = (value, decimals = 2) => {
    if (value === null || value === undefined || value === '' || isNaN(Number(value))) {
      return '-';
    }
    return Number(value).toFixed(decimals);
  };

  // Helper function to render boolean badges
  const renderBooleanBadge = (value) => {
    return value ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Yes
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        No
      </span>
    );
  };

  // Helper function to render source badge
  const renderSourceBadge = (source) => {
    const sourceColors = {
      'import': 'bg-blue-100 text-blue-800',
      'manual': 'bg-yellow-100 text-yellow-800',
      'biometric': 'bg-green-100 text-green-800',
      'manual_edit': 'bg-red-100 text-red-800',
      'slvl_sync': 'bg-indigo-100 text-indigo-800'
    };
    
    const sourceLabels = {
      'manual_edit': 'Manually Edited',
      'slvl_sync': 'SLVL Sync',
      'import': 'Imported',
      'biometric': 'Biometric',
      'manual': 'Manual Entry'
    };
    
    const colorClass = sourceColors[source] || 'bg-gray-100 text-gray-800';
    const label = sourceLabels[source] || (source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Unknown');
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 md:mx-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-800">Attendance Details</h2>
            {attendance.is_nightshift ? (
              <div className="flex items-center space-x-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                <Moon className="h-4 w-4" />
                <span>Night Shift</span>
              </div>
            ) : (
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
          {/* Employee Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Employee Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-gray-900">{attendance.employee_name || 'Unknown Employee'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Employee ID</label>
                <p className="text-gray-900">{attendance.idno || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Department</label>
                <p className="text-gray-900">{attendance.department || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Line</label>
                <p className="text-gray-900">{attendance.line || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Date Information */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Date Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Date</label>
                <p className="text-gray-900">{formatDate(attendance.attendance_date)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Day</label>
                <p className="text-gray-900">{attendance.day || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Time Information */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Time Information
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Time In</label>
                <p className="text-gray-900 font-mono">{formatTime(attendance.time_in)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Break Out</label>
                <p className="text-gray-900 font-mono">{formatTime(attendance.break_out)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Break In</label>
                <p className="text-gray-900 font-mono">{formatTime(attendance.break_in)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  {attendance.is_nightshift && attendance.next_day_timeout ? 'Next Day Timeout' : 'Time Out'}
                </label>
                <p className="text-gray-900 font-mono">
                  {attendance.is_nightshift && attendance.next_day_timeout 
                    ? formatTime(attendance.next_day_timeout)
                    : formatTime(attendance.time_out)
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Hours and Attendance Metrics */}
          <div className="bg-yellow-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <Timer className="h-5 w-5 mr-2" />
              Hours & Attendance Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Hours Worked</label>
                <p className="text-gray-900 text-lg font-semibold">{formatNumeric(attendance.hours_worked)} hours</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Late Minutes</label>
                <p className="text-gray-900">
                  {attendance.late_minutes > 0 ? (
                    <span className="text-red-600 font-medium">{formatMinutes(attendance.late_minutes)}</span>
                  ) : (
                    <span className="text-green-600 font-medium">On time</span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Undertime Minutes</label>
                <p className="text-gray-900">
                  {attendance.undertime_minutes > 0 ? (
                    <span className="text-orange-600 font-medium">{formatMinutes(attendance.undertime_minutes)}</span>
                  ) : (
                    <span className="text-green-600 font-medium">Full time</span>
                  )}
                </p>
              </div>
            </div>
            
            {/* Late/Undertime Summary */}
            <div className="mt-4 pt-4 border-t border-yellow-200">
              <label className="text-sm font-medium text-gray-500">Attendance Status</label>
              <div className="mt-1">
                {getLateUndertimeDisplay()}
              </div>
            </div>
          </div>

          {/* Payroll Information */}
          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <Building className="h-5 w-5 mr-2" />
              Payroll Information
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Overtime</label>
                <p className="text-gray-900">{formatNumeric(attendance.overtime)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Travel Order</label>
                <p className="text-gray-900">{formatNumeric(attendance.travel_order, 1)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">SLVL</label>
                <p className="text-gray-900">{formatNumeric(attendance.slvl, 1)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Holiday</label>
                <p className="text-gray-900">{formatNumeric(attendance.holiday)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">OT Reg Holiday</label>
                <p className="text-gray-900">{formatNumeric(attendance.ot_reg_holiday)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">OT Special Holiday</label>
                <p className="text-gray-900">{formatNumeric(attendance.ot_special_holiday)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Retro Multiplier</label>
                <p className="text-gray-900">{formatNumeric(attendance.retromultiplier)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Offset</label>
                <p className="text-gray-900">{formatNumeric(attendance.offset)}</p>
              </div>
            </div>
          </div>

          {/* Flags and Status */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <Info className="h-5 w-5 mr-2" />
              Flags & Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">CT (Compensatory Time)</label>
                <div className="mt-1">{renderBooleanBadge(attendance.ct)}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">CS (Compressed Schedule)</label>
                <div className="mt-1">{renderBooleanBadge(attendance.cs)}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Rest Day</label>
                <div className="mt-1">{renderBooleanBadge(attendance.restday)}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Official Business</label>
                <div className="mt-1">{renderBooleanBadge(attendance.ob)}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Source</label>
                <div className="mt-1">{renderSourceBadge(attendance.source)}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Posting Status</label>
                <div className="mt-1">
                  {attendance.posting_status === 'posted' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Posted
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Not Posted
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* System Information */}
          {attendance.source === 'manual_edit' && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Manual Edit Notice:</strong> This attendance record has been manually edited. 
                The late minutes, undertime minutes, and hours worked have been automatically recalculated 
                based on the updated time entries.
              </AlertDescription>
            </Alert>
          )}
          
          {attendance.remarks && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Remarks</h3>
              <p className="text-gray-700">{attendance.remarks}</p>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            onClick={onEdit}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Attendance
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceInfoModal;