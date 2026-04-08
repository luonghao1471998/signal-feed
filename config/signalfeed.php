<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Signal classification threshold
    |--------------------------------------------------------------------------
    |
    | Tweets with signal_score >= this value are treated as signals (is_signal = true).
    | Applied after LLM returns signal_score (single source of truth vs raw model flag).
    |
    */
    'signal_threshold' => (float) env('SIGNAL_THRESHOLD', 0.6),

    /*
    |--------------------------------------------------------------------------
    | Classify batch safety limit (per pipeline run)
    |--------------------------------------------------------------------------
    */
    'classify_batch_size' => (int) env('CLASSIFY_BATCH_SIZE', 200),

    /*
    |--------------------------------------------------------------------------
    | Classify lookback window (hours)
    |--------------------------------------------------------------------------
    |
    | Only tweets with created_at within this window are considered.
    | Set to 0 to disable the lookback filter (all unclassified rows).
    |
    */
    'classify_lookback_hours' => (int) env('CLASSIFY_LOOKBACK_HOURS', 24),

    /*
    |--------------------------------------------------------------------------
    | Per-category thresholds (Phase 2 placeholder)
    |--------------------------------------------------------------------------
    */
    'category_thresholds' => [],
];
