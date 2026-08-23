/**
 * MUST be the first import in critical test scripts.
 * Forces a non-production NODE_ENV before game modules capture DEV_FLAGS.enabled.
 *
 * Production builds still block Lab overrides / clock mutations; tests run as development.
 */
if (typeof process !== 'undefined') {
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
    process.env.NODE_ENV = 'development';
  }
}
