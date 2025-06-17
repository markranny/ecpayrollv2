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
        Schema::table('retros', function (Blueprint $table) {
            // Add new fields for the updated retro system
            $table->decimal('hours_days', 8, 2)->nullable()->after('adjustment_type')->comment('Hours or Days for the retro');
            $table->decimal('multiplier_rate', 5, 2)->nullable()->after('hours_days')->comment('Multiplier rate (e.g., 1.25, 1.5, 2.0)');
            $table->decimal('base_rate', 10, 2)->nullable()->after('multiplier_rate')->comment('Base hourly/daily rate');
            
            // Rename existing fields to be more clear
            $table->renameColumn('original_value', 'original_total_amount');
            $table->renameColumn('requested_value', 'requested_total_amount');
            
            // Add computed amount field
            $table->decimal('computed_amount', 10, 2)->nullable()->after('base_rate')->comment('Computed amount based on hours/days * multiplier * base_rate');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('retros', function (Blueprint $table) {
            $table->dropColumn(['hours_days', 'multiplier_rate', 'base_rate', 'computed_amount']);
            $table->renameColumn('original_total_amount', 'original_value');
            $table->renameColumn('requested_total_amount', 'requested_value');
        });
    }
};