# Scheduler Setup Guide

## 1. Setup Log Permissions

Run before first deployment:

```bash
cd /var/www/signalfeed
./scripts/setup-logs.sh
```

## 2. Production Cron Configuration

Add to server crontab (`crontab -e`):

```bash
* * * * * cd /var/www/signalfeed && php artisan schedule:run >> /dev/null 2>&1
```

**Important:**

- Runs every minute; Laravel runs scheduled closure **`pipeline:crawl-classify`** (crawl + classify) only at the four scheduled VN times.
- Ensure cron daemon is running: `systemctl status cron`
- Command output is logged via channels in `config/logging.php`, not cron stdout.

## 3. Verification Commands

```bash
# List scheduled tasks
php artisan schedule:list

# Expected: 0 1,7,13,19 * * *  pipeline:crawl-classify

# Run scheduler manually (executes if time matches)
php artisan schedule:run

# Interactive test of one scheduled command
php artisan schedule:test
```

## 4. Monitor Logs

### Real-time monitoring (during crawl)

```bash
# Watch crawler activity (daily driver = dated filename)
tail -f storage/logs/crawler-$(date +%Y-%m-%d).log

# Watch scheduler (daily driver)
tail -f storage/logs/scheduler-$(date +%Y-%m-%d).log

# Watch errors only
tail -f storage/logs/crawler-errors.log

# Watch all logs (careful: noisy)
tail -f storage/logs/*.log
```

### Search logs

```bash
# Find today's crawl sessions
grep "Crawl Session Started" storage/logs/crawler-$(date +%Y-%m-%d).log

# Show stats from last completed session
grep "Crawl Session Completed" storage/logs/crawler-$(date +%Y-%m-%d).log | tail -1
```

### Log rotation (automatic)

- `scheduler-*.log`: daily, 14 days retention
- `crawler-*.log`: daily, 30 days retention
- `crawler-errors.log`: single file, manual cleanup if needed

## 5. Troubleshooting

### Scheduler not running

```bash
systemctl status cron
crontab -l | grep schedule:run
php artisan schedule:run -v
```

### No logs appearing

```bash
ls -la storage/logs/
./scripts/setup-logs.sh
```

### Crawler errors

```bash
tail -20 storage/logs/crawler-errors.log
```

## 6. Health monitoring script

```bash
chmod +x scripts/check-crawler-health.sh
./scripts/check-crawler-health.sh
```

Optional daily cron (adjust path and mail):

```bash
0 8 * * * /var/www/signalfeed/scripts/check-crawler-health.sh || echo "Crawler health check failed" | mail -s "SignalFeed Alert" admin@example.com
```

## Timezone

Align server, PHP `date.timezone`, and Laravel `config('app.timezone')` with **Asia/Ho_Chi_Minh** where applicable. The scheduled event uses `Asia/Ho_Chi_Minh` explicitly in `routes/console.php`.
