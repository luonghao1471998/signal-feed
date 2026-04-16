<!DOCTYPE html>
<html lang="{{ $user->locale ?? 'en' }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SignalFeed Digest — {{ $date->format('M j, Y') }}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #18181b;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
        <td align="center" style="padding: 24px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                <tr>
                    <td style="padding: 24px 32px; border-bottom: 1px solid #e4e4e7;">
                        <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #18181b;">SignalFeed</h1>
                        <p style="margin: 4px 0 0; font-size: 14px; color: #71717a;">{{ $date->format('l, F j, Y') }}</p>
                    </td>
                </tr>

                <tr>
                    <td style="padding: 24px 32px 8px;">
                        <p style="margin: 0; font-size: 16px; color: #18181b;">
                            Hi {{ $user->display_name ?: ('@' . $user->x_username) }},
                        </p>
                        <p style="margin: 8px 0 0; font-size: 14px; color: #52525b; line-height: 1.6;">
                            @if ($user->plan !== 'free')
                                Here are today's top signals from your sources:
                            @else
                                Here are today's top signals:
                            @endif
                        </p>
                    </td>
                </tr>

                @foreach ($signals as $signal)
                    <tr>
                        <td style="padding: 16px 32px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid #e4e4e7; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <div style="font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                                            {{ (int) ($signal->source_count ?? 0) }} source{{ ((int) ($signal->source_count ?? 0)) > 1 ? 's' : '' }} · rank {{ number_format((float) ($signal->rank_score ?? 0), 2) }}
                                        </div>
                                        <h2 style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #18181b; line-height: 1.4;">
                                            {{ $signal->title }}
                                        </h2>
                                        <p style="margin: 0 0 12px; font-size: 14px; color: #52525b; line-height: 1.6;">
                                            {{ \Illuminate\Support\Str::limit((string) $signal->summary, 200) }}
                                        </p>
                                        <a href="{{ $appUrl }}/digest?signal_id={{ $signal->id }}"
                                           style="display: inline-block; font-size: 13px; color: #2563eb; text-decoration: none; font-weight: 500;">
                                            Read full signal →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                @endforeach

                <tr>
                    <td align="center" style="padding: 24px 32px 32px;">
                        <a href="{{ $appUrl }}/digest"
                           style="display: inline-block; padding: 12px 24px; background-color: #18181b; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
                            View full digest
                        </a>
                    </td>
                </tr>

                <tr>
                    <td style="padding: 16px 32px; border-top: 1px solid #e4e4e7; text-align: center;">
                        <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                            You're receiving this because you signed up for SignalFeed.<br>
                            To manage delivery preferences, visit your <a href="{{ $appUrl }}/settings" style="color: #71717a;">settings</a>.
                        </p>
                        <p style="margin: 12px 0 0; font-size: 11px; color: #d4d4d8;">
                            © {{ now()->year }} SignalFeed
                        </p>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
