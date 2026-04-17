<?php

namespace App\Events;

use App\Models\Source;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;

class SourceModerated
{
    use Dispatchable;

    public function __construct(
        public Source $source,
        public string $action,
        public ?User $submitter
    ) {
    }
}
