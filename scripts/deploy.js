// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require('hardhat');
require('dotenv').config();

const {
  TOKEN_NAME,
  TOKEN_SYMBOL,
  TOKEN_SUPPLY,
  OWNER,
  TREASURY_WALLET,
  TXN_FEE_PERCENTAGE,
  SLOT,
  ADMIN_CLAIM_PERIOD,
  WITHDRAWAL_FEE_PERCENTAGE,
} = process.env;

async function main() {
  const LingoToken = await ethers.getContractFactory('LINGO');

  console.log('Deploying LINGO Token...');

  const LINGO = await LingoToken.deploy(
    TOKEN_NAME,
    TOKEN_SYMBOL,
    TOKEN_SUPPLY,
    OWNER,
    TREASURY_WALLET,
    TXN_FEE_PERCENTAGE
  );

  console.log('Deployed token contract address:', LINGO.address);

  const Distribution = await ethers.getContractFactory('Distribution');

  console.log('Deploying Distribution Contract...');

  const DISTRIBUTION = await Distribution.deploy(
    OWNER,
    TREASURY_WALLET,
    LINGO.address,
    SLOT,
    ADMIN_CLAIM_PERIOD,
    WITHDRAWAL_FEE_PERCENTAGE
  );

  console.log('Deployed distribution contract address:', DISTRIBUTION.address);

  console.log('Waiting for contract deployment confirmations...');
  await LINGO.deployTransaction.wait(6);
  await DISTRIBUTION.deployTransaction.wait(6);
  console.log('Contract deployment confirmed !!');

  console.log('Verifying Contracts ...');

  await hre.run('verify:verify', {
    address: LINGO.address,
    constructorArguments: [
      TOKEN_NAME,
      TOKEN_SYMBOL,
      TOKEN_SUPPLY,
      OWNER,
      TREASURY_WALLET,
      TXN_FEE_PERCENTAGE,
    ],
  });

  await hre.run('verify:verify', {
    address: DISTRIBUTION.address,
    constructorArguments: [
      OWNER,
      TREASURY_WALLET,
      LINGO.address,
      SLOT,
      ADMIN_CLAIM_PERIOD,
      WITHDRAWAL_FEE_PERCENTAGE,
    ],
  });

  console.log('Contracts verified successfully !!');

  //Note: Please add distribution contract to external whitelist on token contract manually
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
