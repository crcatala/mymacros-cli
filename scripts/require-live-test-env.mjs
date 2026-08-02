const required = ['MYMACROS_TEST_USER', 'MYMACROS_TEST_PASSWORD']
const missing = required.filter((name) => !process.env[name])

if (process.env.MYMACROS_LIVE_TESTS !== '1' || missing.length > 0) {
  console.error('Live tests are opt-in and require a dedicated test account.')
  console.error(`Set MYMACROS_LIVE_TESTS=1 and ${required.join(', ')}.`)
  process.exit(1)
}
