<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Check if travel_orders table exists
        if (!Schema::hasTable('travel_orders')) {
            // Create the complete travel_orders table
            Schema::create('travel_orders', function (Blueprint $table) {
                $table->id();
                $table->foreignId('employee_id')->constrained()->onDelete('cascade');
                $table->date('start_date');
                $table->date('end_date');
                $table->datetime('departure_time')->nullable();
                $table->datetime('return_time')->nullable();
                $table->string('destination');
                $table->string('transportation_type')->nullable();
                $table->text('purpose');
                $table->boolean('accommodation_required')->default(false);
                $table->boolean('meal_allowance')->default(false);
                $table->text('other_expenses')->nullable();
                $table->decimal('estimated_cost', 10, 2)->nullable();
                $table->boolean('return_to_office')->default(false);
                $table->datetime('office_return_time')->nullable();
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
                
                // Add indexes for better performance
                $table->index(['employee_id', 'status']);
                $table->index(['start_date', 'end_date']);
                $table->index('status');
            });
        } else {
            // Add missing columns to existing table
            Schema::table('travel_orders', function (Blueprint $table) {
                $columns = Schema::getColumnListing('travel_orders');
                
                // Change departure_time and return_time to datetime if they're time
                if (in_array('departure_time', $columns)) {
                    $table->datetime('departure_time')->nullable()->change();
                } else {
                    $table->datetime('departure_time')->nullable()->after('end_date');
                }
                
                if (in_array('return_time', $columns)) {
                    $table->datetime('return_time')->nullable()->change();
                } else {
                    $table->datetime('return_time')->nullable()->after('departure_time');
                }
                
                // Change office_return_time to datetime if it's time
                if (in_array('office_return_time', $columns)) {
                    $table->datetime('office_return_time')->nullable()->change();
                } else {
                    $table->datetime('office_return_time')->nullable()->after('return_to_office');
                }
                
                // Add missing columns
                if (!in_array('return_to_office', $columns)) {
                    $table->boolean('return_to_office')->default(false)->after('estimated_cost');
                }
                
                if (!in_array('working_days', $columns)) {
                    $table->integer('working_days')->default(0)->after('total_days');
                }
                
                if (!in_array('is_full_day', $columns)) {
                    $table->boolean('is_full_day')->default(true)->after('working_days');
                }
                
                if (!in_array('created_by', $columns)) {
                    $table->foreignId('created_by')->nullable()->constrained('users')->after('status');
                }
                
                // This is the critical missing column
                if (!in_array('document_paths', $columns)) {
                    $table->text('document_paths')->nullable()->after('remarks');
                }
                
                // Remove the 'date' column if it exists (we use start_date instead)
                if (in_array('date', $columns)) {
                    $table->dropColumn('date');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('travel_orders');
    }
};