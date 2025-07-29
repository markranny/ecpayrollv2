<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Check if final_payrolls table exists, if not create it
        if (!Schema::hasTable('final_payrolls')) {
            Schema::create('final_payrolls', function (Blueprint $table) {
                $table->id();
                
                // Employee Information
                $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
                $table->string('employee_no')->index();
                $table->string('employee_name');
                $table->string('cost_center')->nullable();
                $table->string('department')->nullable();
                $table->string('line')->nullable();
                $table->string('job_title')->nullable();
                $table->string('rank_file')->nullable();
                
                // Payroll period information
                $table->date('period_start');
                $table->date('period_end');
                $table->enum('period_type', ['1st_half', '2nd_half']); // 1-15 or 16-30/31
                $table->integer('year');
                $table->integer('month');
                
                // Basic Salary Information
                $table->string('pay_type')->nullable(); // hourly, daily, monthly
                $table->decimal('basic_rate', 10, 2)->default(0)->comment('Basic hourly/daily/monthly rate');
                $table->decimal('pay_allowance', 10, 2)->default(0)->comment('Regular allowance');
                $table->boolean('is_taxable')->default(true);
                
                // === ATTENDANCE SUMMARY ===
                $table->decimal('days_worked', 5, 2)->default(0)->comment('Total days worked');
                $table->decimal('hours_worked', 8, 2)->default(0)->comment('Total hours worked');
                $table->decimal('late_under_minutes', 8, 2)->default(0)->comment('Total late/undertime in minutes');
                $table->decimal('late_under_hours', 8, 2)->default(0)->comment('Total late/undertime in hours');
                
                // === OVERTIME AND PREMIUMS ===
                $table->decimal('ot_regular_hours', 8, 2)->default(0)->comment('Regular overtime hours (1.25x)');
                $table->decimal('ot_regular_amount', 10, 2)->default(0)->comment('Regular overtime amount');
                $table->decimal('ot_rest_day_hours', 8, 2)->default(0)->comment('Rest day hours (1.30x)');
                $table->decimal('ot_rest_day_amount', 10, 2)->default(0)->comment('Rest day amount');
                $table->decimal('ot_special_holiday_hours', 8, 2)->default(0)->comment('Special holiday OT hours');
                $table->decimal('ot_special_holiday_amount', 10, 2)->default(0)->comment('Special holiday OT amount');
                $table->decimal('ot_regular_holiday_hours', 8, 2)->default(0)->comment('Regular holiday OT hours');
                $table->decimal('ot_regular_holiday_amount', 10, 2)->default(0)->comment('Regular holiday OT amount');
                
                // === SPECIAL HOURS ===
                $table->decimal('nsd_hours', 8, 2)->default(0)->comment('Night shift differential hours');
                $table->decimal('nsd_amount', 10, 2)->default(0)->comment('Night shift differential amount');
                $table->decimal('holiday_hours', 8, 2)->default(0)->comment('Holiday hours worked');
                $table->decimal('holiday_amount', 10, 2)->default(0)->comment('Holiday premium amount');
                $table->decimal('travel_order_hours', 8, 2)->default(0)->comment('Travel order hours');
                $table->decimal('travel_order_amount', 10, 2)->default(0)->comment('Travel order amount');
                
                // === LEAVE AND ABSENCES ===
                $table->decimal('slvl_days', 5, 2)->default(0)->comment('Sick/vacation leave days');
                $table->decimal('slvl_amount', 10, 2)->default(0)->comment('SLVL amount');
                $table->decimal('absence_days', 5, 2)->default(0)->comment('Absence days (unpaid)');
                $table->decimal('absence_deduction', 10, 2)->default(0)->comment('Absence deduction amount');
                $table->decimal('late_under_deduction', 10, 2)->default(0)->comment('Late/undertime deduction');
                
                // === ADDITIONAL EARNINGS ===
                $table->decimal('retro_amount', 10, 2)->default(0)->comment('Retroactive pay');
                $table->decimal('offset_hours', 8, 2)->default(0)->comment('Offset hours used');
                $table->decimal('offset_amount', 10, 2)->default(0)->comment('Offset amount');
                $table->decimal('trip_count', 8, 2)->default(0)->comment('Trip count');
                $table->decimal('trip_amount', 10, 2)->default(0)->comment('Trip allowance amount');
                $table->decimal('other_earnings', 10, 2)->default(0)->comment('Other earnings');
                
                // === GROSS PAY CALCULATION ===
                $table->decimal('basic_pay', 10, 2)->default(0)->comment('Basic salary for period');
                $table->decimal('overtime_pay', 10, 2)->default(0)->comment('Total overtime pay');
                $table->decimal('premium_pay', 10, 2)->default(0)->comment('Total premium pay (NSD, holiday, etc.)');
                $table->decimal('allowances', 10, 2)->default(0)->comment('Total allowances');
                $table->decimal('gross_earnings', 10, 2)->default(0)->comment('Total gross earnings');
                
                // === GOVERNMENT DEDUCTIONS ===
                $table->decimal('sss_contribution', 10, 2)->default(0)->comment('SSS employee contribution');
                $table->decimal('philhealth_contribution', 10, 2)->default(0)->comment('PhilHealth contribution');
                $table->decimal('hdmf_contribution', 10, 2)->default(0)->comment('HDMF/Pag-IBIG contribution');
                $table->decimal('withholding_tax', 10, 2)->default(0)->comment('Withholding tax');
                
                // === COMPANY BENEFITS/DEDUCTIONS ===
                $table->decimal('mf_shares', 10, 2)->default(0)->comment('MF shares deduction');
                $table->decimal('mf_loan', 10, 2)->default(0)->comment('MF loan deduction');
                $table->decimal('sss_loan', 10, 2)->default(0)->comment('SSS loan deduction');
                $table->decimal('hdmf_loan', 10, 2)->default(0)->comment('HDMF loan deduction');
                
                // === OTHER DEDUCTIONS ===
                $table->decimal('advance_deduction', 10, 2)->default(0)->comment('Cash advance deduction');
                $table->decimal('charge_store', 10, 2)->default(0)->comment('Store charge deduction');
                $table->decimal('charge_deduction', 10, 2)->default(0)->comment('General charge deduction');
                $table->decimal('meals_deduction', 10, 2)->default(0)->comment('Meals deduction');
                $table->decimal('miscellaneous_deduction', 10, 2)->default(0)->comment('Miscellaneous deduction');
                $table->decimal('other_deductions', 10, 2)->default(0)->comment('Other deductions');
                
                // === SUMMARY CALCULATIONS ===
                $table->decimal('total_government_deductions', 10, 2)->default(0)->comment('Total government deductions');
                $table->decimal('total_company_deductions', 10, 2)->default(0)->comment('Total company deductions');
                $table->decimal('total_other_deductions', 10, 2)->default(0)->comment('Total other deductions');
                $table->decimal('total_deductions', 10, 2)->default(0)->comment('Total all deductions');
                $table->decimal('taxable_income', 10, 2)->default(0)->comment('Taxable income');
                $table->decimal('net_pay', 10, 2)->default(0)->comment('Final net pay');
                
                // === FLAGS AND STATUS ===
                $table->boolean('has_ct')->default(false)->comment('Has compensatory time');
                $table->boolean('has_cs')->default(false)->comment('Has compressed schedule');
                $table->boolean('has_ob')->default(false)->comment('Has official business');
                $table->boolean('has_adjustments')->default(false)->comment('Has manual adjustments');
                
                // === AUDIT AND STATUS ===
                $table->enum('status', ['draft', 'finalized', 'paid', 'cancelled'])->default('draft');
                $table->enum('approval_status', ['pending', 'approved', 'rejected'])->default('pending');
                $table->foreignId('created_by')->constrained('users');
                $table->foreignId('approved_by')->nullable()->constrained('users');
                $table->timestamp('approved_at')->nullable();
                $table->foreignId('finalized_by')->nullable()->constrained('users');
                $table->timestamp('finalized_at')->nullable();
                $table->foreignId('paid_by')->nullable()->constrained('users');
                $table->timestamp('paid_at')->nullable();
                
                // === REFERENCES ===
                $table->foreignId('payroll_summary_id')->nullable()->constrained('payroll_summaries')->comment('Source payroll summary');
                $table->foreignId('benefit_id')->nullable()->constrained('benefits')->comment('Source benefit record');
                $table->foreignId('deduction_id')->nullable()->constrained('deductions')->comment('Source deduction record');
                
                // === NOTES AND REMARKS ===
                $table->text('calculation_notes')->nullable()->comment('Calculation notes and adjustments');
                $table->text('approval_remarks')->nullable();
                $table->json('calculation_breakdown')->nullable()->comment('Detailed calculation breakdown in JSON');
                
                $table->timestamps();
                
                // Indexes for better performance
                $table->index(['employee_id', 'year', 'month', 'period_type'], 'idx_final_payroll_employee_period');
                $table->index(['year', 'month', 'period_type'], 'idx_final_payroll_period');
                $table->index(['status'], 'idx_final_payroll_status');
                $table->index(['approval_status'], 'idx_final_payroll_approval_status');
                $table->index(['department'], 'idx_final_payroll_department');
                $table->index(['created_at'], 'idx_final_payroll_created_at');
                $table->index(['finalized_at'], 'idx_final_payroll_finalized_at');
                $table->index(['paid_at'], 'idx_final_payroll_paid_at');
                $table->index(['payroll_summary_id'], 'idx_final_payroll_summary_ref');
                
                // Unique constraint to prevent duplicate final payrolls
                $table->unique(['employee_id', 'year', 'month', 'period_type'], 'unique_final_payroll_employee_period');
            });
        } else {
            // If table exists, add any missing columns
            Schema::table('final_payrolls', function (Blueprint $table) {
                // Add payroll_summary_id reference if it doesn't exist
                if (!Schema::hasColumn('final_payrolls', 'payroll_summary_id')) {
                    $table->foreignId('payroll_summary_id')->nullable()->constrained('payroll_summaries')->comment('Source payroll summary');
                }
                
                // Add benefit_id reference if it doesn't exist
                if (!Schema::hasColumn('final_payrolls', 'benefit_id')) {
                    $table->foreignId('benefit_id')->nullable()->constrained('benefits')->comment('Source benefit record');
                }
                
                // Add deduction_id reference if it doesn't exist
                if (!Schema::hasColumn('final_payrolls', 'deduction_id')) {
                    $table->foreignId('deduction_id')->nullable()->constrained('deductions')->comment('Source deduction record');
                }
                
                // Add calculation_breakdown if it doesn't exist
                if (!Schema::hasColumn('final_payrolls', 'calculation_breakdown')) {
                    $table->json('calculation_breakdown')->nullable()->comment('Detailed calculation breakdown in JSON');
                }
                
                // Add has_adjustments if it doesn't exist
                if (!Schema::hasColumn('final_payrolls', 'has_adjustments')) {
                    $table->boolean('has_adjustments')->default(false)->comment('Has manual adjustments');
                }
                
                // Note: Index creation in table modification is handled automatically by Laravel
                // when using the index() method in the constraints above
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('final_payrolls');
    }
};