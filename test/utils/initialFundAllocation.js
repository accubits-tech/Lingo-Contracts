const { ethers } = require('hardhat');

module.exports = async (token, amount) => {
  const [owner, user1, user2, user3] = await ethers.getSigners();

  await token.transfer(user1.address, amount);
  await token.transfer(user2.address, amount);
  await token.transfer(user3.address, amount);
};
