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
        Schema::create('travel_orders', function (Blueprint $table) {
            $table->id();
            
            // Employee Information
            $table->unsignedBigInteger('employee_id');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            
            // Travel Dates and Times
            $table->date('start_date');
            $table->date('end_date');
            $table->dateTime('departure_time')->nullable();
            $table->dateTime('return_time')->nullable();
            $table->dateTime('office_return_time')->nullable();
            
            // Travel Details
            $table->string('destination');
            $table->string('transportation_type', 100);
            $table->text('purpose');
            
            // Travel Calculations
            $table->integer('total_days')->default(0);
            $table->integer('working_days')->default(0);
            $table->boolean('is_full_day')->default(true);
            
            // Expenses and Allowances
            $table->boolean('accommodation_required')->default(false);
            $table->boolean('meal_allowance')->default(false);
            $table->boolean('return_to_office')->default(false);
            $table->text('other_expenses')->nullable();
            $table->decimal('estimated_cost', 10, 2)->nullable();
            
            // Status and Approval
            $table->enum('status', ['pending', 'approved', 'rejected', 'completed', 'cancelled'])->default('pending');
            $table->text('remarks')->nullable();
            
            // Approval Information
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->foreign('approved_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamp('approved_at')->nullable();
            
            // Force Approval (Superadmin)
            $table->boolean('force_approved')->default(false);
            $table->unsignedBigInteger('force_approved_by')->nullable();
            $table->foreign('force_approved_by')->references('id')->on('users')->onDelete('set null');
            $table->timestamp('force_approved_at')->nullable();
            $table->text('force_approve_remarks')->nullable();
            
            // Creation Information
            $table->unsignedBigInteger('created_by');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            
            // Document Attachments
            $table->json('document_paths')->nullable();
            
            // Timestamps
            $table->timestamps();
            
            // Indexes for better performance
            $table->index(['employee_id', 'start_date', 'end_date']);
            $table->index(['status', 'created_at']);
            $table->index('created_by');
            $table->index('approved_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('travel_orders');
    }
};