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
        Schema::table('processed_attendances', function (Blueprint $table) {
            // Add overtime hours column
            $table->decimal('overtime', 5, 2)->default(0)->after('hours_worked')->comment('Overtime hours worked');
            
            // Add rest day indicator
            $table->boolean('restday')->default(false)->after('overtime')->comment('Whether this is a rest day work');
            
            // Add retro multiplier for salary adjustments
            $table->decimal('retromultiplier', 4, 2)->default(1.00)->after('restday')->comment('Retro multiplier for rate adjustments');
            
            // Add official business indicator
            $table->boolean('ob')->default(false)->after('retromultiplier')->comment('Official Business (0=No, 1=Yes)');
            
            // Add indexes for better query performance
            $table->index(['employee_id', 'attendance_date'], 'idx_processed_emp_date');
            $table->index(['overtime'], 'idx_processed_overtime');
            $table->index(['restday'], 'idx_processed_restday');
            $table->index(['ob'], 'idx_processed_ob');
            $table->index(['attendance_date', 'restday'], 'idx_processed_date_restday');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('processed_attendances', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex('idx_processed_emp_date');
            $table->dropIndex('idx_processed_overtime');
            $table->dropIndex('idx_processed_restday');
            $table->dropIndex('idx_processed_ob');
            $table->dropIndex('idx_processed_date_restday');
            
            // Drop the new columns
            $table->dropColumn(['overtime', 'restday', 'retromultiplier', 'ob']);
        });
    }
};