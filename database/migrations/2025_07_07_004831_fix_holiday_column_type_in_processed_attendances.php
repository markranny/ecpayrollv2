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
        // First, check if the holiday column exists and its current type
        $columnExists = Schema::hasColumn('processed_attendances', 'holiday');
        
        if ($columnExists) {
            // Get current column information
            $columns = DB::select("SHOW COLUMNS FROM processed_attendances LIKE 'holiday'");
            $currentType = $columns[0]->Type ?? '';
            
            // Log current column type for debugging
            echo "Current holiday column type: " . $currentType . "\n";
            
            // If it's currently a boolean/tinyint, we need to change it
            if (strpos(strtolower($currentType), 'tinyint') !== false || 
                strpos(strtolower($currentType), 'boolean') !== false) {
                
                echo "Converting holiday column from boolean to decimal...\n";
                
                // Step 1: Create a temporary column
                Schema::table('processed_attendances', function (Blueprint $table) {
                    $table->decimal('holiday_temp', 4, 2)->default(0)->after('holiday')
                        ->comment('Temporary holiday rate multiplier column');
                });
                
                // Step 2: Convert existing boolean values to decimal
                // true/1 becomes 2.0 (regular holiday), false/0 becomes 0
                DB::statement("
                    UPDATE processed_attendances 
                    SET holiday_temp = CASE 
                        WHEN holiday = 1 THEN 2.0 
                        ELSE 0 
                    END
                ");
                
                // Step 3: Drop the old boolean column
                Schema::table('processed_attendances', function (Blueprint $table) {
                    $table->dropColumn('holiday');
                });
                
                // Step 4: Rename the temporary column to holiday
                Schema::table('processed_attendances', function (Blueprint $table) {
                    $table->renameColumn('holiday_temp', 'holiday');
                });
                
                echo "Successfully converted holiday column from boolean to decimal\n";
            } else {
                echo "Holiday column is already decimal type\n";
            }
        } else {
            // Column doesn't exist, create it as decimal
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->decimal('holiday', 4, 2)->default(0)->after('cs')
                    ->comment('Holiday rate multiplier (e.g., 2.0 for regular holiday, 1.3 for special holiday)');
            });
            
            echo "Created new holiday column as decimal\n";
        }
        
        // Add index for better query performance
        if (!$this->indexExists('processed_attendances', 'idx_processed_holiday')) {
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->index(['holiday'], 'idx_processed_holiday');
            });
            echo "Added holiday index\n";
        }
        
        // Add index for holiday with date for better filtering
        if (!$this->indexExists('processed_attendances', 'idx_processed_date_holiday')) {
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->index(['attendance_date', 'holiday'], 'idx_processed_date_holiday');
            });
            echo "Added date-holiday compound index\n";
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop indexes first
        if ($this->indexExists('processed_attendances', 'idx_processed_holiday')) {
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->dropIndex('idx_processed_holiday');
            });
        }
        
        if ($this->indexExists('processed_attendances', 'idx_processed_date_holiday')) {
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->dropIndex('idx_processed_date_holiday');
            });
        }
        
        // Convert back to boolean (data loss will occur)
        if (Schema::hasColumn('processed_attendances', 'holiday')) {
            // Create temporary boolean column
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->boolean('holiday_temp')->default(false)->after('holiday');
            });
            
            // Convert decimal values back to boolean
            // Any non-zero value becomes true
            DB::statement("
                UPDATE processed_attendances 
                SET holiday_temp = CASE 
                    WHEN holiday > 0 THEN 1 
                    ELSE 0 
                END
            ");
            
            // Drop decimal column
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->dropColumn('holiday');
            });
            
            // Rename temp column
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->renameColumn('holiday_temp', 'holiday');
            });
        }
    }
    
    /**
     * Check if an index exists on a table
     */
    private function indexExists(string $table, string $indexName): bool
    {
        try {
            $indexes = DB::select("SHOW INDEX FROM {$table} WHERE Key_name = ?", [$indexName]);
            return count($indexes) > 0;
        } catch (\Exception $e) {
            return false;
        }
    }
};