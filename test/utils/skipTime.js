const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

module.exports = async (timeInSeconds) => {
  const block = await ethers.provider.getBlock('latest');
  const futureTimestamp = block.timestamp + timeInSeconds; // Unix timestamp in seconds
  await time.increaseTo(futureTimestamp);
  return;
};
