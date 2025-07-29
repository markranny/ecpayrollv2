import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import { 
  Search, Calendar, Filter, Download, Trash2, RefreshCw, Users, 
  Calculator, FileText, AlertTriangle, CheckCircle, Clock, Target, 
  Eye, X, User, Building, DollarSign, TrendingUp, Edit, Check, 
  XCircle, Play, Pause, CreditCard, BarChart3, FileSpreadsheet,
  PlusCircle, Settings, Award, AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Final Payroll Detail Modal
const FinalPayrollDetailModal = ({ isOpen, payroll, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [calculationBreakdown, setCalculationBreakdown] = useState(null);

  useEffect(() => {
    if (isOpen && payroll) {
      setFormData({
        basic_rate: payroll.basic_rate || 0,
        pay_allowance: payroll.pay_allowance || 0,
        other_earnings: payroll.other_earnings || 0,
        advance_deduction: payroll.advance_deduction || 0,
        charge_store: payroll.charge_store || 0,
        charge_deduction: payroll.charge_deduction || 0,
        meals_deduction: payroll.meals_deduction || 0,
        miscellaneous_deduction: payroll.miscellaneous_deduction || 0,
        other_deductions: payroll.other_deductions || 0,
        calculation_notes: payroll.calculation_notes || ''
      });
      loadCalculationBreakdown();
    }
  }, [isOpen, payroll]);

  const loadCalculationBreakdown = async () => {
    try {
      const response = await fetch(`/final-payrolls/${payroll.id}/calculation-breakdown`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCalculationBreakdown(data.data);
        }
      }
    } catch (err) {
      console.error('Error loading calculation breakdown:', err);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatNumber = (num, decimals = 2) => {
    return parseFloat(num || 0).toFixed(decimals);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-lg max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-800">
              Final Payroll Details
            </h2>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              payroll?.status === 'paid' 
                ? 'bg-green-100 text-green-800'
                : payroll?.status === 'finalized'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {payroll?.status?.charAt(0).toUpperCase() + payroll?.status?.slice(1)}
            </span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              payroll?.approval_status === 'approved' 
                ? 'bg-green-100 text-green-800'
                : payroll?.approval_status === 'rejected'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {payroll?.approval_status?.charAt(0).toUpperCase() + payroll?.approval_status?.slice(1)}
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
          {/* Employee Information */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Employee Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Employee</label>
                <p className="text-gray-900 font-medium">{payroll?.employee_name}</p>
                <p className="text-sm text-gray-500">{payroll?.employee_no}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Department</label>
                <p className="text-gray-900">{payroll?.department}</p>
                <p className="text-sm text-gray-500">{payroll?.line}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Period</label>
                <p className="text-gray-900">
                  {/* FIXED: Proper period display */}
                  {payroll?.full_period || `${new Date(0, payroll?.month - 1).toLocaleString('default', { month: 'long' })} ${payroll?.year} (${payroll?.period_type === '1st_half' ? '1-15' : '16-30/31'})`}
                </p>
                <p className="text-sm text-gray-500">Cost Center: {payroll?.cost_center || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(payroll?.gross_earnings)}</div>
              <div className="text-sm text-green-800">Gross Earnings</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{formatCurrency(payroll?.total_deductions)}</div>
              <div className="text-sm text-red-800">Total Deductions</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(payroll?.net_pay)}</div>
              <div className="text-sm text-blue-800">Net Pay</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{formatNumber(payroll?.days_worked, 1)}</div>
              <div className="text-sm text-purple-800">Days Worked</div>
            </div>
          </div>

          {/* FIXED: Calculation breakdown with proper JSON formatting */}
          {calculationBreakdown && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <Calculator className="h-4 w-4 mr-2" />
                Calculation Breakdown
              </h4>
              
              <div className="space-y-4">
                {/* Basic Calculation */}
                <div className="bg-white p-3 rounded border">
                  <h5 className="font-medium text-gray-800 mb-2">Basic Calculation</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Pay Type:</span>
                      <span className="ml-2 font-medium">{calculationBreakdown.basic_calculation?.pay_type || 'daily'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Basic Rate:</span>
                      <span className="ml-2 font-medium">{formatCurrency(calculationBreakdown.basic_calculation?.basic_rate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Days/Hours:</span>
                      <span className="ml-2 font-medium">{formatNumber(calculationBreakdown.basic_calculation?.days_worked || calculationBreakdown.basic_calculation?.hours_worked, 2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Basic Pay:</span>
                      <span className="ml-2 font-medium text-green-600">{formatCurrency(calculationBreakdown.basic_calculation?.basic_pay)}</span>
                    </div>
                  </div>
                </div>

                {/* Overtime Calculation */}
                <div className="bg-white p-3 rounded border">
                  <h5 className="font-medium text-gray-800 mb-2">Overtime Calculation</h5>
                  <div className="space-y-2 text-sm">
                    {calculationBreakdown.overtime_calculation?.regular_ot && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Regular OT ({formatNumber(calculationBreakdown.overtime_calculation.regular_ot.hours)} hrs @ {calculationBreakdown.overtime_calculation.regular_ot.rate?.toFixed(2)}):</span>
                        <span className="font-medium">{formatCurrency(calculationBreakdown.overtime_calculation.regular_ot.amount)}</span>
                      </div>
                    )}
                    {calculationBreakdown.overtime_calculation?.rest_day_ot && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rest Day OT ({formatNumber(calculationBreakdown.overtime_calculation.rest_day_ot.hours)} hrs @ {calculationBreakdown.overtime_calculation.rest_day_ot.rate?.toFixed(2)}):</span>
                        <span className="font-medium">{formatCurrency(calculationBreakdown.overtime_calculation.rest_day_ot.amount)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deductions Calculation */}
                <div className="bg-white p-3 rounded border">
                  <h5 className="font-medium text-gray-800 mb-2">Deductions</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {calculationBreakdown.deductions_calculation?.government && (
                      <div>
                        <h6 className="font-medium text-gray-700 mb-1">Government</h6>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>SSS:</span>
                            <span>{formatCurrency(calculationBreakdown.deductions_calculation.government.sss)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>PhilHealth:</span>
                            <span>{formatCurrency(calculationBreakdown.deductions_calculation.government.philhealth)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>HDMF:</span>
                            <span>{formatCurrency(calculationBreakdown.deductions_calculation.government.hdmf)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>W/Tax:</span>
                            <span>{formatCurrency(calculationBreakdown.deductions_calculation.government.withholding_tax)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {calculationBreakdown.deductions_calculation?.other && (
                      <div>
                        <h6 className="font-medium text-gray-700 mb-1">Other Deductions</h6>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>Advance:</span>
                            <span>{formatCurrency(calculationBreakdown.deductions_calculation.other.advance)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Store:</span>
                            <span>{formatCurrency(calculationBreakdown.deductions_calculation.other.charge_store)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Meals:</span>
                            <span>{formatCurrency(calculationBreakdown.deductions_calculation.other.meals)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Late/Under:</span>
                            <span>{formatCurrency(calculationBreakdown.deductions_calculation.other.late_under)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary */}
                {calculationBreakdown.summary && (
                  <div className="bg-blue-50 p-3 rounded border">
                    <h5 className="font-medium text-gray-800 mb-2">Summary</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gross Earnings:</span>
                        <span className="font-bold text-green-600">{formatCurrency(calculationBreakdown.summary.gross_earnings)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Deductions:</span>
                        <span className="font-bold text-red-600">{formatCurrency(calculationBreakdown.summary.total_deductions)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Taxable Income:</span>
                        <span className="font-medium">{formatCurrency(calculationBreakdown.summary.taxable_income)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 text-lg font-semibold">Net Pay:</span>
                        <span className="font-bold text-blue-600 text-lg">{formatCurrency(calculationBreakdown.summary.net_pay)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audit Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Creation Info</h4>
              <div className="space-y-1 text-sm">
                <div>Created: {new Date(payroll?.created_at).toLocaleString()}</div>
                <div>Created by: {payroll?.creator?.name}</div>
                {payroll?.has_adjustments && (
                  <div className="text-orange-600 font-medium">⚠ Has manual adjustments</div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Approval Info</h4>
              <div className="space-y-1 text-sm">
                {payroll?.approved_at && (
                  <>
                    <div>Approved: {new Date(payroll.approved_at).toLocaleString()}</div>
                    <div>Approved by: {payroll?.approver?.name}</div>
                    {payroll?.approval_remarks && (
                      <div className="text-gray-600">Remarks: {payroll.approval_remarks}</div>
                    )}
                  </>
                )}
                {payroll?.finalized_at && (
                  <>
                    <div>Finalized: {new Date(payroll.finalized_at).toLocaleString()}</div>
                    <div>Finalized by: {payroll?.finalizer?.name}</div>
                  </>
                )}
                {payroll?.paid_at && (
                  <>
                    <div>Paid: {new Date(payroll.paid_at).toLocaleString()}</div>
                    <div>Paid by: {payroll?.paid_by?.name}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Final Payroll Component
const FinalPayroll = ({ auth }) => {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filter state
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [periodType, setPeriodType] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departments, setDepartments] = useState([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(25);
  
  // Statistics
  const [statistics, setStatistics] = useState(null);

  // Detail modal state
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Generation modal state
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [availableSummaries, setAvailableSummaries] = useState([]);

  // Load final payrolls
  const loadPayrolls = async () => {
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
      if (approvalStatus) params.append('approval_status', approvalStatus);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await fetch('/final-payrolls?' + params.toString(), {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPayrolls(data.data);
        setTotalPages(data.pagination.last_page);
        setCurrentPage(data.pagination.current_page);
        setStatistics(data.statistics);
        setDepartments(data.departments);
      } else {
        setError('Failed to load final payrolls');
      }
    } catch (err) {
      console.error('Error loading payrolls:', err);
      setError('Error loading final payrolls: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Handle row double-click
  const handleRowDoubleClick = async (payroll) => {
    try {
      const response = await fetch(`/final-payrolls/${payroll.id}`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSelectedPayroll(data.data);
          setShowDetailModal(true);
        }
      }
    } catch (err) {
      console.error('Error loading payroll details:', err);
    }
  };

  // Handle payroll update
  const handlePayrollUpdate = () => {
    loadPayrolls();
  };

  // Handle generation
  const handleGeneration = async () => {
    try {
      const response = await fetch('/final-payrolls/available-summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          year,
          month,
          period_type: periodType || '1st_half',
          department
        })
      });

      const data = await response.json();
      if (data.success) {
        setAvailableSummaries(data.data);
        setShowGenerationModal(true);
      } else {
        setError(data.message || 'Failed to get available summaries');
      }
    } catch (err) {
      console.error('Error getting available summaries:', err);
      setError('Failed to get available summaries');
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
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

  // Load data on component mount and filter changes
  useEffect(() => {
    loadPayrolls();
  }, [year, month, periodType, department, status, approvalStatus, searchTerm, currentPage]);

  return (
    <AuthenticatedLayout user={auth.user}>
      <Head title="Final Payroll" />
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar />
        <div className="flex-1 p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Final Payroll
                </h1>
                <p className="text-sm text-blue-600 mt-1">
                  💡 Tip: Double-click any row to view detailed payroll information
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleGeneration}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <PlusCircle className="h-4 w-4 mr-1" />
                  Generate
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
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    >
                      <option value="">All Departments</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">All Status</option>
                      <option value="draft">Draft</option>
                      <option value="finalized">Finalized</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Approval</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={approvalStatus}
                      onChange={(e) => setApprovalStatus(e.target.value)}
                    >
                      <option value="">All Approval Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
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
                        <p className="text-sm font-medium text-gray-600">Total Employees</p>
                        <p className="text-2xl font-bold text-gray-900">{statistics.total_employees || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <DollarSign className="h-8 w-8 text-green-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Net Pay</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(statistics.total_net_pay)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <TrendingUp className="h-8 w-8 text-orange-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Gross</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(statistics.total_gross_earnings)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <AlertCircle className="h-8 w-8 text-red-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Deductions</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(statistics.total_deductions)}</p>
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
              ) : payrolls.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No final payrolls found</h3>
                  <p className="text-gray-500">Try adjusting your filters or generate payrolls from posted summaries.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Basic Pay</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gross</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deductions</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Pay</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {payrolls.map((payroll) => (
                        <tr 
                          key={payroll.id} 
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                          onDoubleClick={() => handleRowDoubleClick(payroll)}
                          title="Double-click to view detailed payroll breakdown"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {payroll.employee_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {payroll.employee_no}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>
                              <div>{payroll.department}</div>
                              <div className="text-xs text-gray-400">{payroll.line}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {payroll.full_period}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {formatCurrency(payroll.basic_pay)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {formatCurrency(payroll.overtime_pay)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {formatCurrency(payroll.gross_earnings)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                            {formatCurrency(payroll.total_deductions)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                            <span className="text-lg text-blue-600">
                              {formatCurrency(payroll.net_pay)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              payroll.status === 'paid' 
                                ? 'bg-green-100 text-green-800'
                                : payroll.status === 'finalized'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {payroll.status === 'paid' && <CreditCard className="h-3 w-3 mr-1" />}
                              {payroll.status === 'finalized' && <CheckCircle className="h-3 w-3 mr-1" />}
                              {payroll.status === 'draft' && <Clock className="h-3 w-3 mr-1" />}
                              {payroll.status.charAt(0).toUpperCase() + payroll.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              payroll.approval_status === 'approved' 
                                ? 'bg-green-100 text-green-800'
                                : payroll.approval_status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {payroll.approval_status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                              {payroll.approval_status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                              {payroll.approval_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                              {payroll.approval_status.charAt(0).toUpperCase() + payroll.approval_status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRowDoubleClick(payroll);
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {payroll.has_adjustments && (
                                <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-orange-100 text-orange-800" title="Has manual adjustments">
                                  <Settings className="h-3 w-3" />
                                </span>
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
      <FinalPayrollDetailModal
        isOpen={showDetailModal}
        payroll={selectedPayroll}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedPayroll(null);
        }}
        onUpdate={handlePayrollUpdate}
      />
    </AuthenticatedLayout>
  );
};

export default FinalPayroll;