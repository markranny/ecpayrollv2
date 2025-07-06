import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import { Search, Calendar, Filter, Edit, RefreshCw, Clock, AlertTriangle, CheckCircle, Download, Trash2, X, Users, FileText, Eye, Moon, Sun, AlertCircle, CheckCircle2, Info, Calculator, Car } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AttendanceEditModal from './AttendanceEditModal';
import AttendanceInfoModal from './AttendanceInfoModal';

const ProcessedAttendanceList = () => {
  const { auth, attendances: initialAttendances = [], pagination = {}, recalculated_count = 0 } = usePage().props;
  const [attendances, setAttendances] = useState(initialAttendances);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
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
  const [nightShiftFilter, setNightShiftFilter] = useState(false); // NEW: Night shift filter
  const [postingStatusFilter, setPostingStatusFilter] = useState('');
  const [departments, setDepartments] = useState([]);
  const [holdTimer, setHoldTimer] = useState(null);
  const [isHolding, setIsHolding] = useState(false);
  
  // Modal state
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
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

  // Show recalculation message if records were auto-recalculated
  useEffect(() => {
    if (recalculated_count > 0) {
      setSuccess(`Auto-recalculated ${recalculated_count} attendance records for accurate display`);
    }
  }, [recalculated_count]);

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
      if (holdTimer) {
        clearTimeout(holdTimer);
      }
    };
  }, [holdTimer]);

  // Auto-recalculate on component mount and when filters change
  useEffect(() => {
    const shouldAutoRecalculate = true;
    
    if (shouldAutoRecalculate && attendances.length > 0) {
      handleAutoRecalculate();
    }
  }, [searchTerm, dateFilter, departmentFilter, editsOnlyFilter, nightShiftFilter]); // Added nightShiftFilter

  // Enhanced load attendance data with recalculation
  const loadAttendanceData = async (showRecalcMessage = false) => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('per_page', perPage);
      
      if (searchTerm) params.append('search', searchTerm);
      if (dateFilter) params.append('date', dateFilter);
      if (departmentFilter) params.append('department', departmentFilter);
      if (editsOnlyFilter) params.append('edits_only', 'true');
      if (nightShiftFilter) params.append('night_shift_only', 'true'); // NEW: Night shift filter
      if (postingStatusFilter) params.append('posting_status', postingStatusFilter);
      
      const response = await fetch('/attendance/list?' + params.toString(), {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        const processedData = processAttendanceData(data.data);
        setAttendances(processedData);
        setTotalPages(data.pagination.last_page);
        setCurrentPage(data.pagination.current_page);
        
        if (showRecalcMessage && data.recalculated_count > 0) {
          setSuccess(`Loaded data and recalculated ${data.recalculated_count} attendance records`);
        }
        
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

  // Enhanced reset filters with auto-recalculation
  const resetFilters = async () => {
    setSearchTerm('');
    setDateFilter('');
    setDepartmentFilter('');
    setEditsOnlyFilter(false);
    setNightShiftFilter(false); // NEW: Reset night shift filter
    setPostingStatusFilter('');
    setCurrentPage(1);
    
    setTimeout(async () => {
      await loadAttendanceData(true);
    }, 0);
  };

  // Handle attendance update (UPDATED to include trip)
  const handleAttendanceUpdate = async (updatedAttendance) => {
    try {
      setError('');
      setSuccess('');
      
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      if (!csrfToken) {
        setError('Session expired. Please refresh the page and try again.');
        return;
      }
      
      const timeUpdatePayload = {
        id: updatedAttendance.id,
        time_in: updatedAttendance.time_in,
        break_in: updatedAttendance.break_in,
        break_out: updatedAttendance.break_out,
        time_out: updatedAttendance.time_out,
        next_day_timeout: updatedAttendance.next_day_timeout,
        is_nightshift: updatedAttendance.is_nightshift,
        trip: updatedAttendance.trip // NEW: Include trip in update payload
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
      
      if (response.status === 401) {
        setError('Session expired. Please refresh the page and login again.');
        return;
      }
      
      if (response.status === 419) {
        setError('Security token expired. Please refresh the page and try again.');
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        setSuccess('Update completed successfully!');
        window.location.reload();
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Attendance record updated successfully');
        
        const processedRecord = {
          ...data.data,
          source: 'manual_edit',
          is_edited: true
        };
        
        setAttendances(prevAttendances => 
          prevAttendances.map(att => 
            att.id === updatedAttendance.id ? processedRecord : att
          )
        );
        
        setShowEditModal(false);
      } else {
        if (data.redirect) {
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

  // ... (keep all other existing functions)

  return (
    <AuthenticatedLayout user={auth.user}>
      <Head title="Processed Attendance List" />
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar />
        <div className="flex-1 p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Processed Attendance Records (Non-Posted Only)
                </h1>
                <p className="text-gray-600">
                  View and manage non-posted attendance records with automatic recalculation on page load.
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  💡 Tip: Hold any row for 1 second to view details, double-click to edit attendance times
                </p>
                {recalculated_count > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    ✅ Auto-recalculated {recalculated_count} records for accurate display
                  </p>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {selectedIds.length > 0 && (
                  <>
                    <Button
                      onClick={() => handlePostingStatusChange('mark_posted')}
                      variant="outline"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Mark Posted ({selectedIds.length})
                    </Button>
                    
                    <Button
                      onClick={() => handlePostingStatusChange('mark_not_posted')}
                      variant="outline"
                      size="sm"
                      className="bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600"
                    >
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Mark Not Posted ({selectedIds.length})
                    </Button>
                  </> 
                )}

                <Button
                  onClick={() => handleAutoRecalculate(true)}
                  disabled={recalculating}
                  variant="outline"
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                  title="Manually recalculate late/undertime for current view"
                >
                  {recalculating ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4 mr-1" />
                  )}
                  {recalculating ? 'Recalculating...' : 'Recalculate'}
                </Button>
                
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  variant="outline"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                >
                  {exporting ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
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
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete ({selectedIds.length})
                  </Button>
                )}
                
                <Button
                  onClick={() => {
                    setDeleteMode('range');
                    setShowDeleteModal(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Range
                </Button>
                
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {syncing ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
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

            {/* Show recalculation status */}
            {recalculating && (
              <Alert className="mb-4 border-purple-200 bg-purple-50">
                <Calculator className="h-4 w-4 mr-2 text-purple-600 animate-pulse" />
                <AlertDescription className="text-purple-800">
                  Recalculating attendance metrics for accurate late/undertime display...
                </AlertDescription>
              </Alert>
            )}

            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Filters</span>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span>Auto-recalculation: Enabled</span>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
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
                    <select
                      className="w-full pl-4 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={postingStatusFilter}
                      onChange={(e) => setPostingStatusFilter(e.target.value)}
                    >
                      <option value="">All Status</option>
                      <option value="posted">Posted</option>
                      <option value="not_posted">Not Posted</option>
                    </select>
                  </div>
                </div>
                
                {/* NEW: Second row of filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                  <div>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="form-checkbox h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                        checked={nightShiftFilter}
                        onChange={(e) => setNightShiftFilter(e.target.checked)}
                      />
                      <div className="flex items-center space-x-1">
                        <Moon className="h-4 w-4 text-purple-600" />
                        <span className="text-gray-700">Night Shift Only</span>
                      </div>
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
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
                    <Moon className="h-8 w-8 text-purple-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Night Shifts</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {attendances.filter(att => att.is_nightshift).length}
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

            {/* Table container */}
            <div className="bg-white rounded-lg shadow h-[70vh] flex flex-col w-full">
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
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late/Under</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Night Shift</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Travel</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLVL</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CT</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CS</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holiday</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <div className="flex items-center space-x-1">
                                <Car className="h-4 w-4" />
                                <span>Trip</span>
                              </div>
                            </th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 overflow-y-auto">
                          {attendances.map((attendance) => (
                            <tr 
                              key={attendance.id} 
                              className={`hover:bg-blue-50 cursor-pointer transition-colors select-none ${
                                attendance.source === 'manual_edit' ? 'bg-red-50' : ''
                              } ${isHolding ? 'bg-blue-100' : ''}`}
                              onMouseDown={(e) => handleMouseDown(e, attendance)}
                              onMouseUp={handleMouseUp}
                              onMouseLeave={handleMouseLeave}
                              onDoubleClick={(e) => handleRowDoubleClick(e, attendance)}
                              title="Hold for 1 second to view details, double-click to edit attendance times"
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
                                {attendance.is_nightshift && attendance.next_day_timeout 
                                  ? formatTime(attendance.next_day_timeout)
                                  : formatTime(attendance.time_out)
                                }
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap">
                                {renderLateUndertime(attendance)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap">
                                {renderNightShift(attendance)}
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
                                <div className="flex items-center space-x-1">
                                  <Car className="h-3 w-3 text-blue-500" />
                                  <span>{formatNumeric(attendance.trip, 1)}</span>
                                </div>
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap">
                                {renderStatusBadge(attendance.source, 'source')}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap">
                                {renderPostingStatus(attendance)}
                              </td>
                              <td 
                                className="px-2 py-4 whitespace-nowrap text-right text-sm font-medium"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex justify-end space-x-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedAttendance(attendance);
                                      setShowInfoModal(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-900"
                                    type="button"
                                    title="View Details"
                                  >
                                    <Info className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => handleEditClick(e, attendance)}
                                    disabled={isEditingRef.current}
                                    className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                    type="button"
                                    title="Edit Attendance"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination */}
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
          onSync={handleIndividualSync}
        />
      )}

      {/* Info Modal */}
      {showInfoModal && selectedAttendance && (
        <AttendanceInfoModal
          isOpen={showInfoModal}
          attendance={selectedAttendance}
          onClose={handleCloseModal}
          onEdit={() => {
            setShowInfoModal(false);
            setShowEditModal(true);
          }}
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

              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 mb-1">Warning</h4>
                    <p className="text-sm text-red-700">
                      {deleteMode === 'selected' 
                        ? `This will permanently delete ${selectedIds.length} selected attendance records.`
                        : 'This will permanently delete all attendance records within the specified date range and filters.'
                      }
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkDelete}
                disabled={deleting || (deleteMode === 'selected' && selectedIds.length === 0)}
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
                    Delete Records
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