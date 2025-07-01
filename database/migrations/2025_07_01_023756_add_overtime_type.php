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
        Schema::table('overtimes', function (Blueprint $table) {
            // Add overtime_type column after rate_multiplier
            $table->enum('overtime_type', [
                'regular_weekday',
                'rest_day',
                'scheduled_rest_day', 
                'regular_holiday',
                'special_holiday',
                'emergency_work',
                'extended_shift',
                'weekend_work',
                'night_shift',
                'other'
            ])->after('rate_multiplier')->default('regular_weekday')->comment('Type/category of overtime work');
            
            // Add has_night_differential boolean column
            $table->boolean('has_night_differential')->after('overtime_type')->default(false)->comment('Whether night differential (10PM-6AM) applies');
            
            // Add indexes for better query performance
            $table->index(['overtime_type'], 'idx_overtimes_type');
            $table->index(['overtime_type', 'has_night_differential'], 'idx_overtimes_type_night');
            $table->index(['date', 'overtime_type'], 'idx_overtimes_date_type');
        });

        // Update existing records based on rate_multiplier to set appropriate overtime_type
        $this->updateExistingRecords();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('overtimes', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex('idx_overtimes_type');
            $table->dropIndex('idx_overtimes_type_night');
            $table->dropIndex('idx_overtimes_date_type');
            
            // Drop the columns
            $table->dropColumn(['overtime_type', 'has_night_differential']);
        });
    }

    /**
     * Update existing records based on rate multiplier
     */
    private function updateExistingRecords(): void
    {
        // Map rate multipliers to overtime types
        $rateTypeMapping = [
            // Regular weekday overtime
            1.25 => ['type' => 'regular_weekday', 'night_diff' => false],
            1.375 => ['type' => 'regular_weekday', 'night_diff' => true],
            
            // Rest day / Special day
            1.30 => ['type' => 'rest_day', 'night_diff' => false],
            1.43 => ['type' => 'rest_day', 'night_diff' => true],
            1.69 => ['type' => 'rest_day', 'night_diff' => false], // Rest day overtime
            1.859 => ['type' => 'rest_day', 'night_diff' => true], // Rest day overtime + night diff
            
            // Scheduled rest day
            1.50 => ['type' => 'scheduled_rest_day', 'night_diff' => false],
            1.65 => ['type' => 'scheduled_rest_day', 'night_diff' => true],
            1.95 => ['type' => 'scheduled_rest_day', 'night_diff' => false], // Scheduled rest day overtime
            2.145 => ['type' => 'scheduled_rest_day', 'night_diff' => true], // Scheduled rest day overtime + night diff
            
            // Regular holiday
            2.00 => ['type' => 'regular_holiday', 'night_diff' => false],
            2.20 => ['type' => 'regular_holiday', 'night_diff' => true],
            2.60 => ['type' => 'regular_holiday', 'night_diff' => false], // Regular holiday overtime
            2.86 => ['type' => 'regular_holiday', 'night_diff' => true], // Regular holiday overtime + night diff
        ];

        foreach ($rateTypeMapping as $multiplier => $config) {
            DB::table('overtimes')
                ->where('rate_multiplier', $multiplier)
                ->update([
                    'overtime_type' => $config['type'],
                    'has_night_differential' => $config['night_diff']
                ]);
        }

        // Handle any unmapped rate multipliers - set them as 'other'
        DB::table('overtimes')
            ->whereNotIn('rate_multiplier', array_keys($rateTypeMapping))
            ->update([
                'overtime_type' => 'other',
                'has_night_differential' => false
            ]);
    }
};