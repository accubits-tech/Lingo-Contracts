module.exports = async (contract, token, sender, amount) => {
  await token.connect(sender).approve(contract.address, amount);
  await contract.connect(sender).deposit(amount);
  return;
};
