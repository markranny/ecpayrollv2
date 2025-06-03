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
            $table->enum('status', ['pending', 'approved', 'rejected', 'completed', 'cancelled'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->datetime('approved_at')->nullable();
            $table->text('remarks')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();

            // Add indexes for better performance
            $table->index(['employee_id', 'status']);
            $table->index(['start_date', 'end_date']);
            $table->index('status');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('travel_orders');
    }
};