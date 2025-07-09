import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import { Search, Calendar, Filter, Download, Trash2, RefreshCw, Users, Calculator, FileText, AlertTriangle, CheckCircle, Clock, Target, Eye, X, User, Building, Car } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// PayrollSummaryDetailModal Component
const PayrollSummaryDetailModal = ({ isOpen, summary, onClose }) => {
  const [attendanceDetails, setAttendanceDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load attendance details when modal opens
  useEffect(() => {
    if (isOpen && summary) {
      loadAttendanceDetails();
    }
  }, [isOpen, summary]);

  const loadAttendanceDetails = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/payroll-summaries/${summary.id}/attendance-details`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load details: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setAttendanceDetails(data.data);
      } else {
        setError('Failed to load attendance details');
      }
    } catch (err) {
      console.error('Error loading attendance details:', err);
      setError('Error loading attendance details: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      return 'Invalid Date';
    }
  };

  // Format time for display
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

// Alternative time formatting function for backend time strings
const formatTimeFromBackend = (timeString) => {
  if (!timeString) return '-';
  
  try {
    // Handle Laravel timestamp formats
    let timeOnly;
    
    if (timeString.includes('T')) {
      // ISO format
      const date = new Date(timeString);
      if (isNaN(date.getTime())) return '-';
      
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      });
    } else if (timeString.includes(' ')) {
      // Format: "2025-01-16 08:13:00"
      const [datePart, timePart] = timeString.split(' ');
      timeOnly = timePart;
    } else {
      // Time only: "08:13:00"
      timeOnly = timeString;
    }
    
    // Parse time only
    const [hours, minutes] = timeOnly.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) {
      return '-';
    }
    
    // Create a date object for today with the specified time
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
  } catch (error) {
    console.error('Time formatting error:', error);
    return '-';
  }
};

const formatTimeForTable = (timeString) => {
  if (!timeString) return '-';
  
  try {
    // Handle the backend time format (H:i:s)
    if (timeString.match(/^\d{2}:\d{2}:\d{2}$/)) {
      const [hours, minutes] = timeString.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    
    // Fallback to standard formatting
    return formatTime(timeString);
  } catch (err) {
    return 'Invalid Time';
  }
};

  // Format numeric values
  const formatNumeric = (value, decimals = 2) => {
    if (value === null || value === undefined || value === '') return '0.00';
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(decimals);
  };

  // Format minutes to hours for display
  const formatMinutesToHours = (minutes) => {
    if (!minutes || minutes === 0) return '0.00';
    const hours = parseFloat(minutes) / 60;
    return hours.toFixed(2);
  };

  // Render status badges
  const renderStatusBadge = (value, type = 'boolean') => {
    if (type === 'source') {
      const sourceColors = {
        'manual_edit': 'bg-red-100 text-red-800',
        'slvl_sync': 'bg-indigo-100 text-indigo-800',
        'import': 'bg-blue-100 text-blue-800',
        'biometric': 'bg-green-100 text-green-800',
        'unknown': 'bg-gray-100 text-gray-800'
      };
      
      const colorClass = sourceColors[value] || sourceColors['unknown'];
      const displayText = value === 'manual_edit' ? 'Edited' : 
                         value === 'slvl_sync' ? 'SLVL' :
                         value === 'import' ? 'Import' :
                         value === 'biometric' ? 'Bio' : 'Unknown';
      
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
          {displayText}
        </span>
      );
    }
    
    if (value) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ✓
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        -
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-lg max-w-7xl w-full mx-4 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-800">Payroll Summary Details</h2>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              summary?.status === 'posted' 
                ? 'bg-green-100 text-green-800'
                : summary?.status === 'locked'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {summary?.status?.charAt(0).toUpperCase() + summary?.status?.slice(1)}
            </span>
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
          {/* Summary Information */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Summary Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Employee</label>
                <p className="text-gray-900 font-medium">{summary?.employee_name}</p>
                <p className="text-sm text-gray-500">{summary?.employee_no}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Department</label>
                <p className="text-gray-900">{summary?.department}</p>
                <p className="text-sm text-gray-500">{summary?.line}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Period</label>
                <p className="text-gray-900">{summary?.full_period}</p>
                <p className="text-sm text-gray-500">Cost Center: {summary?.cost_center || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Summary Metrics */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <Calculator className="h-5 w-5 mr-2" />
              Summary Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{formatNumeric(summary?.days_worked, 1)}</div>
                <div className="text-sm text-green-800">Days Worked</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{formatNumeric(summary?.ot_hours)}</div>
                <div className="text-sm text-blue-800">OT Hours</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{formatMinutesToHours(summary?.late_under_minutes)}</div>
                <div className="text-sm text-orange-800">Late/Under (Hrs)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{formatNumeric(summary?.nsd_hours)}</div>
                <div className="text-sm text-purple-800">NSD Hours</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{formatNumeric(summary?.slvl_days, 1)}</div>
                <div className="text-sm text-red-800">SLVL Days</div>
              </div>
            </div>
          </div>

          {/* Attendance Details - Styled like second image */}
          <div className="bg-white border rounded-lg">
            <div className="p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Detailed Attendance Records ({attendanceDetails.length} records)
              </h3>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2 text-lg">Loading attendance details...</span>
              </div>
            ) : error ? (
              <div className="p-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            ) : attendanceDetails.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No attendance records found</h3>
                <p className="text-gray-500">The attendance records may have been deleted or not properly linked.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  {/* Header */}
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time In</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Break Out</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Break In</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Out</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late/Under</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Night Shift</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Travel</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLVL</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CT</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CS</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holiday</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center">
                        <Car className="h-3 w-3 mr-1" />
                        Trip
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT Reg</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT Spl</th>
                    </tr>
                  </thead>
                  
                  {/* Body */}
                  <tbody className="bg-white">
                    {attendanceDetails.map((attendance, index) => (
                      <tr key={attendance.id} className="border-b hover:bg-gray-50">
                        
                        {/* Date */}
                        <td className="px-3 py-3">
                          <div className="text-sm text-gray-900">
                            {formatDate(attendance.attendance_date)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {attendance.day || ''}
                          </div>
                        </td>
                        
                        {/* Time In */}
                        <td className="px-3 py-3 text-sm text-gray-900 font-medium">
                        {formatTime(attendance.time_in)}
                        </td>

                        {/* Break Out */}
                        <td className="px-3 py-3 text-sm text-gray-600">
                        {formatTime(attendance.break_out)}
                        </td>

                        {/* Break In */}
                        <td className="px-3 py-3 text-sm text-gray-600">
                        {formatTime(attendance.break_in)}
                        </td>

                        {/* Time Out */}
                        <td className="px-3 py-3 text-sm text-gray-900 font-medium">
                        {attendance.is_nightshift && attendance.next_day_timeout 
                            ? formatTime(attendance.next_day_timeout)
                            : formatTime(attendance.time_out)
                        }
                        </td>
                        
                        {/* Late/Under */}
                        <td className="px-3 py-3">
                          {(attendance.late_minutes > 0 || attendance.undertime_minutes > 0) ? (
                            <div className="space-y-1">
                              {attendance.late_minutes > 0 && (
                                <div className="flex items-center text-red-600 text-xs">
                                  <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                                  {Math.round(attendance.late_minutes)}m late
                                </div>
                              )}
                              {attendance.undertime_minutes > 0 && (
                                <div className="flex items-center text-orange-600 text-xs">
                                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-1"></span>
                                  {Math.round(attendance.undertime_minutes)}m under
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center text-green-600 text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              On Time
                            </div>
                          )}
                        </td>
                        
                        {/* Night Shift */}
                        <td className="px-3 py-3">
                          {attendance.is_nightshift ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                              ☽ Night
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                              ☀ Day
                            </span>
                          )}
                        </td>
                        
                        {/* Hours */}
                        <td className="px-3 py-3 text-sm text-gray-900 font-medium">
                          {formatNumeric(attendance.hours_worked)}
                        </td>
                        
                        {/* OT */}
                        <td className="px-3 py-3 text-sm text-gray-600">
                          {formatNumeric(attendance.overtime)}
                        </td>
                        
                        {/* Travel */}
                        <td className="px-3 py-3 text-sm text-gray-600">
                          {formatNumeric(attendance.travel_order)}
                        </td>
                        
                        {/* SLVL */}
                        <td className="px-3 py-3 text-sm text-gray-600">
                          {formatNumeric(attendance.slvl, 1)}
                        </td>
                        
                        {/* CT */}
                        <td className="px-3 py-3 text-sm text-center">
                          {attendance.ct ? '✓' : '-'}
                        </td>
                        
                        {/* CS */}
                        <td className="px-3 py-3 text-sm text-center">
                          {attendance.cs ? '✓' : '-'}
                        </td>
                        
                        {/* Holiday */}
                        <td className="px-3 py-3 text-sm text-gray-600">
                          {formatNumeric(attendance.holiday)}
                        </td>
                        
                        {/* Trip */}
                        <td className="px-3 py-3">
                          <div className="flex items-center text-sm text-blue-600">
                            <Car className="h-3 w-3 mr-1" />
                            {formatNumeric(attendance.trip, 1)}
                          </div>
                        </td>
                        
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Additional Summary Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Additional Metrics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Off Days:</span>
                  <span className="font-medium">{formatNumeric(summary?.off_days, 1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Travel Order Hours:</span>
                  <span className="font-medium">{formatNumeric(summary?.travel_order_hours)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Holiday Hours:</span>
                  <span className="font-medium">{formatNumeric(summary?.holiday_hours)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">OT Reg Holiday:</span>
                  <span className="font-medium">{formatNumeric(summary?.ot_reg_holiday_hours)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">OT Special Holiday:</span>
                  <span className="font-medium">{formatNumeric(summary?.ot_special_holiday_hours)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Offset Hours:</span>
                  <span className="font-medium">{formatNumeric(summary?.offset_hours)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Trip Count:</span>
                  <span className="font-medium">{formatNumeric(summary?.trip_count, 1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Retro:</span>
                  <span className="font-medium">{formatNumeric(summary?.retro)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Flags</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Has CT (Compensatory Time):</span>
                  <span>{summary?.has_ct ? '✓ Yes' : '✗ No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Has CS (Compressed Schedule):</span>
                  <span>{summary?.has_cs ? '✓ Yes' : '✗ No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Has OB (Official Business):</span>
                  <span>{summary?.has_ob ? '✓ Yes' : '✗ No'}</span>
                </div>
                {summary?.posted_at && (
                  <div className="mt-4 pt-2 border-t border-gray-200">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Posted At:</span>
                      <span className="font-medium">{formatDate(summary.posted_at)}</span>
                    </div>
                    {summary?.posted_by && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Posted By:</span>
                        <span className="font-medium">{summary.posted_by.name}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {summary?.notes && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
              <p className="text-gray-700">{summary.notes}</p>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

const PayrollSummaries = ({ auth }) => {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filter state
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [periodType, setPeriodType] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // Added search state
  const [departments, setDepartments] = useState([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(25);
  
  // Statistics
  const [statistics, setStatistics] = useState(null);

  // Detail modal state
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Load payroll summaries
  const loadSummaries = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('year', year);
      params.append('month', month);
      params.append('page', currentPage);
      params.append('per_page', perPage);
      
      if (periodType) params.append('period_type', periodType);
      if (department) params.append('department', department);
      if (status) params.append('status', status);
      if (searchTerm) params.append('search', searchTerm); // Added search parameter
      
      const response = await fetch('/payroll-summaries?' + params.toString(), {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSummaries(data.data);
        setTotalPages(data.pagination.last_page);
        setCurrentPage(data.pagination.current_page);
        setStatistics(data.statistics);
      } else {
        setError('Failed to load payroll summaries');
      }
    } catch (err) {
      console.error('Error loading summaries:', err);
      setError('Error loading payroll summaries: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    setExporting(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('year', year);
      params.append('month', month);
      
      if (periodType) params.append('period_type', periodType);
      if (department) params.append('department', department);
      if (status) params.append('status', status);
      if (searchTerm) params.append('search', searchTerm); // Added search to export
      
      const response = await fetch('/payroll-summaries/export?' + params.toString(), {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/octet-stream'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Export failed with status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filename = `payroll_summaries_${year}_${month}_${new Date().toISOString().split('T')[0]}.csv`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess('Payroll summaries exported successfully');
      
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export payroll summaries: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  // Handle delete summary
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this payroll summary? This will revert the attendance records to not-posted status.')) {
      return;
    }

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      const response = await fetch(`/payroll-summaries/${id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Delete failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message || 'Payroll summary deleted successfully');
        await loadSummaries();
      } else {
        setError('Delete failed: ' + (data.message || 'Unknown error'));
      }
      
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete payroll summary: ' + (err.message || 'Unknown error'));
    }
  };

  // Handle row double-click
  const handleRowDoubleClick = (summary) => {
    setSelectedSummary(summary);
    setShowDetailModal(true);
  };

  // Load departments
  const loadDepartments = async () => {
    try {
      const response = await fetch('/attendance/departments', {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDepartments(data.data);
        }
      }
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      return 'Invalid Date';
    }
  };

  // Format numeric values
  const formatNumeric = (value, decimals = 2) => {
    if (value === null || value === undefined || value === '') return '0.00';
    const num = parseFloat(value);
    return isNaN(num) ? '0.00' : num.toFixed(decimals);
  };

  // Format minutes to hours for display
  const formatMinutesToHours = (minutes) => {
    if (!minutes || minutes === 0) return '0.00';
    const hours = parseFloat(minutes) / 60;
    return hours.toFixed(2);
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

  // Load data on component mount and filter changes
  useEffect(() => {
    loadSummaries();
  }, [year, month, periodType, department, status, searchTerm, currentPage]);

  useEffect(() => {
    loadDepartments();
  }, []);

  return (
    <AuthenticatedLayout user={auth.user}>
      <Head title="Payroll Summaries" />
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar />
        <div className="flex-1 p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Payroll Summaries
                </h1>
                <p className="text-gray-600">
                  View and manage posted payroll summaries generated from attendance data with accurate calculations.
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  💡 Tip: Double-click any row to view detailed attendance records
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {exporting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </>
                  )}
                </Button>
              </div>
            </div>

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

            {/* Filters Card */}
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search by name or ID..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Year
                    </label>
                    <input
                      type="number"
                      min="2020"
                      max="2030"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Month
                    </label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={month}
                      onChange={(e) => setMonth(parseInt(e.target.value))}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Period
                    </label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={periodType}
                      onChange={(e) => setPeriodType(e.target.value)}
                    >
                      <option value="">All Periods</option>
                      <option value="1st_half">1st Half (1-15)</option>
                      <option value="2nd_half">2nd Half (16-30/31)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    >
                      <option value="">All Departments</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">All Status</option>
                      <option value="posted">Posted</option>
                      <option value="draft">Draft</option>
                      <option value="locked">Locked</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Statistics */}
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-blue-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Summaries</p>
                        <p className="text-2xl font-bold text-gray-900">{statistics.total_summaries || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <Calendar className="h-8 w-8 text-green-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Days Worked</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumeric(statistics.total_days_worked, 1)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <Clock className="h-8 w-8 text-orange-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total OT Hours</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumeric(statistics.total_ot_hours)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <Target className="h-8 w-8 text-purple-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Avg Days/Employee</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumeric(statistics.avg_days_worked, 1)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Table container */}
            <div className="bg-white rounded-lg shadow">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-2 text-lg">Loading...</span>
                </div>
              ) : summaries.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No payroll summaries found</h3>
                  <p className="text-gray-500">Try adjusting your filters or check if any attendance records have been posted.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Worked</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT Hours</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Off Days</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late/Under (Hrs)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NSD Hours</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLVL Days</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retro</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posted</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {summaries.map((summary) => (
                        <tr 
                          key={summary.id} 
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                          onDoubleClick={() => handleRowDoubleClick(summary)}
                          title="Double-click to view detailed attendance records"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {summary.employee_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {summary.employee_no}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>
                              <div>{summary.department}</div>
                              <div className="text-xs text-gray-400">{summary.line}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {summary.full_period}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {formatNumeric(summary.days_worked, 1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {formatNumeric(summary.ot_hours)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatNumeric(summary.off_days, 1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3 text-orange-500" />
                              <span>{formatMinutesToHours(summary.late_under_minutes)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatNumeric(summary.nsd_hours)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatNumeric(summary.slvl_days, 1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatNumeric(summary.retro)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              summary.status === 'posted' 
                                ? 'bg-green-100 text-green-800'
                                : summary.status === 'locked'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {summary.status === 'posted' && <CheckCircle className="h-3 w-3 mr-1" />}
                              {summary.status === 'locked' && <AlertTriangle className="h-3 w-3 mr-1" />}
                              {summary.status === 'draft' && <Clock className="h-3 w-3 mr-1" />}
                              {summary.status.charAt(0).toUpperCase() + summary.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>
                              <div>{formatDate(summary.posted_at)}</div>
                              {summary.posted_by && (
                                <div className="text-xs text-gray-400">
                                  by {summary.posted_by.name}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRowDoubleClick(summary);
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {summary.status !== 'locked' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(summary.id);
                                  }}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete and revert attendance records to not-posted"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 bg-white">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <Button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing page <span className="font-medium">{currentPage}</span> of{' '}
                        <span className="font-medium">{totalPages}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <Button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          variant="outline"
                          size="sm"
                          className="rounded-l-md"
                        >
                          First
                        </Button>
                        <Button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          variant="outline"
                          size="sm"
                        >
                          Previous
                        </Button>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = currentPage <= 3 
                            ? i + 1 
                            : (currentPage >= totalPages - 2 
                              ? totalPages - 4 + i 
                              : currentPage - 2 + i);
                          
                          if (pageNum > 0 && pageNum <= totalPages) {
                            return (
                              <Button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                className={currentPage === pageNum ? "bg-blue-500 text-white" : ""}
                              >
                                {pageNum}
                              </Button>
                            );
                          }
                          return null;
                        })}
                        
                        <Button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          variant="outline"
                          size="sm"
                        >
                          Next
                        </Button>
                        <Button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          variant="outline"
                          size="sm"
                          className="rounded-r-md"
                        >
                          Last
                        </Button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <PayrollSummaryDetailModal
        isOpen={showDetailModal}
        summary={selectedSummary}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSummary(null);
        }}
      />
    </AuthenticatedLayout>
  );
};

export default PayrollSummaries;