const { ethers } = require('hardhat');

const BN = ethers.BigNumber.from;

module.exports = async (contract, initialUserState, amount, currentTime, operation) => {
  let totalCredits = BN(initialUserState.forecastedCredits);
  const contractState = await contract.getContractState();

  if (operation) {
    if (!totalCredits.isZero()) {
      totalCredits = totalCredits.sub(
        BN(initialUserState.balance).mul(BN(contractState.endTime).sub(currentTime))
      );
    }
    totalCredits = totalCredits.add(
      BN(initialUserState.balance).add(amount).mul(BN(contractState.endTime).sub(currentTime))
    );
  } else {
    if (!totalCredits.isZero()) {
      totalCredits = totalCredits.sub(
        BN(initialUserState.balance).mul(BN(contractState.endTime).sub(currentTime))
      );
    }
    totalCredits = totalCredits.add(
      BN(initialUserState.balance).sub(amount).mul(BN(contractState.endTime).sub(currentTime))
    );
  }

  return totalCredits;
};
