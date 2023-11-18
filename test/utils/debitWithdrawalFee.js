const { ethers } = require('hardhat');
const debitFee = require('./debitFee');
const BN = ethers.BigNumber.from;

module.exports = async (token, contract, amount) => {
  const feePercentage = await contract.getWithdrawalFee();
  const amountAfterDebitingTxnFee = await debitFee(token, amount);
  return amountAfterDebitingTxnFee.sub(
    amountAfterDebitingTxnFee.mul(feePercentage).div(BN(10000))
  );
};
