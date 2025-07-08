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
        Schema::create('deductions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->onDelete('cascade');
            $table->decimal('advance', 10, 2)->default(0)->comment('Advance deduction amount');
            $table->decimal('charge_store', 10, 2)->default(0)->comment('Store charge deduction amount');
            $table->decimal('charge', 10, 2)->default(0)->comment('General charge deduction amount');
            $table->decimal('meals', 10, 2)->default(0)->comment('Meals deduction amount');
            $table->decimal('miscellaneous', 10, 2)->default(0)->comment('Miscellaneous deduction amount');
            $table->decimal('other_deductions', 10, 2)->default(0)->comment('Other deductions amount');
            $table->string('cutoff')->comment('1st or 2nd cutoff');
            $table->date('date')->comment('Deduction date');
            $table->date('date_posted')->nullable()->comment('Date when deduction was posted');
            $table->boolean('is_posted')->default(false)->comment('Whether deduction has been posted');
            $table->boolean('is_default')->default(false)->comment('Whether this is a default deduction template');
            $table->timestamps();
            
            // Indexes for better performance
            $table->index(['employee_id', 'cutoff', 'date'], 'idx_deductions_employee_cutoff_date');
            $table->index(['cutoff', 'date'], 'idx_deductions_cutoff_date');
            $table->index(['is_posted'], 'idx_deductions_posted');
            $table->index(['is_default'], 'idx_deductions_default');
            $table->index(['date_posted'], 'idx_deductions_date_posted');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('deductions');
    }
};