import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import axios from 'axios';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { 
    Calendar, 
    List, 
    Search, 
    Filter, 
    ChevronDown, 
    Eye, 
    Edit2, 
    Trash2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    Users,
    CalendarDays,
    Download,
    Upload,
    FileSpreadsheet,
    Plus,
    RefreshCw,
    MoreHorizontal,
    Building,
    User,
    MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Modal from '@/Components/Modal';

// Simple Tabs Component
const Tabs = ({ children, defaultValue, className = "", onValueChange }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  
  useEffect(() => {
    if (onValueChange) {
      onValueChange(activeTab);
    }
  }, [activeTab, onValueChange]);
  
  return (
    <div className={className}>
      {React.Children.map(children, child => {
        if (child && (child.type === TabsList || child.type === TabsContent)) {
          return React.cloneElement(child, { activeTab, setActiveTab });
        }
        return child;
      })}
    </div>
  );
};

const TabsList = ({ children, activeTab, setActiveTab, className = "" }) => {
  return (
    <div className={`flex space-x-1 rounded-lg bg-gray-100 p-1 ${className}`}>
      {React.Children.map(children, child => {
        if (child && child.type === TabsTrigger) {
          return React.cloneElement(child, { activeTab, setActiveTab });
        }
        return child;
      })}
    </div>
  );
};

const TabsTrigger = ({ children, value, activeTab, setActiveTab }) => {
  const isActive = activeTab === value;
  
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
        isActive
          ? 'bg-white text-gray-900 shadow-sm' 
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ children, value, activeTab }) => {
  if (activeTab !== value) return null;
  
  return (
    <div className="mt-2">
      {children}
    </div>
  );
};

// Schedule Form Modal Component
const ScheduleFormModal = ({ isOpen, onClose, schedule, onSave, employees }) => {
    const [formData, setFormData] = useState({
        employee_id: '',
        shift_type: 'regular',
        start_time: '08:00',
        end_time: '17:00',
        break_start: '12:00',
        break_end: '13:00',
        work_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        effective_date: '',
        end_date: '',
        status: 'active',
        notes: ''
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (schedule) {
            setFormData({
                employee_id: schedule.employee_id || '',
                shift_type: schedule.shift_type || 'regular',
                start_time: schedule.start_time || '08:00',
                end_time: schedule.end_time || '17:00',
                break_start: schedule.break_start || '12:00',
                break_end: schedule.break_end || '13:00',
                work_days: schedule.work_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                effective_date: schedule.effective_date || '',
                end_date: schedule.end_date || '',
                status: schedule.status || 'active',
                notes: schedule.notes || ''
            });
        } else {
            setFormData({
                employee_id: '',
                shift_type: 'regular',
                start_time: '08:00',
                end_time: '17:00',
                break_start: '12:00',
                break_end: '13:00',
                work_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                effective_date: '',
                end_date: '',
                status: 'active',
                notes: ''
            });
        }
    }, [schedule]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Error saving schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleWorkDayChange = (day) => {
        setFormData(prev => ({
            ...prev,
            work_days: prev.work_days.includes(day)
                ? prev.work_days.filter(d => d !== day)
                : [...prev.work_days, day]
        }));
    };

    const workDayOptions = [
        { value: 'monday', label: 'Monday' },
        { value: 'tuesday', label: 'Tuesday' },
        { value: 'wednesday', label: 'Wednesday' },
        { value: 'thursday', label: 'Thursday' },
        { value: 'friday', label: 'Friday' },
        { value: 'saturday', label: 'Saturday' },
        { value: 'sunday', label: 'Sunday' }
    ];

    const shiftTypes = [
        { value: 'regular', label: 'Regular Shift' },
        { value: 'night', label: 'Night Shift' },
        { value: 'flexible', label: 'Flexible Shift' },
        { value: 'rotating', label: 'Rotating Shift' }
    ];

    return (
        <Modal show={isOpen} onClose={onClose} title={schedule ? 'Edit Schedule' : 'Create Schedule'}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Employee *
                        </label>
                        <select
                            value={formData.employee_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        >
                            <option value="">Select Employee</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.Fname} {emp.Lname} - {emp.idno}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Shift Type *
                        </label>
                        <select
                            value={formData.shift_type}
                            onChange={(e) => setFormData(prev => ({ ...prev, shift_type: e.target.value }))}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        >
                            {shiftTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Start Time *
                        </label>
                        <input
                            type="time"
                            value={formData.start_time}
                            onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            End Time *
                        </label>
                        <input
                            type="time"
                            value={formData.end_time}
                            onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Break Start
                        </label>
                        <input
                            type="time"
                            value={formData.break_start}
                            onChange={(e) => setFormData(prev => ({ ...prev, break_start: e.target.value }))}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Break End
                        </label>
                        <input
                            type="time"
                            value={formData.break_end}
                            onChange={(e) => setFormData(prev => ({ ...prev, break_end: e.target.value }))}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Effective Date *
                        </label>
                        <input
                            type="date"
                            value={formData.effective_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, effective_date: e.target.value }))}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={formData.end_date}
                            onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Work Days *
                    </label>
                    <div className="grid grid-cols-7 gap-2">
                        {workDayOptions.map(day => (
                            <label key={day.value} className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={formData.work_days.includes(day.value)}
                                    onChange={() => handleWorkDayChange(day.value)}
                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                />
                                <span className="text-sm">{day.label.slice(0, 3)}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status *
                    </label>
                    <select
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                    >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes
                    </label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Additional notes..."
                    />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                {schedule ? 'Update' : 'Create'} Schedule
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

// Import Modal Component
const ImportModal = ({ isOpen, onClose, onImport }) => {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const requiredColumns = [
        'employee_no', 'shift_type', 'start_time', 'end_time', 
        'break_start', 'break_end', 'work_days', 'effective_date', 'status'
    ];

    const handleFileChange = useCallback(async (selectedFile) => {
        if (!selectedFile) return;

        // Validate file type
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv'
        ];

        if (!allowedTypes.includes(selectedFile.type) && 
            !selectedFile.name.endsWith('.csv') && 
            !selectedFile.name.endsWith('.xlsx') && 
            !selectedFile.name.endsWith('.xls')) {
            Swal.fire('Error', 'Please upload only Excel or CSV files', 'error');
            return;
        }

        setFile(selectedFile);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let jsonData;
                
                if (selectedFile.name.endsWith('.csv')) {
                    const csvText = e.target.result;
                    const result = Papa.parse(csvText, { 
                        header: false,
                        skipEmptyLines: true
                    });
                    jsonData = result.data;
                } else {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                }
                
                if (!jsonData[0] || jsonData[0].length === 0) {
                    throw new Error('File appears to be empty');
                }

                const previewData = jsonData.slice(0, 6);
                setPreview(previewData);
            } catch (error) {
                console.error('File reading error:', error);
                Swal.fire('Error', 'Error reading file. Please make sure it\'s a valid file.', 'error');
                setFile(null);
            }
        };

        if (selectedFile.name.endsWith('.csv')) {
            reader.readAsText(selectedFile);
        } else {
            reader.readAsArrayBuffer(selectedFile);
        }
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            await handleFileChange(files[0]);
        }
    }, [handleFileChange]);

    const handleImport = async () => {
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            await onImport(formData);
            setFile(null);
            setPreview([]);
            onClose();
        } catch (error) {
            console.error('Import error:', error);
        } finally {
            setUploading(false);
        }
    };

    return (
        <Modal show={isOpen} onClose={onClose} title="Import Employee Schedules">
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">Required Columns:</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {requiredColumns.map((col) => (
                            <div key={col} className="flex items-center text-sm text-blue-700">
                                <div className="w-2 h-2 bg-blue-400 rounded-full mr-2" />
                                {col}
                            </div>
                        ))}
                    </div>
                </div>

                <div 
                    className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                        isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                    }`}
                    onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        onChange={(e) => handleFileChange(e.target.files[0])}
                        className="hidden"
                        id="schedule-file-upload"
                        accept=".xlsx,.xls,.csv"
                    />
                    <label htmlFor="schedule-file-upload" className="cursor-pointer flex flex-col items-center">
                        <Upload className={`h-12 w-12 mb-4 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className={`text-center ${isDragOver ? 'text-blue-600' : 'text-gray-600'}`}>
                            {file ? (
                                <div className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5" />
                                    {file.name}
                                </div>
                            ) : isDragOver ? (
                                'Drop your file here'
                            ) : (
                                'Drop your Excel file here or click to browse'
                            )}
                        </span>
                        {!file && (
                            <span className="text-sm text-gray-500 mt-2">
                                Supports .xlsx, .xls, and .csv files
                            </span>
                        )}
                    </label>
                </div>

                {preview.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {preview[0].map((header, index) => (
                                            <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {preview.slice(1).map((row, rowIndex) => (
                                        <tr key={rowIndex}>
                                            {row.map((cell, cellIndex) => (
                                                <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleImport} disabled={!file || uploading}>
                        {uploading ? (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Import Schedules
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// Summary Card Component
const SummaryCard = ({ icon, title, count, color }) => (
    <Card className="border-t-4 shadow-md hover:shadow-lg transition-shadow duration-200" style={{ borderTopColor: color }}>
        <CardContent className="p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <p className="text-2xl font-bold">{count}</p>
                </div>
                <div className={`p-3 rounded-full`} style={{ backgroundColor: `${color}20` }}>
                    {icon}
                </div>
            </div>
        </CardContent>
    </Card>
);

// Main Employee Scheduling Component
const EmployeeScheduling = () => {
    const { auth, flash } = usePage().props;
    
    // State management
    const [schedules, setSchedules] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [shiftFilter, setShiftFilter] = useState('');
    const [departments, setDepartments] = useState([]);
    const [filterOpen, setFilterOpen] = useState(false);
    const [displayView, setDisplayView] = useState('list');
    const [error, setError] = useState(null);
    
    // Modal states
    const [scheduleFormModalOpen, setScheduleFormModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState(null);

    const calendarRef = useRef(null);

    // Fetch data on component mount
    useEffect(() => {
        fetchData();
        fetchEmployees();
        fetchDepartments();
    }, [searchTerm, departmentFilter, statusFilter, shiftFilter]);

    // Fetch schedules data
    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await axios.get('/employee-schedules/list', {
                params: {
                    search: searchTerm,
                    department: departmentFilter,
                    status: statusFilter,
                    shift_type: shiftFilter
                }
            });

            const fetchedSchedules = response.data.schedules || [];
            setSchedules(fetchedSchedules);
            
            // Process schedules for calendar display
            const events = processSchedulesForCalendar(fetchedSchedules);
            setCalendarEvents(events);
            
        } catch (error) {
            console.error('Error fetching schedules:', error);
            setError('Failed to load schedule data. Please try again later.');
            Swal.fire('Error', 'Failed to load schedule data.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch employees
    const fetchEmployees = async () => {
        try {
            const response = await axios.get('/api/employees');
            setEmployees(response.data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    // Fetch departments
    const fetchDepartments = async () => {
        try {
            const response = await axios.get('/departments');
            setDepartments(response.data || []);
        } catch (error) {
            console.error('Error fetching departments:', error);
        }
    };

    // Process schedules for calendar display
    const processSchedulesForCalendar = (schedules) => {
        return schedules.map(schedule => {
            const startDate = new Date(schedule.effective_date);
            const endDate = schedule.end_date ? new Date(schedule.end_date) : null;
            
            return {
                id: `schedule_${schedule.id}`,
                title: `${schedule.employee?.Fname} ${schedule.employee?.Lname} - ${schedule.shift_type}`,
                start: startDate,
                end: endDate,
                allDay: true,
                extendedProps: {
                    schedule: schedule,
                    type: 'schedule'
                },
                backgroundColor: getScheduleColor(schedule.shift_type, schedule.status),
                borderColor: getScheduleColor(schedule.shift_type, schedule.status),
                display: 'block'
            };
        });
    };

    // Get color based on shift type and status
    const getScheduleColor = (shiftType, status) => {
        if (status === 'inactive') return '#ef4444';
        if (status === 'pending') return '#f59e0b';
        
        const colors = {
            'regular': '#10b981',
            'night': '#8b5cf6',
            'flexible': '#3b82f6',
            'rotating': '#f97316'
        };
        return colors[shiftType] || '#6b7280';
    };

    // Handle schedule save
    const handleScheduleSave = async (formData) => {
        try {
            if (selectedSchedule) {
                await axios.put(`/employee-schedules/${selectedSchedule.id}`, formData);
                Swal.fire('Success', 'Schedule updated successfully!', 'success');
            } else {
                await axios.post('/employee-schedules', formData);
                Swal.fire('Success', 'Schedule created successfully!', 'success');
            }
            
            fetchData();
            setSelectedSchedule(null);
        } catch (error) {
            console.error('Error saving schedule:', error);
            Swal.fire('Error', 'Failed to save schedule.', 'error');
            throw error;
        }
    };

    // Handle schedule deletion
    const handleScheduleDelete = async (scheduleId) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`/employee-schedules/${scheduleId}`);
                Swal.fire('Deleted!', 'Schedule has been deleted.', 'success');
                fetchData();
            } catch (error) {
                console.error('Error deleting schedule:', error);
                Swal.fire('Error', 'Failed to delete schedule.', 'error');
            }
        }
    };

    // Handle import
    const handleImport = async (formData) => {
        try {
            const response = await axios.post('/employee-schedules/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            Swal.fire('Success', 'Schedules imported successfully!', 'success');
            fetchData();
        } catch (error) {
            console.error('Import error:', error);
            Swal.fire('Error', 'Failed to import schedules.', 'error');
            throw error;
        }
    };

    // Handle export
    const handleExport = async () => {
        try {
            const response = await axios.get('/employee-schedules/export', {
                responseType: 'blob',
                params: {
                    search: searchTerm,
                    department: departmentFilter,
                    status: statusFilter,
                    shift_type: shiftFilter
                }
            });
            
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `employee-schedules-${new Date().toISOString().split('T')[0]}.xlsx`;
            link.click();
            window.URL.revokeObjectURL(url);
            
            Swal.fire('Success', 'Schedules exported successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            Swal.fire('Error', 'Failed to export schedules.', 'error');
        }
    };

    // Handle template download
    const handleDownloadTemplate = async () => {
        try {
            const response = await axios.get('/employee-schedules/template/download', {
                responseType: 'blob'
            });
            
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'employee-schedules-template.xlsx';
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Template download error:', error);
            Swal.fire('Error', 'Failed to download template.', 'error');
        }
    };

    // Handle calendar event click
    const handleCalendarEventClick = (info) => {
        const schedule = info.event.extendedProps.schedule;
        setSelectedSchedule(schedule);
        setScheduleFormModalOpen(true);
    };

    // Get summary statistics
    const getSummaryStats = () => {
        const active = schedules.filter(s => s.status === 'active').length;
        const inactive = schedules.filter(s => s.status === 'inactive').length;
        const pending = schedules.filter(s => s.status === 'pending').length;
        const regular = schedules.filter(s => s.shift_type === 'regular').length;
        const night = schedules.filter(s => s.shift_type === 'night').length;
        
        return {
            total: schedules.length,
            active,
            inactive,
            pending,
            regular,
            night
        };
    };

    const stats = getSummaryStats();

    // Format time for display
    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${period}`;
    };

    // Format work days for display
    const formatWorkDays = (workDays) => {
        if (!workDays) return '';
        if (typeof workDays === 'string') {
            try {
                workDays = JSON.parse(workDays);
            } catch {
                return workDays;
            }
        }
        if (Array.isArray(workDays)) {
            return workDays.map(day => day.charAt(0).toUpperCase() + day.slice(1, 3)).join(', ');
        }
        return '';
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Employee Scheduling" />
            <div className="flex min-h-screen bg-gray-50">
                <Sidebar />
                <div className="flex-1 p-6">
                    <div className="max-w-7xl mx-auto">
                        {flash?.message && (
                            <Alert className="mb-6">
                                <AlertDescription>{flash.message}</AlertDescription>
                            </Alert>
                        )}

                        {error && (
                            <Alert className="mb-6 bg-red-50 border border-red-200 text-red-800">
                                <AlertDescription className="text-red-700">{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Header Section */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center">
                                        <CalendarDays className="h-6 w-6 mr-2 text-indigo-600" />
                                        Employee Scheduling
                                    </h1>
                                    <p className="text-gray-600">
                                        Manage employee work schedules, shifts, and time assignments.
                                    </p>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <Button
                                        onClick={handleDownloadTemplate}
                                        variant="outline"
                                        className="shadow-sm"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Template
                                    </Button>
                                    <Button
                                        onClick={() => setImportModalOpen(true)}
                                        variant="outline"
                                        className="shadow-sm"
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Import
                                    </Button>
                                    <Button
                                        onClick={handleExport}
                                        variant="outline"
                                        className="shadow-sm"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Export
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setSelectedSchedule(null);
                                            setScheduleFormModalOpen(true);
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        New Schedule
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                            <SummaryCard 
                                icon={<Users className="h-5 w-5 text-indigo-600" />} 
                                title="Total Schedules" 
                                count={stats.total}
                                color="#6366f1"
                            />
                            <SummaryCard 
                                icon={<CheckCircle className="h-5 w-5 text-emerald-600" />} 
                                title="Active" 
                                count={stats.active}
                                color="#10b981"
                            />
                            <SummaryCard 
                                icon={<XCircle className="h-5 w-5 text-red-600" />} 
                                title="Inactive" 
                                count={stats.inactive}
                                color="#ef4444"
                            />
                            <SummaryCard 
                                icon={<Clock className="h-5 w-5 text-amber-600" />} 
                                title="Pending" 
                                count={stats.pending}
                                color="#f59e0b"
                            />
                            <SummaryCard 
                                icon={<Calendar className="h-5 w-5 text-emerald-600" />} 
                                title="Regular Shift" 
                                count={stats.regular}
                                color="#10b981"
                            />
                            <SummaryCard 
                                icon={<Calendar className="h-5 w-5 text-purple-600" />} 
                                title="Night Shift" 
                                count={stats.night}
                                color="#8b5cf6"
                            />
                        </div>

                        {/* Filter Section */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <div className="relative flex-grow">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <input
                                        type="text"
                                        placeholder="Search employees, departments..."
                                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                
                                <div className="inline-flex">
                                    <Button
                                        variant="outline"
                                        onClick={() => setFilterOpen(!filterOpen)}
                                        className="flex items-center shadow-sm hover:bg-gray-50"
                                    >
                                        <Filter className="h-4 w-4 mr-2 text-indigo-500" />
                                        Filters
                                        <ChevronDown className={`h-4 w-4 ml-2 transform ${filterOpen ? 'rotate-180' : ''} text-indigo-500`} />
                                    </Button>
                                    
                                    <Tabs
                                        defaultValue={displayView}
                                        onValueChange={setDisplayView}
                                        className="ml-4"
                                    >
                                        <TabsList className="bg-gray-100 shadow-inner">
                                            <TabsTrigger value="list">
                                                <List className="h-4 w-4 mr-1" />
                                                List
                                            </TabsTrigger>
                                            <TabsTrigger value="calendar">
                                                <Calendar className="h-4 w-4 mr-1" />
                                                Calendar
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>
                            </div>
                            
                            {filterOpen && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                                    <div>
                                        <label htmlFor="departmentFilter" className="block text-sm font-medium text-gray-700 mb-1">
                                            Department
                                        </label>
                                        <select
                                            id="departmentFilter"
                                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                            value={departmentFilter}
                                            onChange={(e) => setDepartmentFilter(e.target.value)}
                                        >
                                            <option value="">All Departments</option>
                                            {departments.map((dept, index) => (
                                                <option key={index} value={dept.name || dept}>
                                                    {dept.name || dept}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">
                                            Status
                                        </label>
                                        <select
                                            id="statusFilter"
                                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                        >
                                            <option value="">All Statuses</option>
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                            <option value="pending">Pending</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="shiftFilter" className="block text-sm font-medium text-gray-700 mb-1">
                                            Shift Type
                                        </label>
                                        <select
                                            id="shiftFilter"
                                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                            value={shiftFilter}
                                            onChange={(e) => setShiftFilter(e.target.value)}
                                        >
                                            <option value="">All Shifts</option>
                                            <option value="regular">Regular Shift</option>
                                            <option value="night">Night Shift</option>
                                            <option value="flexible">Flexible Shift</option>
                                            <option value="rotating">Rotating Shift</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Content Section */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <Tabs value={displayView} onValueChange={setDisplayView}>
                                <TabsContent value="list">
                                    {isLoading ? (
                                        <div className="h-96 flex items-center justify-center">
                                            <div className="text-center">
                                                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                                <p className="mt-2 text-gray-600">Loading schedules...</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Employee
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Department
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Shift Type
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Work Time
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Work Days
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Status
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Effective Date
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {schedules.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                                                                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                                                <p className="text-lg font-medium">No schedules found</p>
                                                                <p className="text-sm">Create a new schedule to get started.</p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        schedules.map((schedule) => (
                                                            <tr key={schedule.id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center">
                                                                        <div className="flex-shrink-0 h-10 w-10">
                                                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                                                                <User className="h-5 w-5 text-indigo-600" />
                                                                            </div>
                                                                        </div>
                                                                        <div className="ml-4">
                                                                            <div className="text-sm font-medium text-gray-900">
                                                                                {schedule.employee?.Fname} {schedule.employee?.Lname}
                                                                            </div>
                                                                            <div className="text-sm text-gray-500">
                                                                                ID: {schedule.employee?.idno}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center text-sm text-gray-900">
                                                                        <Building className="h-4 w-4 mr-2 text-gray-400" />
                                                                        {schedule.employee?.Department || 'N/A'}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                                        schedule.shift_type === 'regular' ? 'bg-green-100 text-green-800' :
                                                                        schedule.shift_type === 'night' ? 'bg-purple-100 text-purple-800' :
                                                                        schedule.shift_type === 'flexible' ? 'bg-blue-100 text-blue-800' :
                                                                        'bg-orange-100 text-orange-800'
                                                                    }`}>
                                                                        {schedule.shift_type?.charAt(0).toUpperCase() + schedule.shift_type?.slice(1)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                    <div className="flex items-center">
                                                                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                                                                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                    {formatWorkDays(schedule.work_days)}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                                        schedule.status === 'active' ? 'bg-green-100 text-green-800' :
                                                                        schedule.status === 'inactive' ? 'bg-red-100 text-red-800' :
                                                                        'bg-yellow-100 text-yellow-800'
                                                                    }`}>
                                                                        {schedule.status?.charAt(0).toUpperCase() + schedule.status?.slice(1)}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                    {new Date(schedule.effective_date).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                    <div className="flex items-center space-x-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                setSelectedSchedule(schedule);
                                                                                setScheduleFormModalOpen(true);
                                                                            }}
                                                                        >
                                                                            <Edit2 className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => handleScheduleDelete(schedule.id)}
                                                                            className="text-red-600 hover:text-red-700 hover:border-red-300"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="calendar">
                                    {isLoading ? (
                                        <div className="h-96 flex items-center justify-center">
                                            <div className="text-center">
                                                <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                                <p className="mt-2 text-gray-600">Loading calendar...</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-6">
                                            <div className="calendar-wrapper rounded-lg overflow-hidden">
                                                <FullCalendar
                                                    ref={calendarRef}
                                                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                                                    initialView="dayGridMonth"
                                                    headerToolbar={{
                                                        left: 'prev,next today',
                                                        center: 'title',
                                                        right: 'dayGridMonth,timeGridWeek,listMonth'
                                                    }}
                                                    events={calendarEvents}
                                                    eventClick={handleCalendarEventClick}
                                                    height="auto"
                                                    contentHeight={600}
                                                    dayMaxEvents={3}
                                                    eventTimeFormat={{
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        meridiem: true
                                                    }}
                                                    buttonText={{
                                                        today: 'Today',
                                                        month: 'Month',
                                                        week: 'Week',
                                                        list: 'List'
                                                    }}
                                                />
                                            </div>
                                            
                                            {/* Calendar Legend */}
                                            <div className="flex flex-wrap gap-4 mt-4 p-4 bg-white rounded-lg border border-gray-100 shadow-sm text-sm">
                                                <div className="flex items-center">
                                                    <span className="inline-block w-4 h-4 mr-2 rounded-full bg-green-500 shadow-sm"></span>
                                                    <span className="text-gray-700">Regular Shift</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className="inline-block w-4 h-4 mr-2 rounded-full bg-purple-500 shadow-sm"></span>
                                                    <span className="text-gray-700">Night Shift</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className="inline-block w-4 h-4 mr-2 rounded-full bg-blue-500 shadow-sm"></span>
                                                    <span className="text-gray-700">Flexible Shift</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className="inline-block w-4 h-4 mr-2 rounded-full bg-orange-500 shadow-sm"></span>
                                                    <span className="text-gray-700">Rotating Shift</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className="inline-block w-4 h-4 mr-2 rounded-full bg-red-500 shadow-sm"></span>
                                                    <span className="text-gray-700">Inactive</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className="inline-block w-4 h-4 mr-2 rounded-full bg-yellow-500 shadow-sm"></span>
                                                    <span className="text-gray-700">Pending</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* Schedule Form Modal */}
                        <ScheduleFormModal
                            isOpen={scheduleFormModalOpen}
                            onClose={() => {
                                setScheduleFormModalOpen(false);
                                setSelectedSchedule(null);
                            }}
                            schedule={selectedSchedule}
                            onSave={handleScheduleSave}
                            employees={employees}
                        />

                        {/* Import Modal */}
                        <ImportModal
                            isOpen={importModalOpen}
                            onClose={() => setImportModalOpen(false)}
                            onImport={handleImport}
                        />
                    </div>
                </div>
            </div>
            
            {/* Custom styles for FullCalendar */}
            <style jsx global>{`
                .fc .fc-button-primary {
                    background-color: #4f46e5;
                    border-color: #4f46e5;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }
                
                .fc .fc-button-primary:hover {
                    background-color: #4338ca;
                    border-color: #4338ca;
                }
                
                .fc .fc-button-primary:disabled {
                    background-color: #6366f1;
                    border-color: #6366f1;
                    opacity: 0.7;
                }
                
                .fc .fc-daygrid-day-top {
                    padding: 6px;
                }
                
                .fc .fc-daygrid-day-number {
                    font-size: 0.9rem;
                    font-weight: 500;
                }
                
                .fc .fc-toolbar-title {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #1f2937;
                }
                
                .fc .fc-day-today {
                    background-color: rgba(79, 70, 229, 0.06) !important;
                }
                
                .fc .fc-event {
                    font-size: 0.75rem;
                    border-radius: 4px;
                    padding: 2px 4px;
                }
                
                .fc-theme-standard td, .fc-theme-standard th {
                    border-color: #e5e7eb;
                }
                
                .fc-theme-standard .fc-scrollgrid {
                    border-color: #e5e7eb;
                }
                
                @media (max-width: 768px) {
                    .fc .fc-toolbar-title {
                        font-size: 1.1rem;
                    }
                    
                    .fc .fc-daygrid-day-number {
                        font-size: 0.8rem;
                    }
                }
            `}</style>
        </AuthenticatedLayout>
    );
};

export default EmployeeScheduling;