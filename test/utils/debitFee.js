const { ethers } = require('hardhat');
const BN = ethers.BigNumber.from;

module.exports = async (token, amount) => {
  const feePercentage = await token.getTransferFee();
  return amount.sub(amount.mul(feePercentage).div(BN(10000)));
};
