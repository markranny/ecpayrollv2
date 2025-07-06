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
            // Add trip column after ob
            $table->decimal('trip', 5, 2)->default(0)->after('ob')->comment('Number of trips');
            
            // Add index for better query performance
            $table->index(['trip'], 'idx_processed_trip');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('processed_attendances', function (Blueprint $table) {
            // Drop index first
            $table->dropIndex('idx_processed_trip');
            
            // Drop the column
            $table->dropColumn('trip');
        });
    }
};