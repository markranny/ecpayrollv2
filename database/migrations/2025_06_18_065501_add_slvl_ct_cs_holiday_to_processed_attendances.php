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
            // Add SLVL (Sick Leave/Vacation Leave) value
            $table->decimal('slvl', 3, 1)->default(0)->after('travel_order')->comment('Sick Leave/Vacation Leave (0=None, 0.5=Half Day, 1=Full Day)');
            
            // Add CT (Compensatory Time) indicator
            $table->boolean('ct')->default(false)->after('slvl')->comment('Compensatory Time (0=No, 1=Yes)');
            
            // Add CS (Compressed Schedule) indicator
            $table->boolean('cs')->default(false)->after('ct')->comment('Compressed Schedule (0=No, 1=Yes)');
            
            // Add Holiday indicator
            $table->boolean('holiday')->default(false)->after('cs')->comment('Holiday (0=No, 1=Yes)');
            
            // Add OT Regular Holiday hours
            $table->decimal('ot_reg_holiday', 5, 2)->default(0)->after('holiday')->comment('Overtime hours on Regular Holiday');
            
            // Add OT Special Holiday hours
            $table->decimal('ot_special_holiday', 5, 2)->default(0)->after('ot_reg_holiday')->comment('Overtime hours on Special Holiday');
            
            // Add indexes for better query performance
            $table->index(['slvl'], 'idx_processed_slvl');
            $table->index(['ct'], 'idx_processed_ct');
            $table->index(['cs'], 'idx_processed_cs');
            $table->index(['holiday'], 'idx_processed_holiday');
            $table->index(['attendance_date', 'holiday'], 'idx_processed_date_holiday');
            $table->index(['ot_reg_holiday'], 'idx_processed_ot_reg_holiday');
            $table->index(['ot_special_holiday'], 'idx_processed_ot_special_holiday');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('processed_attendances', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex('idx_processed_slvl');
            $table->dropIndex('idx_processed_ct');
            $table->dropIndex('idx_processed_cs');
            $table->dropIndex('idx_processed_holiday');
            $table->dropIndex('idx_processed_date_holiday');
            $table->dropIndex('idx_processed_ot_reg_holiday');
            $table->dropIndex('idx_processed_ot_special_holiday');
            
            // Drop the columns
            $table->dropColumn([
                'slvl',
                'ct',
                'cs',
                'holiday',
                'ot_reg_holiday',
                'ot_special_holiday'
            ]);
        });
    }
};