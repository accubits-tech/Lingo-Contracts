module.exports = {
  NAME: 'LingoTest',
  SYMBOL: 'LINGO_TEST',
  DECIMALS: '18',
  TOTAL_SUPPLY: '1000000000',
  FEE: '500', //5%
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  SLOT: 30 * 24, // 1 month = 30 days = 30 * 24 hours
  ADMIN_CLAIM_PERIOD: 12 * 24 * 30, //1 year = 12 months = 12 * 30 days = 12 * 30 * 24 hours
  ADMIN_CLAIM_PERIOD_TAKE_EFFECT_TIME_WINDOW: 30 * 24 * 3600, // 30 days in seconds
  WITHDRAWAL_FEE: '500', //5%,
};
