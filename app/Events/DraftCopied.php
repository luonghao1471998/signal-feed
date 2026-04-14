<?php

namespace App\Events;

use App\Models\DraftTweet;
use App\Models\Signal;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DraftCopied
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public User $user,
        public Signal $signal,
        public DraftTweet $draft
    ) {
    }
}