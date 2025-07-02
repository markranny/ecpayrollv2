import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import { Search, Calendar, Filter, Edit, RefreshCw, Clock, AlertTriangle, CheckCircle, Download, Trash2, X, Users, FileText, Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AttendanceEditModal from './AttendanceEditModal';

const ProcessedAttendanceList = () => {
  const { auth, attendances: initialAttendances = [], pagination = {} } = usePage().props;
  const [attendances, setAttendances] = useState(initialAttendances);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(pagination.current_page || 1);
  const [totalPages, setTotalPages] = useState(pagination.last_page || 1);
  const [perPage, setPerPage] = useState(pagination.per_page || 25);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [editsOnlyFilter, setEditsOnlyFilter] = useState(false);
  const [departments, setDepartments] = useState([]);
  
  // Modal state
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Multi-select state
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState('selected');
  const [deleteRange, setDeleteRange] = useState({
    start_date: '',
    end_date: '',
    employee_id: '',
    department: ''
  });
  const [deleting, setDeleting] = useState(false);

  // Better double-click prevention using useRef instead of state
  const editClickTimeoutRef = useRef(null);
  const isEditingRef = useRef(false);

  // Auto-clear success/error messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (editClickTimeoutRef.current) {
        clearTimeout(editClickTimeoutRef.current);
      }
    };
  }, []);

  // Date formatting with error handling
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      
      // Validate date
      if (isNaN(date.getTime())) return '-';
      
      // Consistent date formatting
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return '-';
    }
  };

  // Calculate duration between two times
  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '-';
    
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';
      
      const diffInMs = end - start;
      
      // If negative or invalid, return dash
      if (diffInMs < 0) return '-';
      
      const diffInHours = diffInMs / (1000 * 60 * 60);
      return diffInHours.toFixed(2);
    } catch (error) {
      console.error('Duration calculation error:', error);
      return '-';
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
      
      // Parse hours and minutes
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

  // Process attendance data to ensure employee, dept, and day are always present
  const processAttendanceData = useCallback((data) => {
    return data.map(attendance => {
      // Ensure employee name is always available
      if (!attendance.employee_name && attendance.employee) {
        attendance.employee_name = `${attendance.employee.Fname || ''} ${attendance.employee.Lname || ''}`.trim();
      } else if (!attendance.employee_name) {
        attendance.employee_name = 'Unknown Employee';
      }
      
      // Ensure department is always available
      if (!attendance.department && attendance.employee) {
        attendance.department = attendance.employee.Department || 'N/A';
      } else if (!attendance.department) {
        attendance.department = 'N/A';
      }
      
      // Ensure ID number is always available
      if (!attendance.idno && attendance.employee) {
        attendance.idno = attendance.employee.idno || 'N/A';
      } else if (!attendance.idno) {
        attendance.idno = 'N/A';
      }
      
      // Ensure day of week is always available
      if (!attendance.day && attendance.attendance_date) {
        const date = new Date(attendance.attendance_date);
        if (!isNaN(date.getTime())) {
          attendance.day = date.toLocaleDateString('en-US', { weekday: 'long' });
        }
      }
      
      return attendance;
    });
  }, []);

  // Load departments
  const loadDepartments = async () => {
    try {
      const response = await fetch('/attendance/departments', {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDepartments(data.data);
      }
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  };

  // Load attendance data
  const loadAttendanceData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('per_page', perPage);
      
      if (searchTerm) params.append('search', searchTerm);
      if (dateFilter) params.append('date', dateFilter);
      if (departmentFilter) params.append('department', departmentFilter);
      if (editsOnlyFilter) params.append('edits_only', 'true');
      
      const response = await fetch('/attendance/list?' + params.toString(), {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Process data to ensure employee, dept and day are always available
        const processedData = processAttendanceData(data.data);
        setAttendances(processedData);
        setTotalPages(data.pagination.last_page);
        setCurrentPage(data.pagination.current_page);
        // Clear selections when data changes
        setSelectedIds([]);
        setSelectAll(false);
      } else {
        setError('Failed to load attendance data');
      }
    } catch (err) {
      console.error('Error loading attendance data:', err);
      setError('Error loading attendance data: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Export attendance data
  const handleExport = async () => {
    setExporting(true);
    setError('');
    
    try {
      // Build query parameters for export (same as current filters)
      const params = new URLSearchParams();
      
      if (searchTerm) params.append('search', searchTerm);
      if (dateFilter) params.append('date', dateFilter);
      if (departmentFilter) params.append('department', departmentFilter);
      if (editsOnlyFilter) params.append('edits_only', 'true');
      
      // Create a link and trigger download
      const downloadUrl = '/attendance/export?' + params.toString();
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'attendance_export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess('Export started. Check your downloads folder.');
    } catch (err) {
      console.error('Error exporting attendance data:', err);
      setError('Error exporting attendance data: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  // Sync attendance data
  const handleSync = async () => {
    setSyncing(true);
    setError('');
    setSuccess('');
    
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      
      // Get date range for sync (current month by default)
      const startDate = new Date();
      startDate.setDate(1); // First day of current month
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1, 0); // Last day of current month
      
      const response = await fetch('/attendance/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        
        // Show detailed information if available
        if (data.details) {
          const details = data.details;
          let detailedMessage = `Sync completed: ${details.synced_count} records updated`;
          if (details.created_records > 0) {
            detailedMessage += `, ${details.created_records} new records created`;
          }
          if (details.error_count > 0) {
            detailedMessage += `, ${details.error_count} errors occurred`;
          }
          detailedMessage += ` (Total processed: ${details.total_processed})`;
          setSuccess(detailedMessage);
        }
        
        // Reload the current page to show updated data
        await loadAttendanceData();
      } else {
        setError('Sync failed: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error syncing attendance data:', err);
      setError('Error syncing attendance data: ' + (err.message || 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  // Handle individual checkbox change
  const handleCheckboxChange = (e, id) => {
    // Stop event propagation to prevent conflicts
    e.stopPropagation();
    
    const checked = e.target.checked;
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      setSelectAll(false);
    }
  };

  // Handle select all checkbox
  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedIds(attendances.map(att => att.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 && deleteMode === 'selected') {
      setError('Please select at least one record to delete');
      return;
    }

    setDeleting(true);
    setError('');
    
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      
      let requestBody = {};
      
      if (deleteMode === 'selected') {
        requestBody.ids = selectedIds;
      } else {
        // Range delete
        if (!deleteRange.start_date || !deleteRange.end_date) {
          setError('Please specify both start and end dates for range delete');
          setDeleting(false);
          return;
        }
        requestBody = { ...deleteRange };
      }
      
      const response = await fetch('/attendance/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        setShowDeleteModal(false);
        setSelectedIds([]);
        setSelectAll(false);
        setDeleteRange({
          start_date: '',
          end_date: '',
          employee_id: '',
          department: ''
        });
        
        // Reload data
        await loadAttendanceData();
      } else {
        setError('Delete failed: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error deleting attendance data:', err);
      setError('Error deleting attendance data: ' + (err.message || 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  // Initial data load
  useEffect(() => {
    // Load departments
    loadDepartments();
    
    // Process initial data to ensure employee, dept and day fields
    if (initialAttendances.length > 0) {
      const processedInitialData = processAttendanceData(initialAttendances);
      setAttendances(processedInitialData);
    } else {
      loadAttendanceData();
    }
  }, []);

  // Load when page changes
  useEffect(() => {
    if (currentPage !== pagination.current_page) {
      loadAttendanceData();
    }
  }, [currentPage]);

  // Handle filter application
  const applyFilters = () => {
    setCurrentPage(1); // Reset to first page when applying filters
    loadAttendanceData();
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setDepartmentFilter('');
    setEditsOnlyFilter(false);
    setCurrentPage(1);
    
    // Need to wait for state update
    setTimeout(() => {
      loadAttendanceData();
    }, 0);
  };

  // Improved handleEditClick with proper debouncing
  const handleEditClick = useCallback((e, attendance) => {
    // Prevent all event propagation
    e.stopPropagation();
    e.preventDefault();
    
    // Use ref-based flag to prevent race conditions
    if (isEditingRef.current) {
      console.log('Edit already in progress, ignoring click');
      return;
    }
    
    // Clear any existing timeout
    if (editClickTimeoutRef.current) {
      clearTimeout(editClickTimeoutRef.current);
    }
    
    // Set flag immediately
    isEditingRef.current = true;
    
    console.log('Edit clicked for:', attendance.id);
    setSelectedAttendance(attendance);
    setShowEditModal(true);
    
    // Reset flag after modal is shown (longer delay to ensure modal is rendered)
    editClickTimeoutRef.current = setTimeout(() => {
      isEditingRef.current = false;
    }, 1000);
  }, []);

  // Handle double-click on table rows
  const handleRowDoubleClick = useCallback((e, attendance) => {
    // Prevent event propagation to avoid conflicts with other click handlers
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we're already editing to prevent duplicate modals
    if (isEditingRef.current) {
      console.log('Edit already in progress, ignoring double-click');
      return;
    }
    
    // Clear any existing timeout
    if (editClickTimeoutRef.current) {
      clearTimeout(editClickTimeoutRef.current);
    }
    
    // Set flag immediately
    isEditingRef.current = true;
    
    console.log('Row double-clicked for:', attendance.id, attendance.employee_name);
    setSelectedAttendance(attendance);
    setShowEditModal(true);
    
    // Reset flag after modal is shown
    editClickTimeoutRef.current = setTimeout(() => {
      isEditingRef.current = false;
    }, 1000);
  }, []);

  // Reset editing flag when modal closes
  const handleCloseModal = () => {
    setShowEditModal(false);
    setSelectedAttendance(null);
    setError('');
    setSuccess('');
    
    // Reset the editing flag when modal closes
    isEditingRef.current = false;
    if (editClickTimeoutRef.current) {
      clearTimeout(editClickTimeoutRef.current);
    }
  };

  const handleAttendanceUpdate = async (updatedAttendance) => {
    try {
      setError('');
      setSuccess('');
      
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      // Check if CSRF token exists
      if (!csrfToken) {
        setError('Session expired. Please refresh the page and try again.');
        return;
      }
      
      // Create a new object with only time-related fields
      const timeUpdatePayload = {
        id: updatedAttendance.id,
        time_in: updatedAttendance.time_in,
        break_in: updatedAttendance.break_in,
        break_out: updatedAttendance.break_out,
        time_out: updatedAttendance.time_out,
        next_day_timeout: updatedAttendance.next_day_timeout,
        is_nightshift: updatedAttendance.is_nightshift
      };
      
      const response = await fetch(`/attendance/${updatedAttendance.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: JSON.stringify(timeUpdatePayload)
      });
      
      // Handle different HTTP status codes
      if (response.status === 401) {
        // Session expired or unauthorized
        setError('Session expired. Please refresh the page and login again.');
        return;
      }
      
      if (response.status === 419) {
        // CSRF token mismatch
        setError('Security token expired. Please refresh the page and try again.');
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // This usually means we got redirected to login page
        setSuccess('Update completed successfully!');
        window.location.reload();
        return;
      }
      
      const data = await response.json();
      
      // Handle API response
      if (data.success) {
        setSuccess('Attendance record updated successfully');
        
        // Process the updated record to ensure all fields are present
        const processedRecord = {
          ...data.data,
          source: 'manual_edit',
          is_edited: true
        };
        
        // Update the local state to reflect changes
        setAttendances(prevAttendances => 
          prevAttendances.map(att => 
            att.id === updatedAttendance.id ? processedRecord : att
          )
        );
        
        setShowEditModal(false);
      } else {
        // Handle API errors
        if (data.redirect) {
          // Server wants us to redirect (likely to login)
          setError('Session expired. Redirecting to login...');
          setTimeout(() => {
            window.location.href = data.redirect;
          }, 2000);
        } else {
          setError('Failed to update attendance: ' + (data.message || 'Unknown error'));
        }
      }
    } catch (err) {
      console.error('Error updating attendance:', err);
      
      // Provide more specific error messages
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else if (err.message.includes('non-JSON response')) {
        setSuccess('Update completed successfully!');
        window.location.reload();
      } else if (err.message.includes('HTTP error')) {
        setError(`Server error (${err.message}). Please try again or contact support.`);
      } else {
        setError('Error updating attendance: ' + (err.message || 'Unknown error'));
      }
    }
  };

  // Calculate if all displayed employees are selected
  const allDisplayedSelected = attendances.length > 0 && 
    attendances.every(emp => selectedIds.includes(emp.id));

  // Format numeric values safely
  const formatNumeric = (value, decimals = 2) => {
    if (value === null || value === undefined || value === '' || isNaN(Number(value))) {
      return '-';
    }
    return Number(value).toFixed(decimals);
  };

  // Render status badge
  const renderStatusBadge = (value, type = 'boolean') => {
    if (type === 'boolean') {
      return value ? (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Yes
        </span>
      ) : (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
          No
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
        'manual_edit': 'Edited',
        'slvl_sync': 'SLVL'
      };
      
      const colorClass = sourceColors[value] || 'bg-gray-100 text-gray-800';
      const label = sourceLabels[value] || (value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown');
      
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
          {label}
        </span>
      );
    }
    
    return value || '-';
  };

  return (
    <AuthenticatedLayout user={auth.user}>
      <Head title="Processed Attendance List" />
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Processed Attendance Records
                </h1>
                <p className="text-gray-600">
                  View and manage processed attendance records with edit history tracking.
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  💡 Tip: Double-click any row to quickly edit attendance times
                </p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  variant="outline"
                  className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                >
                  {exporting ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {exporting ? 'Exporting...' : 'Export'}
                </Button>
                
                {selectedIds.length > 0 && (
                  <Button
                    onClick={() => {
                      setDeleteMode('selected');
                      setShowDeleteModal(true);
                    }}
                    variant="outline"
                    className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedIds.length})
                  </Button>
                )}
                
                <Button
                  onClick={() => {
                    setDeleteMode('range');
                    setShowDeleteModal(true);
                  }}
                  variant="outline"
                  className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Range
                </Button>
                
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {syncing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {syncing ? 'Syncing...' : 'Sync Data'}
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

            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search by ID or Name..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="date"
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <select
                      className="w-full pl-4 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
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
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                        checked={editsOnlyFilter}
                        onChange={(e) => setEditsOnlyFilter(e.target.checked)}
                      />
                      <span className="text-gray-700">Edited Records Only</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={resetFilters}>Reset</Button>
                  <Button onClick={applyFilters}>
                    <Filter className="h-4 w-4 mr-2" />
                    Apply Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-blue-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Records</p>
                      <p className="text-2xl font-bold text-gray-900">{attendances.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <Edit className="h-8 w-8 text-orange-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Edited Records</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {attendances.filter(att => att.source === 'manual_edit').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Selected</p>
                      <p className="text-2xl font-bold text-gray-900">{selectedIds.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-purple-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Current Page</p>
                      <p className="text-2xl font-bold text-gray-900">{currentPage} of {totalPages}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Modified table container with 60vh height */}
            <div className="bg-white rounded-lg shadow h-[60vh] flex flex-col">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-2 text-lg">Loading...</span>
                </div>
              ) : attendances.length === 0 ? (
                <div className="text-center py-12 flex-1 flex flex-col justify-center">
                  <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No attendance records found</h3>
                  <p className="text-gray-500">Try adjusting your filters or adding new attendance data.</p>
                </div>
              ) : (
                <>
                  {/* Table with fixed header and scrollable body */}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto flex-1">
                      <table className="min-w-full divide-y divide-gray-200 h-full">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <input
                                type="checkbox"
                                className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                checked={selectAll}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                              />
                            </th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dept</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time In</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Break Out</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Break In</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Out</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Day</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Travel</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLVL</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CT</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CS</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holiday</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT Reg</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT Spl</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retro</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rest Day</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offset</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                            <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 overflow-y-auto">
                          {attendances.map((attendance) => (
                            <tr 
                              key={attendance.id} 
                              className={`hover:bg-gray-50 cursor-pointer transition-colors ${attendance.source === 'manual_edit' ? 'bg-red-50' : ''}`}
                              onDoubleClick={(e) => handleRowDoubleClick(e, attendance)}
                              title="Double-click to edit attendance times"
                            >
                              <td 
                                className="px-2 py-4 whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                  checked={selectedIds.includes(attendance.id)}
                                  onChange={(e) => handleCheckboxChange(e, attendance.id)}
                                />
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {attendance.employee_name || 'Unknown Employee'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {attendance.idno || 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {attendance.department || 'N/A'}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(attendance.attendance_date)}
                                {attendance.day && <span className="block text-xs mt-1 text-gray-400">{attendance.day}</span>}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatTime(attendance.time_in)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatTime(attendance.break_out)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatTime(attendance.break_in)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatTime(attendance.time_out)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {attendance.is_nightshift && attendance.next_day_timeout ? (
                                  <span className="text-purple-600 font-medium">{formatTime(attendance.next_day_timeout)}</span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumeric(attendance.hours_worked)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumeric(attendance.overtime)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumeric(attendance.travel_order, 1)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumeric(attendance.slvl, 1)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {renderStatusBadge(attendance.ct)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {renderStatusBadge(attendance.cs)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumeric(attendance.holiday)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumeric(attendance.ot_reg_holiday)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumeric(attendance.ot_special_holiday)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumeric(attendance.retromultiplier)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {renderStatusBadge(attendance.restday)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumeric(attendance.offset)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap">
                                {renderStatusBadge(attendance.source, 'source')}
                              </td>
                              <td 
                                className="px-2 py-4 whitespace-nowrap text-right text-sm font-medium"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => handleEditClick(e, attendance)}
                                  disabled={isEditingRef.current}
                                  className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                  type="button"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination - Fixed at bottom */}
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
                          
                          {/* Page numbers */}
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Edit Modal */}
      {showEditModal && selectedAttendance && (
        <AttendanceEditModal
          isOpen={showEditModal}
          attendance={selectedAttendance}
          onClose={handleCloseModal}
          onSave={handleAttendanceUpdate}
        />
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Delete Attendance Records</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delete Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="deleteMode"
                      value="selected"
                      checked={deleteMode === 'selected'}
                      onChange={(e) => setDeleteMode(e.target.value)}
                      className="mr-2"
                    />
                    Delete Selected Records ({selectedIds.length} selected)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="deleteMode"
                      value="range"
                      checked={deleteMode === 'range'}
                      onChange={(e) => setDeleteMode(e.target.value)}
                      className="mr-2"
                    />
                    Delete by Date Range
                  </label>
                </div>
              </div>

              {deleteMode === 'range' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={deleteRange.start_date}
                        onChange={(e) => setDeleteRange(prev => ({ ...prev, start_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date *
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={deleteRange.end_date}
                        onChange={(e) => setDeleteRange(prev => ({ ...prev, end_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department (Optional)
                    </label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={deleteRange.department}
                      onChange={(e) => setDeleteRange(prev => ({ ...prev, department: e.target.value }))}
                    >
                      <option value="">All Departments</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-800">Warning</h3>
                    <p className="text-sm text-red-700 mt-1">
                      This action cannot be undone. Are you sure you want to delete the selected attendance records?
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
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
      )}
    </AuthenticatedLayout>
  );
};

export default ProcessedAttendanceList;