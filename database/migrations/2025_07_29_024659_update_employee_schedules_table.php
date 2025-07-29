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
        Schema::create('employee_schedules', function (Blueprint $table) {
            $table->id();
            
            // Employee reference
            $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
            
            // Shift information
            $table->enum('shift_type', ['regular', 'night', 'flexible', 'rotating'])
                  ->comment('Type of work shift');
            
            // Time information
            $table->time('start_time')->comment('Daily shift start time');
            $table->time('end_time')->comment('Daily shift end time');
            $table->time('break_start')->nullable()->comment('Break start time');
            $table->time('break_end')->nullable()->comment('Break end time');
            
            // Work days (stored as JSON array)
            $table->json('work_days')->comment('Array of working days (monday, tuesday, etc.)');
            
            // Schedule period
            $table->date('effective_date')->comment('When this schedule becomes effective');
            $table->date('end_date')->nullable()->comment('When this schedule ends (null = ongoing)');
            
            // Status and metadata
            $table->enum('status', ['active', 'inactive', 'pending'])->default('active')
                  ->comment('Current status of the schedule');
            $table->text('notes')->nullable()->comment('Additional notes or comments');
            
            // Audit fields
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            
            // Indexes for better performance
            $table->index(['employee_id', 'status'], 'idx_employee_schedules_employee_status');
            $table->index(['shift_type', 'status'], 'idx_employee_schedules_shift_status');
            $table->index(['effective_date', 'end_date'], 'idx_employee_schedules_date_range');
            $table->index(['status', 'effective_date'], 'idx_employee_schedules_status_effective');
            $table->index('created_at', 'idx_employee_schedules_created_at');
            
            // Composite index for finding current schedules
            $table->index(['employee_id', 'status', 'effective_date', 'end_date'], 'idx_employee_schedules_current');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_schedules');
    }
};