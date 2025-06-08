<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // First, let's check what columns exist and add missing ones
        if (Schema::hasTable('travel_orders')) {
            Schema::table('travel_orders', function (Blueprint $table) {
                // Check and add missing columns
                if (!Schema::hasColumn('travel_orders', 'departure_time')) {
                    $table->time('departure_time')->nullable()->after('end_date');
                }
                if (!Schema::hasColumn('travel_orders', 'return_time')) {
                    $table->time('return_time')->nullable()->after('departure_time');
                }
                if (!Schema::hasColumn('travel_orders', 'return_to_office')) {
                    $table->boolean('return_to_office')->default(false)->after('estimated_cost');
                }
                if (!Schema::hasColumn('travel_orders', 'office_return_time')) {
                    $table->time('office_return_time')->nullable()->after('return_to_office');
                }
                if (!Schema::hasColumn('travel_orders', 'working_days')) {
                    $table->integer('working_days')->default(0)->after('total_days');
                }
                if (!Schema::hasColumn('travel_orders', 'is_full_day')) {
                    $table->boolean('is_full_day')->default(true)->after('working_days');
                }
                if (!Schema::hasColumn('travel_orders', 'created_by')) {
                    $table->foreignId('created_by')->nullable()->constrained('users')->after('status');
                }
                if (!Schema::hasColumn('travel_orders', 'document_paths')) {
                    $table->text('document_paths')->nullable()->after('remarks');
                }
                
                // Remove the 'date' column if it exists (we use start_date instead)
                if (Schema::hasColumn('travel_orders', 'date')) {
                    $table->dropColumn('date');
                }
            });
        } else {
            // Create the table if it doesn't exist
            Schema::create('travel_orders', function (Blueprint $table) {
                $table->id();
                $table->foreignId('employee_id')->constrained()->onDelete('cascade');
                $table->date('start_date');
                $table->date('end_date');
                $table->time('departure_time')->nullable();
                $table->time('return_time')->nullable();
                $table->string('destination');
                $table->string('transportation_type')->nullable();
                $table->text('purpose');
                $table->boolean('accommodation_required')->default(false);
                $table->boolean('meal_allowance')->default(false);
                $table->text('other_expenses')->nullable();
                $table->decimal('estimated_cost', 10, 2)->nullable();
                $table->boolean('return_to_office')->default(false);
                $table->time('office_return_time')->nullable();
                $table->integer('total_days');
                $table->integer('working_days')->default(0);
                $table->boolean('is_full_day')->default(true);
                $table->string('status')->default('pending');
                $table->foreignId('approved_by')->nullable()->constrained('users');
                $table->datetime('approved_at')->nullable();
                $table->text('remarks')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users');
                $table->text('document_paths')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('travel_orders')) {
            Schema::table('travel_orders', function (Blueprint $table) {
                // Add back the date column if needed
                if (!Schema::hasColumn('travel_orders', 'date')) {
                    $table->date('date')->after('employee_id');
                }
                
                // Drop the columns we added
                $columns = [
                    'departure_time', 'return_time', 'return_to_office', 
                    'office_return_time', 'working_days', 'is_full_day', 
                    'created_by', 'document_paths'
                ];
                
                foreach ($columns as $column) {
                    if (Schema::hasColumn('travel_orders', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};