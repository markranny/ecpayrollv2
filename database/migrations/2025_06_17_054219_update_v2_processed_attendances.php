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
            // Add travel_order column after overtime
            $table->decimal('travel_order', 5, 2)->default(0)->after('overtime')->comment('Travel order hours');
            
            // Add index for better query performance
            $table->index(['travel_order'], 'idx_processed_travel_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('processed_attendances', function (Blueprint $table) {
            // Drop index first
            $table->dropIndex('idx_processed_travel_order');
            
            // Drop the column
            $table->dropColumn('travel_order');
        });
    }
};