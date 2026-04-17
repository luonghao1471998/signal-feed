<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Source Moderation Update</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fb;font-family:Helvetica,Arial,sans-serif;color:#1f2937;">
    @php
        $handle = '@' . ltrim((string) ($source->x_handle ?? ''), '@');
        $isApprove = $action === 'approve';
        $isSpam = $action === 'flag_spam';
        $ctaUrl = $isApprove ? ($frontendUrl . '/digest') : ($frontendUrl . '/my-kols');
        $ctaLabel = $isApprove ? 'View My Digest' : ($isSpam ? 'View My Sources' : 'Manage My Sources');
    @endphp
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fb;padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                    <tr>
                        <td style="padding:28px 24px 8px;">
                            <h1 style="margin:0;font-size:20px;font-weight:700;color:#111827;">SignalFeed</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 24px 24px;line-height:1.65;font-size:15px;color:#374151;">
                            @if ($isApprove)
                                <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">Good News! 🎉</h2>
                                <p style="margin:0 0 12px;">Your submitted source <strong>{{ $handle }}</strong> has been approved and is now active in our pool.</p>
                                <p style="margin:0 0 20px;">You can now follow this source to start receiving signals in your digest.</p>
                            @elseif ($isSpam)
                                <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">Source Review Update</h2>
                                <p style="margin:0 0 12px;">We've reviewed your submitted source <strong>{{ $handle }}</strong>.</p>
                                <p style="margin:0 0 20px;">Unfortunately, it doesn't meet our quality guidelines at this time.</p>
                            @else
                                <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">Source Submission Update</h2>
                                <p style="margin:0 0 20px;">Your submission <strong>{{ $handle }}</strong> has been removed from our tracking pool.</p>
                            @endif
                            <a href="{{ $ctaUrl }}" style="display:inline-block;padding:12px 24px;border-radius:4px;background:#1DA1F2;color:#ffffff;text-decoration:none;font-weight:600;">
                                {{ $ctaLabel }}
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 24px 24px;">
                            <footer style="margin-top:16px;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;">
                                <p style="margin:0 0 6px;">SignalFeed - Track what matters</p>
                                <p style="margin:0;font-size:12px;">You received this email because you submitted a source for tracking.</p>
                            </footer>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
