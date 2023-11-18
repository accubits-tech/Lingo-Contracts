const { ethers } = require('hardhat');

const BN = ethers.BigNumber.from;

module.exports = (amount, duration) => {
  let amountBN = BN(amount);
  let durationBN = BN(duration);
  
  return amountBN.mul(durationBN).div(BN(3600));
}
