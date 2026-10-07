// Pin the timezone so "local midnight" tests behave the same everywhere (incl. DST).
export default function setup() {
  process.env.TZ = 'America/New_York';
}
