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
        // Add missing columns to the slvl table
        Schema::table('slvl', function (Blueprint $table) {
            // Add created_by column if it doesn't exist
            if (!Schema::hasColumn('slvl', 'created_by')) {
                $table->foreignId('created_by')->nullable()->constrained('users')->after('status');
            }
            
            // Ensure other missing columns exist
            if (!Schema::hasColumn('slvl', 'dept_manager_id')) {
                $table->foreignId('dept_manager_id')->nullable()->constrained('users')->after('created_by');
            }
            
            if (!Schema::hasColumn('slvl', 'dept_approved_by')) {
                $table->foreignId('dept_approved_by')->nullable()->constrained('users')->after('dept_manager_id');
            }
            
            if (!Schema::hasColumn('slvl', 'dept_approved_at')) {
                $table->datetime('dept_approved_at')->nullable()->after('dept_approved_by');
            }
            
            if (!Schema::hasColumn('slvl', 'dept_remarks')) {
                $table->text('dept_remarks')->nullable()->after('dept_approved_at');
            }
            
            if (!Schema::hasColumn('slvl', 'hrd_approved_by')) {
                $table->foreignId('hrd_approved_by')->nullable()->constrained('users')->after('dept_remarks');
            }
            
            if (!Schema::hasColumn('slvl', 'hrd_approved_at')) {
                $table->datetime('hrd_approved_at')->nullable()->after('hrd_approved_by');
            }
            
            if (!Schema::hasColumn('slvl', 'hrd_remarks')) {
                $table->text('hrd_remarks')->nullable()->after('hrd_approved_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('slvl', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
            
            $table->dropForeign(['dept_manager_id']);
            $table->dropColumn('dept_manager_id');
            
            $table->dropForeign(['dept_approved_by']);
            $table->dropColumn('dept_approved_by');
            
            $table->dropColumn('dept_approved_at');
            $table->dropColumn('dept_remarks');
            
            $table->dropForeign(['hrd_approved_by']);
            $table->dropColumn('hrd_approved_by');
            
            $table->dropColumn('hrd_approved_at');
            $table->dropColumn('hrd_remarks');
        });
    }
};