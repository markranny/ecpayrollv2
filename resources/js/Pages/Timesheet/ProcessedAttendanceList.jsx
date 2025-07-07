import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import { Search, Calendar, Filter, Edit, RefreshCw, Clock, AlertTriangle, CheckCircle, Download, Trash2, X, Users, FileText, Eye, Moon, Sun, AlertCircle, CheckCircle2, Info, Calculator, Car, Upload, Calendar as CalendarIcon, Target } from 'lucide-react';
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
  const [importing, setImporting] = useState(false);
  const [settingHoliday, setSettingHoliday] = useState(false);
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
  const [nightShiftFilter, setNightShiftFilter] = useState(false);
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

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);

  // Holiday modal state
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayData, setHolidayData] = useState({
    date: '',
    multiplier: '2.0',
    department: '',
    employee_ids: []
  });

  // Better double-click prevention using useRef instead of state
  const editClickTimeoutRef = useRef(null);
  const isEditingRef = useRef(false);

  // Process attendance data for display
  const processAttendanceData = (data) => {
    return data.map(attendance => ({
      ...attendance,
      // Ensure all necessary fields are present
      employee_name: attendance.employee_name || 'Unknown Employee',
      idno: attendance.idno || 'N/A',
      department: attendance.department || 'N/A',
      line: attendance.line || 'N/A',
      hours_worked: attendance.hours_worked || 0,
      late_minutes: attendance.late_minutes || 0,
      undertime_minutes: attendance.undertime_minutes || 0,
      overtime: attendance.overtime || 0,
      travel_order: attendance.travel_order || 0,
      slvl: attendance.slvl || 0,
      trip: attendance.trip || 0,
      ct: attendance.ct || false,
      cs: attendance.cs || false,
      holiday: attendance.holiday || 0,
      ot_reg_holiday: attendance.ot_reg_holiday || 0,
      ot_special_holiday: attendance.ot_special_holiday || 0,
      retromultiplier: attendance.retromultiplier || 1,
      restday: attendance.restday || false,
      offset: attendance.offset || 0,
      ob: attendance.ob || false,
      is_nightshift: attendance.is_nightshift || false,
      source: attendance.source || 'unknown',
      posting_status: attendance.posting_status || 'not_posted'
    }));
  };

  // Load attendance data with recalculation
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
      if (nightShiftFilter) params.append('night_shift_only', 'true');
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

  // Apply filters and reload data
  const applyFilters = async () => {
    setCurrentPage(1);
    await loadAttendanceData(true);
  };

  // Enhanced reset filters with auto-recalculation
  const resetFilters = async () => {
    setSearchTerm('');
    setDateFilter('');
    setDepartmentFilter('');
    setEditsOnlyFilter(false);
    setNightShiftFilter(false);
    setPostingStatusFilter('');
    setCurrentPage(1);
    
    setTimeout(async () => {
      await loadAttendanceData(true);
    }, 0);
  };

  // Handle download template functionality
  const handleDownloadTemplate = async () => {
    setExporting(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      
      // Add current filters to download
      if (searchTerm) params.append('search', searchTerm);
      if (dateFilter) params.append('date', dateFilter);
      if (departmentFilter) params.append('department', departmentFilter);
      if (editsOnlyFilter) params.append('edits_only', 'true');
      if (nightShiftFilter) params.append('night_shift_only', 'true');
      if (postingStatusFilter) params.append('posting_status', postingStatusFilter);
      
      const response = await fetch('/attendance/download-template?' + params.toString(), {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/octet-stream'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Download failed with status: ${response.status}`);
      }
      
      // Get the blob data
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with current date and filters
      const now = new Date();
      const dateString = now.toISOString().split('T')[0];
      let filename = `attendance_data_${dateString}`;
      
      // Add filter info to filename
      if (dateFilter) {
        filename += `_${dateFilter}`;
      }
      if (departmentFilter) {
        filename += `_${departmentFilter.replace(/\s+/g, '_')}`;
      }
      if (editsOnlyFilter) {
        filename += '_edited_only';
      }
      if (nightShiftFilter) {
        filename += '_night_shift';
      }
      
      link.download = `${filename}.csv`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess('Attendance data downloaded successfully');
      
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download attendance data: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  // Handle export functionality
  const handleExport = async () => {
    setExporting(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      
      // Add current filters to export
      if (searchTerm) params.append('search', searchTerm);
      if (dateFilter) params.append('date', dateFilter);
      if (departmentFilter) params.append('department', departmentFilter);
      if (editsOnlyFilter) params.append('edits_only', 'true');
      if (nightShiftFilter) params.append('night_shift_only', 'true');
      if (postingStatusFilter) params.append('posting_status', postingStatusFilter);
      
      const response = await fetch('/attendance/export?' + params.toString(), {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/octet-stream'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Export failed with status: ${response.status}`);
      }
      
      // Get the blob data
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with current date and filters
      const now = new Date();
      const dateString = now.toISOString().split('T')[0];
      let filename = `attendance_export_${dateString}`;
      
      // Add filter info to filename
      if (dateFilter) {
        filename += `_${dateFilter}`;
      }
      if (departmentFilter) {
        filename += `_${departmentFilter.replace(/\s+/g, '_')}`;
      }
      if (editsOnlyFilter) {
        filename += '_edited_only';
      }
      if (nightShiftFilter) {
        filename += '_night_shift';
      }
      
      link.download = `${filename}.csv`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess('Attendance data exported successfully');
      
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export attendance data: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  // Handle import functionality
  const handleImport = async () => {
    if (!importFile) {
      setError('Please select a file to import');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

      const response = await fetch('/attendance/import', {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Import failed with status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message || 'Import completed successfully');
        setShowImportModal(false);
        setImportFile(null);
        await loadAttendanceData(false);
      } else {
        setError('Import failed: ' + (data.message || 'Unknown error'));
        if (data.errors && data.errors.length > 0) {
          setError(data.message + '\n\nErrors:\n' + data.errors.slice(0, 5).join('\n'));
        }
      }

    } catch (err) {
      console.error('Import error:', err);
      setError('Failed to import attendance data: ' + (err.message || 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  const handleSetHoliday = async () => {
    // Enhanced validation
    if (!holidayData.date) {
      setError('Please select a holiday date');
      return;
    }
    
    if (!holidayData.multiplier || isNaN(parseFloat(holidayData.multiplier))) {
      setError('Please provide a valid holiday multiplier');
      return;
    }

    const multiplierValue = parseFloat(holidayData.multiplier);
    if (multiplierValue < 0.1 || multiplierValue > 10) {
      setError('Holiday multiplier must be between 0.1 and 10');
      return;
    }

    setSettingHoliday(true);
    setError('');

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      if (!csrfToken) {
        setError('Session expired. Please refresh the page and try again.');
        setSettingHoliday(false);
        return;
      }

      // Prepare the request payload
      const requestData = {
        date: holidayData.date,
        multiplier: multiplierValue,
        department: holidayData.department || null,
        employee_ids: Array.isArray(holidayData.employee_ids) && holidayData.employee_ids.length > 0 
          ? holidayData.employee_ids 
          : null
      };

      console.log('Sending holiday request:', requestData); // Debug log

      const response = await fetch('/attendance/set-holiday', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      console.log('Response status:', response.status); // Debug log

      if (!response.ok) {
        // Handle different HTTP status codes
        if (response.status === 422) {
          const errorData = await response.json();
          console.error('Validation errors:', errorData);
          
          if (errorData.errors) {
            // Format validation errors
            const errorMessages = Object.values(errorData.errors).flat();
            setError('Validation failed: ' + errorMessages.join(', '));
          } else {
            setError('Validation failed: ' + (errorData.message || 'Invalid data provided'));
          }
          return;
        } else if (response.status === 404) {
          const errorData = await response.json();
          setError(errorData.message || 'No eligible attendance records found for the specified criteria');
          return;
        } else if (response.status >= 500) {
          setError('Server error occurred. Please try again later.');
          return;
        } else {
          throw new Error(`Request failed with status: ${response.status}`);
        }
      }

      const data = await response.json();
      console.log('Response data:', data); // Debug log

      if (data.success) {
        setSuccess(data.message || 'Holiday set successfully');
        setShowHolidayModal(false);
        
        // Reset holiday form data
        setHolidayData({
          date: '',
          multiplier: '2.0',
          department: '',
          employee_ids: []
        });
        
        // Reload attendance data
        await loadAttendanceData(false);
      } else {
        setError('Set holiday failed: ' + (data.message || 'Unknown error occurred'));
      }

    } catch (err) {
      console.error('Set holiday error:', err);
      
      // Handle different types of errors
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else if (err.message.includes('JSON')) {
        setError('Invalid response from server. Please try again.');
      } else {
        setError('Failed to set holiday: ' + (err.message || 'Unknown error occurred'));
      }
    } finally {
      setSettingHoliday(false);
    }
  };

  // Handle auto-recalculation
  const handleAutoRecalculate = async (showMessage = false) => {
    if (recalculating) return;
    
    setRecalculating(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      
      if (dateFilter) params.append('date', dateFilter);
      if (departmentFilter) params.append('department', departmentFilter);
      
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      const response = await fetch('/attendance/recalculate-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          date: dateFilter,
          department: departmentFilter
        })
      });
      
      if (!response.ok) {
        throw new Error(`Recalculation failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        if (showMessage && data.recalculated_count > 0) {
          setSuccess(`Recalculated ${data.recalculated_count} attendance records`);
        }
        
        await loadAttendanceData(false);
      } else {
        setError('Recalculation failed: ' + (data.message || 'Unknown error'));
      }
      
    } catch (err) {
      console.error('Recalculation error:', err);
      setError('Failed to recalculate attendance data: ' + (err.message || 'Unknown error'));
    } finally {
      setRecalculating(false);
    }
  };

  // Handle sync functionality
  const handleSync = async () => {
    if (syncing) return;
    
    setSyncing(true);
    setError('');
    
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      const response = await fetch('/attendance/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Sync failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message || 'Sync completed successfully');
        await loadAttendanceData(false);
      } else {
        setError('Sync failed: ' + (data.message || 'Unknown error'));
      }
      
    } catch (err) {
      console.error('Sync error:', err);
      setError('Failed to sync attendance data: ' + (err.message || 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  // Handle individual record sync
  const handleIndividualSync = async (attendanceId) => {
    try {
      setError('');
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      const response = await fetch(`/attendance/${attendanceId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Individual sync failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message || 'Record synced successfully');
        
        if (data.data) {
          setAttendances(prevAttendances => 
            prevAttendances.map(att => 
              att.id === attendanceId ? { ...att, ...data.data } : att
            )
          );
        }
      } else {
        setError('Individual sync failed: ' + (data.message || 'Unknown error'));
      }
      
    } catch (err) {
      console.error('Individual sync error:', err);
      setError('Failed to sync individual record: ' + (err.message || 'Unknown error'));
    }
  };

  // Handle attendance update
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
        trip: updatedAttendance.trip
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

  // Handle checkbox selection
  const handleCheckboxChange = (e, attendanceId) => {
    e.stopPropagation();
    
    if (e.target.checked) {
      setSelectedIds(prev => [...prev, attendanceId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== attendanceId));
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

  // Handle mouse interactions for hold-to-view functionality
  const handleMouseDown = (e, attendance) => {
    e.preventDefault();
    
    setIsHolding(true);
    
    const timer = setTimeout(() => {
      setSelectedAttendance(attendance);
      setShowInfoModal(true);
      setIsHolding(false);
    }, 1000);
    
    setHoldTimer(timer);
  };

  const handleMouseUp = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      setHoldTimer(null);
    }
    setIsHolding(false);
  };

  const handleMouseLeave = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      setHoldTimer(null);
    }
    setIsHolding(false);
  };

  // Handle row double-click for editing
  const handleRowDoubleClick = (e, attendance) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (holdTimer) {
      clearTimeout(holdTimer);
      setHoldTimer(null);
    }
    
    if (isEditingRef.current) return;
    
    if (editClickTimeoutRef.current) {
      clearTimeout(editClickTimeoutRef.current);
    }
    
    isEditingRef.current = true;
    
    setSelectedAttendance(attendance);
    setShowEditModal(true);
    
    editClickTimeoutRef.current = setTimeout(() => {
      isEditingRef.current = false;
    }, 500);
  };

  // Handle edit button click
  const handleEditClick = (e, attendance) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isEditingRef.current) return;
    
    if (editClickTimeoutRef.current) {
      clearTimeout(editClickTimeoutRef.current);
    }
    
    isEditingRef.current = true;
    
    setSelectedAttendance(attendance);
    setShowEditModal(true);
    
    editClickTimeoutRef.current = setTimeout(() => {
      isEditingRef.current = false;
    }, 500);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowEditModal(false);
    setShowInfoModal(false);
    setSelectedAttendance(null);
    
    isEditingRef.current = false;
    
    if (editClickTimeoutRef.current) {
      clearTimeout(editClickTimeoutRef.current);
    }
  };

  // Handle posting status changes
  const handlePostingStatusChange = async (action) => {
    if (selectedIds.length === 0) {
      setError('Please select attendance records first');
      return;
    }
    
    try {
      setError('');
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      const endpoint = action === 'mark_posted' ? '/attendance/mark-as-posted' : '/attendance/mark-as-not-posted';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          ids: selectedIds
        })
      });
      
      if (!response.ok) {
        throw new Error(`Status update failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        const statusText = action === 'mark_posted' ? 'posted' : 'not posted';
        setSuccess(`${selectedIds.length} records marked as ${statusText}`);
        
        const newStatus = action === 'mark_posted' ? 'posted' : 'not_posted';
        setAttendances(prevAttendances =>
          prevAttendances.map(att =>
            selectedIds.includes(att.id)
              ? { ...att, posting_status: newStatus }
              : att
          )
        );
        
        setSelectedIds([]);
        setSelectAll(false);
      } else {
        setError('Failed to update posting status: ' + (data.message || 'Unknown error'));
      }
      
    } catch (err) {
      console.error('Posting status update error:', err);
      setError('Failed to update posting status: ' + (err.message || 'Unknown error'));
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    try {
      setDeleting(true);
      setError('');
      
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      let requestBody = {};
      
      if (deleteMode === 'selected') {
        if (selectedIds.length === 0) {
          setError('Please select attendance records to delete');
          return;
        }
        requestBody = { ids: selectedIds };
      } else {
        if (!deleteRange.start_date || !deleteRange.end_date) {
          setError('Please provide both start and end dates');
          return;
        }
        requestBody = {
          start_date: deleteRange.start_date,
          end_date: deleteRange.end_date,
          employee_id: deleteRange.employee_id || null,
          department: deleteRange.department || null
        };
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
      
      if (!response.ok) {
        throw new Error(`Delete failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message || `Deleted ${data.deleted_count} records successfully`);
        
        await loadAttendanceData(false);
        
        setSelectedIds([]);
        setSelectAll(false);
        setShowDeleteModal(false);
        setDeleteRange({
          start_date: '',
          end_date: '',
          employee_id: '',
          department: ''
        });
      } else {
        setError('Delete failed: ' + (data.message || 'Unknown error'));
      }
      
    } catch (err) {
      console.error('Bulk delete error:', err);
      setError('Failed to delete records: ' + (err.message || 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  // Load departments for filter
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
      const time = new Date(timeString);
      return time.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (err) {
      return 'Invalid Time';
    }
  };

  // Format numeric values
  const formatNumeric = (value, decimals = 2) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = parseFloat(value);
    return isNaN(num) ? '-' : num.toFixed(decimals);
  };

  // Render late/undertime status
  const renderLateUndertime = (attendance) => {
    const lateMinutes = parseFloat(attendance.late_minutes || 0);
    const undertimeMinutes = parseFloat(attendance.undertime_minutes || 0);
    
    if (lateMinutes === 0 && undertimeMinutes === 0) {
      return (
        <div className="flex items-center space-x-1">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-600 font-medium">On Time</span>
        </div>
      );
    }
    
    return (
      <div className="space-y-1">
        {lateMinutes > 0 && (
          <div className="flex items-center space-x-1">
            <Clock className="h-3 w-3 text-red-500" />
            <span className="text-xs text-red-600">
              {Math.floor(lateMinutes / 60) > 0 ? `${Math.floor(lateMinutes / 60)}h ` : ''}
              {Math.round(lateMinutes % 60)}m late
            </span>
          </div>
        )}
        {undertimeMinutes > 0 && (
          <div className="flex items-center space-x-1">
            <AlertTriangle className="h-3 w-3 text-orange-500" />
            <span className="text-xs text-orange-600">
              {Math.floor(undertimeMinutes / 60) > 0 ? `${Math.floor(undertimeMinutes / 60)}h ` : ''}
              {Math.round(undertimeMinutes % 60)}m under
            </span>
          </div>
        )}
      </div>
    );
  };

  // Render night shift indicator
  const renderNightShift = (attendance) => {
    if (attendance.is_nightshift) {
      return (
        <div className="flex items-center space-x-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
          <Moon className="h-3 w-3" />
          <span>Night</span>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
        <Sun className="h-3 w-3" />
        <span>Day</span>
      </div>
    );
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

  // Render posting status
  const renderPostingStatus = (attendance) => {
    if (attendance.posting_status === 'posted') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Posted
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <AlertCircle className="h-3 w-3 mr-1" />
        Not Posted
      </span>
    );
  };

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
  }, [searchTerm, dateFilter, departmentFilter, editsOnlyFilter, nightShiftFilter]);

  // Initialize component data
  useEffect(() => {
    loadDepartments();
  }, []);

  // Handle page changes
  useEffect(() => {
    if (currentPage !== pagination.current_page) {
      loadAttendanceData(false);
    }
  }, [currentPage]);

  // Handle filter changes with debouncing
  useEffect(() => {
    const delayedApply = setTimeout(() => {
      if (searchTerm !== '' || dateFilter !== '' || departmentFilter !== '' || 
          editsOnlyFilter !== false || nightShiftFilter !== false || postingStatusFilter !== '') {
        applyFilters();
      }
    }, 500);

    return () => clearTimeout(delayedApply);
  }, [searchTerm]);

  // Apply filters immediately for other filter types
  useEffect(() => {
    applyFilters();
  }, [dateFilter, departmentFilter, editsOnlyFilter, nightShiftFilter, postingStatusFilter]);

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
                  onClick={handleDownloadTemplate}
                  disabled={exporting}
                  variant="outline"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                >
                  {exporting ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  {exporting ? 'Downloading...' : 'Download'}
                </Button>

                <Button
                  onClick={() => setShowImportModal(true)}
                  variant="outline"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Import
                </Button>

                <Button
                  onClick={() => setShowHolidayModal(true)}
                  variant="outline"
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                >
                  <Target className="h-4 w-4 mr-1" />
                  Set Holiday
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
                    <FileText className="h-4 w-4 mr-1" />
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
                
                {/* Second row of filters */}
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Import Attendance Data</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Upload a CSV file with attendance data. Hours will be automatically calculated.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <h4 className="font-medium mb-2">CSV Format Requirements:</h4>
                    <div className="space-y-1">
                      <p>• Employee Number, Employee Name, Department, Date, Day</p>
                      <p>• Time In, Break Out, Break In, Time Out, Next Day Timeout</p>
                      <p>• Hours Worked (will be recalculated), Night Shift, Trip</p>
                      <p>• Use the Download button to get the correct format</p>
                    </div>
                  </div>
                </div>
              </div>

              {importFile && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Selected file:</strong> {importFile.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Size: {(importFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => setShowImportModal(false)}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || !importFile}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {importing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Modal */}
      {showHolidayModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Set Holiday</h2>
              <button
                onClick={() => {
                  setShowHolidayModal(false);
                  setError(''); // Clear any errors when closing
                }}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
                disabled={settingHoliday}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Show any validation errors */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Holiday Date *
                  </label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="date"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      value={holidayData.date}
                      onChange={(e) => {
                        setHolidayData(prev => ({ ...prev, date: e.target.value }));
                        setError(''); // Clear error when user makes changes
                      }}
                      disabled={settingHoliday}
                      required
                    />
                  </div>
                  {!holidayData.date && (
                    <p className="mt-1 text-xs text-red-500">Holiday date is required</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Holiday Multiplier *
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={holidayData.multiplier}
                    onChange={(e) => {
                      setHolidayData(prev => ({ ...prev, multiplier: e.target.value }));
                      setError(''); // Clear error when user makes changes
                    }}
                    placeholder="2.0"
                    disabled={settingHoliday}
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Common values: 2.0 (Regular Holiday), 1.3 (Special Holiday)
                  </p>
                  {holidayData.multiplier && (isNaN(parseFloat(holidayData.multiplier)) || parseFloat(holidayData.multiplier) < 0.1 || parseFloat(holidayData.multiplier) > 10) && (
                    <p className="mt-1 text-xs text-red-500">Multiplier must be between 0.1 and 10</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department (Optional)
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={holidayData.department}
                    onChange={(e) => {
                      setHolidayData(prev => ({ ...prev, department: e.target.value }));
                      setError(''); // Clear error when user makes changes
                    }}
                    disabled={settingHoliday}
                  >
                    <option value="">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty to apply to all departments
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start">
                  <Target className="h-5 w-5 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="text-sm text-orange-800">
                    <h4 className="font-medium mb-2">Holiday Setting Rules:</h4>
                    <div className="space-y-1">
                      <p>• Only applies to employees without existing OT, OT Reg, or OT Spl</p>
                      <p>• Will update the holiday column with the specified multiplier</p>
                      <p>• Department filter is optional - leave empty for all departments</p>
                      <p>• Date must be specified to target the correct attendance records</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => {
                  setShowHolidayModal(false);
                  setError(''); // Clear error when canceling
                }}
                disabled={settingHoliday}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSetHoliday}
                disabled={
                  settingHoliday || 
                  !holidayData.date || 
                  !holidayData.multiplier ||
                  isNaN(parseFloat(holidayData.multiplier)) ||
                  parseFloat(holidayData.multiplier) < 0.1 ||
                  parseFloat(holidayData.multiplier) > 10
                }
                className="bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingHoliday ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Setting Holiday...
                  </>
                ) : (
                  <>
                    <Target className="h-4 w-4 mr-2" />
                    Set Holiday
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
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