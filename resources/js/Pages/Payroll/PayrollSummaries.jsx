import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  Filter, 
  Download, 
  Trash2, 
  RefreshCw, 
  Users, 
  Calculator, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Target, 
  Eye, 
  X, 
  User, 
  Building, 
  Car, 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  PieChart, 
  Award, 
  Briefcase, 
  MapPin, 
  Phone, 
  Mail, 
  Edit, 
  Save, 
  XCircle, // Using XCircle instead of Cancel
  Plus 
} from 'lucide-react';

// Complete Payroll Summaries Component with Sample Data
const CompletePayrollSummaries = () => {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [departments] = useState([
    'Production', 'Quality Control', 'Maintenance', 'Administration', 
    'Sales', 'Finance', 'Human Resources', 'Security'
  ]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(25);
  
  // Statistics
  const [statistics, setStatistics] = useState({
    total_summaries: 42,
    total_days_worked: 378.5,
    total_ot_hours: 156.75,
    total_late_under_minutes: 2340,
    total_nsd_hours: 89.25,
    total_slvl_days: 12.5,
    avg_days_worked: 9.0,
    avg_ot_hours: 3.73
  });

  // Detail modal state
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Sample payroll summaries data
  const sampleSummaries = [
    {
      id: 1,
      employee_id: 101,
      employee_no: 'EMP001',
      employee_name: 'Juan Carlos Dela Cruz',
      cost_center: 'CC001',
      department: 'Production',
      line: 'Line A',
      period_start: '2025-01-01',
      period_end: '2025-01-15',
      period_type: '1st_half',
      year: 2025,
      month: 1,
      days_worked: 10.0,
      ot_hours: 8.5,
      off_days: 1.0,
      late_under_minutes: 120,
      nsd_hours: 4.5,
      slvl_days: 0.0,
      retro: 0.0,
      travel_order_hours: 0.0,
      holiday_hours: 8.0,
      ot_reg_holiday_hours: 0.0,
      ot_special_holiday_hours: 0.0,
      offset_hours: 0.0,
      trip_count: 0.0,
      has_ct: false,
      has_cs: false,
      has_ob: false,
      status: 'posted',
      posted_at: '2025-01-16T08:30:00Z',
      posted_by: { id: 1, name: 'HR Manager' },
      // New deduction columns
      advance: 2500.00,
      charge_store: 150.00,
      charge: 0.00,
      meals: 800.00,
      miscellaneous: 0.00,
      other_deductions: 0.00,
      // New benefit columns
      mf_shares: 500.00,
      mf_loan: 1200.00,
      sss_loan: 0.00,
      hmdf_loan: 0.00,
      hmdf_prem: 125.00,
      sss_prem: 580.00,
      philhealth: 220.00,
      allowances: 1500.00
    },
    {
      id: 2,
      employee_id: 102,
      employee_no: 'EMP002',
      employee_name: 'Maria Santos Rodriguez',
      cost_center: 'CC002',
      department: 'Quality Control',
      line: 'QC Lab',
      period_start: '2025-01-01',
      period_end: '2025-01-15',
      period_type: '1st_half',
      year: 2025,
      month: 1,
      days_worked: 9.5,
      ot_hours: 6.0,
      off_days: 0.5,
      late_under_minutes: 45,
      nsd_hours: 0.0,
      slvl_days: 0.5,
      retro: 1250.00,
      travel_order_hours: 8.0,
      holiday_hours: 8.0,
      ot_reg_holiday_hours: 4.0,
      ot_special_holiday_hours: 0.0,
      offset_hours: 2.0,
      trip_count: 1.0,
      has_ct: true,
      has_cs: false,
      has_ob: true,
      status: 'posted',
      posted_at: '2025-01-16T09:15:00Z',
      posted_by: { id: 1, name: 'HR Manager' },
      advance: 1000.00,
      charge_store: 350.00,
      charge: 200.00,
      meals: 750.00,
      miscellaneous: 100.00,
      other_deductions: 0.00,
      mf_shares: 500.00,
      mf_loan: 800.00,
      sss_loan: 2500.00,
      hmdf_loan: 1500.00,
      hmdf_prem: 125.00,
      sss_prem: 580.00,
      philhealth: 220.00,
      allowances: 2000.00
    },
    {
      id: 3,
      employee_id: 103,
      employee_no: 'EMP003',
      employee_name: 'Robert Chen Lim',
      cost_center: 'CC001',
      department: 'Maintenance',
      line: 'Facilities',
      period_start: '2025-01-01',
      period_end: '2025-01-15',
      period_type: '1st_half',
      year: 2025,
      month: 1,
      days_worked: 10.0,
      ot_hours: 12.5,
      off_days: 2.0,
      late_under_minutes: 0,
      nsd_hours: 8.0,
      slvl_days: 0.0,
      retro: 0.0,
      travel_order_hours: 0.0,
      holiday_hours: 8.0,
      ot_reg_holiday_hours: 0.0,
      ot_special_holiday_hours: 2.0,
      offset_hours: 0.0,
      trip_count: 0.0,
      has_ct: false,
      has_cs: true,
      has_ob: false,
      status: 'draft',
      posted_at: null,
      posted_by: null,
      advance: 0.00,
      charge_store: 200.00,
      charge: 0.00,
      meals: 900.00,
      miscellaneous: 0.00,
      other_deductions: 150.00,
      mf_shares: 500.00,
      mf_loan: 0.00,
      sss_loan: 0.00,
      hmdf_loan: 0.00,
      hmdf_prem: 125.00,
      sss_prem: 580.00,
      philhealth: 220.00,
      allowances: 1200.00
    },
    {
      id: 4,
      employee_id: 104,
      employee_no: 'EMP004',
      employee_name: 'Anna Mae Gonzales',
      cost_center: 'CC003',
      department: 'Administration',
      line: 'Admin Support',
      period_start: '2025-01-01',
      period_end: '2025-01-15',
      period_type: '1st_half',
      year: 2025,
      month: 1,
      days_worked: 9.0,
      ot_hours: 2.0,
      off_days: 0.0,
      late_under_minutes: 180,
      nsd_hours: 0.0,
      slvl_days: 1.0,
      retro: 500.00,
      travel_order_hours: 4.0,
      holiday_hours: 8.0,
      ot_reg_holiday_hours: 0.0,
      ot_special_holiday_hours: 0.0,
      offset_hours: 1.0,
      trip_count: 2.0,
      has_ct: false,
      has_cs: false,
      has_ob: true,
      status: 'posted',
      posted_at: '2025-01-16T10:45:00Z',
      posted_by: { id: 2, name: 'Finance Manager' },
      advance: 3000.00,
      charge_store: 450.00,
      charge: 100.00,
      meals: 650.00,
      miscellaneous: 200.00,
      other_deductions: 0.00,
      mf_shares: 500.00,
      mf_loan: 1500.00,
      sss_loan: 1000.00,
      hmdf_loan: 500.00,
      hmdf_prem: 125.00,
      sss_prem: 580.00,
      philhealth: 220.00,
      allowances: 1800.00
    },
    {
      id: 5,
      employee_id: 105,
      employee_no: 'EMP005',
      employee_name: 'Michael John Torres',
      cost_center: 'CC002',
      department: 'Sales',
      line: 'Field Sales',
      period_start: '2025-01-01',
      period_end: '2025-01-15',
      period_type: '1st_half',
      year: 2025,
      month: 1,
      days_worked: 8.5,
      ot_hours: 4.0,
      off_days: 0.0,
      late_under_minutes: 60,
      nsd_hours: 0.0,
      slvl_days: 1.5,
      retro: 2000.00,
      travel_order_hours: 16.0,
      holiday_hours: 8.0,
      ot_reg_holiday_hours: 0.0,
      ot_special_holiday_hours: 0.0,
      offset_hours: 0.0,
      trip_count: 8.0,
      has_ct: false,
      has_cs: false,
      has_ob: true,
      status: 'locked',
      posted_at: '2025-01-16T11:20:00Z',
      posted_by: { id: 1, name: 'HR Manager' },
      advance: 1500.00,
      charge_store: 100.00,
      charge: 300.00,
      meals: 1200.00,
      miscellaneous: 0.00,
      other_deductions: 250.00,
      mf_shares: 500.00,
      mf_loan: 2000.00,
      sss_loan: 0.00,
      hmdf_loan: 0.00,
      hmdf_prem: 125.00,
      sss_prem: 580.00,
      philhealth: 220.00,
      allowances: 3000.00
    }
  ];

  // Load sample data
  useEffect(() => {
    setSummaries(sampleSummaries);
    setTotalPages(1);
  }, []);

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

  // Format currency
  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '₱0.00';
    const num = parseFloat(value);
    return isNaN(num) ? '₱0.00' : `₱${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format minutes to hours for display
  const formatMinutesToHours = (minutes) => {
    if (!minutes || minutes === 0) return '0.00';
    const num = parseFloat(minutes);
    if (isNaN(num)) return '0.00';
    const hours = num / 60;
    return hours.toFixed(2);
  };

  // Handle row double-click
  const handleRowDoubleClick = (summary) => {
    setSelectedSummary(summary);
    setShowDetailModal(true);
  };

  // Calculate totals for selected summaries
  const calculateTotals = (summariesData) => {
    return summariesData.reduce((totals, summary) => ({
      total_deductions: totals.total_deductions + (parseFloat(summary.advance || 0) + 
        parseFloat(summary.charge_store || 0) + parseFloat(summary.charge || 0) + 
        parseFloat(summary.meals || 0) + parseFloat(summary.miscellaneous || 0) + 
        parseFloat(summary.other_deductions || 0) + parseFloat(summary.mf_loan || 0) + 
        parseFloat(summary.sss_loan || 0) + parseFloat(summary.hmdf_loan || 0) + 
        parseFloat(summary.hmdf_prem || 0) + parseFloat(summary.sss_prem || 0) + 
        parseFloat(summary.philhealth || 0)),
      total_benefits: totals.total_benefits + (parseFloat(summary.mf_shares || 0) + 
        parseFloat(summary.allowances || 0)),
      days_worked: totals.days_worked + parseFloat(summary.days_worked || 0),
      ot_hours: totals.ot_hours + parseFloat(summary.ot_hours || 0),
      late_under_minutes: totals.late_under_minutes + parseFloat(summary.late_under_minutes || 0)
    }), { total_deductions: 0, total_benefits: 0, days_worked: 0, ot_hours: 0, late_under_minutes: 0 });
  };

  const totals = calculateTotals(summaries);

  return (
    <div className="min-h-screen bg-gray-50/50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              💼 Payroll Summaries
            </h1>
            <p className="text-sm text-blue-600 mt-1">
              💡 Complete payroll summary with deductions, benefits, and attendance data
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setExporting(true)}
              disabled={exporting}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              {exporting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters Card */}
        <div className="bg-white rounded-lg shadow mb-4 p-6">
          <h3 className="text-lg font-semibold mb-4">🔍 Filters</h3>
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
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Employees</p>
                <p className="text-2xl font-bold text-gray-900">{summaries.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Days Worked</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumeric(totals.days_worked, 1)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total OT Hours</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumeric(totals.ot_hours)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Deductions</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.total_deductions)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Award className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Benefits</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.total_benefits)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table container */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">OT Hrs</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Late/Under</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">NSD</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">SLVL</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Retro</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Deductions</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Benefits</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summaries.map((summary) => {
                  const totalDeductions = parseFloat(summary.advance || 0) + 
                    parseFloat(summary.charge_store || 0) + parseFloat(summary.charge || 0) + 
                    parseFloat(summary.meals || 0) + parseFloat(summary.miscellaneous || 0) + 
                    parseFloat(summary.other_deductions || 0) + parseFloat(summary.mf_loan || 0) + 
                    parseFloat(summary.sss_loan || 0) + parseFloat(summary.hmdf_loan || 0) + 
                    parseFloat(summary.hmdf_prem || 0) + parseFloat(summary.sss_prem || 0) + 
                    parseFloat(summary.philhealth || 0);
                  
                  const totalBenefits = parseFloat(summary.mf_shares || 0) + 
                    parseFloat(summary.allowances || 0);

                  return (
                    <tr 
                      key={summary.id} 
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onDoubleClick={() => handleRowDoubleClick(summary)}
                      title="Double-click to view detailed information"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {summary.employee_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {summary.employee_no}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building className="h-4 w-4 text-gray-400 mr-2" />
                          <div>
                            <div className="text-sm text-gray-900">{summary.department}</div>
                            <div className="text-xs text-gray-500">{summary.line}</div>
                            <div className="text-xs text-gray-400">{summary.cost_center}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div className="font-medium">{summary.year}-{String(summary.month).padStart(2, '0')}</div>
                          <div className="text-xs">{summary.period_type === '1st_half' ? '1-15' : '16-30/31'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {formatNumeric(summary.days_worked, 1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {formatNumeric(summary.ot_hours)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Clock className="h-3 w-3 text-red-500" />
                          <span className="text-sm text-red-600 font-medium">
                            {formatMinutesToHours(summary.late_under_minutes)}h
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {formatNumeric(summary.nsd_hours)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {formatNumeric(summary.slvl_days, 1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-medium">
                        {formatCurrency(summary.retro)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm">
                          <div className="text-red-600 font-medium">{formatCurrency(totalDeductions)}</div>
                          <div className="text-xs text-gray-500">
                            A:{formatCurrency(summary.advance)} | 
                            S:{formatCurrency(summary.charge_store)} | 
                            M:{formatCurrency(summary.meals)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm">
                          <div className="text-green-600 font-medium">{formatCurrency(totalBenefits)}</div>
                          <div className="text-xs text-gray-500">
                            MF:{formatCurrency(summary.mf_shares)} | 
                            All:{formatCurrency(summary.allowances)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
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
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowDoubleClick(summary);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {summary.status !== 'locked' && (
                            <>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Modal */}
        {showDetailModal && selectedSummary && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="relative bg-white rounded-lg shadow-lg max-w-6xl w-full mx-4 max-h-[95vh] overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-semibold text-gray-800">
                    📋 Payroll Summary Details
                  </h2>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    selectedSummary?.status === 'posted' 
                      ? 'bg-green-100 text-green-800'
                      : selectedSummary?.status === 'locked'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedSummary?.status?.charAt(0).toUpperCase() + selectedSummary?.status?.slice(1)}
                  </span>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Employee Information */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Employee Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Full Name</label>
                      <p className="text-gray-900 font-medium text-lg">{selectedSummary.employee_name}</p>
                      <p className="text-sm text-gray-500">ID: {selectedSummary.employee_no}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Department</label>
                      <p className="text-gray-900 flex items-center">
                        <Building className="h-4 w-4 mr-1" />
                        {selectedSummary.department}
                      </p>
                      <p className="text-sm text-gray-500">Line: {selectedSummary.line}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Period</label>
                      <p className="text-gray-900">{selectedSummary.year}-{String(selectedSummary.month).padStart(2, '0')}</p>
                      <p className="text-sm text-gray-500">
                        {selectedSummary.period_type === '1st_half' ? '1st Half (1-15)' : '2nd Half (16-30/31)'}
                      </p>
                      <p className="text-xs text-gray-400">Cost Center: {selectedSummary.cost_center}</p>
                    </div>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="bg-green-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Calculator className="h-5 w-5 mr-2" />
                    Attendance Summary
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{formatNumeric(selectedSummary.days_worked, 1)}</div>
                      <div className="text-sm text-green-800">Days Worked</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">{formatNumeric(selectedSummary.ot_hours)}</div>
                      <div className="text-sm text-blue-800">OT Hours</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-orange-600">{formatMinutesToHours(selectedSummary.late_under_minutes)}</div>
                      <div className="text-sm text-orange-800">Late/Under (Hrs)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600">{formatNumeric(selectedSummary.nsd_hours)}</div>
                      <div className="text-sm text-purple-800">NSD Hours</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{formatNumeric(selectedSummary.slvl_days, 1)}</div>
                      <div className="text-sm text-red-800">SLVL Days</div>
                    </div>
                  </div>
                </div>

                {/* Financial Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Deductions */}
                  <div className="bg-red-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <DollarSign className="h-5 w-5 mr-2 text-red-600" />
                      Deductions
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Advance:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.advance)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Charge Store:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.charge_store)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Charge:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.charge)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Meals:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.meals)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">MF Loan:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.mf_loan)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">SSS Loan:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.sss_loan)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">HMDF Loan:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.hmdf_loan)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">HMDF Premium:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.hmdf_prem)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">SSS Premium:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.sss_prem)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">PhilHealth:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.philhealth)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Miscellaneous:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.miscellaneous)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Other Deductions:</span>
                        <span className="font-medium text-red-600">{formatCurrency(selectedSummary.other_deductions)}</span>
                      </div>
                      <div className="border-t border-red-200 pt-3">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span className="text-gray-800">Total Deductions:</span>
                          <span className="text-red-600">
                            {formatCurrency(
                              parseFloat(selectedSummary.advance || 0) + 
                              parseFloat(selectedSummary.charge_store || 0) + 
                              parseFloat(selectedSummary.charge || 0) + 
                              parseFloat(selectedSummary.meals || 0) + 
                              parseFloat(selectedSummary.miscellaneous || 0) + 
                              parseFloat(selectedSummary.other_deductions || 0) + 
                              parseFloat(selectedSummary.mf_loan || 0) + 
                              parseFloat(selectedSummary.sss_loan || 0) + 
                              parseFloat(selectedSummary.hmdf_loan || 0) + 
                              parseFloat(selectedSummary.hmdf_prem || 0) + 
                              parseFloat(selectedSummary.sss_prem || 0) + 
                              parseFloat(selectedSummary.philhealth || 0)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="bg-green-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <Award className="h-5 w-5 mr-2 text-green-600" />
                      Benefits & Allowances
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">MF Shares:</span>
                        <span className="font-medium text-green-600">{formatCurrency(selectedSummary.mf_shares)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Allowances:</span>
                        <span className="font-medium text-green-600">{formatCurrency(selectedSummary.allowances)}</span>
                      </div>
                      <div className="border-t border-green-200 pt-3">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span className="text-gray-800">Total Benefits:</span>
                          <span className="text-green-600">
                            {formatCurrency(
                              parseFloat(selectedSummary.mf_shares || 0) + 
                              parseFloat(selectedSummary.allowances || 0)
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="mt-6 pt-6 border-t border-green-200">
                      <h4 className="font-medium text-gray-900 mb-3">Additional Information</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Off Days:</span>
                          <span className="font-medium">{formatNumeric(selectedSummary.off_days, 1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Travel Order Hours:</span>
                          <span className="font-medium">{formatNumeric(selectedSummary.travel_order_hours)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Holiday Hours:</span>
                          <span className="font-medium">{formatNumeric(selectedSummary.holiday_hours)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">OT Reg Holiday:</span>
                          <span className="font-medium">{formatNumeric(selectedSummary.ot_reg_holiday_hours)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">OT Special Holiday:</span>
                          <span className="font-medium">{formatNumeric(selectedSummary.ot_special_holiday_hours)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Offset Hours:</span>
                          <span className="font-medium">{formatNumeric(selectedSummary.offset_hours)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center">
                            <Car className="h-3 w-3 mr-1" />
                            Trip Count:
                          </span>
                          <span className="font-medium">{formatNumeric(selectedSummary.trip_count, 1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Retro:</span>
                          <span className="font-medium">{formatCurrency(selectedSummary.retro)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Flags and Status */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Status Flags</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Has CT (Compensatory Time):</span>
                      <span className={selectedSummary.has_ct ? 'text-green-600' : 'text-gray-400'}>
                        {selectedSummary.has_ct ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Has CS (Compressed Schedule):</span>
                      <span className={selectedSummary.has_cs ? 'text-green-600' : 'text-gray-400'}>
                        {selectedSummary.has_cs ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Has OB (Official Business):</span>
                      <span className={selectedSummary.has_ob ? 'text-green-600' : 'text-gray-400'}>
                        {selectedSummary.has_ob ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                  </div>
                  
                  {selectedSummary.posted_at && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Posted At:</span>
                          <span className="font-medium">{formatDate(selectedSummary.posted_at)}</span>
                        </div>
                        {selectedSummary.posted_by && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Posted By:</span>
                            <span className="font-medium">{selectedSummary.posted_by.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end border-t">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompletePayrollSummaries;