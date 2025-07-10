/** @type {import('@million/lint').MillionConfig} */
module.exports = {
  telemetry: false, // Disable telemetry to prevent fetch errors
  enabled: true,
  rsc: true,
  optimize: {
    threshold: 0.05, // Only optimize components that are used at least 5% of the time
  },
};
