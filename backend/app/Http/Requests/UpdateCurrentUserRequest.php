<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCurrentUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'my_categories' => ['required', 'array', 'min:1', 'max:3'],
            'my_categories.*' => ['integer', 'distinct', Rule::exists('categories', 'id')],
        ];
    }
}
