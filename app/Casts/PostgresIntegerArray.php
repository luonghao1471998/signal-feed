<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Cột PostgreSQL INTEGER[] — không dùng cast "array" (JSON) của Eloquent.
 *
 * @implements CastsAttributes<array<int>, array<int>|list<int>>
 */
class PostgresIntegerArray implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null || $value === '' || $value === '{}') {
            return [];
        }

        if (is_array($value)) {
            return array_map('intval', $value);
        }

        if (is_string($value)) {
            $trim = trim($value, '{}');
            if ($trim === '') {
                return [];
            }

            return array_map('intval', explode(',', $trim));
        }

        return [];
    }

    /**
     * @param  array<int>|list<int>  $value
     * @return array<string, string>
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): array
    {
        if (! is_array($value) || $value === []) {
            return [$key => '{}'];
        }

        $ints = array_map('intval', $value);

        return [$key => '{'.implode(',', $ints).'}'];
    }
}
