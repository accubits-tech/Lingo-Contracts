const { ethers } = require('hardhat');

const BN = ethers.BigNumber.from;

module.exports =  (userCredits, totalCredits, distributionAmount) => {
  let userCreditsBN = BN(userCredits);
  let totalCreditsBN = BN(totalCredits);
  let distributionAmountBN = BN(distributionAmount);

  return (userCreditsBN.mul(distributionAmountBN)).div(totalCreditsBN);;
};
