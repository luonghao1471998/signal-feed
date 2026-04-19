<?php

namespace App\Services;

use App\Models\Signal;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

/**
 * Logic trùng với {@see \App\Jobs\SendDigestEmailJob} — dùng chung cho email và Telegram digest.
 */
class DigestSignalsService
{
    /**
     * @return Collection<int, Signal>
     */
    public function signalsForUserOnDate(User $user, Carbon $date): Collection
    {
        $dateStr = $date->toDateString();
        $isPaid = in_array((string) $user->plan, ['pro', 'power'], true);

        $query = Signal::query()
            ->with('sources');

        if (Schema::hasColumn('signals', 'date')) {
            $query->whereDate('signals.date', $dateStr);
        } else {
            $query->whereHas('digest', static function ($digestQuery) use ($dateStr): void {
                $digestQuery->whereDate('digests.date', $dateStr);
            });
        }

        if ($isPaid) {
            $query->where(function ($q) use ($user): void {
                $q->where('type', 0)
                    ->orWhere(function ($inner) use ($user): void {
                        $inner->where('type', 1)
                            ->where('user_id', $user->id);
                    });
            });
        } else {
            $query->where('type', 0);
        }

        return $query
            ->orderByDesc('rank_score')
            ->limit(10)
            ->get();
    }
}
