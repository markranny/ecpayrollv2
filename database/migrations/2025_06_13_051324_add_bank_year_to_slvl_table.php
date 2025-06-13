<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('slvl', function (Blueprint $table) {
            // Add bank_year column after pay_type column
            $table->year('bank_year')->after('pay_type')->nullable()->comment('Year of the leave bank to use');
        });

        // Update existing records to set bank_year based on start_date
        DB::statement('UPDATE slvl SET bank_year = YEAR(start_date) WHERE bank_year IS NULL AND start_date IS NOT NULL');

        // Create indexes for better performance
        Schema::table('slvl', function (Blueprint $table) {
            $table->index('bank_year', 'idx_slvl_bank_year');
            $table->index(['employee_id', 'bank_year'], 'idx_slvl_employee_bank_year');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('slvl', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex('idx_slvl_bank_year');
            $table->dropIndex('idx_slvl_employee_bank_year');
            
            // Drop the column
            $table->dropColumn('bank_year');
        });
    }
};