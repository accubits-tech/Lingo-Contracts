module.exports = async (contract, sender, amount) => {
  await contract.connect(sender).withdraw(amount);
  return;
};
