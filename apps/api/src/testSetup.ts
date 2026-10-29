// Provider modules may be imported by other test files before their own tests load.
process.env.DISCOGS_MIN_REQUEST_INTERVAL_MS = '1'
process.env.DISCOGS_MAX_RETRIES = '1'
process.env.DISCOGS_REQUEST_TIMEOUT_MS = '10'
