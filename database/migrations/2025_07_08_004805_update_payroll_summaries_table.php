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
        // Drop table if it exists to recreate with correct structure
        Schema::dropIfExists('payroll_summaries');
        
        Schema::create('payroll_summaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
            $table->string('employee_no')->index();
            $table->string('employee_name');
            $table->string('cost_center')->nullable();
            $table->string('department')->nullable();
            $table->string('line')->nullable();
            
            // Payroll period information
            $table->date('period_start');
            $table->date('period_end');
            $table->enum('period_type', ['1st_half', '2nd_half']); // 1-15 or 16-30/31
            $table->integer('year');
            $table->integer('month');
            
            // FIXED: Core summary fields based on processed_attendances
            $table->decimal('days_worked', 5, 2)->default(0)->comment('Total number of days worked (1–15 / 16–30)');
            $table->decimal('ot_hours', 8, 2)->default(0)->comment('Total OT hours (1–15 / 16–30)');
            $table->decimal('off_days', 5, 2)->default(0)->comment('Total rest days (1–15 / 16–30)');
            $table->decimal('late_under_minutes', 8, 2)->default(0)->comment('Total late and undertime minutes (1–15 / 16–30)');
            $table->decimal('nsd_hours', 8, 2)->default(0)->comment('Total night shift differential hours (1–15 / 16–30)');
            $table->decimal('slvl_days', 5, 2)->default(0)->comment('Total SLVL (Sick Leave/Vacation Leave) days (1–15 / 16–30)');
            $table->decimal('retro', 10, 2)->default(0)->comment('Total retro (1–15 / 16–30)');
            
            // Additional summary fields for comprehensive payroll
            $table->decimal('travel_order_hours', 8, 2)->default(0)->comment('Total travel order hours');
            $table->decimal('holiday_hours', 8, 2)->default(0)->comment('Total holiday hours');
            $table->decimal('ot_reg_holiday_hours', 8, 2)->default(0)->comment('Total OT regular holiday hours');
            $table->decimal('ot_special_holiday_hours', 8, 2)->default(0)->comment('Total OT special holiday hours');
            $table->decimal('offset_hours', 8, 2)->default(0)->comment('Total offset hours');
            $table->decimal('trip_count', 8, 2)->default(0)->comment('Total trip count');
            $table->boolean('has_ct')->default(false)->comment('Has compensatory time');
            $table->boolean('has_cs')->default(false)->comment('Has compressed schedule');
            $table->boolean('has_ob')->default(false)->comment('Has official business');
            
            // Status and metadata
            $table->enum('status', ['draft', 'posted', 'locked'])->default('draft');
            $table->foreignId('posted_by')->nullable()->constrained('users');
            $table->timestamp('posted_at')->nullable();
            $table->text('notes')->nullable();
            
            $table->timestamps();
            
            // Indexes for better performance
            $table->index(['employee_id', 'year', 'month', 'period_type'], 'idx_payroll_employee_period');
            $table->index(['year', 'month', 'period_type'], 'idx_payroll_period');
            $table->index(['status'], 'idx_payroll_status');
            $table->index(['posted_at'], 'idx_payroll_posted_at');
            $table->index(['department'], 'idx_payroll_department');
            
            // Unique constraint to prevent duplicate summaries
            $table->unique(['employee_id', 'year', 'month', 'period_type'], 'unique_employee_period');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_summaries');
    }
};