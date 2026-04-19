{{-- Cùng dữ liệu với emails/digest; HTML tương thích Telegram (parse_mode HTML). --}}
<b>SignalFeed</b>
{{ $date->format('l, F j, Y') }}

@if ($user->plan !== 'free')
Here are today's top signals from your sources:
@else
Here are today's top signals:
@endif

Hi {{ $user->display_name ?: ('@' . $user->x_username) }},

@foreach ($signals as $signal)
────────────
<b>{{ $signal->title }}</b>
{{ (int) ($signal->source_count ?? 0) }} source{{ ((int) ($signal->source_count ?? 0)) > 1 ? 's' : '' }} · rank {{ number_format((float) ($signal->rank_score ?? 0), 2) }}

{{ \Illuminate\Support\Str::limit((string) $signal->summary, 200) }}

<a href="{{ $appUrl }}/digest?signal_id={{ $signal->id }}">Read full signal →</a>

@endforeach

────────────
<a href="{{ $appUrl }}/digest">View full digest</a>

You're receiving this because you signed up for SignalFeed.
Manage delivery: <a href="{{ $appUrl }}/settings">settings</a>.
