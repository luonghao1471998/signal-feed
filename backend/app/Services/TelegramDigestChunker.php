<?php

namespace App\Services;

/**
 * Chia nội dung digest thành các phần ≤ giới hạn Telegram (4096 ký tự).
 */
class TelegramDigestChunker
{
    private const MAX_LEN = 4000;

    /**
     * @param  list<string>  $parts  HTML từng phần (đã escape)
     * @return list<string>
     */
    public function chunk(array $parts): array
    {
        $chunks = [];
        $current = '';

        foreach ($parts as $part) {
            if ($part === '') {
                continue;
            }

            if (mb_strlen($current.$part) <= self::MAX_LEN) {
                $current .= $part;

                continue;
            }

            if ($current !== '') {
                $chunks[] = $current;
                $current = '';
            }

            if (mb_strlen($part) <= self::MAX_LEN) {
                $current = $part;

                continue;
            }

            foreach (mb_str_split($part, self::MAX_LEN) as $slice) {
                if ($slice !== '') {
                    $chunks[] = $slice;
                }
            }
        }

        if ($current !== '') {
            $chunks[] = $current;
        }

        return $chunks;
    }
}
