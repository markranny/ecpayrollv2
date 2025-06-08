<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('travel_orders', function (Blueprint $table) {
            // Add only the columns that don't exist
            $columns = Schema::getColumnListing('travel_orders');
            
            if (!in_array('departure_time', $columns)) {
                $table->time('departure_time')->nullable();
            }
            if (!in_array('return_time', $columns)) {
                $table->time('return_time')->nullable();
            }
            if (!in_array('return_to_office', $columns)) {
                $table->boolean('return_to_office')->default(false);
            }
            if (!in_array('office_return_time', $columns)) {
                $table->time('office_return_time')->nullable();
            }
            if (!in_array('working_days', $columns)) {
                $table->integer('working_days')->default(0);
            }
            if (!in_array('is_full_day', $columns)) {
                $table->boolean('is_full_day')->default(true);
            }
            if (!in_array('created_by', $columns)) {
                $table->foreignId('created_by')->nullable()->constrained('users');
            }
        });
    }

    public function down(): void
    {
        Schema::table('travel_orders', function (Blueprint $table) {
            $columns = Schema::getColumnListing('travel_orders');
            
            if (in_array('departure_time', $columns)) {
                $table->dropColumn('departure_time');
            }
            if (in_array('return_time', $columns)) {
                $table->dropColumn('return_time');
            }
            if (in_array('return_to_office', $columns)) {
                $table->dropColumn('return_to_office');
            }
            if (in_array('office_return_time', $columns)) {
                $table->dropColumn('office_return_time');
            }
            if (in_array('working_days', $columns)) {
                $table->dropColumn('working_days');
            }
            if (in_array('is_full_day', $columns)) {
                $table->dropColumn('is_full_day');
            }
            if (in_array('created_by', $columns)) {
                $table->dropColumn('created_by');
            }
        });
    }
};