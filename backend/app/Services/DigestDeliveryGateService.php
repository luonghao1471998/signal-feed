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

        $vnDate = $date->copy()->timezone('Asia/Ho_Chi_Minh');

        return $vnDate->isMonday() || $vnDate->isWednesday() || $vnDate->isFriday();
    }
}
