<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;

class DigestDeliveryGateService
{
    public function shouldDeliverToUser(User $user, Carbon $date): bool
    {
        $plan = (string) $user->plan;

        if (in_array($plan, ['pro', 'power'], true)) {
            return true;
        }

        if ($plan !== 'free') {
            return false;
        }

        $utcDate = $date->copy()->utc();

        return $utcDate->isMonday() || $utcDate->isWednesday() || $utcDate->isFriday();
    }
}
