module.exports = async (contract, token, amount) => {
  await token.approve(contract.address, amount);
  await contract.distribute(amount);
  return;
};
