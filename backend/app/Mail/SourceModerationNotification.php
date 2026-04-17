<?php

namespace App\Mail;

use App\Models\Source;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SourceModerationNotification extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Source $source,
        public string $action,
        public User $submitter
    ) {
        $this->mailer('resend');
    }

    public function build(): self
    {
        $handle = ltrim((string) $this->source->x_handle, '@');
        $subjects = [
            'approve' => "Your source @{$handle} has been approved!",
            'flag_spam' => "Update on your source @{$handle} submission",
            'soft_delete' => "Update on your source @{$handle} submission",
        ];

        return $this->subject($subjects[$this->action] ?? 'Source Update')
            ->view('emails.source-moderation')
            ->with([
                'action' => $this->action,
                'source' => $this->source,
                'submitter' => $this->submitter,
                'frontendUrl' => rtrim((string) env('FRONTEND_URL', config('app.url', 'http://localhost:8000')), '/'),
            ]);
    }
}
